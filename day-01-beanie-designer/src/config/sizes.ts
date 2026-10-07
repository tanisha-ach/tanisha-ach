export type SizeId = 'baby' | 'toddler' | 'child' | 'adult-s' | 'adult-m' | 'adult-l';

export interface HatSize {
  id: SizeId;
  name: string;
  /** Head circumference range the size is meant to fit, in inches. */
  head: [number, number];
}

export const HAT_SIZES: HatSize[] = [
  { id: 'baby', name: 'Baby', head: [14, 16] },
  { id: 'toddler', name: 'Toddler', head: [16, 18] },
  { id: 'child', name: 'Child', head: [18, 20] },
  { id: 'adult-s', name: 'Adult S', head: [20, 21.5] },
  { id: 'adult-m', name: 'Adult M', head: [21.5, 22.5] },
  { id: 'adult-l', name: 'Adult L', head: [22.5, 24] },
];

export const getSize = (id: string): HatSize => HAT_SIZES.find((s) => s.id === id) ?? HAT_SIZES[4];
