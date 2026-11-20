import { create } from 'zustand'
import {
  createSim,
  pay as simPay,
  restock as simRestock,
  scanNext as simScan,
  tick as simTick,
  type PaymentMethod,
  type SimEvent,
  type SimState,
  type Snapshot,
  type Ticket,
} from './sim'
import { live, type ConnectionMode } from './live'
import { initNet, net } from './net'

export type ToastKind = 'ok' | 'warn' | 'bad'
export type Toast = { id: number; text: string; kind: ToastKind }

export type Interaction = { kind: 'checkout' } | { kind: 'restock' }
export type { PaymentMethod }

export function interactionKey(interaction: Interaction): string {
  return interaction.kind
}

/** La simulación local (modo un jugador). En coop manda el servidor. */
const local = createSim()

let toastSeq = 0

type HudPatch = {
  money: number
  stock: Record<string, number>
  sold: number
  queueLength: number
  ticket: Ticket | null
  cardPending: boolean
  customerIds: number[]
  remoteIds: string[]
}

function sameIds(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function sameStrings(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function sameStock(a: Record<string, number>, b: Record<string, number>) {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}

function sameTicket(a: Ticket | null, b: Ticket | null) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.customerId === b.customerId &&
    a.scanned === b.scanned &&
    a.total === b.total &&
    a.items.length === b.items.length
  )
}

function hudFromSim(state: SimState): HudPatch {
  return {
    money: state.money,
    stock: state.stock,
    sold: state.sold,
    queueLength: state.queue.length,
    ticket: state.ticket,
    cardPending: state.pending !== null,
    customerIds: state.customers.map((c) => c.id),
    remoteIds: [],
  }
}

function hudFromSnapshot(snap: Snapshot): HudPatch {
  return {
    money: snap.money,
    stock: snap.stock,
    sold: snap.sold,
    queueLength: snap.queueLength,
    ticket: snap.ticket,
    cardPending: snap.cardPending,
    customerIds: snap.customers.map((c) => c.id),
    remoteIds: snap.players.filter((p) => p.id !== live.myId).map((p) => p.id),
  }
}

type GameState = {
  money: number
  stock: Record<string, number>
  sold: number

  ticket: Ticket | null
  cardPending: boolean
  queueLength: number
  customerIds: number[]
  remoteIds: string[]

  connection: ConnectionMode
  playerCount: number

  hoverKey: string | null
  toast: Toast | null

  say: (text: string, kind?: ToastKind) => void
  clearToast: () => void
  setHover: (key: string | null) => void
  setConnection: (mode: ConnectionMode, players: number) => void
  applyHud: (patch: HudPatch) => void

  scanNext: () => void
  pay: (method: PaymentMethod) => void
  restock: () => void
}

export const useGame = create<GameState>((set) => ({
  money: local.money,
  stock: local.stock,
  sold: local.sold,

  ticket: null,
  cardPending: false,
  queueLength: 0,
  customerIds: [],
  remoteIds: [],

  connection: 'local',
  playerCount: 1,

  hoverKey: null,
  toast: null,

  say: (text, kind = 'ok') => set({ toast: { id: ++toastSeq, text, kind } }),
  clearToast: () => set({ toast: null }),
  setHover: (key) => set((s) => (s.hoverKey === key ? s : { hoverKey: key })),

  setConnection: (mode, players) =>
    set((s) =>
      s.connection === mode && s.playerCount === players ? s : { connection: mode, playerCount: players },
    ),

  /** Solo escribe las claves que han cambiado: un snapshot a 15 Hz no debe repintar el HUD. */
  applyHud: (patch) =>
    set((s) => {
      const next: Partial<GameState> = {}
      if (s.money !== patch.money) next.money = patch.money
      if (s.sold !== patch.sold) next.sold = patch.sold
      if (s.queueLength !== patch.queueLength) next.queueLength = patch.queueLength
      if (s.cardPending !== patch.cardPending) next.cardPending = patch.cardPending
      if (!sameStock(s.stock, patch.stock)) next.stock = patch.stock
      if (!sameTicket(s.ticket, patch.ticket)) next.ticket = patch.ticket
      if (!sameIds(s.customerIds, patch.customerIds)) next.customerIds = patch.customerIds
      if (!sameStrings(s.remoteIds, patch.remoteIds)) next.remoteIds = patch.remoteIds
      return Object.keys(next).length > 0 ? next : s
    }),

  scanNext: () => {
    if (live.mode === 'online') {
      net.send({ t: 'scan' })
      return
    }
    if (live.mode !== 'local') return
    pushEvents(simScan(local))
    refreshLocal()
  },

  pay: (method) => {
    if (live.mode === 'online') {
      net.send({ t: 'pay', method })
      return
    }
    if (live.mode !== 'local') return
    pushEvents(simPay(local, method))
    refreshLocal()
  },

  restock: () => {
    if (live.mode === 'online') {
      net.send({ t: 'restock' })
      return
    }
    if (live.mode !== 'local') return
    pushEvents(simRestock(local))
    refreshLocal()
  },
}))

// ------------------------------------------------------------------- puente

function pushEvents(events: SimEvent[]) {
  const last = events[events.length - 1]
  if (last) useGame.getState().say(last.text, last.kind)
}

function refreshLocal() {
  live.customers = local.customers
  live.players = []
  useGame.getState().applyHud(hudFromSim(local))
}

/** Avanza la tienda en modo un jugador. En coop lo hace el servidor. */
export function tickWorld(dt: number) {
  if (live.mode !== 'local') return
  pushEvents(simTick(local, dt))
  refreshLocal()
}

/** Conecta (si hay servidor) y engancha los snapshots al HUD y al render. */
export function initNetwork() {
  initNet({
    onWelcome: (playerId, name) => {
      live.myId = playerId
      live.myName = name
    },
    onSnapshot: (snap) => {
      live.customers = snap.customers
      live.players = snap.players
      live.mode = 'online'
      const game = useGame.getState()
      game.applyHud(hudFromSnapshot(snap))
      game.setConnection('online', snap.players.length)
    },
    onEvents: (events) => pushEvents(events),
    onStatus: (mode, players) => {
      if (mode === 'local') {
        live.customers = local.customers
        live.players = []
      }
      useGame.getState().setConnection(mode, players)
    },
  })
}
