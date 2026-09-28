const { app, BrowserWindow, nativeTheme, shell, ipcMain, Notification } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 430,
    height: 900,
    minWidth: 375,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#faf8f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Open external links in the system browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL('http://localhost:5179')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

ipcMain.handle('notification:send', (_event, { title, body }) => {
  // Packaged/signed builds: native Electron notification (app is registered in macOS Notifications)
  // Dev builds: osascript, since unsigned binaries aren't auto-registered by macOS
  if (app.isPackaged || process.platform !== 'darwin') {
    new Notification({ title, body }).show()
  } else {
    const { execFile } = require('child_process')
    const safe = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    execFile('osascript', ['-e', `display notification "${safe(body)}" with title "${safe(title)}"`])
  }
})

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.setAppUserModelId('com.reflow.mybattery')
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
