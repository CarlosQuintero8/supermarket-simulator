export type Product = {
  id: string
  name: string
  price: number
  cost: number
  /** base color of the box on the shelf */
  color: string
  /** accent color for the label stripe */
  accent: string
}

export const SHELF_CAPACITY = 12
export const CART_MAX = 8

export const PRODUCTS: Product[] = [
  { id: 'leche', name: 'Leche', price: 2.5, cost: 1.2, color: '#e8eef7', accent: '#3b82f6' },
  { id: 'pan', name: 'Pan', price: 1.8, cost: 0.85, color: '#d9a066', accent: '#b45309' },
  { id: 'manzana', name: 'Manzanas', price: 3.2, cost: 1.55, color: '#e05252', accent: '#166534' },
  { id: 'cereal', name: 'Cereal', price: 4.5, cost: 2.3, color: '#f2c94c', accent: '#b91c1c' },
  { id: 'agua', name: 'Agua', price: 1.0, cost: 0.35, color: '#9ad6f2', accent: '#0369a1' },
  { id: 'cafe', name: 'Café', price: 5.9, cost: 3.1, color: '#6b4a34', accent: '#f59e0b' },
]

const byId = new Map(PRODUCTS.map((p) => [p.id, p]))

export function productById(id: string): Product {
  const p = byId.get(id)
  if (!p) throw new Error(`Producto desconocido: ${id}`)
  return p
}

export function eur(value: number): string {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}
