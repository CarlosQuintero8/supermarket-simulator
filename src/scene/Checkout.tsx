import { useEffect, useMemo } from 'react'
import { makeLabelTexture } from '../game/labels'
import { productById } from '../game/products'
import { useGame } from '../game/store'
import { COUNTER } from '../game/world'
import { Hitbox, Interactable } from './Interactable'

function CounterItems() {
  const ticket = useGame((s) => s.ticket)
  const pending = ticket ? ticket.items.slice(ticket.scanned) : []
  const count = pending.length

  return (
    <group>
      {pending.map((productId, index) => {
        const product = productById(productId)
        // Desplazados al lado del escáner para no tapar la cara del cliente.
        const x = -0.55 + (index - (count - 1) / 2) * 0.56
        return (
          <group key={`${productId}-${index}`} position={[x, 1.35, -0.2]}>
            <mesh>
              <boxGeometry args={[0.5, 0.34, 0.42]} />
              <meshStandardMaterial color={product.color} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0, 0.215]}>
              <planeGeometry args={[0.44, 0.1]} />
              <meshStandardMaterial color={product.accent} roughness={0.6} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function CardTerminal() {
  const cardPending = useGame((s) => s.cardPending)
  return (
    <group position={[1.15, 1.18, -0.28]} rotation={[0, -0.35, 0]}>
      <mesh position={[0, 0.11, 0]}>
        <boxGeometry args={[0.26, 0.22, 0.18]} />
        <meshStandardMaterial color="#1b2536" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.13, 0.095]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.18, 0.11]} />
        <meshStandardMaterial
          color="#0b3d2c"
          emissive="#34d399"
          emissiveIntensity={cardPending ? 2.4 : 0.9}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.05, 0.13]}>
        <boxGeometry args={[0.1, 0.015, 0.045]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}

export function Checkout() {
  const texture = useMemo(() => makeLabelTexture('Caja', '#0b2d1f', '#6ee7b7'), [])
  useEffect(() => () => texture.dispose(), [texture])

  const ticket = useGame((s) => s.ticket)
  const pendingCount = ticket ? ticket.items.length - ticket.scanned : 0
  const [x, , z] = COUNTER.position

  // El escáner brilla cuando queda algo por escanear.
  const glow = pendingCount > 0 ? 1.8 : 0.45

  return (
    <Interactable info={{ kind: 'checkout' }} position={[x, 0, z]}>
      {/* Cuerpo */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[COUNTER.width, 1.1, COUNTER.depth]} />
        <meshStandardMaterial color="#34435c" roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Encimera */}
      <mesh position={[0, 1.13, 0]} castShadow>
        <boxGeometry args={[COUNTER.width + 0.12, 0.1, COUNTER.depth + 0.12]} />
        <meshStandardMaterial color="#a8b5c9" roughness={0.35} metalness={0.2} />
      </mesh>
      {/* Caja registradora (lado del cajero) */}
      <mesh position={[0.9, 1.4, 0.35]} castShadow>
        <boxGeometry args={[0.8, 0.44, 0.5]} />
        <meshStandardMaterial color="#2f3d54" roughness={0.6} />
      </mesh>
      <mesh position={[0.9, 1.63, 0.35]} rotation={[-0.45, 0, 0]}>
        <planeGeometry args={[0.56, 0.34]} />
        <meshStandardMaterial color="#0f766e" emissive="#34d399" emissiveIntensity={0.7} />
      </mesh>
      {/* Escáner */}
      <mesh position={[-0.75, 1.19, 0.1]}>
        <boxGeometry args={[0.58, 0.05, 0.44]} />
        <meshStandardMaterial
          color="#0b3d2c"
          emissive="#34d399"
          emissiveIntensity={glow}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-0.75, 1.2, 0.1]}>
        <boxGeometry args={[0.46, 0.02, 0.34]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Cajón del dinero */}
      <mesh position={[-1.15, 0.95, 0.66]}>
        <boxGeometry args={[0.7, 0.16, 0.06]} />
        <meshStandardMaterial color="#20293a" roughness={0.6} />
      </mesh>

      <CardTerminal />
      <CounterItems />

      {/* Rótulo: uno hacia la tienda y otro hacia el cajero */}
      <mesh position={[0, 2.42, -0.75]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.3, 0.33]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent />
      </mesh>
      <mesh position={[0, 2.42, -0.72]}>
        <planeGeometry args={[1.3, 0.33]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent />
      </mesh>

      <Hitbox size={[COUNTER.width + 0.4, 2.1, COUNTER.depth + 0.4]} position={[0, 1.05, 0]} />
    </Interactable>
  )
}
