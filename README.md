# Supermarket Simulator — Web

Prototipo jugable en primera persona de un simulador de supermercado, hecho para el navegador
con React Three Fiber (Three.js) y Zustand.

Eres el cajero —de pie detrás del mostrador— y también el reponedor: los clientes recorren la
tienda, llenan su cesta y se ponen en cola delante de la caja. Tú escaneas sus productos y
cobras en efectivo o con tarjeta.

## Ejecutar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # comprueba tipos y genera dist/
npm run preview  # sirve la build
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

## Estructura

```
src/
  App.tsx               Canvas, estado de partida (menú/jugando) y pointer lock
  game/
    products.ts         Catálogo, precios, coste, formato de moneda
    world.ts            Dimensiones de la tienda, distribución, colisiones AABB
    store.ts            Estado del juego (dinero, stock, ticket) con Zustand
    customers.ts        Motor de clientes: rutas, estados, cola y cobro
    labels.ts           Rótulos generados con CanvasTexture
  scene/
    Scene.tsx           Luces y composición de la escena
    StoreRoom.tsx       Suelo, paredes, puerta, techo y paneles de luz
    ShelfUnit.tsx       Estanterías; las cajas visibles son el stock real
    Checkout.tsx        Mostrador, escáner, datáfono y productos del cliente
    RestockPallet.tsx   Palé del almacén
    Customers.tsx       NPCs (mallas low-poly) y tick de la simulación
    Interactable.tsx    Grupo apuntable + hitbox invisible
    Player.tsx          Cámara en primera persona, colisiones y raycast de interacción
  ui/
    HUD.tsx             Dinero, ticket de caja, stock, pistas y pantalla de inicio
```

Decisiones de diseño:

- **Posiciones de los NPC fuera de React**: el motor muta objetos normales y el store solo
  guarda los ids. Así no hay re-render por frame con 3 clientes moviéndose.
- **Rutas por waypoints**, no pathfinding: la tienda es una rejilla conocida (pasillo frontal,
  huecos entre islas, pasillo lateral de la caja), así que cada recorrido es una lista fija de
  puntos. Cero coste de búsqueda.
- **Sin físicas**: el jugador es un círculo contra cajas AABB; los clientes siguen rutas
  precalculadas y no chocan entre sí.
- **Una sola caja**: el ticket abierto vive en el store, y el motor solo abre uno cuando el
  cliente llega al mostrador y no hay otro en curso.
- **Sin servidor**: el estado vive en memoria. El siguiente paso natural es guardarlo en
  `localStorage` con `persist` de Zustand.

## Siguientes pasos sugeridos

1. **Paciencia**: si un cliente espera demasiado se va enfadado y pierdes la venta.
2. **Más cesta**: que cada cliente visite 2–3 estanterías en lugar de una.
3. **Caja con cambio manual**: que el jugador elija los billetes y el cambio salga de la caja
   (con riesgo de error).
4. **Pedidos de stock**: comprar al por mayor y esperar la entrega en vez de reponer al instante.
5. **Progresión**: alquiler diario, ampliar la tienda, contratar a un reponedor.
6. **Guardado** con `persist` y versión del estado.
