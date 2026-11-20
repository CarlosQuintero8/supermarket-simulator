import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import {
  addPlayer,
  createSim,
  movePlayer,
  pay,
  removePlayer,
  restock,
  scanNext,
  snapshotOf,
  tick,
  type SimState,
} from '../src/game/sim'
import type { ClientMessage, ServerMessage } from '../src/game/protocol'

/**
 * Servidor cooperativo.
 *
 * - Autoridad total sobre dinero, stock, tickets y clientes.
 * - Una sala por código (`?sala=...`), con su propio tick a 15 Hz.
 * - Sirve también `dist/` para que un único túnel exponga juego y socket.
 */

const PORT = Number(process.env.PORT ?? 8080)
const TICK_MS = 66 // ~15 Hz
const DIST = resolve(process.cwd(), 'dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

type Client = {
  id: number
  ws: WebSocket
  room: string
  playerId: string
}

type Room = {
  code: string
  state: SimState
  clients: Set<Client>
  timer: NodeJS.Timeout
}

const rooms = new Map<string, Room>()
let nextClientId = 1

function send(client: Client, message: ServerMessage) {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message))
  }
}

function broadcast(room: Room, message: ServerMessage) {
  const data = JSON.stringify(message)
  for (const client of room.clients) {
    if (client.ws.readyState === WebSocket.OPEN) client.ws.send(data)
  }
}

function tickRoom(room: Room) {
  if (room.clients.size === 0) return

  const events = tick(room.state, TICK_MS / 1000)
  if (events.length > 0) broadcast(room, { t: 'events', events })
  broadcast(room, { t: 'snapshot', snap: snapshotOf(room.state) })
}

function getRoom(code: string): Room {
  const existing = rooms.get(code)
  if (existing) return existing

  const room: Room = {
    code,
    state: createSim(),
    clients: new Set(),
    timer: setInterval(() => tickRoom(room), TICK_MS),
  }
  rooms.set(code, room)
  console.log(`[sala ${code}] creada`)
  return room
}

function sanitizeRoom(value: string | null): string {
  const clean = (value ?? 'main').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)
  return clean || 'main'
}

// ------------------------------------------------------------------ estáticos

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const pathname = decodeURIComponent(url.pathname)
  const relative = pathname === '/' ? '/index.html' : pathname
  const file = resolve(DIST, `.${relative}`)

  if (!file.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const data = await readFile(file)
    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type })
    res.end(data)
  } catch {
    // Fallback de SPA
    try {
      const html = await readFile(resolve(DIST, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Ejecuta "npm run build" para servir el juego desde aquí.\n')
    }
  }
}

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }))
    return
  }
  void serveStatic(req, res)
})

// ------------------------------------------------------------------ websocket

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/ws', 'http://localhost')
  const roomCode = sanitizeRoom(url.searchParams.get('sala'))
  const room = getRoom(roomCode)

  const client: Client = { id: nextClientId++, ws, room: roomCode, playerId: '' }
  room.clients.add(client)
  ;(ws as WebSocket & { isAlive?: boolean }).isAlive = true

  let greeted = false
  const helloTimer = setTimeout(() => {
    if (!greeted) ws.close(4000, 'hello timeout')
  }, 5000)

  ws.on('pong', () => {
    ;(ws as WebSocket & { isAlive?: boolean }).isAlive = true
  })

  ws.on('message', (raw) => {
    let message: ClientMessage
    try {
      message = JSON.parse(String(raw)) as ClientMessage
    } catch {
      return
    }
    if (!message || typeof message !== 'object') return

    switch (message.t) {
      case 'hello': {
        if (greeted) return
        greeted = true
        clearTimeout(helloTimer)

        const player = addPlayer(room.state, typeof message.name === 'string' ? message.name : '')
        client.playerId = player.id

        send(client, {
          t: 'welcome',
          playerId: player.id,
          name: player.name,
          room: room.code,
        })
        broadcast(room, { t: 'snapshot', snap: snapshotOf(room.state) })
        console.log(`[sala ${room.code}] entra ${player.name} (${player.id})`)
        break
      }

      case 'move': {
        if (!client.playerId) return
        movePlayer(room.state, client.playerId, Number(message.x), Number(message.z), Number(message.yaw))
        break
      }

      case 'scan': {
        if (!client.playerId) return
        const events = scanNext(room.state)
        if (events.length > 0) send(client, { t: 'events', events })
        broadcast(room, { t: 'snapshot', snap: snapshotOf(room.state) })
        break
      }

      case 'pay': {
        if (!client.playerId) return
        const events = pay(room.state, message.method === 'card' ? 'card' : 'cash')
        if (events.length > 0) send(client, { t: 'events', events })
        broadcast(room, { t: 'snapshot', snap: snapshotOf(room.state) })
        break
      }

      case 'restock': {
        if (!client.playerId) return
        const events = restock(room.state)
        if (events.length > 0) send(client, { t: 'events', events })
        broadcast(room, { t: 'snapshot', snap: snapshotOf(room.state) })
        break
      }
    }
  })

  ws.on('close', () => {
    clearTimeout(helloTimer)
    room.clients.delete(client)

    if (client.playerId) {
      removePlayer(room.state, client.playerId)
      broadcast(room, { t: 'snapshot', snap: snapshotOf(room.state) })
      console.log(`[sala ${room.code}] sale ${client.playerId}`)
    }

    if (room.clients.size === 0) {
      clearInterval(room.timer)
      rooms.delete(room.code)
      console.log(`[sala ${room.code}] cerrada`)
    }
  })

  ws.on('error', () => {
    /* el cierre limpia */
  })
})

// Latido: Cloudflare Tunnel corta conexiones ociosas, y así se detectan muertas.
setInterval(() => {
  for (const ws of wss.clients) {
    const socket = ws as WebSocket & { isAlive?: boolean }
    if (socket.isAlive === false) {
      socket.terminate()
      continue
    }
    socket.isAlive = false
    socket.ping()
  }
}, 30_000)

server.listen(PORT, () => {
  console.log('')
  console.log('  Supermarket Simulator · servidor coop')
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`)
  console.log(`  Juego:     http://localhost:${PORT}  (requiere "npm run build")`)
  console.log('  Salas:     ?sala=codigo en la URL (por defecto "main")')
  console.log('')
})
