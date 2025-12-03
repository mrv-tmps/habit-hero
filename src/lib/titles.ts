// src/lib/titles.ts

export interface TitleTier {
  minXp: number;
  name: string;
}

export function getStarCountForTitle(title: string): number {
  const index = TITLE_TIERS.findIndex(t => t.name === title);
  if (index === -1) return 1; // fallback

  if (index <= 2) return 1;       // New Traveler → Iron Will
  if (index <= 5) return 2;       // Dawn Breaker → Unbroken
  if (index <= 8) return 3;       // Titan Awakened → Eternal Flame
  if (index <= 12) return 4;      // Mythic → Legend Forged
  return 5;                       // Immortal → Shadow Monarch
}

export const TITLE_TIERS: TitleTier[] = [
  { minXp: 0, name: 'New Traveler' },
  { minXp: 50, name: 'Rising Flame' },
  { minXp: 150, name: 'Iron Will' },
  { minXp: 300, name: 'Dawn Breaker' },
  { minXp: 600, name: 'Storm Chaser' },
  { minXp: 1000, name: 'Unbroken' },
  { minXp: 2000, name: 'Titan Awakened' },
  { minXp: 3500, name: 'Void Walker' },
  { minXp: 5000, name: 'Eternal Flame' },
  { minXp: 8000, name: 'Mythic' },
  { minXp: 12000, name: 'Ascended' },
  { minXp: 20000, name: 'Legend Forged' },
  { minXp: 35000, name: 'Immortal' },
  { minXp: 50000, name: 'Origin' },
  { minXp: 75000, name: 'Apex' },
  { minXp: 100000, name: 'Shadow Monarch' },
];

export function getTitleForXp(totalXp: number): TitleTier {
  let current = TITLE_TIERS[0];
  for (const tier of TITLE_TIERS) {
    if (totalXp >= tier.minXp) current = tier;
    else break;
  }
  return current;
}
