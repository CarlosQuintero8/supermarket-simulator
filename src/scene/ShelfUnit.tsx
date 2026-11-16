import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { makeLabelTexture } from '../game/labels'
import { productById } from '../game/products'
import { useGame } from '../game/store'
import { SHELF_SIZE, type ShelfPlacement } from '../game/world'

const FRAME = '#7d8aa3'
const PANEL = '#48566e'
const BOARD_Y = [0.34, 1.04, 1.74, 2.3]
const COL_X = [-1.08, -0.36, 0.36, 1.08]

function Label({ text }: { text: string }) {
  const texture = useMemo(() => makeLabelTexture(text, '#111a2b', '#9fd0ff'), [text])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[0, 2.72, 0.5]}>
      <planeGeometry args={[2.7, 0.62]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  )
}

export function ShelfUnit({ productId, position }: ShelfPlacement) {
  const product = productById(productId)
  const stock = useGame((s) => s.stock[productId] ?? 0)

  const boxes = useMemo(() => {
    const out: { key: string; x: number; y: number }[] = []
    for (let i = 0; i < stock; i++) {
      const row = Math.floor(i / 4)
      out.push({ key: `${i}`, x: COL_X[i % 4], y: BOARD_Y[row] + 0.24 })
    }
    return out
  }, [stock])

  return (
    <group position={position}>
      {/* Estructura */}
      <mesh position={[0, SHELF_SIZE.height / 2, -0.44]} receiveShadow>
        <boxGeometry args={[SHELF_SIZE.width, SHELF_SIZE.height, 0.08]} />
        <meshStandardMaterial color={PANEL} roughness={0.9} />
      </mesh>
      {[-1.56, 1.56].map((x) => (
        <mesh key={x} position={[x, SHELF_SIZE.height / 2, 0]} castShadow>
          <boxGeometry args={[0.08, SHELF_SIZE.height, SHELF_SIZE.depth]} />
          <meshStandardMaterial color={FRAME} roughness={0.5} metalness={0.35} />
        </mesh>
      ))}
      {BOARD_Y.map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[SHELF_SIZE.width, 0.08, SHELF_SIZE.depth]} />
          <meshStandardMaterial color="#7b8aa3" roughness={0.6} metalness={0.25} />
        </mesh>
      ))}

      {/* Productos */}
      {boxes.map((box) => (
        <group key={box.key} position={[box.x, box.y, 0.02]}>
          <mesh castShadow>
            <boxGeometry args={[0.56, 0.4, 0.52]} />
            <meshStandardMaterial
              color={product.color}
              roughness={0.55}
              metalness={0.05}
            />
          </mesh>
          <mesh position={[0, 0, 0.265]}>
            <planeGeometry args={[0.5, 0.12]} />
            <meshStandardMaterial color={product.accent} roughness={0.6} />
          </mesh>
        </group>
      ))}

      <Label text={product.name} />
    </group>
  )
}

/** Las seis estanterías de la tienda. */
export function ShelfUnits({ shelves }: { shelves: ShelfPlacement[] }) {
  const ref = useRef<THREE.Group>(null)
  return (
    <group ref={ref}>
      {shelves.map((s) => (
        <ShelfUnit key={s.productId} {...s} />
      ))}
    </group>
  )
}
