import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { interactionKey, useGame, type Interaction } from '../game/store'
import { net } from '../game/net'
import {
  INTERACT_DISTANCE,
  PLAYER_EYE,
  SPAWN,
  clampToRoom,
  isBlocked,
} from '../game/world'

const WALK_SPEED = 3.2
const RUN_SPEED = 5.4
const LOOK_SENSITIVITY = 0.0022
const ARROW_YAW_SPEED = 2.1
const ARROW_PITCH_SPEED = 1.4
const PITCH_LIMIT = Math.PI / 2 - 0.12

function findInteract(object: THREE.Object3D): Interaction | null {
  let current: THREE.Object3D | null = object
  while (current) {
    const info = current.userData?.interact as Interaction | undefined
    if (info) return info
    current = current.parent
  }
  return null
}

/**
 * Controlador en primera persona.
 * - Movimiento: WASD (+Shift para correr).
 * - Cámara: ratón con pointer lock; si el navegador no lo permite, flechas o arrastre.
 * - Interacción: E sobre el objeto apuntado (raycast desde el centro).
 */
export function Player({ playing }: { playing: boolean }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  const keys = useRef<Record<string, boolean>>({})
  const position = useRef(new THREE.Vector3(SPAWN[0], 0, SPAWN[2]))
  const yaw = useRef(0)
  const pitch = useRef(0)
  const bobTime = useRef(0)
  const dragging = useRef(false)
  const playingRef = useRef(playing)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const screenCenter = useMemo(() => new THREE.Vector2(0, 0), [])
  const forward = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const wish = useMemo(() => new THREE.Vector3(), [])

  playingRef.current = playing

  useEffect(() => {
    const canvas = gl.domElement
    camera.rotation.order = 'YXZ'
    camera.position.set(position.current.x, PLAYER_EYE, position.current.z)

    const act = () => {
      if (!playingRef.current) return
      const game = useGame.getState()
      if (!game.hoverKey) return

      if (game.hoverKey === 'checkout') game.scanNext()
      else if (game.hoverKey === 'restock') game.restock()
    }

    const onMouseMove = (event: MouseEvent) => {
      if (!playingRef.current) return
      const locked = document.pointerLockElement === canvas
      if (!locked && !dragging.current) return
      yaw.current -= event.movementX * LOOK_SENSITIVITY
      pitch.current = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, pitch.current - event.movementY * LOOK_SENSITIVITY),
      )
    }

    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 0 && playingRef.current && document.pointerLockElement !== canvas) {
        dragging.current = true
        canvas.style.cursor = 'grabbing'
      }
    }

    const onMouseUp = () => {
      dragging.current = false
      canvas.style.cursor = ''
    }

    const onKeyDown = (event: KeyboardEvent) => {
      keys.current[event.code] = true
      if (!playingRef.current) return

      if (event.code === 'KeyE') act()
      else if (event.code === 'KeyF') useGame.getState().pay('cash')
      else if (event.code === 'KeyT') useGame.getState().pay('card')
      if (event.code.startsWith('Arrow')) event.preventDefault()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      keys.current[event.code] = false
    }

    const onBlur = () => {
      keys.current = {}
      dragging.current = false
    }

    const onClick = () => {
      if (playingRef.current && document.pointerLockElement !== canvas) {
        try {
          void (canvas.requestPointerLock() as unknown as Promise<void>)?.catch(() => {})
        } catch {
          /* modo alternativo con flechas / arrastre */
        }
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    canvas.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('click', onClick)
    }
  }, [camera, gl])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const k = keys.current
    const active = playingRef.current

    // --- cámara con flechas (funciona sin pointer lock) ---
    if (active) {
      const turn = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)
      const tilt = (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)
      if (turn !== 0) yaw.current += turn * ARROW_YAW_SPEED * dt
      if (tilt !== 0) {
        pitch.current = Math.max(
          -PITCH_LIMIT,
          Math.min(PITCH_LIMIT, pitch.current + tilt * ARROW_PITCH_SPEED * dt),
        )
      }
    }

    // --- movimiento ---
    const axisForward = active ? (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) : 0
    const axisStrafe = active ? (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) : 0
    const running = Boolean(k.ShiftLeft || k.ShiftRight)
    const moving = axisForward !== 0 || axisStrafe !== 0

    wish.set(0, 0, 0)
    if (moving) {
      forward.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
      right.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current))
      wish.addScaledVector(forward, axisForward)
      wish.addScaledVector(right, axisStrafe)
      wish.normalize().multiplyScalar((running ? RUN_SPEED : WALK_SPEED) * dt)

      // Resolución por ejes: permite deslizarse por los laterales de las estanterías.
      const nextX = position.current.x + wish.x
      if (!isBlocked(nextX, position.current.z)) position.current.x = nextX

      const nextZ = position.current.z + wish.z
      if (!isBlocked(position.current.x, nextZ)) position.current.z = nextZ

      const clamped = clampToRoom(position.current.x, position.current.z)
      position.current.x = clamped.x
      position.current.z = clamped.z

      bobTime.current += dt * (running ? 13 : 8.5)
    } else {
      bobTime.current += dt * 1.5
    }

    const bobAmount = moving ? 0.035 : 0.006
    camera.position.set(
      position.current.x,
      PLAYER_EYE + Math.sin(bobTime.current) * bobAmount,
      position.current.z,
    )
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')

    // En coop, avisar a los demás de dónde estamos (10 Hz, solo si cambió).
    net.sendMove(position.current.x, position.current.z, yaw.current)

    // --- interacción (rayo desde el centro de la pantalla) ---
    raycaster.setFromCamera(screenCenter, camera)
    raycaster.far = INTERACT_DISTANCE
    const hits = raycaster.intersectObjects(scene.children, true)

    let hovered: string | null = null
    for (const hit of hits) {
      if (hit.distance > INTERACT_DISTANCE) break
      const info = findInteract(hit.object)
      if (info) hovered = interactionKey(info)
      break // la primera superficie que toca el rayo decide
    }

    useGame.getState().setHover(active ? hovered : null)
  })

  return null
}
