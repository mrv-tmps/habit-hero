// Player slot colors — tokens defined in src/index.css (:root --player-1..8).

const PLAYER_SLOT_COLORS = [
  'bg-[hsl(var(--player-1))]',
  'bg-[hsl(var(--player-2))]',
  'bg-[hsl(var(--player-3))]',
  'bg-[hsl(var(--player-4))]',
  'bg-[hsl(var(--player-5))]',
  'bg-[hsl(var(--player-6))]',
  'bg-[hsl(var(--player-7))]',
  'bg-[hsl(var(--player-8))]',
];

export function slotColor(idx: number): string {
  return PLAYER_SLOT_COLORS[idx % PLAYER_SLOT_COLORS.length];
}

// Raw HSL var reference for style-prop usage (e.g. progress bar fill color).
export function slotColorVar(idx: number): string {
  return `hsl(var(--player-${(idx % PLAYER_SLOT_COLORS.length) + 1}))`;
}
