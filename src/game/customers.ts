import { COUNTER, SHELVES } from './world'
import { setPaidHandler, useGame } from './store'

/**
 * Motor de clientes.
 *
 * No vive en el estado de React: las posiciones cambian cada frame y
 * re-renderizar por frame no aporta nada. Aquí solo se guardan ids en el store
 * (cuando alguien entra o sale); el resto son mutaciones sobre estos objetos.
 */

export type Pt = { x: number; z: number }

export type CustomerState =
  | 'toShelf'
  | 'shopping'
  | 'toTill'
  | 'queued'
  | 'atTill'
  | 'leaving'

export type Customer = {
  id: number
  color: string
  state: CustomerState
  pos: Pt
  yaw: number
  path: Pt[]
  targetProduct: string
  basket: string[]
  timer: number
  slot: number
  speed: number
  bob: number
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
const COLORS = ['#e07a5f', '#3d8bfd', '#e8c547', '#9b5de5', '#00bbf9', '#f15bb5', '#2dd4bf']

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

const customers: Customer[] = []
const byId = new Map<number, Customer>()
let queue: number[] = []
let nextId = 1
let spawnTimer = 0.5

export function getCustomers(): readonly Customer[] {
  return customers
}

export function getCustomer(id: number): Customer | undefined {
  return byId.get(id)
}

function syncIds() {
  useGame.getState().setCustomerIds(customers.map((c) => c.id))
}

function reassignSlots() {
  queue.forEach((id, index) => {
    const customer = byId.get(id)
    if (customer) customer.slot = index
  })
  useGame.getState().setQueue(queue.length)
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

function startLeaving(customer: Customer) {
  customer.state = 'leaving'
  customer.path = leavePath(customer)
  queue = queue.filter((id) => id !== customer.id)
  reassignSlots()
}

function openTicketFor(customer: Customer) {
  if (customer.basket.length === 0) {
    startLeaving(customer)
    return
  }
  useGame.getState().openTicket(customer.id, customer.basket)
}

function enqueue(customer: Customer) {
  if (!queue.includes(customer.id)) queue.push(customer.id)
  customer.state = 'queued'
  reassignSlots()
}

function trySpawn() {
  if (customers.length >= MAX_CUSTOMERS) return

  const stock = useGame.getState().stock
  const options = STANDS.filter((s) => (stock[s.productId] ?? 0) > 0)
  if (options.length === 0) return

  const target = options[Math.floor(Math.random() * options.length)]
  const customer: Customer = {
    id: nextId++,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    state: 'toShelf',
    pos: { ...DOOR },
    yaw: 0,
    path: [FRONT, ...target.approach],
    targetProduct: target.productId,
    basket: [],
    timer: 0,
    slot: 0,
    speed: WALK_SPEED,
    bob: 0,
  }

  customers.push(customer)
  byId.set(customer.id, customer)
  syncIds()
}

setPaidHandler((customerId) => {
  const customer = byId.get(customerId)
  if (customer) startLeaving(customer)
})

export function updateCustomers(dt: number) {
  spawnTimer -= dt
  if (spawnTimer <= 0) {
    spawnTimer = 2.5 + Math.random() * 3
    trySpawn()
  }

  for (let i = customers.length - 1; i >= 0; i--) {
    const customer = customers[i]

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
        const taken = useGame.getState().takeFromShelf(customer.targetProduct, wanted)

        if (taken === 0) {
          startLeaving(customer) // no quedaba stock: se va sin comprar
          break
        }

        customer.basket = Array.from({ length: taken }, () => customer.targetProduct)
        customer.state = 'toTill'
        customer.path = tillPath(customer)
        break
      }

      case 'toTill': {
        if (advance(customer, dt)) enqueue(customer)
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
          openTicketFor(customer)
        }
        break
      }

      case 'atTill': {
        customer.yaw = Math.PI
        break
      }

      case 'leaving': {
        if (advance(customer, dt)) {
          customers.splice(i, 1)
          byId.delete(customer.id)
          syncIds()
        }
        break
      }
    }
  }
}

/** Detiene la simulación y vacía la tienda (por si se reinicia la partida). */
export function resetCustomers() {
  customers.length = 0
  byId.clear()
  queue = []
  spawnTimer = 0.5
  syncIds()
  useGame.getState().setQueue(0)
}
