const { app, BrowserWindow } = require('electron')

const APP_URL = process.env.MIGHTY_APP_URL ?? 'http://localhost:5199'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  win.loadURL(APP_URL)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
