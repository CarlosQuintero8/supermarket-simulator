import { useEffect, useMemo } from 'react'
import { PRODUCTS, SHELF_CAPACITY, eur, productById, round2 } from '../game/products'
import { useGame } from '../game/store'
import { net } from '../game/net'

type Props = { playing: boolean; onPlay: () => void }

type Hint = { text: string; sub?: string }

function hintFor(hoverKey: string | null, ticketCount: number, scanned: number): Hint | null {
  if (!hoverKey) return null

  if (hoverKey === 'checkout') {
    if (ticketCount === 0) return { text: 'Caja libre', sub: 'Esperando al próximo cliente' }
    if (scanned < ticketCount) {
      const missing = ticketCount - scanned
      return {
        text: 'Escanear',
        sub: `Queda ${missing} ${missing === 1 ? 'producto' : 'productos'}`,
      }
    }
    return { text: 'Cobrar', sub: 'F efectivo · T tarjeta' }
  }

  if (hoverKey === 'restock') {
    return { text: 'Reponer', sub: 'Rellenar todas las estanterías' }
  }

  return null
}

export function HUD({ playing, onPlay }: Props) {
  const money = useGame((s) => s.money)
  const stock = useGame((s) => s.stock)
  const sold = useGame((s) => s.sold)
  const ticket = useGame((s) => s.ticket)
  const cardPending = useGame((s) => s.cardPending)
  const queueLength = useGame((s) => s.queueLength)
  const customerCount = useGame((s) => s.customerIds.length)
  const hoverKey = useGame((s) => s.hoverKey)
  const toast = useGame((s) => s.toast)
  const clearToast = useGame((s) => s.clearToast)
  const connection = useGame((s) => s.connection)
  const playerCount = useGame((s) => s.playerCount)

  const restockCost = useMemo(
    () =>
      round2(
        PRODUCTS.reduce((acc, p) => acc + (SHELF_CAPACITY - (stock[p.id] ?? 0)) * p.cost, 0),
      ),
    [stock],
  )

  const hint = hintFor(hoverKey, ticket?.items.length ?? 0, ticket?.scanned ?? 0)
  const allScanned = ticket !== null && ticket.scanned === ticket.items.length
  const waiting = Math.max(0, queueLength - 1)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(clearToast, 2400)
    return () => window.clearTimeout(timer)
  }, [toast, clearToast])

  return (
    <div className="hud">
      {/* Dinero + ventas */}
      <div className="panel money-panel">
        <div className="money">{eur(money)}</div>
        <div className="muted small">
          {sold} {sold === 1 ? 'artículo vendido' : 'artículos vendidos'}
        </div>
      </div>

      {/* Estado de conexión */}
      <div className={`conn ${connection}`}>
        <span className="conn-dot" />
        {connection === 'online'
          ? `En línea · ${playerCount} ${playerCount === 1 ? 'jugador' : 'jugadores'}`
          : connection === 'connecting'
            ? 'Conectando…'
            : 'Un jugador'}
      </div>

      {/* Caja */}
      <div className="panel ticket-panel">
        <div className="panel-title">
          Caja
          <span className={waiting > 0 ? 'badge warn' : 'badge'}>
            {waiting > 0 ? `${waiting} esperando` : ticket ? 'atendiendo' : 'libre'}
          </span>
        </div>

        {!ticket ? (
          <div className="muted small">
            {customerCount > 0
              ? `${customerCount} ${customerCount === 1 ? 'cliente' : 'clientes'} en la tienda`
              : 'Sin clientes. Repón stock para que vuelvan.'}
          </div>
        ) : (
          <>
            <ul className="ticket-list">
              {ticket.items.map((productId, index) => {
                const product = productById(productId)
                const done = index < ticket.scanned
                return (
                  <li key={`${productId}-${index}`} className={done ? 'done' : ''}>
                    <span className="dot" style={{ background: product.color }} />
                    <span className="cart-name">{product.name}</span>
                    <span className="cart-price">{eur(product.price)}</span>
                    <span className="check">{done ? '✓' : '·'}</span>
                  </li>
                )
              })}
            </ul>

            <div className="cart-total">
              <span>
                {ticket.scanned} de {ticket.items.length}
              </span>
              <strong>{eur(ticket.total)}</strong>
            </div>

            {cardPending ? (
              <div className="card-pending small">Procesando tarjeta…</div>
            ) : allScanned ? (
              <div className="pay-buttons">
                <span className="pay">
                  <kbd>F</kbd> Efectivo
                </span>
                <span className="pay">
                  <kbd>T</kbd> Tarjeta
                </span>
              </div>
            ) : (
              <div className="muted small scan-hint">
                Mira el mostrador y pulsa <kbd>E</kbd> para escanear
              </div>
            )}
          </>
        )}
      </div>

      {/* Stock */}
      <div className="panel stock-panel">
        <div className="panel-title">
          Estanterías
          <span className={restockCost > 0 ? 'badge warn' : 'badge ok'}>
            {restockCost > 0 ? `${eur(restockCost)} reponer` : 'llenas'}
          </span>
        </div>
        <ul className="stock-list">
          {PRODUCTS.map((p) => {
            const count = stock[p.id] ?? 0
            const pct = (count / SHELF_CAPACITY) * 100
            return (
              <li key={p.id}>
                <span className="dot" style={{ background: p.color }} />
                <span className="stock-name">{p.name}</span>
                <span className="bar">
                  <span
                    className="bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: pct <= 25 ? '#f87171' : pct <= 60 ? '#fbbf24' : '#34d399',
                    }}
                  />
                </span>
                <span className="stock-count muted">
                  {count}/{SHELF_CAPACITY}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Retícula */}
      <div className={`crosshair ${hint ? 'active' : ''}`}>
        <span />
      </div>

      {/* Pista de interacción */}
      {hint && playing && (
        <div className="hint">
          <kbd>E</kbd>
          <span className="hint-text">
            <strong>{hint.text}</strong>
            {hint.sub && <em>{hint.sub}</em>}
          </span>
        </div>
      )}

      {/* Aviso temporal */}
      {toast && (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          {toast.text}
        </div>
      )}

      {playing && <div className="esc-hint">ESC para pausar</div>}

      {/* Pantalla de inicio / pausa */}
      {!playing && (
        <div className="overlay" onClick={onPlay}>
          <div className="card">
            <div className="kicker">Prototipo jugable · v0.2</div>
            <h1>Supermarket Simulator</h1>
            <p className="lead">
              Eres el cajero. Los clientes recorren la tienda, llenan su cesta y se ponen en cola:
              escanea sus productos y cóbrales en efectivo o con tarjeta. Repón en el almacén
              cuando se vacíen las estanterías.
            </p>

            {connection === 'online' && (
              <div className="room-line">
                Sala «{net.room}» · {playerCount}{' '}
                {playerCount === 1 ? 'jugador conectado' : 'jugadores conectados'} · comparte la URL
                para jugar juntos
              </div>
            )}

            <div className="controls">
              <div>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
                <span>Moverse</span>
              </div>
              <div>
                <kbd>Ratón</kbd>
                <span>Mirar</span>
              </div>
              <div>
                <kbd>Flechas</kbd>
                <span>Mirar (alternativa al ratón)</span>
              </div>
              <div>
                <kbd>E</kbd>
                <span>Escanear producto · reponer en el almacén</span>
              </div>
              <div>
                <kbd>F</kbd>
                <span>Cobrar en efectivo</span>
              </div>
              <div>
                <kbd>T</kbd>
                <span>Cobrar con tarjeta</span>
              </div>
              <div>
                <kbd>ESC</kbd>
                <span>Pausa</span>
              </div>
            </div>

            <button className="play" type="button" onClick={onPlay}>
              Jugar
            </button>
            <div className="muted small center">Requiere teclado y ratón</div>
          </div>
        </div>
      )}
    </div>
  )
}
