import { Checkout } from './Checkout'
import { Customers } from './Customers'
import { Player } from './Player'
import { RemotePlayers } from './RemotePlayers'
import { RestockPallet } from './RestockPallet'
import { ShelfUnits } from './ShelfUnit'
import { StoreRoom } from './StoreRoom'
import { SHELVES } from '../game/world'

export function Scene({ playing }: { playing: boolean }) {
  return (
    <>
      <color attach="background" args={['#0a1020']} />
      <fog attach="fog" args={['#0a1020', 16, 38]} />

      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#cfe3ff', '#1a2333', 0.8]} />
      <directionalLight position={[6, 11, 5]} intensity={0.75} color="#fff4e2" />
      <directionalLight position={[-9, 8, -7]} intensity={0.25} color="#9ec5ff" />

      <StoreRoom />
      <ShelfUnits shelves={SHELVES} />
      <Checkout />
      <RestockPallet />
      <Customers playing={playing} />
      <RemotePlayers />
      <Player playing={playing} />
    </>
  )
}
