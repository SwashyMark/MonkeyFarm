/**
 * The preload script runs before `index.html` is loaded
 * in the renderer. It has access to web APIs as well as
 * Electron's renderer process modules and some polyfilled
 * Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }

  ipcRenderer.invoke('get-app-version').then(v => replaceText('app-version', v))

  setInterval(async () => {
    const next = await ipcRenderer.invoke('get-next-check-time')
    const secs = Math.max(0, Math.round((next - Date.now()) / 1000))
    const m = Math.floor(secs / 60)
    const s = secs % 60
    replaceText('update-countdown', `${m}:${s.toString().padStart(2, '0')}`)
  }, 1000)
})
