import { ElectronAPI } from '@electron-toolkit/preload'

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

export interface ExporterAPI {
  getPalette: () => Promise<PaletteColor[]>
  getConfig: () => Promise<CanvasConfig>
  getDefaultOutputDir: () => Promise<string>
  selectOutputDir: () => Promise<string | null>
  fetchPreview: () => Promise<PreviewResult>
  exportCanvas: (options: ExportOptions) => Promise<ExportResult>
  openFolder: (folderPath: string) => Promise<void>
  onExportProgress: (callback: (data: ProgressData) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ExporterAPI
  }
}
