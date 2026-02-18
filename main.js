// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const https = require('node:https')
const fs = require('node:fs')

// ── Auto-updater ─────────────────────────────────────────────────────────
const REPO_RAW = 'https://raw.githubusercontent.com/SwashyMark/MonkeyFarm/main'
const UPDATE_FILES = ['renderer.js', 'index.html', 'preload.js']

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

async function checkForUpdates(win) {
  try {
    const remote = JSON.parse(await fetchText(`${REPO_RAW}/package.json`))
    const local = require('./package.json').version
    if (!semverGt(remote.version, local)) return

    console.log(`Update available: ${local} → ${remote.version}`)
    for (const file of UPDATE_FILES) {
      const content = await fetchText(`${REPO_RAW}/${file}`)
      fs.writeFileSync(path.join(__dirname, file), content, 'utf8')
    }

    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: `Monkey Farm ${remote.version} downloaded`,
      detail: `Updated from ${local}. Restart to apply the new version.`,
      buttons: ['Restart Now', 'Later']
    })

    if (response === 0) {
      app.relaunch()
      app.quit()
    }
  } catch (err) {
    console.error('[updater] check failed:', err.message)
  }
}
// ─────────────────────────────────────────────────────────────────────────

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
  createWindow()
  const [win] = BrowserWindow.getAllWindows()
  checkForUpdates(win)

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
