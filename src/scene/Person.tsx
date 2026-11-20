import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeNameTexture } from '../game/labels'

const TROUSERS = '#2b3648'
const SKIN = '#e8c39e'
const HAIR = '#33261b'
const BASKET = '#8a5a33'

function NameTag({ text, accent }: { text: string; accent: string }) {
  const texture = useMemo(() => makeNameTexture(text, accent), [text, accent])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <sprite position={[0, 2.02, 0]} scale={[1, 0.25, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

type Props = {
  color: string
  name?: string
  withBasket?: boolean
  fade?: boolean
}

/**
 * Avatar low-poly compartido por clientes y por otros jugadores.
 * El padre se encarga de la posición y la rotación.
 */
export function Person({ color, name, withBasket = true, fade = true }: Props) {
  const group = useRef<THREE.Group>(null!)
  const world = useMemo(() => new THREE.Vector3(), [])

  const mats = useMemo(() => {
    const make = (value: string, roughness: number) =>
      new THREE.MeshStandardMaterial({ color: value, roughness, transparent: true })
    return {
      shirt: make(color, 0.75),
      trousers: make(TROUSERS, 0.9),
      skin: make(SKIN, 0.85),
      hair: make(HAIR, 0.95),
      basket: make(BASKET, 0.9),
    }
  }, [color])

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  useFrame((state) => {
    if (!fade || !group.current) return

    group.current.getWorldPosition(world)
    // Distancia horizontal: la altura del pivote (los pies) falsearía el cálculo.
    const distance = Math.hypot(
      state.camera.position.x - world.x,
      state.camera.position.z - world.z,
    )
    const opacity = distance < 1.6 ? Math.max(0.12, (distance - 0.4) / 1.2) : 1

    for (const material of Object.values(mats)) {
      material.opacity = opacity
      material.depthWrite = opacity > 0.95
    }
  })

  return (
    <group ref={group}>
      {/* piernas */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.38, 0]} material={mats.trousers}>
          <boxGeometry args={[0.15, 0.76, 0.17]} />
        </mesh>
      ))}

      {/* torso */}
      <mesh position={[0, 1.05, 0]} material={mats.shirt}>
        <boxGeometry args={[0.46, 0.62, 0.28]} />
      </mesh>

      {/* brazos */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 1.04, 0]} material={mats.shirt}>
          <boxGeometry args={[0.11, 0.5, 0.14]} />
        </mesh>
      ))}

      {/* cabeza */}
      <mesh position={[0, 1.56, 0]} material={mats.skin}>
        <sphereGeometry args={[0.19, 16, 12]} />
      </mesh>

      {/* pelo */}
      <mesh position={[0, 1.62, 0.02]} material={mats.hair}>
        <sphereGeometry args={[0.195, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
      </mesh>

      {/* cesta delante (el modelo mira hacia -Z) */}
      {withBasket && (
        <mesh position={[0, 0.86, -0.25]} material={mats.basket}>
          <boxGeometry args={[0.34, 0.18, 0.22]} />
        </mesh>
      )}

      {name && <NameTag text={name} accent={color} />}
    </group>
  )
}
