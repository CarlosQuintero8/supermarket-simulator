import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { live } from '../game/live'
import { useGame } from '../game/store'
import { Person } from './Person'

function RemotePlayer({ id, color, name }: { id: string; color: string; name: string }) {
  const group = useRef<THREE.Group>(null!)
  const smooth = useRef({ x: 0, z: 0, yaw: 0, ready: false })

  useFrame((_, delta) => {
    const player = live.players.find((p) => p.id === id)
    if (!player || !group.current) return

    const dt = Math.min(delta, 0.05)
    const s = smooth.current
    if (!s.ready) {
      s.x = player.pos.x
      s.z = player.pos.z
      s.yaw = player.yaw
      s.ready = true
    }

    const k = 1 - Math.exp(-16 * dt)
    s.x += (player.pos.x - s.x) * k
    s.z += (player.pos.z - s.z) * k

    let deltaYaw = player.yaw - s.yaw
    while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2
    while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2
    s.yaw += deltaYaw * k

    group.current.position.set(s.x, 0, s.z)
    group.current.rotation.y = s.yaw
  })

  return (
    <group ref={group}>
      <Person color={color} name={name} withBasket={false} />
    </group>
  )
}

/** Avatares de los demás cajeros. */
export function RemotePlayers() {
  const ids = useGame((s) => s.remoteIds)

  return (
    <>
      {ids.map((id) => {
        const player = live.players.find((p) => p.id === id)
        return (
          <RemotePlayer
            key={id}
            id={id}
            color={player?.color ?? '#38bdf8'}
            name={player?.name ?? 'Cajero'}
          />
        )
      })}
    </>
  )
}
