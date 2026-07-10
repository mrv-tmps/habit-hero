import { BA_CANVAS_W } from '@/config/constants';
import { pickMapStructure, type MapStructure } from '@/lib/blastTerrain';

// Blast Arena map registry — like games.ts, adding a map here must never require
// touching the engine: structure, hazard, theme tokens, and backdrop all hang off
// the config entry.

// Same tiny PRNG as blastTerrain — duplicated per lib by house convention.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 'water' and 'lava' both enable the KO floor; the visual difference is pure theme
// tokens (orbit styles its 'water' floor as void).
export type BlastMapHazard = 'none' | 'water' | 'lava';

export interface BackdropColors {
  deco: string;
  cloud: string;
}

export interface BlastMapConfig {
  id: string;
  label: string;
  structure: MapStructure;
  // Value for the data-ba-map attribute that scopes this map's --ba-* tokens
  themeAttr: string;
  hazard: BlastMapHazard;
  // Seeded pixel decorations painted once behind the terrain, sky band only
  paintBackdrop: (ctx: CanvasRenderingContext2D, rng: () => number, colors: BackdropColors) => void;
}

export const RANDOM_MAP_ID = 'random';

// Highest terrain surface is y=70 (blastTerrain MIN_SURFACE), so decorations in
// this band are never buried.
const SKY_BAND_H = 66;

function paintClouds(ctx: CanvasRenderingContext2D, rng: () => number, colors: BackdropColors): void {
  ctx.fillStyle = colors.cloud;
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rng() * (BA_CANVAS_W - 46));
    const y = 6 + Math.floor(rng() * (SKY_BAND_H - 26));
    const w = 20 + Math.floor(rng() * 26);
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x + 3, y - 2, Math.floor(w * 0.6), 2);
    ctx.fillRect(x + 5, y + 3, Math.floor(w * 0.7), 2);
  }
}

function paintEmbers(ctx: CanvasRenderingContext2D, rng: () => number, colors: BackdropColors): void {
  ctx.fillStyle = colors.deco;
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rng() * BA_CANVAS_W);
    const y = 8 + Math.floor(rng() * (SKY_BAND_H - 8));
    ctx.globalAlpha = 0.25 + rng() * 0.5;
    const s = rng() < 0.25 ? 2 : 1;
    ctx.fillRect(x, y, s, s);
  }
}

function paintSnow(ctx: CanvasRenderingContext2D, rng: () => number, colors: BackdropColors): void {
  ctx.fillStyle = colors.deco;
  for (let i = 0; i < 36; i++) {
    const x = Math.floor(rng() * BA_CANVAS_W);
    const y = Math.floor(rng() * SKY_BAND_H);
    ctx.globalAlpha = 0.35 + rng() * 0.45;
    ctx.fillRect(x, y, 1, 1);
  }
}

function paintStars(ctx: CanvasRenderingContext2D, rng: () => number, colors: BackdropColors): void {
  ctx.fillStyle = colors.deco;
  for (let i = 0; i < 48; i++) {
    const x = 1 + Math.floor(rng() * (BA_CANVAS_W - 2));
    const y = 1 + Math.floor(rng() * (SKY_BAND_H - 2));
    ctx.globalAlpha = 0.3 + rng() * 0.7;
    ctx.fillRect(x, y, 1, 1);
    // A few bright stars get a plus-sign twinkle
    if (rng() < 0.12) {
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
  }
}

export const BLAST_MAPS: BlastMapConfig[] = [
  { id: 'grasslands', label: 'Grasslands', structure: 'hills', themeAttr: 'grasslands', hazard: 'none', paintBackdrop: paintClouds },
  { id: 'volcano', label: 'Volcano', structure: 'pillars', themeAttr: 'volcano', hazard: 'lava', paintBackdrop: paintEmbers },
  { id: 'tundra', label: 'Tundra', structure: 'caverns', themeAttr: 'tundra', hazard: 'none', paintBackdrop: paintSnow },
  { id: 'orbit', label: 'Orbit', structure: 'islands', themeAttr: 'orbit', hazard: 'water', paintBackdrop: paintStars },
];

// 'random' / null / unknown ids resolve via the shared seed — deterministic, so
// every multiplayer client agrees with no extra messages. Reuses pickMapStructure
// so the distribution matches the pre-picker random behavior.
export function resolveBlastMap(mapId: string | null | undefined, seed: number): BlastMapConfig {
  const explicit = BLAST_MAPS.find(m => m.id === mapId);
  if (explicit) return explicit;
  const structure = pickMapStructure(seed);
  return BLAST_MAPS.find(m => m.structure === structure) ?? BLAST_MAPS[0];
}

export function paintMapBackdrop(
  ctx: CanvasRenderingContext2D,
  map: BlastMapConfig,
  seed: number,
  colors: BackdropColors,
): void {
  const rng = mulberry32(seed ^ 0x51ed270b);
  ctx.save();
  map.paintBackdrop(ctx, rng, colors);
  ctx.restore();
}
