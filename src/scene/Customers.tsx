import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { live } from '../game/live'
import { tickWorld, useGame } from '../game/store'
import { Person } from './Person'

type Smooth = { x: number; z: number; yaw: number; ready: boolean }

function CustomerNpc({ id, color }: { id: number; color: string }) {
  const group = useRef<THREE.Group>(null!)
  const smooth = useRef<Smooth>({ x: 0, z: 0, yaw: 0, ready: false })

  useFrame((_, delta) => {
    const customer = live.customers.find((c) => c.id === id)
    if (!customer || !group.current) return

    const dt = Math.min(delta, 0.05)
    const s = smooth.current

    if (!s.ready) {
      s.x = customer.pos.x
      s.z = customer.pos.z
      s.yaw = customer.yaw
      s.ready = true
    }

    // En coop las posiciones llegan a 15 Hz: se suavizan entre snapshots.
    const k = live.mode === 'online' ? 1 - Math.exp(-14 * dt) : 1
    s.x += (customer.pos.x - s.x) * k
    s.z += (customer.pos.z - s.z) * k

    let deltaYaw = customer.yaw - s.yaw
    while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2
    while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2
    s.yaw += deltaYaw * k

    const bob = Math.abs(Math.sin(customer.bob)) * 0.035
    group.current.position.set(s.x, bob, s.z)
    group.current.rotation.y = s.yaw
  })

  return (
    <group ref={group}>
      <Person color={color} />
    </group>
  )
}

/**
 * Clientes de la tienda. En modo local también hacen avanzar la simulación;
 * en coop solo pintan lo que manda el servidor.
 */
export function Customers({ playing }: { playing: boolean }) {
  const ids = useGame((s) => s.customerIds)

  useFrame((_, delta) => {
    if (!playing) return
    tickWorld(Math.min(delta, 0.05))
  })

  return (
    <>
      {ids.map((id) => (
        <CustomerNpc
          key={id}
          id={id}
          color={live.customers.find((c) => c.id === id)?.color ?? '#8892a6'}
        />
      ))}
    </>
  )
}
