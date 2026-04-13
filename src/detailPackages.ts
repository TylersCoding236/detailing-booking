export type DetailPackageKey = 'exterior' | 'interior' | 'full';

export type DetailPackage = {
  key: DetailPackageKey;
  icon: string;
  title: string;
  price: number;
  description: string;
  displayOrder: number;
};

export const DETAIL_PACKAGES: DetailPackage[] = [
  {
    key: 'exterior',
    icon: 'EX',
    title: 'Exterior Refresh',
    price: 50,
    description: 'Hand wash, dry, wheels, and glass cleaned for a solid reset.',
    displayOrder: 1,
  },
  {
    key: 'interior',
    icon: 'IN',
    title: 'Interior Reset',
    price: 50,
    description: 'Vacuum, wipe-down, and the main interior surfaces cleaned up properly.',
    displayOrder: 2,
  },
  {
    key: 'full',
    icon: 'FD',
    title: 'Full Detail',
    price: 70,
    description: 'A complete inside-and-out service for the cleanest overall finish.',
    displayOrder: 3,
  },
];

export function getDetailPackageKey(name: string): DetailPackageKey | null {
  const value = name.trim().toLowerCase();
  if (value.includes('exterior')) return 'exterior';
  if (value.includes('interior')) return 'interior';
  if (value.includes('full')) return 'full';
  return null;
}
