# Supermarket Simulator — Web

Prototipo jugable en primera persona de un simulador de supermercado, hecho para el navegador
con React Three Fiber (Three.js) y Zustand.

Eres el cajero —de pie detrás del mostrador— y también el reponedor: los clientes recorren la
tienda, llenan su cesta y se ponen en cola delante de la caja. Tú escaneas sus productos y
cobras en efectivo o con tarjeta.

Incluye **cooperativo**: varios cajeros en la misma tienda, con el servidor como autoridad.

## Ejecutar

```bash
npm install

npm run dev        # http://localhost:5173  (un jugador, sin servidor)
npm run start      # http://localhost:8080  (servidor coop + build servida)
npm run server     # solo el servidor, con recarga al editar (puerto 8080)
npm run build      # comprueba tipos y genera dist/
```

Para desarrollo con servidor:

```bash
npm run build      # el servidor sirve dist/
npm run server     # en una terminal
# en otra:
$env:VITE_SERVER_URL='ws://localhost:8080'; npm run dev
```

## Cómo se juega

| Acción | Control |
| --- | --- |
| Moverse | `W` `A` `S` `D` |
| Correr | `Shift` |
| Mirar | Ratón (pointer lock) · flechas o arrastrar con el botón izquierdo si el navegador no permite capturar el ratón |
| Escanear producto | `E` mirando la caja |
| Cobrar en efectivo | `F` |
| Cobrar con tarjeta | `T` |
| Reponer estanterías | `E` mirando el palé del almacén |
| Pausa | `Esc` |

Bucle de juego:

1. Entran clientes por la puerta, van a una estantería con stock y cogen 1–2 unidades.
   El stock baja de verdad: las cajas desaparecen del estante.
2. Se ponen en cola delante de la caja (máximo 3 en la tienda).
3. Cuando llegan al mostrador, sus productos aparecen encima. Míralos y pulsa `E` para
   escanearlos uno a uno; el ticket se va sumando en el panel de la caja.
4. Con todo escaneado, cobra:
   - `F` **efectivo**: el cliente paga con el billete más pequeño posible (5/10/20/50 €) y verás
     el cambio.
   - `T` **tarjeta**: el datáfono procesa el pago durante ~1,5 s y lo aprueba.
5. El cliente se va y el siguiente de la cola avanza. El dinero entra en tu caja.
6. Cuando las estanterías se vacíen, repón en el palé del almacén pagando el precio de coste.

Empiezas con 24,50 € y márgenes distintos por producto (por ejemplo: manzanas 3,20 € de venta
frente a 1,55 € de coste). Si no repones, los clientes se van sin comprar.

## Cooperativo

El servidor es la única autoridad sobre dinero, stock, tickets y clientes. El cliente solo envía
movimiento y órdenes (`scan`, `pay`, `restock`); recibe snapshots a 15 Hz y suaviza las
posiciones para que los clientes y los compañeros se muevan fluido.

- **Salas**: `?sala=codigo` en la URL (por defecto `main`). Cada sala tiene su tienda y su tick.
- **Modos**:
  - URL explícita (`VITE_SERVER_URL`) → coop obligatorio; reintenta si el servidor cae.
  - `npm run dev` sin URL → un jugador.
  - Build servida por el propio servidor → detecta `/ws` en el mismo origen automáticamente.
  - Build estática (GitHub Pages, etc.) → intenta `/ws`, falla y cae a un jugador.
- **Jugadores**: hasta 3–4 sin problema (las salas no tienen límite lógico, solo el de la cola).

### Exponerlo con Cloudflare Tunnel

El servidor sirve **la build y el WebSocket en el mismo puerto**, así que un único túnel basta:

```bash
npm run build
npm run start                                  # terminal 1
cloudflared tunnel --url http://localhost:8080 # terminal 2
```

Comparte la URL `https://algo-random.trycloudflare.com/?sala=amigos`. El túnel da TLS, así que el
cliente usa `wss://` sin configuración extra (el navegador rechaza `ws://` desde una página https).

Notas: el túnel rápido cambia de URL en cada arranque; para una URL fija, usa un túnel con
nombre y tu dominio. El PC debe estar encendido y sin suspensión. Si juegas en la misma red,
`npm run dev -- --host` y la IP local es más rápido y no depende de Cloudflare.

## Estructura

```
src/
  App.tsx               Canvas, estado de partida (menú/jugando) y pointer lock
  game/
    sim.ts              Núcleo de simulación puro: clientes, caja, stock, jugadores
    protocol.ts         Mensajes cliente ↔ servidor
    net.ts              Cliente WebSocket (salas, reintentos, envío de movimiento)
    live.ts             Estado para el render (posiciones), fuera de React
    store.ts            Store de Zustand: simulación local o réplica del servidor
    products.ts         Catálogo, precios, coste, formato de moneda
    world.ts            Dimensiones de la tienda, distribución, colisiones AABB
    labels.ts           Rótulos y nombres generados con CanvasTexture
  scene/
    Scene.tsx           Luces y composición de la escena
    StoreRoom.tsx       Suelo, paredes, puerta, techo y paneles de luz
    ShelfUnit.tsx       Estanterías; las cajas visibles son el stock real
    Checkout.tsx        Mostrador, escáner, datáfono y productos del cliente
    RestockPallet.tsx   Palé del almacén
    Customers.tsx       Clientes: pintan `live.customers` y avanzan la sim local
    RemotePlayers.tsx   Avatares de los demás cajeros, con nombre
    Person.tsx          Avatar low-poly compartido (clientes y jugadores)
    Interactable.tsx    Grupo apuntable + hitbox invisible
    Player.tsx          Primera persona: colisiones, raycast y envío de posición
  ui/
    HUD.tsx             Dinero, ticket, stock, conexión, pistas y pantalla de inicio
server/
  index.ts              Servidor autoritativo: salas, tick 15 Hz, estáticos y /health
```

Decisiones de diseño:

- **Un solo núcleo (`sim.ts`) para cliente y servidor**. No hay dos implementaciones que se
  desincronicen: en coop manda el servidor y en local corre el mismo código en el navegador.
- **Posiciones fuera de React**: `live.ts` se muta muchas veces por segundo y las mallas lo leen
  en su propio `useFrame`; React solo se entera de los ids (apariciones y desapariciones).
- **Snapshots completos a 15 Hz** en lugar de deltas: con 3–4 jugadores son ~0,5 KB por envío.
  Si algún día crece, el siguiente paso es delta + interés por zona.
- **Rutas por waypoints**, no pathfinding: la tienda es una rejilla conocida.
- **Sin físicas**: el jugador es un círculo contra cajas AABB; los clientes siguen rutas
  precalculadas y se desvanecen si te acercas demasiado (no hay colisión jugador-NPC).
- **Sin persistencia**: el estado vive en memoria de la sala y se pierde al vaciarse.

## Siguientes pasos sugeridos

1. **Paciencia**: si un cliente espera demasiado se va enfadado y pierdes la venta.
2. **Reconexión**: volver a la sala ocupando tu mismo avatar tras un corte de red.
3. **Más cesta**: que cada cliente visite 2–3 estanterías en lugar de una.
4. **Pedidos de stock**: comprar al por mayor y esperar la entrega en vez de reponer al instante.
5. **Progresión**: alquiler diario, ampliar la tienda, contratar a un reponedor.
6. **Persistencia**: guardar la sala en SQLite/Postgres para que sobreviva al reinicio.
