import { useState, useEffect, useCallback } from 'react'

type ExportStage =
  | 'idle'
  | 'downloading'
  | 'processing'
  | 'exporting-svg'
  | 'exporting-png'
  | 'exporting-json'
  | 'complete'

interface ExportState {
  stage: ExportStage
  progress: number
}

const STAGE_LABELS: Record<ExportStage, string> = {
  idle: '',
  downloading: 'Downloading canvas...',
  processing: 'Processing pixels...',
  'exporting-svg': 'Generating SVG...',
  'exporting-png': 'Generating PNG...',
  'exporting-json': 'Generating JSON...',
  complete: 'Export complete!'
}

function App(): React.JSX.Element {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 384 })
  const [outputDir, setOutputDir] = useState<string>('')
  const [exportState, setExportState] = useState<ExportState>({ stage: 'idle', progress: 0 })
  const [exportedFiles, setExportedFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const [options, setOptions] = useState({
    svg: false,
    png: true,
    json: false,
    scale: 1
  })

  useEffect(() => {
    window.api.getDefaultOutputDir().then(setOutputDir)

    const unsubscribe = window.api.onExportProgress((data) => {
      setExportState({
        stage: data.stage as ExportStage,
        progress: data.progress
      })
    })

    return unsubscribe
  }, [])

  const handleFetchPreview = useCallback(async () => {
    setError(null)
    setExportState({ stage: 'downloading', progress: 0 })

    const result = await window.api.fetchPreview()

    if (result.success && result.previewBase64) {
      setPreviewUrl(result.previewBase64)
      setCanvasSize({ width: result.width || 960, height: result.height || 384 })
      setExportState({ stage: 'idle', progress: 0 })
    } else {
      setError(result.error || 'Failed to fetch preview')
      setExportState({ stage: 'idle', progress: 0 })
    }
  }, [])

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await window.api.selectOutputDir()
    if (dir) {
      setOutputDir(dir)
    }
  }, [])

  const handleExport = useCallback(async () => {
    if (!options.svg && !options.png && !options.json) {
      setError('Select at least one export format')
      return
    }

    setError(null)
    setExportedFiles([])
    setExportState({ stage: 'downloading', progress: 0 })

    const result = await window.api.exportCanvas({
      ...options,
      outputDir
    })

    if (result.success && result.files) {
      setExportedFiles(result.files)
      if (result.previewBase64) {
        setPreviewUrl(result.previewBase64)
      }
    } else {
      setError(result.error || 'Export failed')
    }

    setExportState({ stage: 'idle', progress: 0 })
  }, [options, outputDir])

  const handleOpenFolder = useCallback(() => {
    window.api.openFolder(outputDir)
  }, [outputDir])

  const isLoading = exportState.stage !== 'idle' && exportState.stage !== 'complete'

  return (
    <div className="app">
      <main className="main">
        <section className="preview-section">
          <div className="section-header">
            <h2>Canvas Preview</h2>
            <button className="btn btn-secondary" onClick={handleFetchPreview} disabled={isLoading}>
              <svg viewBox="0 0 24 24" className="btn-icon">
                <path
                  fill="currentColor"
                  d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                />
              </svg>
              Refresh
            </button>
          </div>

          <div className="preview-container">
            {previewUrl ? (
              <img src={previewUrl} alt="Canvas Preview" className="preview-image" />
            ) : (
              <div className="preview-placeholder">
                <svg viewBox="0 0 24 24" className="placeholder-icon">
                  <path
                    fill="currentColor"
                    d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                  />
                </svg>
                <p>Click "Refresh" to load canvas preview</p>
              </div>
            )}
          </div>

          <div className="canvas-info">
            <span>
              {canvasSize.width} x {canvasSize.height} px
            </span>
          </div>
        </section>

        <section className="settings-section">
          <h2>Export Settings</h2>

          <div className="settings-group">
            <label className="settings-label">Output Formats</label>
            <div className="format-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.svg}
                  onChange={(e) => setOptions({ ...options, svg: e.target.checked })}
                  disabled={isLoading}
                />
                <span className="checkbox-custom"></span>
                <span className="checkbox-text">
                  SVG
                  <small>Vector, best quality</small>
                </span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.png}
                  onChange={(e) => setOptions({ ...options, png: e.target.checked })}
                  disabled={isLoading}
                />
                <span className="checkbox-custom"></span>
                <span className="checkbox-text">
                  PNG
                  <small>Raster, smaller size</small>
                </span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.json}
                  onChange={(e) => setOptions({ ...options, json: e.target.checked })}
                  disabled={isLoading}
                />
                <span className="checkbox-custom"></span>
                <span className="checkbox-text">
                  JSON
                  <small>Raw pixel data</small>
                </span>
              </label>
            </div>
          </div>

          <div className="settings-group">
            <label className="settings-label scale-label">
              Scale
              <div className="info-tooltip">
                <span className="info-icon">i</span>
                <div className="tooltip-content">
                  <p>
                    <strong>PNG:</strong> Recommended scale is 10x or higher.
                  </p>
                  <p>
                    <strong>SVG:</strong> Scale above 1x may cause heavy lag.
                  </p>
                  <p>
                    <strong>JSON:</strong> Scale does not matter.
                  </p>
                </div>
              </div>
            </label>
            <div className="scale-options">
              {[1, 10, 20, 30].map((s) => (
                <button
                  key={s}
                  className={`scale-btn ${options.scale === s ? 'active' : ''}`}
                  onClick={() => setOptions({ ...options, scale: s })}
                  disabled={isLoading}
                >
                  {s}x
                </button>
              ))}
            </div>
            <small className="scale-info">
              Output: {canvasSize.width * options.scale} x {canvasSize.height * options.scale} px
            </small>
          </div>

          <div className="settings-group">
            <label className="settings-label">Output Directory</label>
            <div className="output-dir">
              <input
                type="text"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                className="output-input"
                disabled={isLoading}
              />
              <button
                className="btn btn-secondary"
                onClick={handleSelectOutputDir}
                disabled={isLoading}
              >
                Browse
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="progress-section">
              <div className="progress-label">{STAGE_LABELS[exportState.stage]}</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${exportState.progress}%` }}></div>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {exportedFiles.length > 0 && (
            <div className="success-message">
              <svg viewBox="0 0 24 24" className="success-icon">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <div>
                <strong>Exported {exportedFiles.length} file(s)</strong>
                <button className="link-btn" onClick={handleOpenFolder}>
                  Open folder
                </button>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary export-btn"
            onClick={handleExport}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Exporting...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="btn-icon">
                  <path
                    fill="currentColor"
                    d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"
                  />
                </svg>
                Export Canvas
              </>
            )}
          </button>
        </section>
      </main>

      <footer className="footer">
        <span>Pixel Battle Canvas Exporter</span>
        <span className="separator">|</span>
        <span>by Gidora</span>
      </footer>
    </div>
  )
}

export default App
