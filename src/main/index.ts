import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  exportCanvas,
  fetchPreview,
  getDefaultOutputDir,
  selectOutputDir,
  PALETTE,
  CONFIG
} from './exporter'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 600,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0e0e',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.majestic.pixelbattle-exporter')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('get-palette', () => PALETTE)
  ipcMain.handle('get-config', () => CONFIG)
  ipcMain.handle('get-default-output-dir', () => getDefaultOutputDir())

  ipcMain.handle('select-output-dir', async () => {
    return await selectOutputDir()
  })

  ipcMain.handle('fetch-preview', async (event) => {
    try {
      const result = await fetchPreview((stage, progress) => {
        event.sender.send('export-progress', { stage, progress })
      })
      return { success: true, ...result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('export-canvas', async (event, options) => {
    try {
      const result = await exportCanvas(options, (stage, progress) => {
        event.sender.send('export-progress', { stage, progress })
      })
      return { success: true, ...result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('open-folder', async (_, folderPath: string) => {
    shell.openPath(folderPath)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
