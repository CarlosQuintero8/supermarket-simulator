import * as THREE from 'three'

/**
 * Genera una textura de cartel a partir de un texto.
 * Se usa en los rótulos de las estanterías y de la caja.
 */
export function makeLabelTexture(text: string, bg = '#0f172a', fg = '#e2e8f0'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = fg
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 6
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16)
  ctx.globalAlpha = 1

  ctx.fillStyle = fg
  ctx.font = 'bold 54px system-ui, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let label = text.toUpperCase()
  while (ctx.measureText(label).width > 440 && label.length > 3) {
    label = label.slice(0, -2)
  }
  if (label !== text.toUpperCase()) label += '…'

  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
