import type { Product } from './types';

const photosByName: Record<string, string> = {
  'Оқ балиқ': '/menu/fried-carp.jpg',
  Сазан: '/menu/fried-carp.jpg',
  Табака: '/menu/tabaka.jpg',
  'Шўр карам': '/menu/cabbage-salad.jpg',
  'Ёғли карам': '/menu/cabbage-salad.jpg',
  Сузма: '/menu/suzma.jpg',
  Нон: '/menu/bread.jpg',
  'Нон яримта': '/menu/bread.jpg',
  Чой: '/menu/black-tea.jpg',
  'Cola 1L': '/menu/cola.jpg',
  'Pepsi 1L': '/menu/pepsi.jpg',
  'Fanta 1L': '/menu/fanta.jpg',
  'Ҳамза сув': '/menu/water.jpg',
};

export function menuImageFor(product: Product): string | null {
  return product.thumbnailUrl || product.imageUrl || photosByName[product.name] || null;
}