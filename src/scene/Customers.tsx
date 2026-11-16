import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getCustomer, updateCustomers } from '../game/customers'
import { useGame } from '../game/store'

function useCustomerMaterials(shirt: string) {
  const mats = useMemo(
    () => ({
      shirt: new THREE.MeshStandardMaterial({
        color: shirt,
        roughness: 0.75,
        transparent: true,
      }),
      trousers: new THREE.MeshStandardMaterial({
        color: '#2b3648',
        roughness: 0.9,
        transparent: true,
      }),
      skin: new THREE.MeshStandardMaterial({
        color: '#e8c39e',
        roughness: 0.85,
        transparent: true,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: '#33261b',
        roughness: 0.95,
        transparent: true,
      }),
      basket: new THREE.MeshStandardMaterial({
        color: '#8a5a33',
        roughness: 0.9,
        transparent: true,
      }),
    }),
    [shirt],
  )

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  return mats
}

function CustomerNpc({ id }: { id: number }) {
  const group = useRef<THREE.Group>(null!)
  const customer = getCustomer(id)
  const mats = useCustomerMaterials(customer?.color ?? '#888888')

  useFrame((state) => {
    if (!group.current || !customer) return

    const bob = Math.abs(Math.sin(customer.bob)) * 0.035
    group.current.position.set(customer.pos.x, bob, customer.pos.z)
    group.current.rotation.y = customer.yaw

    // Se desvanecen si el jugador se les acerca (no hay colisión entre ambos).
    const distance = state.camera.position.distanceTo(group.current.position)
    const opacity = distance < 1.6 ? Math.max(0.12, (distance - 0.4) / 1.2) : 1
    for (const material of Object.values(mats)) {
      material.opacity = opacity
      material.depthWrite = opacity > 0.95
    }
  })

  if (!customer) return null

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
      <mesh position={[0, 0.86, -0.25]} material={mats.basket}>
        <boxGeometry args={[0.34, 0.18, 0.22]} />
      </mesh>
    </group>
  )
}

/**
 * Renderiza los clientes y hace avanzar su simulación.
 * Solo se re-renderiza cuando alguien entra o sale de la tienda.
 */
export function Customers({ playing }: { playing: boolean }) {
  const ids = useGame((s) => s.customerIds)

  useFrame((_, delta) => {
    if (!playing) return
    updateCustomers(Math.min(delta, 0.05))
  })

  return (
    <>
      {ids.map((id) => (
        <CustomerNpc key={id} id={id} />
      ))}
    </>
  )
}
