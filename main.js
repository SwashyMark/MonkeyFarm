// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('node:path')
const https = require('node:https')
const fs = require('node:fs')

// ── Auto-updater ─────────────────────────────────────────────────────────
const REPO_RAW = 'https://raw.githubusercontent.com/SwashyMark/MonkeyFarm/main'
const UPDATE_FILES = ['main.js', 'renderer.js', 'index.html', 'preload.js', 'package.json']
const PENDING_DIR = path.join(__dirname, '_pending_update')

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

// Called at startup: if a pending update was staged, apply it now and relaunch.
function applyPendingUpdate() {
  if (!fs.existsSync(PENDING_DIR)) return false
  try {
    ulog('[updater] Applying pending update...')
    for (const file of fs.readdirSync(PENDING_DIR)) {
      fs.copyFileSync(path.join(PENDING_DIR, file), path.join(__dirname, file))
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
  try {
    const bust = `?t=${Date.now()}`
    const remote = JSON.parse(await fetchText(`${REPO_RAW}/package.json${bust}`))
    const local = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version
    ulog(`[updater] Check: local=${local} remote=${remote.version}`)
    if (!semverGt(remote.version, local)) return

    ulog(`[updater] Update available: ${local} → ${remote.version}`)
    ulog('[updater] Downloading to staging folder...')
    fs.mkdirSync(PENDING_DIR, { recursive: true })
    for (const file of UPDATE_FILES) {
      const content = await fetchText(`${REPO_RAW}/${file}${bust}`)
      fs.writeFileSync(path.join(PENDING_DIR, file), content, 'utf8')
      ulog(`[updater] Staged: ${file}`)
    }

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

ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('get-next-check-time', () => nextCheckTime)

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Apply any update that was staged during the previous session.
  if (applyPendingUpdate()) {
    app.relaunch()
    app.quit()
    return
  }

  ulog(`[updater] App started v${app.getVersion()}`)
  createWindow()
  checkForUpdates()

  setInterval(() => {
    nextCheckTime = Date.now() + UPDATE_INTERVAL_MS
    checkForUpdates()
  }, UPDATE_INTERVAL_MS)
  nextCheckTime = Date.now() + UPDATE_INTERVAL_MS

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
