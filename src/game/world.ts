/**
 * Geometría y distribución de la tienda.
 * Todo el mundo es plano: X hacia la derecha, Z hacia el jugador (+Z = entrada).
 */

export type Vec3 = [number, number, number]

export type Box = { minX: number; maxX: number; minZ: number; maxZ: number }

export const ROOM = {
  minX: -10,
  maxX: 10,
  minZ: -7,
  maxZ: 7,
  height: 3.4,
  wallThickness: 0.3,
}

export const PLAYER_EYE = 1.66
export const PLAYER_RADIUS = 0.34
export const INTERACT_DISTANCE = 2.9

/** Huella de una estantería (ancho x fondo) */
export const SHELF_SIZE = { width: 3.2, depth: 1.0, height: 2.4 }

export type ShelfPlacement = { productId: string; position: Vec3 }

export const SHELVES: ShelfPlacement[] = [
  { productId: 'leche', position: [-6, 0, -5.4] },
  { productId: 'pan', position: [0, 0, -5.4] },
  { productId: 'manzana', position: [6, 0, -5.4] },
  { productId: 'cereal', position: [-6, 0, -0.4] },
  { productId: 'agua', position: [0, 0, -0.4] },
  { productId: 'cafe', position: [6, 0, -0.4] },
]

export const COUNTER = { position: [6.6, 0, 4.6] as Vec3, width: 3.2, depth: 1.3 }
export const PALLET = { position: [-7.6, 0, 4.9] as Vec3, width: 2.4, depth: 1.8 }

/** El jugador empieza detrás del mostrador, en su puesto de cajero. */
export const SPAWN: Vec3 = [
  COUNTER.position[0],
  PLAYER_EYE,
  COUNTER.position[2] + COUNTER.depth / 2 + 1,
]

function footprint(cx: number, cz: number, width: number, depth: number): Box {
  return {
    minX: cx - width / 2,
    maxX: cx + width / 2,
    minZ: cz - depth / 2,
    maxZ: cz + depth / 2,
  }
}

export const COLLIDERS: Box[] = [
  ...SHELVES.map((s) => footprint(s.position[0], s.position[2], SHELF_SIZE.width, SHELF_SIZE.depth)),
  footprint(COUNTER.position[0], COUNTER.position[2], COUNTER.width, COUNTER.depth),
  footprint(PALLET.position[0], PALLET.position[2], PALLET.width, PALLET.depth),
]

/** true si la posición (x, z) de un círculo de radio PLAYER_RADIUS choca con algo */
export function isBlocked(x: number, z: number): boolean {
  const r = PLAYER_RADIUS
  return COLLIDERS.some(
    (c) => x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r,
  )
}

export function clampToRoom(x: number, z: number): { x: number; z: number } {
  const m = PLAYER_RADIUS + 0.15
  return {
    x: Math.min(Math.max(x, ROOM.minX + m), ROOM.maxX - m),
    z: Math.min(Math.max(z, ROOM.minZ + m), ROOM.maxZ - m),
  }
}
