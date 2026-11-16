import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Interaction } from '../game/store'

type Props = {
  info: Interaction
  position?: [number, number, number]
  rotation?: [number, number, number]
  children: ReactNode
}

/**
 * Volumen invisible que amplía la zona apuntable de un objeto.
 * Sin él, un mostrador bajo no se detectaría al mirar al frente.
 */
export function Hitbox({
  size,
  position,
}: {
  size: [number, number, number]
  position?: [number, number, number]
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/**
 * Grupo que el raycaster del jugador reconoce como interactuable.
 * El rayo sube por los padres hasta encontrar `userData.interact`.
 */
export function Interactable({ info, position, rotation, children }: Props) {
  const ref = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (ref.current) ref.current.userData.interact = info
  }, [info])

  return (
    <group ref={ref} position={position} rotation={rotation}>
      {children}
    </group>
  )
}
