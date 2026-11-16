import { useEffect, useMemo } from 'react'
import { makeLabelTexture } from '../game/labels'
import { ROOM } from '../game/world'

const WALL = '#26324a'
const WALL_TOP = '#1b2436'
const FLOOR = '#333f56'
const AISLE = '#3d4a63'

function Wall({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={WALL} roughness={0.9} metalness={0.05} />
    </mesh>
  )
}

function DoorLabel() {
  const texture = useMemo(() => makeLabelTexture('Salida', '#0b1a2c', '#9fd0ff'), [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[0, 2.95, ROOM.maxZ - 0.01]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[1.5, 0.38]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  )
}

export function StoreRoom() {
  const { width, depth, height, wallThickness: t } = {
    width: ROOM.maxX - ROOM.minX,
    depth: ROOM.maxZ - ROOM.minZ,
    height: ROOM.height,
    wallThickness: ROOM.wallThickness,
  }

  return (
    <group>
      {/* Suelo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={FLOOR} roughness={0.85} />
      </mesh>

      {/* Pasillos (franjas más claras) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -2.9]}>
        <planeGeometry args={[width - 3.5, 3.4]} />
        <meshStandardMaterial color={AISLE} roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 2.3]}>
        <planeGeometry args={[width - 3.5, 3.2]} />
        <meshStandardMaterial color={AISLE} roughness={0.8} />
      </mesh>

      {/* Alfombrilla de entrada */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 6.2]}>
        <planeGeometry args={[3.2, 1.6]} />
        <meshStandardMaterial color="#4c5f80" roughness={0.95} />
      </mesh>

      {/* Pared trasera */}
      <Wall position={[0, height / 2, ROOM.minZ - t / 2]} size={[width + t * 2, height, t]} />

      {/* Pared frontal con hueco de entrada */}
      <Wall
        position={[-(1.3 + 4.5), height / 2, ROOM.maxZ + t / 2]}
        size={[9, height, t]}
      />
      <Wall
        position={[1.3 + 4.5, height / 2, ROOM.maxZ + t / 2]}
        size={[9, height, t]}
      />
      {/* Dintel */}
      <Wall position={[0, 2.95, ROOM.maxZ + t / 2]} size={[2.6, 0.9, t]} />
      {/* Puerta de cristal */}
      <mesh position={[0, 1.25, ROOM.maxZ + t / 2]}>
        <boxGeometry args={[2.6, 2.5, 0.05]} />
        <meshStandardMaterial
          color="#0e2237"
          roughness={0.12}
          metalness={0.4}
          transparent
          opacity={0.45}
        />
      </mesh>
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} position={[x, 1.25, ROOM.maxZ + t / 2]}>
          <boxGeometry args={[0.09, 2.5, 0.12]} />
          <meshStandardMaterial color="#8b98ad" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <DoorLabel />

      {/* Exterior nocturno (visible a través del cristal) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 8.4]}>
        <planeGeometry args={[16, 3.4]} />
        <meshStandardMaterial color="#141c2e" roughness={1} />
      </mesh>
      <mesh position={[0, 2.4, 9.4]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[16, 6]} />
        <meshBasicMaterial color="#08101d" />
      </mesh>
      {[
        [-3.8, 2.15, 9.3],
        [3.4, 2.15, 9.3],
      ].map(([x, y, z]) => (
        <mesh key={x} position={[x, y, z]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.7, 0.22]} />
          <meshBasicMaterial color="#ffd8a0" toneMapped={false} />
        </mesh>
      ))}
      <Wall position={[ROOM.minX - t / 2, height / 2, 0]} size={[t, height, depth]} />
      <Wall position={[ROOM.maxX + t / 2, height / 2, 0]} size={[t, height, depth]} />

      {/* Zócalo superior */}
      <mesh position={[0, height - 0.08, 0]}>
        <boxGeometry args={[width, 0.16, 0.16]} />
        <meshStandardMaterial color={WALL_TOP} />
      </mesh>

      {/* Techo */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1f2a3d" roughness={1} />
      </mesh>

      {/* Paneles de luz */}
      {[
        [-5, -3.5],
        [0, -3.5],
        [5, -3.5],
        [-5, 2.5],
        [0, 2.5],
        [5, 2.5],
        [6.6, 5.2],
        [-7.6, 5.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, height - 0.05, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.6, 0.7]} />
            <meshBasicMaterial color="#eaf4ff" toneMapped={false} />
          </mesh>
          <pointLight position={[0, -0.4, 0]} intensity={4.5} distance={9} decay={2} color="#dbeafe" />
        </group>
      ))}
    </group>
  )
}
