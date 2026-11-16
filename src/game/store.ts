import { create } from 'zustand'
import { PRODUCTS, SHELF_CAPACITY, eur, productById, round2 } from './products'

export type ToastKind = 'ok' | 'warn' | 'bad'
export type Toast = { id: number; text: string; kind: ToastKind }

export type Interaction = { kind: 'checkout' } | { kind: 'restock' }
export type PaymentMethod = 'cash' | 'card'

export type Ticket = {
  customerId: number
  items: string[]
  /** productos ya escaneados (los N primeros de `items`) */
  scanned: number
  /** subtotal de lo escaneado */
  total: number
}

let toastSeq = 0

/**
 * El motor de clientes avisa aquí cuando un cobro se completa.
 * Se registra desde `customers.ts` para que el store no dependa de él.
 */
export type PaidHandler = (customerId: number, method: PaymentMethod, total: number) => void

let onPaid: PaidHandler | null = null
export function setPaidHandler(handler: PaidHandler) {
  onPaid = handler
}

export function interactionKey(interaction: Interaction): string {
  return interaction.kind
}

function emptyStock(): Record<string, number> {
  return Object.fromEntries(PRODUCTS.map((p) => [p.id, SHELF_CAPACITY]))
}

type GameState = {
  money: number
  stock: Record<string, number>
  sold: number

  ticket: Ticket | null
  cardPending: boolean
  queueLength: number
  customerIds: number[]

  hoverKey: string | null
  toast: Toast | null

  say: (text: string, kind?: ToastKind) => void
  clearToast: () => void
  setHover: (key: string | null) => void

  openTicket: (customerId: number, items: string[]) => void
  scanNext: () => void
  pay: (method: PaymentMethod) => void

  takeFromShelf: (productId: string, count: number) => number
  setQueue: (length: number) => void
  setCustomerIds: (ids: number[]) => void

  restock: () => void
  reset: () => void
}

export const useGame = create<GameState>((set, get) => ({
  money: 24.5,
  stock: emptyStock(),
  sold: 0,

  ticket: null,
  cardPending: false,
  queueLength: 0,
  customerIds: [],

  hoverKey: null,
  toast: null,

  say: (text, kind = 'ok') => set({ toast: { id: ++toastSeq, text, kind } }),
  clearToast: () => set({ toast: null }),
  setHover: (key) => set((s) => (s.hoverKey === key ? s : { hoverKey: key })),

  setQueue: (length) => set((s) => (s.queueLength === length ? s : { queueLength: length })),
  setCustomerIds: (ids) => set({ customerIds: ids }),

  /** Un cliente llega al mostrador con su cesta. */
  openTicket: (customerId, items) =>
    set((s) => {
      if (s.ticket || items.length === 0) return s
      return { ticket: { customerId, items, scanned: 0, total: 0 } }
    }),

  scanNext: () => {
    const { ticket, cardPending, say } = get()
    if (cardPending) return
    if (!ticket) {
      say('No hay ningún cliente en la caja.', 'warn')
      return
    }
    if (ticket.scanned >= ticket.items.length) {
      say('Todo escaneado · F efectivo · T tarjeta', 'warn')
      return
    }

    const product = productById(ticket.items[ticket.scanned])
    set({
      ticket: {
        ...ticket,
        scanned: ticket.scanned + 1,
        total: round2(ticket.total + product.price),
      },
      toast: {
        id: ++toastSeq,
        kind: 'ok',
        text: `${product.name} · ${eur(product.price)}`,
      },
    })
  },

  pay: (method) => {
    const state = get()
    const ticket = state.ticket

    if (state.cardPending) return
    if (!ticket) {
      state.say('No hay ningún cliente en la caja.', 'warn')
      return
    }
    if (ticket.scanned < ticket.items.length) {
      const missing = ticket.items.length - ticket.scanned
      state.say(`Faltan ${missing} ${missing === 1 ? 'producto' : 'productos'} por escanear.`, 'warn')
      return
    }

    const { total, customerId } = ticket
    const itemCount = ticket.items.length

    const complete = () => {
      const current = get()
      const note = [5, 10, 20, 50].find((n) => n >= total) ?? Math.ceil(total / 50) * 50
      const change = round2(note - total)

      set({
        money: round2(current.money + total),
        sold: current.sold + itemCount,
        ticket: null,
        cardPending: false,
        toast: {
          id: ++toastSeq,
          kind: 'ok',
          text:
            method === 'cash'
              ? `Efectivo ${eur(note)} · cambio ${eur(change)}`
              : `Tarjeta aprobada · ${eur(total)}`,
        },
      })

      onPaid?.(customerId, method, total)
    }

    if (method === 'card') {
      set({ cardPending: true })
      window.setTimeout(complete, 1500)
    } else {
      complete()
    }
  },

  takeFromShelf: (productId, count) => {
    const { stock } = get()
    const available = stock[productId] ?? 0
    const taken = Math.min(available, Math.max(0, Math.floor(count)))
    if (taken <= 0) return 0
    set({ stock: { ...stock, [productId]: available - taken } })
    return taken
  },

  restock: () => {
    const { stock, money, say } = get()

    const missingUnits = PRODUCTS.reduce((acc, p) => acc + (SHELF_CAPACITY - stock[p.id]), 0)
    if (missingUnits === 0) {
      say('Todas las estanterías están llenas.', 'warn')
      return
    }

    const cost = round2(
      PRODUCTS.reduce((acc, p) => acc + (SHELF_CAPACITY - stock[p.id]) * p.cost, 0),
    )

    if (cost > money) {
      say(`Reponer cuesta ${eur(cost)} y tienes ${eur(money)}.`, 'bad')
      return
    }

    set({
      money: round2(money - cost),
      stock: emptyStock(),
      toast: { id: ++toastSeq, text: `Repuesto · -${eur(cost)}`, kind: 'warn' },
    })
  },

  reset: () =>
    set({
      money: 24.5,
      stock: emptyStock(),
      sold: 0,
      ticket: null,
      cardPending: false,
      queueLength: 0,
      customerIds: [],
      hoverKey: null,
      toast: null,
    }),
}))
