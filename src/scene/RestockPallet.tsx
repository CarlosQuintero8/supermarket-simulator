import { useEffect, useMemo } from 'react'
import { makeLabelTexture } from '../game/labels'
import { PALLET } from '../game/world'
import { Interactable, Hitbox } from './Interactable'

const BOX_COLORS = ['#c08a4a', '#a9743b', '#d19a5c', '#b98147']

export function RestockPallet() {
  const [x, , z] = PALLET.position
  const texture = useMemo(() => makeLabelTexture('Almacén', '#2b1d0d', '#f5c27a'), [])
  useEffect(() => () => texture.dispose(), [texture])

  const crates: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [
    { pos: [0, 0.09, 0], size: [PALLET.width, 0.18, PALLET.depth], color: '#6b4a2a' },
    { pos: [-0.55, 0.66, -0.35], size: [1.0, 0.95, 0.95], color: BOX_COLORS[0] },
    { pos: [0.5, 0.66, -0.35], size: [0.95, 0.95, 0.95], color: BOX_COLORS[1] },
    { pos: [0.0, 0.53, 0.5], size: [1.05, 0.7, 0.7], color: BOX_COLORS[2] },
    { pos: [0.35, 1.35, -0.3], size: [0.8, 0.45, 0.7], color: BOX_COLORS[3] },
  ]

  return (
    <Interactable info={{ kind: 'restock' }} position={[x, 0, z]}>
      {crates.map((crate, i) => (
        <mesh key={i} position={crate.pos} castShadow receiveShadow>
          <boxGeometry args={crate.size} />
          <meshStandardMaterial color={crate.color} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 2.35, -0.4]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.9, 0.47]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent />
      </mesh>
      <Hitbox size={[PALLET.width + 0.3, 2.1, PALLET.depth + 0.3]} position={[0, 1.0, 0]} />
    </Interactable>
  )
}
