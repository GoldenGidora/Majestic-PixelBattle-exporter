import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface ExportOptions {
  svg: boolean
  png: boolean
  json: boolean
  scale: number
  outputDir: string
}

export interface ExportResult {
  success: boolean
  files?: string[]
  previewBase64?: string
  error?: string
}

export interface PreviewResult {
  success: boolean
  previewBase64?: string
  width?: number
  height?: number
  error?: string
}

export interface PaletteColor {
  r: number
  g: number
  b: number
}

export interface CanvasConfig {
  imageUrl: string
  canvasWidth: number
  canvasHeight: number
}

export interface ProgressData {
  stage: string
  progress: number
}

const api = {
  getPalette: (): Promise<PaletteColor[]> => ipcRenderer.invoke('get-palette'),
  getConfig: (): Promise<CanvasConfig> => ipcRenderer.invoke('get-config'),
  getDefaultOutputDir: (): Promise<string> => ipcRenderer.invoke('get-default-output-dir'),
  selectOutputDir: (): Promise<string | null> => ipcRenderer.invoke('select-output-dir'),
  fetchPreview: (): Promise<PreviewResult> => ipcRenderer.invoke('fetch-preview'),
  exportCanvas: (options: ExportOptions): Promise<ExportResult> =>
    ipcRenderer.invoke('export-canvas', options),
  openFolder: (folderPath: string): Promise<void> => ipcRenderer.invoke('open-folder', folderPath),
  onExportProgress: (callback: (data: ProgressData) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ProgressData): void => callback(data)
    ipcRenderer.on('export-progress', handler)
    return () => ipcRenderer.removeListener('export-progress', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
