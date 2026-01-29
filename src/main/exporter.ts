/**
 * Majestic Pixel Battle Canvas Exporter
 * Core export logic for Electron main process
 */

import { Jimp } from 'jimp'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { app, dialog } from 'electron'

const rgbaToHex = (r: number, g: number, b: number, a: number = 255): number =>
  ((r << 24) | (g << 16) | (b << 8) | a) >>> 0

const hexToRgba = (hex: number): { r: number; g: number; b: number; a: number } => ({
  r: (hex >> 24) & 0xff,
  g: (hex >> 16) & 0xff,
  b: (hex >> 8) & 0xff,
  a: hex & 0xff
})

export const CONFIG = {
  imageUrl: 'https://api.majestic-files.net/pixelBattle/image',
  canvasWidth: 960,
  canvasHeight: 384
}

export const PALETTE = [
  { r: 174, g: 35, b: 61 },
  { r: 236, g: 84, b: 39 },
  { r: 244, g: 171, b: 60 },
  { r: 249, g: 215, b: 89 },
  { r: 72, g: 160, b: 109 },
  { r: 92, g: 200, b: 127 },
  { r: 154, g: 233, b: 108 },
  { r: 49, g: 114, b: 112 },
  { r: 70, g: 156, b: 168 },
  { r: 45, g: 81, b: 158 },
  { r: 77, g: 144, b: 227 },
  { r: 126, g: 230, b: 242 },
  { r: 68, g: 64, b: 186 },
  { r: 102, g: 98, b: 246 },
  { r: 119, g: 43, b: 153 },
  { r: 167, g: 84, b: 186 },
  { r: 235, g: 78, b: 129 },
  { r: 241, g: 158, b: 171 },
  { r: 104, g: 74, b: 52 },
  { r: 149, g: 106, b: 52 },
  { r: 0, g: 0, b: 0 },
  { r: 137, g: 141, b: 144 },
  { r: 213, g: 215, b: 217 },
  { r: 255, g: 255, b: 255 }
]

function findClosestColor(r: number, g: number, b: number): number {
  let minDist = Infinity
  let closestIdx = 0

  for (let i = 0; i < PALETTE.length; i++) {
    const p = PALETTE[i]
    const dist = Math.sqrt(Math.pow(r - p.r, 2) + Math.pow(g - p.g, 2) + Math.pow(b - p.b, 2))
    if (dist < minDist) {
      minDist = dist
      closestIdx = i
    }
  }

  return closestIdx
}

export function downloadImage(
  url: string,
  onProgress?: (downloaded: number) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const location = response.headers.location
          if (location) {
            return downloadImage(location, onProgress).then(resolve).catch(reject)
          }
          return reject(new Error('Redirect without location'))
        }

        const chunks: Buffer[] = []
        let downloaded = 0

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
          downloaded += chunk.length
          onProgress?.(downloaded)
        })

        response.on('end', () => {
          const buffer = Buffer.concat(chunks)
          resolve(buffer)
        })

        response.on('error', reject)
      })
      .on('error', reject)
  })
}

export async function extractPixels(
  imageBuffer: Buffer
): Promise<{ pixels: number[][]; width: number; height: number }> {
  const image = await Jimp.read(imageBuffer)
  const { width, height } = image

  const pixels: number[][] = []

  for (let y = 0; y < height; y++) {
    const row: number[] = []
    for (let x = 0; x < width; x++) {
      const hex = image.getPixelColor(x, y)
      const { r, g, b } = hexToRgba(hex)
      const colorIdx = findClosestColor(r, g, b)
      row.push(colorIdx)
    }
    pixels.push(row)
  }

  return { pixels, width, height }
}

export function generateSVG(pixels: number[][], width: number, height: number, scale = 1): string {
  const svgWidth = width * scale
  const svgHeight = height * scale

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">
`

  const colorGroups: Record<number, { x: number; y: number }[]> = {}

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colorIdx = pixels[y][x]
      if (!colorGroups[colorIdx]) {
        colorGroups[colorIdx] = []
      }
      colorGroups[colorIdx].push({ x, y })
    }
  }

  for (const [colorIdx, points] of Object.entries(colorGroups)) {
    const color = PALETTE[parseInt(colorIdx)]
    const fill = `rgb(${color.r},${color.g},${color.b})`

    svg += `<g fill="${fill}">`
    for (const { x, y } of points) {
      svg += `<rect x="${x}" y="${y}" width="1" height="1"/>`
    }
    svg += `</g>\n`
  }

  svg += `</svg>`

  return svg
}

export async function generatePNG(
  pixels: number[][],
  width: number,
  height: number,
  scale = 1
): Promise<Buffer> {
  const outWidth = width * scale
  const outHeight = height * scale

  const image = new Jimp({ width: outWidth, height: outHeight, color: 0xffffffff })

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colorIdx = pixels[y][x]
      const color = PALETTE[colorIdx]
      const hex = rgbaToHex(color.r, color.g, color.b)

      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          image.setPixelColor(hex, x * scale + sx, y * scale + sy)
        }
      }
    }
  }

  return image.getBuffer('image/png')
}

export function generateJSON(pixels: number[][], width: number, height: number): string {
  return JSON.stringify(
    {
      width,
      height,
      palette: PALETTE.map((c, i) => ({ index: i, rgb: `rgb(${c.r},${c.g},${c.b})` })),
      pixels
    },
    null,
    2
  )
}

export interface ExportOptions {
  svg: boolean
  png: boolean
  json: boolean
  scale: number
  outputDir: string
}

export async function exportCanvas(
  options: ExportOptions,
  onProgress: (stage: string, progress: number) => void
): Promise<{ files: string[]; previewBase64: string }> {
  const files: string[] = []

  onProgress('downloading', 0)
  const imageBuffer = await downloadImage(CONFIG.imageUrl, (downloaded) => {
    onProgress('downloading', Math.min(downloaded / 50000, 1) * 100)
  })
  onProgress('downloading', 100)

  onProgress('processing', 0)
  const { pixels, width, height } = await extractPixels(imageBuffer)
  onProgress('processing', 100)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true })
  }

  if (options.svg) {
    onProgress('exporting-svg', 0)
    const svg = generateSVG(pixels, width, height, options.scale)
    const svgPath = path.join(options.outputDir, `canvas_${timestamp}.svg`)
    fs.writeFileSync(svgPath, svg)
    files.push(svgPath)
    onProgress('exporting-svg', 100)
  }

  if (options.png) {
    onProgress('exporting-png', 0)
    const png = await generatePNG(pixels, width, height, options.scale)
    const pngPath = path.join(options.outputDir, `canvas_${timestamp}.png`)
    fs.writeFileSync(pngPath, png)
    files.push(pngPath)
    onProgress('exporting-png', 100)
  }

  if (options.json) {
    onProgress('exporting-json', 0)
    const json = generateJSON(pixels, width, height)
    const jsonPath = path.join(options.outputDir, `canvas_${timestamp}.json`)
    fs.writeFileSync(jsonPath, json)
    files.push(jsonPath)
    onProgress('exporting-json', 100)
  }

  const previewPng = await generatePNG(pixels, width, height, 1)
  const previewBase64 = `data:image/png;base64,${previewPng.toString('base64')}`

  onProgress('complete', 100)

  return { files, previewBase64 }
}

export async function fetchPreview(
  onProgress: (stage: string, progress: number) => void
): Promise<{ previewBase64: string; width: number; height: number }> {
  onProgress('downloading', 0)
  const imageBuffer = await downloadImage(CONFIG.imageUrl, (downloaded) => {
    onProgress('downloading', Math.min(downloaded / 50000, 1) * 100)
  })
  onProgress('downloading', 100)

  onProgress('processing', 0)
  const { pixels, width, height } = await extractPixels(imageBuffer)
  onProgress('processing', 100)

  const previewPng = await generatePNG(pixels, width, height, 1)
  const previewBase64 = `data:image/png;base64,${previewPng.toString('base64')}`

  return { previewBase64, width, height }
}

export function getDefaultOutputDir(): string {
  return path.join(app.getPath('documents'), 'PixelBattleExports')
}

export async function selectOutputDir(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: getDefaultOutputDir()
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
}
