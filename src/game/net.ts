import type { ClientMessage, ServerMessage } from './protocol'
import type { SimEvent, Snapshot } from './sim'
import { live } from './live'

/**
 * Cliente WebSocket.
 *
 * Modos:
 *  - URL explícita (`VITE_SERVER_URL`): coop obligatorio; reintenta si cae.
 *  - Dev sin URL: un jugador (simulación local).
 *  - Build servido por nuestro servidor: detecta `/ws` en el mismo origen;
 *    si no responde, cae a un jugador.
 */

const EXPLICIT = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim() ?? ''

const ROOM = new URLSearchParams(window.location.search).get('sala')?.slice(0, 24) || 'main'

const SAME_ORIGIN = (() => {
  if (EXPLICIT || import.meta.env.DEV) return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
})()

const TARGET = EXPLICIT || SAME_ORIGIN

function resolveUrl(base: string): string {
  try {
    const url = new URL(base, window.location.href)
    if (url.pathname === '/' || url.pathname === '') url.pathname = '/ws'
    url.searchParams.set('sala', ROOM)
    return url.toString()
  } catch {
    return ''
  }
}

type Handlers = {
  onWelcome: (playerId: string, name: string) => void
  onSnapshot: (snap: Snapshot) => void
  onEvents: (events: SimEvent[]) => void
  onStatus: (mode: 'local' | 'connecting' | 'online', players: number) => void
}

let handlers: Handlers | null = null
let socket: WebSocket | null = null
let retryTimer: number | null = null
let attempts = 0
let everConnected = false
let started = false

let lastMoveAt = 0
let lastMove: { x: number; z: number; yaw: number } | null = null

function status(mode: 'local' | 'connecting' | 'online', players = 0) {
  live.mode = mode
  if (mode === 'local') {
    live.players = []
    live.myId = ''
  }
  handlers?.onStatus(mode, players)
}

function scheduleRetry() {
  if (retryTimer !== null) return
  attempts += 1
  const delay = Math.min(10_000, 1000 * attempts)
  retryTimer = window.setTimeout(() => {
    retryTimer = null
    connect()
  }, delay)
}

function connect() {
  if (!TARGET) {
    status('local')
    return
  }

  const url = resolveUrl(TARGET)
  if (!url) {
    status('local')
    return
  }

  status('connecting')

  try {
    socket = new WebSocket(url)
  } catch {
    scheduleRetry()
    return
  }

  socket.onopen = () => {
    attempts = 0
    socket?.send(JSON.stringify({ t: 'hello', name: '' } satisfies ClientMessage))
  }

  socket.onmessage = (event) => {
    let msg: ServerMessage
    try {
      msg = JSON.parse(String(event.data)) as ServerMessage
    } catch {
      return
    }

    if (msg.t === 'welcome') {
      everConnected = true
      live.myId = msg.playerId
      live.myName = msg.name
      handlers?.onWelcome(msg.playerId, msg.name)
      return
    }

    if (msg.t === 'snapshot') {
      handlers?.onSnapshot(msg.snap)
      return
    }

    if (msg.t === 'events') {
      handlers?.onEvents(msg.events)
    }
  }

  socket.onclose = () => {
    socket = null
    if (everConnected) {
      status('connecting')
      scheduleRetry()
      return
    }
    // Nunca hubo conexión: si el servidor era autodetectado, esto es un build
    // estático y el juego debe funcionar en un jugador.
    if (!EXPLICIT) {
      status('local')
      return
    }
    status('connecting')
    scheduleRetry()
  }

  socket.onerror = () => {
    /* el cierre gestiona el reintento */
  }
}

export function initNet(config: Handlers) {
  if (started) return
  started = true
  handlers = config
  connect()
}

function send(message: ClientMessage) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

export const net = {
  get enabled() {
    return Boolean(TARGET)
  },
  get room() {
    return ROOM
  },
  send,
  /** Posición propia: se manda a ~10 Hz y solo si cambió. */
  sendMove(x: number, z: number, yaw: number) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    const now = performance.now()
    if (now - lastMoveAt < 100) return

    const moved =
      !lastMove ||
      Math.abs(lastMove.x - x) > 0.01 ||
      Math.abs(lastMove.z - z) > 0.01 ||
      Math.abs(lastMove.yaw - yaw) > 0.01

    if (!moved) return

    lastMoveAt = now
    lastMove = { x, z, yaw }
    send({ t: 'move', x, z, yaw })
  },
}
