import type { CustomerView, PlayerView } from './sim'

export type ConnectionMode = 'local' | 'connecting' | 'online'

/**
 * Estado "vivo" para el render 3D.
 *
 * Se actualiza muchas veces por segundo, así que no pasa por React: las mallas
 * leen de aquí en su propio `useFrame`. React solo se entera de los ids.
 */
export const live = {
  mode: 'local' as ConnectionMode,
  customers: [] as CustomerView[],
  players: [] as PlayerView[],
  myId: '',
  myName: '',
}
