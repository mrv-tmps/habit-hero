// Cosmetic pixel-art sprites for Blast Arena. Render-only: nothing here may touch
// simulation state. Sprites are authored as char maps and rasterized once per palette
// color into cached offscreen canvases (equivalent to tinting one sheet per player,
// without the compositing round-trip).

export const UNIT_SPR_W = 8;
export const UNIT_SPR_H = 10;

// Frame indices into the unit sheet
export const UNIT_FRAME = {
  idle1: 0,
  idle2: 1,
  walk1: 2,
  walk2: 3,
  aim: 4,
  fire: 5,
  hit: 6,
} as const;

const UNIT_FRAME_COUNT = 7;

// Chars: . transparent · B body (tint) · D body shade · O outline · W eye white · E pupil
const UNIT_MAPS: string[][] = [
  // idle1
  [
    '..OOOO..',
    '.OBBBBO.',
    'OBBBBBBO',
    'OBBBWEBO',
    'OBBBBBBO',
    'ODBBBBDO',
    '.ODBBDO.',
    '..OBBO..',
    '.OB..BO.',
    '.OO..OO.',
  ],
  // idle2 (blink)
  [
    '..OOOO..',
    '.OBBBBO.',
    'OBBBBBBO',
    'OBBBDDBO',
    'OBBBBBBO',
    'ODBBBBDO',
    '.ODBBDO.',
    '..OBBO..',
    '.OB..BO.',
    '.OO..OO.',
  ],
  // walk1
  [
    '..OOOO..',
    '.OBBBBO.',
    'OBBBBBBO',
    'OBBBWEBO',
    'OBBBBBBO',
    'ODBBBBDO',
    '.ODBBDO.',
    '..OBBO..',
    '.OB.BO..',
    '.OO.OO..',
  ],
  // walk2
  [
    '..OOOO..',
    '.OBBBBO.',
    'OBBBBBBO',
    'OBBBWEBO',
    'OBBBBBBO',
    'ODBBBBDO',
    '.ODBBDO.',
    '..OBBO..',
    '..OB.BO.',
    '..OO.OO.',
  ],
  // aim (eyes up)
  [
    '..OOOO..',
    '.OBBBBO.',
    'OBBBWEBO',
    'OBBBBBBO',
    'OBBBBBBO',
    'ODBBBBDO',
    '.ODBBDO.',
    '..OBBO..',
    '.OB..BO.',
    '.OO..OO.',
  ],
  // fire (eyes wide)
  [
    '..OOOO..',
    '.OBBBBO.',
    'OBBBWWBO',
    'OBBBBBBO',
    'OBBBBBBO',
    'ODBBBBDO',
    '.ODBBDO.',
    '..OBBO..',
    '.OB..BO.',
    '.OO..OO.',
  ],
  // hit (eyes squeezed shut)
  [
    '..OOOO..',
    '.OBBBBO.',
    'OBBBBBBO',
    'OBBBEEBO',
    'OBBBBBBO',
    'ODBBBBDO',
    '.ODBBDO.',
    '..OBBO..',
    '.OB..BO.',
    '.OO..OO.',
  ],
];

// Rocket points right; rotated to velocity at draw time. R body · N nose · F fins
const ROCKET_MAP = [
  'F.RRRR.',
  'FRRRRRN',
  'F.RRRR.',
];
export const ROCKET_W = 7;
export const ROCKET_H = 3;

// Grenade body; the fuse pixel at the top blinks (drawn separately). G shell
const GRENADE_MAP = [
  '..O..',
  '.OOO.',
  'OGGGO',
  'OGGGO',
  '.OOO.',
];
export const GRENADE_W = 5;
export const GRENADE_H = 5;

// Boot toe points right; rotated to velocity at draw time. L leather
const BOOT_MAP = [
  '..OLLO',
  '..OLLO',
  '.OLLLO',
  'OLLLLO',
  'OOOOOO',
];
export const BOOT_W = 6;
export const BOOT_H = 5;

// Supply crate: C planks (crate accent tint) · S diagonal straps
const CRATE_MAP = [
  'OOOOOOOO',
  'OSCCCCSO',
  'OCSCCSCO',
  'OCCSSCCO',
  'OCCSSCCO',
  'OCSCCSCO',
  'OSCCCCSO',
  'OOOOOOOO',
];
export const CRATE_W = 8;
export const CRATE_H = 8;

// Parachute canopy + strings, drawn above a falling crate. P canopy
const PARACHUTE_MAP = [
  '..OOOOOO..',
  '.OPPPPPPO.',
  'OPPPPPPPPO',
  'OOOOOOOOOO',
  '.O......O.',
  '..O....O..',
  '...O..O...',
];
export const PARACHUTE_W = 10;
export const PARACHUTE_H = 7;

// G stone · D inset cross
const TOMBSTONE_MAP = [
  '..OOOO..',
  '.OGGGGO.',
  '.OGDDGO.',
  '.OGDDGO.',
  '.OGGGGO.',
  '.OGGGGO.',
  'OOGGGGOO',
  'OOOOOOOO',
];
export const TOMBSTONE_W = 8;
export const TOMBSTONE_H = 8;

export interface SpriteColors {
  outline: string;
  eyeWhite: string;
  rocketBody: string;
  rocketNose: string;
  fin: string;
  grenadeShell: string;
  bootLeather: string;
  stone: string;
  crate: string;
  chute: string;
}

function rasterize(map: string[], w: number, h: number, colorFor: (ch: string) => string | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = colorFor(map[y]?.[x] ?? '.');
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

// One horizontal sheet of all unit frames tinted with the given body color.
// The shade char draws body color, then a translucent outline-color pass on top.
export function buildUnitSheet(bodyColor: string, colors: SpriteColors): HTMLCanvasElement {
  const sheet = document.createElement('canvas');
  sheet.width = UNIT_SPR_W * UNIT_FRAME_COUNT;
  sheet.height = UNIT_SPR_H;
  const ctx = sheet.getContext('2d');
  if (!ctx) return sheet;
  UNIT_MAPS.forEach((map, frame) => {
    const ox = frame * UNIT_SPR_W;
    for (let y = 0; y < UNIT_SPR_H; y++) {
      for (let x = 0; x < UNIT_SPR_W; x++) {
        const ch = map[y][x];
        if (ch === '.') continue;
        if (ch === 'B' || ch === 'D') {
          ctx.globalAlpha = 1;
          ctx.fillStyle = bodyColor;
          ctx.fillRect(ox + x, y, 1, 1);
          if (ch === 'D') {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = colors.outline;
            ctx.fillRect(ox + x, y, 1, 1);
            ctx.globalAlpha = 1;
          }
        } else {
          ctx.fillStyle = ch === 'W' ? colors.eyeWhite : colors.outline;
          ctx.fillRect(ox + x, y, 1, 1);
        }
      }
    }
  });
  return sheet;
}

export interface ProjectileSprites {
  rocket: HTMLCanvasElement;
  grenade: HTMLCanvasElement;
  boot: HTMLCanvasElement;
  tombstone: HTMLCanvasElement;
  crate: HTMLCanvasElement;
  parachute: HTMLCanvasElement;
}

export function buildProjectileSprites(colors: SpriteColors): ProjectileSprites {
  return {
    rocket: rasterize(ROCKET_MAP, ROCKET_W, ROCKET_H, ch =>
      ch === 'R' ? colors.rocketBody : ch === 'N' ? colors.rocketNose : ch === 'F' ? colors.fin : null,
    ),
    grenade: rasterize(GRENADE_MAP, GRENADE_W, GRENADE_H, ch =>
      ch === 'G' ? colors.grenadeShell : ch === 'O' ? colors.outline : null,
    ),
    boot: rasterize(BOOT_MAP, BOOT_W, BOOT_H, ch =>
      ch === 'L' ? colors.bootLeather : ch === 'O' ? colors.outline : null,
    ),
    tombstone: rasterize(TOMBSTONE_MAP, TOMBSTONE_W, TOMBSTONE_H, ch =>
      ch === 'G' ? colors.stone : ch === 'O' || ch === 'D' ? colors.outline : null,
    ),
    crate: rasterize(CRATE_MAP, CRATE_W, CRATE_H, ch =>
      ch === 'C' ? colors.crate : ch === 'S' || ch === 'O' ? colors.outline : null,
    ),
    parachute: rasterize(PARACHUTE_MAP, PARACHUTE_W, PARACHUTE_H, ch =>
      ch === 'P' ? colors.chute : ch === 'O' ? colors.outline : null,
    ),
  };
}

// 3×5 pixel digit font for floating damage numbers
const DIGIT_ROWS: Record<string, number[]> = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b011, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b001, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  '-': [0b000, 0b000, 0b111, 0b000, 0b000],
};

export const DIGIT_W = 3;
export const DIGIT_H = 5;

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  color: string,
  outline: string,
): void {
  const totalW = text.length * (DIGIT_W + 1) - 1;
  const x0 = Math.round(cx - totalW / 2);
  const yi = Math.round(y);
  // 1px outline pass keeps digits readable over any terrain
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass === 0 ? outline : color;
    text.split('').forEach((ch, i) => {
      const rows = DIGIT_ROWS[ch];
      if (!rows) return;
      const gx = x0 + i * (DIGIT_W + 1);
      rows.forEach((bits, ry) => {
        for (let rx = 0; rx < DIGIT_W; rx++) {
          if (!(bits & (1 << (DIGIT_W - 1 - rx)))) continue;
          if (pass === 0) {
            ctx.fillRect(gx + rx - 1, yi + ry, 3, 1);
            ctx.fillRect(gx + rx, yi + ry - 1, 1, 3);
          } else {
            ctx.fillRect(gx + rx, yi + ry, 1, 1);
          }
        }
      });
    });
  }
}
