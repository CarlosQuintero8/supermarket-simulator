import { PRODUCTS, SHELF_CAPACITY, eur, productById, round2 } from './products'
import { COUNTER, ROOM, SHELVES } from './world'

/**
 * Núcleo de simulación, sin React ni DOM.
 *
 * El mismo módulo corre en el navegador (modo un jugador) y en el servidor
 * (modo cooperativo). Todo lo que decide dinero, stock o tickets vive aquí.
 */

export type Pt = { x: number; z: number }

export type PaymentMethod = 'cash' | 'card'

export type CustomerState =
  | 'toShelf'
  | 'shopping'
  | 'toTill'
  | 'queued'
  | 'atTill'
  | 'leaving'

/** Datos de un cliente que necesitan el render y la red. */
export type CustomerView = {
  id: number
  color: string
  state: CustomerState
  pos: Pt
  yaw: number
  bob: number
}

export type Customer = CustomerView & {
  path: Pt[]
  targetProduct: string
  basket: string[]
  timer: number
  slot: number
  speed: number
}

export type Ticket = {
  customerId: number
  items: string[]
  /** productos ya escaneados (los N primeros de `items`) */
  scanned: number
  /** subtotal de lo escaneado */
  total: number
}

export type PlayerView = {
  id: string
  name: string
  color: string
  pos: Pt
  yaw: number
}

export type SimEvent = { text: string; kind: 'ok' | 'warn' | 'bad' }

export type PendingPayment = {
  customerId: number
  method: PaymentMethod
  total: number
  remaining: number
}

export type SimState = {
  money: number
  stock: Record<string, number>
  sold: number
  ticket: Ticket | null
  pending: PendingPayment | null
  queue: number[]
  customers: Customer[]
  players: PlayerView[]
  spawnTimer: number
  nextCustomerId: number
  nextPlayerNumber: number
}

/** Estado reducido que se replica al cliente (y pinta el HUD). */
export type Snapshot = {
  money: number
  stock: Record<string, number>
  sold: number
  ticket: Ticket | null
  cardPending: boolean
  queueLength: number
  customers: CustomerView[]
  players: PlayerView[]
}

const DOOR: Pt = { x: 0, z: 6.8 }
/** Pasillo ancho delante de las islas centrales */
const FRONT: Pt = { x: 0, z: 2.7 }
/** Punto de paso delante de las islas, de camino a la caja */
const JUNCTION: Pt = { x: 3.2, z: 2.2 }
/** El cliente espera delante del mostrador (lado tienda) y mira hacia la caja */
const TILL: Pt = {
  x: COUNTER.position[0],
  z: COUNTER.position[2] - COUNTER.depth / 2 - 1.05,
}
const QUEUE: Pt[] = [
  TILL,
  { x: TILL.x, z: TILL.z - 0.95 },
  { x: TILL.x, z: TILL.z - 1.9 },
]

const MAX_CUSTOMERS = 3
const WALK_SPEED = 1.6
const CARD_SECONDS = 1.5
const CUSTOMER_COLORS = [
  '#e07a5f',
  '#3d8bfd',
  '#e8c547',
  '#9b5de5',
  '#00bbf9',
  '#f15bb5',
  '#2dd4bf',
]
const PLAYER_COLORS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80']

type Stand = { productId: string; stand: Pt; approach: Pt[]; back: boolean }

/** Puntos donde se coloca un cliente para mirar cada estantería. */
const STANDS: Stand[] = SHELVES.map((shelf) => {
  const x = shelf.position[0]
  const back = shelf.position[2] < -2

  if (!back) {
    const stand = { x, z: 0.95 }
    return { productId: shelf.productId, stand, approach: [stand], back }
  }

  const gapX = x <= 0 ? -3 : 3
  const stand = { x, z: -4.15 }
  return {
    productId: shelf.productId,
    stand,
    approach: [
      { x: gapX, z: FRONT.z },
      { x: gapX, z: -2.9 },
      stand,
    ],
    back,
  }
})

function emptyStock(): Record<string, number> {
  return Object.fromEntries(PRODUCTS.map((p) => [p.id, SHELF_CAPACITY]))
}

export function createSim(): SimState {
  return {
    money: 24.5,
    stock: emptyStock(),
    sold: 0,
    ticket: null,
    pending: null,
    queue: [],
    customers: [],
    players: [],
    spawnTimer: 0.5,
    nextCustomerId: 1,
    nextPlayerNumber: 1,
  }
}

// ---------------------------------------------------------------- jugadores

export function addPlayer(state: SimState, name?: string): PlayerView {
  const n = state.nextPlayerNumber++
  const player: PlayerView = {
    id: `p${n}`,
    name: name?.trim().slice(0, 16) || `Cajero ${n}`,
    color: PLAYER_COLORS[(n - 1) % PLAYER_COLORS.length],
    pos: { x: COUNTER.position[0], z: COUNTER.position[2] + COUNTER.depth / 2 + 1 },
    yaw: 0,
  }
  state.players.push(player)
  return player
}

export function removePlayer(state: SimState, id: string) {
  state.players = state.players.filter((p) => p.id !== id)
}

export function movePlayer(state: SimState, id: string, x: number, z: number, yaw: number) {
  const player = state.players.find((p) => p.id === id)
  if (!player) return
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(yaw)) return
  player.pos.x = Math.min(Math.max(x, ROOM.minX), ROOM.maxX)
  player.pos.z = Math.min(Math.max(z, ROOM.minZ), ROOM.maxZ)
  player.yaw = yaw
}

// ---------------------------------------------------------------- clientes

function findCustomer(state: SimState, id: number): Customer | undefined {
  return state.customers.find((c) => c.id === id)
}

function reassignSlots(state: SimState) {
  state.queue.forEach((id, index) => {
    const customer = findCustomer(state, id)
    if (customer) customer.slot = index
  })
}

function advance(customer: Customer, dt: number): boolean {
  const step = customer.speed * dt
  let budget = step

  while (budget > 0.0001 && customer.path.length > 0) {
    const target = customer.path[0]
    const dx = target.x - customer.pos.x
    const dz = target.z - customer.pos.z
    const distance = Math.hypot(dx, dz)

    if (distance < 0.0001) {
      customer.path.shift()
      continue
    }

    const dirX = dx / distance
    const dirZ = dz / distance
    customer.yaw = Math.atan2(-dirX, -dirZ)

    if (distance <= budget) {
      customer.pos.x = target.x
      customer.pos.z = target.z
      customer.path.shift()
      budget -= distance
    } else {
      customer.pos.x += dirX * budget
      customer.pos.z += dirZ * budget
      budget = 0
    }
    customer.bob += step * 9
  }

  return customer.path.length === 0
}

function tillPath(customer: Customer): Pt[] {
  const stand = STANDS.find((s) => s.productId === customer.targetProduct)
  const path: Pt[] = []

  if (stand?.back) {
    const gapX = stand.stand.x <= 0 ? -3 : 3
    path.push({ x: gapX, z: -2.9 }, { x: gapX, z: FRONT.z })
  }

  path.push(JUNCTION, { x: TILL.x, z: QUEUE[2].z })
  return path
}

function leavePath(customer: Customer): Pt[] {
  if (customer.pos.z < -1) {
    // sale desde la fila trasera: vuelve por el hueco de las islas
    const gapX = customer.pos.x <= 0 ? -3 : 3
    return [{ x: gapX, z: -2.9 }, { x: gapX, z: FRONT.z }, FRONT, DOOR]
  }
  return [FRONT, DOOR]
}

function startLeaving(state: SimState, customer: Customer) {
  customer.state = 'leaving'
  customer.path = leavePath(customer)
  state.queue = state.queue.filter((id) => id !== customer.id)
  reassignSlots(state)
}

function openTicketFor(state: SimState, customer: Customer) {
  if (customer.basket.length === 0) {
    startLeaving(state, customer)
    return
  }
  if (state.ticket) return
  state.ticket = {
    customerId: customer.id,
    items: [...customer.basket],
    scanned: 0,
    total: 0,
  }
}

function enqueue(state: SimState, customer: Customer) {
  if (!state.queue.includes(customer.id)) state.queue.push(customer.id)
  customer.state = 'queued'
  reassignSlots(state)
}

function takeFromShelf(state: SimState, productId: string, count: number): number {
  const available = state.stock[productId] ?? 0
  const taken = Math.min(available, Math.max(0, Math.floor(count)))
  if (taken <= 0) return 0
  state.stock = { ...state.stock, [productId]: available - taken }
  return taken
}

function trySpawn(state: SimState) {
  if (state.customers.length >= MAX_CUSTOMERS) return

  const options = STANDS.filter((s) => (state.stock[s.productId] ?? 0) > 0)
  if (options.length === 0) return

  const target = options[Math.floor(Math.random() * options.length)]
  const customer: Customer = {
    id: state.nextCustomerId++,
    color: CUSTOMER_COLORS[Math.floor(Math.random() * CUSTOMER_COLORS.length)],
    state: 'toShelf',
    pos: { ...DOOR },
    yaw: 0,
    bob: 0,
    path: [FRONT, ...target.approach],
    targetProduct: target.productId,
    basket: [],
    timer: 0,
    slot: 0,
    speed: WALK_SPEED,
  }

  state.customers.push(customer)
}

// ------------------------------------------------------------------ cobros

function finishPayment(state: SimState): SimEvent[] {
  const pending = state.pending
  const ticket = state.ticket
  state.pending = null

  if (!pending || !ticket) {
    state.ticket = null
    return []
  }

  const { method, customerId, total } = pending
  const items = ticket.items.length

  state.ticket = null
  state.money = round2(state.money + total)
  state.sold += items

  const customer = findCustomer(state, customerId)
  if (customer) startLeaving(state, customer)

  const note = [5, 10, 20, 50].find((n) => n >= total) ?? Math.ceil(total / 50) * 50
  const change = round2(note - total)

  return [
    {
      text:
        method === 'cash'
          ? `Efectivo ${eur(note)} · cambio ${eur(change)}`
          : `Tarjeta aprobada · ${eur(total)}`,
      kind: 'ok',
    },
  ]
}

// --------------------------------------------------------------------- API

export function tick(state: SimState, dt: number): SimEvent[] {
  const events: SimEvent[] = []

  if (state.pending) {
    state.pending.remaining -= dt
    if (state.pending.remaining <= 0) events.push(...finishPayment(state))
  }

  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    state.spawnTimer = 2.5 + Math.random() * 3
    trySpawn(state)
  }

  for (let i = state.customers.length - 1; i >= 0; i--) {
    const customer = state.customers[i]

    switch (customer.state) {
      case 'toShelf': {
        if (advance(customer, dt)) {
          customer.state = 'shopping'
          customer.timer = 1 + Math.random() * 0.8
        }
        break
      }

      case 'shopping': {
        customer.timer -= dt
        if (customer.timer > 0) break

        const wanted = 1 + Math.floor(Math.random() * 2)
        const taken = takeFromShelf(state, customer.targetProduct, wanted)

        if (taken === 0) {
          startLeaving(state, customer) // no quedaba stock: se va sin comprar
          break
        }

        customer.basket = Array.from({ length: taken }, () => customer.targetProduct)
        customer.state = 'toTill'
        customer.path = tillPath(customer)
        break
      }

      case 'toTill': {
        if (advance(customer, dt)) enqueue(state, customer)
        break
      }

      case 'queued': {
        const target = QUEUE[Math.min(customer.slot, QUEUE.length - 1)]
        const distance = Math.hypot(target.x - customer.pos.x, target.z - customer.pos.z)

        if (distance > 0.04) {
          customer.path = [target]
          advance(customer, dt)
        } else {
          customer.yaw = Math.PI // mirando al mostrador
        }

        if (customer.slot === 0 && distance <= 0.08) {
          customer.state = 'atTill'
          customer.yaw = Math.PI
          openTicketFor(state, customer)
        }
        break
      }

      case 'atTill': {
        customer.yaw = Math.PI
        break
      }

      case 'leaving': {
        if (advance(customer, dt)) {
          state.customers.splice(i, 1)
        }
        break
      }
    }
  }

  return events
}

export function scanNext(state: SimState): SimEvent[] {
  if (state.pending) return []

  const ticket = state.ticket
  if (!ticket) return [{ text: 'No hay ningún cliente en la caja.', kind: 'warn' }]

  if (ticket.scanned >= ticket.items.length) {
    return [{ text: 'Todo escaneado · F efectivo · T tarjeta', kind: 'warn' }]
  }

  const product = productById(ticket.items[ticket.scanned])
  state.ticket = {
    ...ticket,
    scanned: ticket.scanned + 1,
    total: round2(ticket.total + product.price),
  }

  return [{ text: `${product.name} · ${eur(product.price)}`, kind: 'ok' }]
}

export function pay(state: SimState, method: PaymentMethod): SimEvent[] {
  if (state.pending) return []

  const ticket = state.ticket
  if (!ticket) return [{ text: 'No hay ningún cliente en la caja.', kind: 'warn' }]

  if (ticket.scanned < ticket.items.length) {
    const missing = ticket.items.length - ticket.scanned
    return [
      {
        text: `Faltan ${missing} ${missing === 1 ? 'producto' : 'productos'} por escanear.`,
        kind: 'warn',
      },
    ]
  }

  state.pending = {
    customerId: ticket.customerId,
    method,
    total: ticket.total,
    remaining: method === 'card' ? CARD_SECONDS : 0,
  }

  if (method === 'cash') return finishPayment(state)
  return []
}

export function restock(state: SimState): SimEvent[] {
  const missingUnits = PRODUCTS.reduce((acc, p) => acc + (SHELF_CAPACITY - state.stock[p.id]), 0)
  if (missingUnits === 0) return [{ text: 'Todas las estanterías están llenas.', kind: 'warn' }]

  const cost = round2(
    PRODUCTS.reduce((acc, p) => acc + (SHELF_CAPACITY - state.stock[p.id]) * p.cost, 0),
  )

  if (cost > state.money) {
    return [{ text: `Reponer cuesta ${eur(cost)} y tienes ${eur(state.money)}.`, kind: 'bad' }]
  }

  state.money = round2(state.money - cost)
  state.stock = emptyStock()
  return [{ text: `Repuesto · -${eur(cost)}`, kind: 'warn' }]
}

export function snapshotOf(state: SimState): Snapshot {
  return {
    money: state.money,
    stock: state.stock,
    sold: state.sold,
    ticket: state.ticket ? { ...state.ticket, items: [...state.ticket.items] } : null,
    cardPending: state.pending !== null,
    queueLength: state.queue.length,
    customers: state.customers.map((c) => ({
      id: c.id,
      color: c.color,
      state: c.state,
      pos: { x: c.pos.x, z: c.pos.z },
      yaw: c.yaw,
      bob: c.bob,
    })),
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      pos: { x: p.pos.x, z: p.pos.z },
      yaw: p.yaw,
    })),
  }
}
