import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Scene } from './scene/Scene'
import { HUD } from './ui/HUD'

export default function App() {
  const [playing, setPlaying] = useState(false)
  const hadLock = useRef(false)

  useEffect(() => {
    const onChange = () => {
      const locked = document.pointerLockElement !== null
      if (locked) {
        hadLock.current = true
        setPlaying(true)
      } else if (hadLock.current) {
        hadLock.current = false
        setPlaying(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Sin pointer lock (navegadores que no lo permiten) ESC también pausa.
      if (event.code === 'Escape' && !document.pointerLockElement) setPlaying(false)
    }

    document.addEventListener('pointerlockchange', onChange)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerlockchange', onChange)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const play = useCallback(() => {
    setPlaying(true)
    const canvas = document.querySelector('canvas')
    if (!canvas) return

    try {
      const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          // Sin captura de ratón: se juega con flechas o arrastrando el botón izquierdo.
        })
      }
    } catch {
      /* modo alternativo */
    }
  }, [])

  return (
    <div className="app">
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 72, near: 0.05, far: 120 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1
        }}
      >
        <Scene playing={playing} />
      </Canvas>
      <HUD playing={playing} onPlay={play} />
    </div>
  )
}
