// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('node:path')
const https = require('node:https')
const fs = require('node:fs')

// ── Auto-updater ─────────────────────────────────────────────────────────
const REPO_RAW = 'https://raw.githubusercontent.com/SwashyMark/MonkeyFarm/main'
const UPDATE_FILES = ['renderer.js', 'index.html', 'preload.js', 'package.json']

// When packaged as an asar, main.js still runs from inside it — but we can
// point the window at updated files in resources/app/ if they exist there.
const IS_ASAR = app.getAppPath().endsWith('.asar')
const RESOURCES_APP = path.join(process.resourcesPath, 'app')
const PENDING_DIR    = path.join(process.resourcesPath, '_pending_update')

// APP_DIR: where we read/write UI files and check versions.
// If resources/app/index.html exists (a previous update placed it there), use it.
// Otherwise fall back to __dirname (reads transparently from the asar).
const APP_DIR = (IS_ASAR && fs.existsSync(path.join(RESOURCES_APP, 'index.html')))
  ? RESOURCES_APP
  : __dirname

function ulog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  console.log(msg)
  try {
    const logFile = path.join(app.getPath('userData'), 'updater.log')
    fs.appendFileSync(logFile, line, 'utf8')
  } catch (_) {}
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function semverGt(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

// Called at startup: copy staged files into resources/app/ and relaunch.
function applyPendingUpdate() {
  if (!fs.existsSync(PENDING_DIR)) return false
  if (!fs.statSync(PENDING_DIR).isDirectory()) {
    fs.rmSync(PENDING_DIR, { force: true })
    return false
  }
  try {
    ulog('[updater] Applying pending update...')
    fs.mkdirSync(RESOURCES_APP, { recursive: true })
    // If bootstrapping resources/app/ for the first time, seed it with all known
    // app files from the asar so it is a complete, loadable directory.
    const ALL_FILES = ['main.js', 'renderer.js', 'index.html', 'preload.js', 'package.json']
    for (const f of ALL_FILES) {
      const dest = path.join(RESOURCES_APP, f)
      if (!fs.existsSync(dest)) {
        fs.writeFileSync(dest, fs.readFileSync(path.join(__dirname, f), 'utf8'), 'utf8')
        ulog(`[updater] Seeded: ${f}`)
      }
    }
    // Now overwrite with the freshly downloaded files.
    for (const file of fs.readdirSync(PENDING_DIR)) {
      fs.copyFileSync(path.join(PENDING_DIR, file), path.join(RESOURCES_APP, file))
      ulog(`[updater] Applied: ${file}`)
    }
    fs.rmSync(PENDING_DIR, { recursive: true, force: true })
    ulog('[updater] Pending update applied, relaunching...')
    return true
  } catch (err) {
    ulog(`[updater] Failed to apply pending update: ${err.message}`)
    ulog(err.stack)
    return false
  }
}

async function checkForUpdates() {
  if (updateFound) return
  try {
    const bust = `?t=${Date.now()}`
    const remote = JSON.parse(await fetchText(`${REPO_RAW}/package.json${bust}`))
    const pkgPath = path.join(APP_DIR, 'package.json')
    const local = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version
    ulog(`[updater] Check: local=${local} remote=${remote.version} (appDir=${APP_DIR})`)
    if (!semverGt(remote.version, local)) return

    ulog(`[updater] Update available: ${local} → ${remote.version}`)
    ulog('[updater] Downloading to staging folder...')
    if (fs.existsSync(PENDING_DIR) && !fs.statSync(PENDING_DIR).isDirectory()) {
      fs.rmSync(PENDING_DIR, { force: true })
    }
    fs.mkdirSync(PENDING_DIR, { recursive: true })
    for (const file of UPDATE_FILES) {
      const content = await fetchText(`${REPO_RAW}/${file}${bust}`)
      fs.writeFileSync(path.join(PENDING_DIR, file), content, 'utf8')
      ulog(`[updater] Staged: ${file}`)
    }

    updateFound = true
    ulog('[updater] Showing restart dialog...')
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Monkey Farm ${remote.version} downloaded`,
      detail: `Updated from ${local}. Restart to apply the new version.`,
      buttons: ['Restart Now', 'Later']
    })
    ulog(`[updater] Dialog response: ${response}`)

    if (response === 0) {
      app.relaunch()
      app.quit()
    }
  } catch (err) {
    ulog(`[updater] ERROR: ${err.message}`)
    ulog(err.stack)
  }
}
// ──────────────────────────────────────────────────────────────────────────

const UPDATE_INTERVAL_MS = 60 * 1000
let nextCheckTime = Date.now()
let updateFound = false

ipcMain.handle('get-app-version', () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8')).version
  } catch {
    return app.getVersion()
  }
})
ipcMain.handle('get-next-check-time', () => nextCheckTime)

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(APP_DIR, 'preload.js'),
      backgroundThrottling: false
    }
  })

  // Load index.html from APP_DIR — points to resources/app/ when updated,
  // otherwise reads transparently from the asar.
  mainWindow.loadFile(path.join(APP_DIR, 'index.html'))

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
  if (applyPendingUpdate()) {
    app.relaunch()
    app.quit()
    return
  }

  ulog(`[updater] App started v${app.getVersion()} appDir=${APP_DIR}`)
  createWindow()
  checkForUpdates()

  setInterval(() => {
    nextCheckTime = Date.now() + UPDATE_INTERVAL_MS
    checkForUpdates()
  }, UPDATE_INTERVAL_MS)
  nextCheckTime = Date.now() + UPDATE_INTERVAL_MS

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
