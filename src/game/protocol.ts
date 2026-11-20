import type { PaymentMethod, SimEvent, Snapshot } from './sim'

/** Mensajes cliente → servidor. */
export type ClientMessage =
  | { t: 'hello'; name: string }
  | { t: 'move'; x: number; z: number; yaw: number }
  | { t: 'scan' }
  | { t: 'pay'; method: PaymentMethod }
  | { t: 'restock' }

/** Mensajes servidor → cliente. */
export type ServerMessage =
  | { t: 'welcome'; playerId: string; name: string; room: string }
  | { t: 'snapshot'; snap: Snapshot }
  | { t: 'events'; events: SimEvent[] }
  | { t: 'error'; message: string }
