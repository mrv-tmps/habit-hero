import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BA_CANVAS_W,
  BA_CANVAS_H,
  BA_FALL_DMG_CAP,
  BA_FALL_DMG_PER_PX,
  BA_FALL_SAFE_PX,
  BA_GRAVITY,
  BA_JUMP_IMPULSE,
  BA_JUMP_STAMINA_COST,
  BA_MAX_ROUNDS,
  BA_RESOLUTION_FORCE_MS,
  BA_SUDDEN_DEATH_DRAIN,
  BA_TURN_TIME_MS,
  BA_UNIT_HP,
  BA_UNIT_W,
  BA_UNIT_H,
  BA_WALK_STAMINA_PX,
  BA_WEAPONS,
  BA_WIND_MAX,
  type BlastWeaponId,
} from '@/config/constants';
import {
  generateTerrain,
  carveCircle,
  isSolid,
  spawnPositions,
  MAP_STRUCTURES,
  HAZARD_FLOOR_Y,
  type MapStructure,
} from '@/lib/blastTerrain';
import { paintMapBackdrop, type BlastMapConfig } from '@/config/blastMaps';
import {
  simulateShot,
  windAt,
  type ShotInput,
  type ShotResult,
  type TurnResolution,
  type UnitState,
  type SimFrame,
} from '@/lib/blastSim';
import {
  buildUnitSheet,
  buildProjectileSprites,
  drawPixelText,
  UNIT_FRAME,
  UNIT_SPR_W,
  UNIT_SPR_H,
  ROCKET_W,
  ROCKET_H,
  GRENADE_W,
  GRENADE_H,
  BOOT_W,
  BOOT_H,
  TOMBSTONE_W,
  TOMBSTONE_H,
  type ProjectileSprites,
  type SpriteColors,
} from '@/lib/blastSprites';
import {
  createFxState,
  spawnExplosionFx,
  spawnBootImpactFx,
  spawnMuzzleFx,
  spawnTrailSmoke,
  spawnWalkDust,
  spawnKoFx,
  spawnLandingFx,
  spawnSplashFx,
  spawnDamageNumber,
  fxShakeOffset,
  drawFxAmbient,
  drawFxParticles,
  drawFxScreenFlash,
  pruneNumbers,
  numberProgress,
  type BlastFxState,
  type FxPalette,
} from '@/lib/blastFx';

export type BlastPhase = 'countdown' | 'aiming' | 'projectile' | 'done';

export interface BlastUnitInit {
  id: string;
  nickname: string;
  colorIndex: number;
  isLocal: boolean;
}

interface UseBlastEngineArgs {
  seed: number;
  startAt: number;
  // Resolved map (callers run resolveBlastMap) — structure, hazard, and theme
  map: BlastMapConfig;
  unitInits: BlastUnitInit[];
  onShotCommitted?: (input: ShotInput, turnIndex: number) => void;
  // Multiplayer host: broadcast the authoritative turn boundary after every shot/skip
  onTurnResolved?: (resolution: TurnResolution) => void;
  autoSkipTurns?: boolean;
  skipGraceMs?: number;
  // Pacing overrides — multiplayer scales both down with player count; solo passes neither
  turnTimeMs?: number;
  maxRounds?: number;
}

export interface SimStateSnapshot {
  terrain: Uint8Array;
  units: UnitState[];
  wind: number;
  hazardY: number | null;
}

interface UseBlastEngineReturn {
  phase: BlastPhase;
  countdown: number;
  turnIndex: number;
  activeUnit: UnitState | null;
  unitsView: UnitState[];
  wind: number;
  turnTimeLeft: number;
  winner: UnitState | null;
  damageDealt: Record<string, number>;
  selectedWeapon: BlastWeaponId;
  setWeapon: (w: BlastWeaponId) => void;
  staminaLeft: number;
  jump: () => void;
  commitShot: (vx: number, vy: number) => void;
  applyRemoteShot: (input: ShotInput, turnIndex: number) => void;
  skipCurrentTurn: () => void;
  applyTurnResolution: (resolution: TurnResolution) => void;
  setWalkHeld: (dir: -1 | 0 | 1) => void;
  updateAim: (dx: number, dy: number) => void;
  clearAim: () => void;
  registerCanvas: (el: HTMLCanvasElement | null) => void;
  getSimState: () => SimStateSnapshot;
}

const WALK_TICK_MS = 50;
const WALK_STEP_PX = 1.5;
const PREVIEW_STEPS = 90;
const EXPLOSION_FLASH_MS = 350;
const SIM_FPS = 60;

function readToken(css: CSSStyleDeclaration, name: string): string {
  return `hsl(${css.getPropertyValue(name).trim()})`;
}

interface Playback {
  result: ShotResult;
  weapon: BlastWeaponId;
  shooterId: string;
  turnIndex: number;
  startedAt: number;
  // Projectile frames plus the longest knockback-flight arc — playback runs this long
  totalFrames: number;
  // Explosion visuals (FX + carve) fire once at the projectile/flight seam
  explosionShown: boolean;
  // Renderer bookkeeping: last frame that emitted a smoke-trail particle
  trailFrame: number;
}

export function useBlastEngine({
  seed,
  startAt,
  map,
  unitInits,
  onShotCommitted,
  onTurnResolved,
  autoSkipTurns = true,
  skipGraceMs = 0,
  turnTimeMs = BA_TURN_TIME_MS,
  maxRounds = BA_MAX_ROUNDS,
}: UseBlastEngineArgs): UseBlastEngineReturn {
  const onTurnResolvedRef = useRef(onTurnResolved);
  onTurnResolvedRef.current = onTurnResolved;

  // ── Simulation state (refs — the rAF renderer reads these; never setState per frame)
  const terrainRef = useRef<Uint8Array>(new Uint8Array(0));
  const unitsRef = useRef<UnitState[]>([]);
  const windRef = useRef(0);
  const damageDealtRef = useRef<Record<string, number>>({});
  const playbackRef = useRef<Playback | null>(null);
  const pendingResolutionRef = useRef<TurnResolution | null>(null);
  const forceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCarvedTurnRef = useRef(-1);
  const explosionRef = useRef<{ x: number; y: number; r: number; endsAt: number } | null>(null);
  const previewRef = useRef<SimFrame[] | null>(null);
  const walkHeldRef = useRef<-1 | 0 | 1>(0);
  const staminaRef = useRef(BA_WALK_STAMINA_PX);
  const hazardYRef = useRef<number | null>(null);
  // Local unit's in-air state (jump or walk-off); null while grounded
  const airborneRef = useRef<{ vy: number; peakY: number } | null>(null);
  const turnEndsAtRef = useRef(0);
  const phaseRef = useRef<BlastPhase>('countdown');
  const turnIndexRef = useRef(0);
  const activeIdxRef = useRef(0);
  const selectedWeaponRef = useRef<BlastWeaponId>('bazooka');

  // ── Rendering refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteRef = useRef<Record<string, string>>({});
  const rafRef = useRef(0);

  // ── Cosmetic-only refs (sprites, particles, per-unit animation) — never feed the sim
  const fxRef = useRef<BlastFxState | null>(null);
  const unitSheetsRef = useRef<Record<number, HTMLCanvasElement>>({});
  const flashSheetRef = useRef<HTMLCanvasElement | null>(null);
  const projSpritesRef = useRef<ProjectileSprites | null>(null);
  const unitAnimRef = useRef<Record<string, { displayHp: number; hitUntil: number }>>({});
  const recoilRef = useRef<{ id: string; until: number; dir: number } | null>(null);

  // ── React state (discrete events only)
  const [phase, setPhaseState] = useState<BlastPhase>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [turnIndex, setTurnIndex] = useState(0);
  const [unitsView, setUnitsView] = useState<UnitState[]>([]);
  const [wind, setWind] = useState(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState(turnTimeMs / 1000);
  const [winner, setWinner] = useState<UnitState | null>(null);
  const [damageDealt, setDamageDealt] = useState<Record<string, number>>({});
  const [selectedWeapon, setSelectedWeapon] = useState<BlastWeaponId>('bazooka');
  const [staminaLeft, setStaminaLeft] = useState(BA_WALK_STAMINA_PX);

  const setPhase = useCallback((p: BlastPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const syncUnits = useCallback(() => {
    setUnitsView(unitsRef.current.map(u => ({ ...u })));
  }, []);

  // ── Terrain offscreen canvas: base fill + dirt texture + edge/grass outlines.
  // Runs only on init and after carves, so the full-pixel scans are cheap in practice.
  const repaintTerrain = useCallback(() => {
    let off = terrainCanvasRef.current;
    if (!off) {
      off = document.createElement('canvas');
      off.width = BA_CANVAS_W;
      off.height = BA_CANVAS_H;
      terrainCanvasRef.current = off;
    }
    const ctx = off.getContext('2d');
    if (!ctx) return;
    const terrain = terrainRef.current;
    const pal = paletteRef.current;
    const solidAt = (x: number, y: number) =>
      x >= 0 && x < BA_CANVAS_W && y >= 0 && y < BA_CANVAS_H && terrain[y * BA_CANVAS_W + x] !== 0;

    // Row-run fill of every cell holding the given value
    const fillRuns = (value: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let y = 0; y < BA_CANVAS_H; y++) {
        let runStart = -1;
        for (let x = 0; x <= BA_CANVAS_W; x++) {
          const match = x < BA_CANVAS_W && terrain[y * BA_CANVAS_W + x] === value;
          if (match && runStart < 0) runStart = x;
          if (!match && runStart >= 0) {
            ctx.rect(runStart, y, x - runStart, 1);
            runStart = -1;
          }
        }
      }
      ctx.fill();
    };

    ctx.clearRect(0, 0, BA_CANVAS_W, BA_CANVAS_H);
    // Themed sky decorations sit behind the terrain fills; seeded, so they are
    // stable across the carve-triggered repaints
    paintMapBackdrop(ctx, map, seed, { deco: pal.deco ?? pal.cloud, cloud: pal.cloud });
    fillRuns(1, pal.terrain ?? '#000');
    fillRuns(2, pal.rock ?? pal.terrain ?? '#000');

    // Rock edge: darker outline wherever rock touches air, so "won't blow up" reads visually
    ctx.fillStyle = pal.rockEdge ?? pal.rock ?? '#000';
    ctx.beginPath();
    for (let y = 0; y < BA_CANVAS_H; y++) {
      for (let x = 0; x < BA_CANVAS_W; x++) {
        if (terrain[y * BA_CANVAS_W + x] !== 2) continue;
        if (!solidAt(x - 1, y) || !solidAt(x + 1, y) || !solidAt(x, y - 1) || !solidAt(x, y + 1)) {
          ctx.rect(x, y, 1, 1);
        }
      }
    }
    ctx.fill();

    // Dirt speckle: position-hashed so texture is stable across repaints
    ctx.fillStyle = pal.dirt ?? pal.terrain ?? '#000';
    ctx.beginPath();
    for (let y = 0; y < BA_CANVAS_H; y++) {
      for (let x = 0; x < BA_CANVAS_W; x++) {
        if (terrain[y * BA_CANVAS_W + x] !== 1) continue;
        const h = (Math.imul(x, 2654435761) ^ Math.imul(y, 40503)) >>> 0;
        if (h % 97 < 8) ctx.rect(x, y, 1, 1);
      }
    }
    ctx.fill();

    // Crater/side outline (darker), then grass on top-exposed surfaces
    ctx.fillStyle = pal.terrainEdge ?? pal.terrain ?? '#000';
    ctx.beginPath();
    for (let y = 0; y < BA_CANVAS_H; y++) {
      for (let x = 0; x < BA_CANVAS_W; x++) {
        if (terrain[y * BA_CANVAS_W + x] !== 1) continue;
        if (solidAt(x, y - 1) && (!solidAt(x - 1, y) || !solidAt(x + 1, y) || !solidAt(x, y + 1))) {
          ctx.rect(x, y, 1, 1);
        }
      }
    }
    ctx.fill();

    ctx.fillStyle = pal.grass ?? pal.terrain ?? '#000';
    ctx.beginPath();
    for (let y = 0; y < BA_CANVAS_H; y++) {
      for (let x = 0; x < BA_CANVAS_W; x++) {
        if (terrain[y * BA_CANVAS_W + x] !== 1) continue;
        if (!solidAt(x, y - 1)) {
          ctx.rect(x, y, 1, 1);
          if (solidAt(x, y + 1) && !solidAt(x, y - 2)) ctx.rect(x, y + 1, 1, 1);
        }
      }
    }
    ctx.fill();
  }, [map, seed]);

  // ── World init (re-runs when the roster arrives — multiplayer loads participants async)
  useEffect(() => {
    if (unitInits.length === 0) return;
    // Dev-only escape hatch to force a structure while testing (localStorage 'ba-map')
    const forced = import.meta.env.DEV ? localStorage.getItem('ba-map') : null;
    const isForced = MAP_STRUCTURES.includes(forced as MapStructure);
    const structure: MapStructure = isForced ? (forced as MapStructure) : map.structure;
    const { terrain, hazardY } = generateTerrain(seed, structure);
    terrainRef.current = terrain;
    // The map config owns the hazard floor; a forced structure keeps its default
    hazardYRef.current = isForced ? hazardY : map.hazard === 'none' ? null : HAZARD_FLOOR_Y;
    airborneRef.current = null;
    const spawns = spawnPositions(seed, terrain, unitInits.length, hazardY);
    unitsRef.current = unitInits.map((init, i) => ({
      ...init,
      hp: BA_UNIT_HP,
      x: spawns[i].x,
      y: spawns[i].y,
      facing: (i % 2 === 0 ? 1 : -1) as 1 | -1,
    }));
    damageDealtRef.current = Object.fromEntries(unitInits.map(u => [u.id, 0]));
    unitAnimRef.current = Object.fromEntries(
      unitInits.map(u => [u.id, { displayHp: BA_UNIT_HP, hitUntil: 0 }]),
    );
    lastCarvedTurnRef.current = -1;
    repaintTerrain();
    syncUnits();
  }, [seed, map, unitInits, repaintTerrain, syncUnits]);

  // ── Palette sampled from CSS tokens (design rule: no hex literals in TS).
  // The map's theme attribute goes on <html> so the [data-ba-map] token scopes
  // resolve here even before the canvas mounts (MP samples during the ready screen).
  useEffect(() => {
    document.documentElement.setAttribute('data-ba-map', map.themeAttr);
    const css = getComputedStyle(document.documentElement);
    const palette: Record<string, string> = {
      sky: readToken(css, '--ba-sky'),
      terrain: readToken(css, '--ba-terrain'),
      terrainEdge: readToken(css, '--ba-terrain-edge'),
      grass: readToken(css, '--ba-grass'),
      dirt: readToken(css, '--ba-dirt'),
      rock: readToken(css, '--ba-rock'),
      rockEdge: readToken(css, '--ba-rock-edge'),
      hazard: readToken(css, '--ba-hazard'),
      hazardDeep: readToken(css, '--ba-hazard-deep'),
      deco: readToken(css, '--ba-deco'),
      explosion: readToken(css, '--ba-explosion'),
      trajectory: readToken(css, '--ba-trajectory'),
      smoke: readToken(css, '--ba-smoke'),
      cloud: readToken(css, '--ba-cloud'),
      unitOutline: readToken(css, '--ba-unit-outline'),
      foreground: readToken(css, '--foreground'),
      muted: readToken(css, '--muted'),
      primary: readToken(css, '--primary'),
      destructive: readToken(css, '--destructive'),
    };
    for (let i = 1; i <= 8; i++) {
      palette[`player${i}`] = readToken(css, `--player-${i}`);
    }
    paletteRef.current = palette;

    const spriteColors: SpriteColors = {
      outline: palette.unitOutline,
      eyeWhite: palette.foreground,
      rocketBody: palette.destructive,
      rocketNose: palette.trajectory,
      fin: palette.muted,
      grenadeShell: palette.grass,
      bootLeather: palette.primary,
      stone: palette.muted,
    };
    const sheets: Record<number, HTMLCanvasElement> = {};
    for (let i = 1; i <= 8; i++) {
      sheets[i] = buildUnitSheet(palette[`player${i}`], spriteColors);
    }
    unitSheetsRef.current = sheets;
    // All-white silhouette reused for the hit flash overlay
    flashSheetRef.current = buildUnitSheet(palette.foreground, {
      ...spriteColors,
      outline: palette.foreground,
      eyeWhite: palette.foreground,
    });
    projSpritesRef.current = buildProjectileSprites(spriteColors);
    repaintTerrain();
    return () => document.documentElement.removeAttribute('data-ba-map');
  }, [map, repaintTerrain]);

  // ── FX state honors prefers-reduced-motion, live
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    fxRef.current = createFxState(mq.matches);
    const onChange = (e: MediaQueryListEvent) => {
      if (fxRef.current) fxRef.current.reducedMotion = e.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const getFxPal = useCallback((): FxPalette => {
    const pal = paletteRef.current;
    return {
      explosion: pal.explosion,
      smoke: pal.smoke,
      dirt: pal.dirt,
      terrain: pal.terrain,
      cloud: pal.cloud,
      trajectory: pal.trajectory,
      hazard: pal.hazard,
    };
  }, []);

  // Cosmetic damage feedback: floating number, hit flash, KO poof
  const fxDamage = useCallback((unit: UnitState, dmg: number, killed: boolean) => {
    const fx = fxRef.current;
    if (!fx || dmg <= 0) return;
    const now = Date.now();
    spawnDamageNumber(fx, unit.x, unit.y - UNIT_SPR_H - 8, dmg, now);
    const anim = unitAnimRef.current[unit.id];
    if (anim) anim.hitUntil = now + 220;
    if (killed) spawnKoFx(fx, getFxPal(), unit.x, unit.y, now);
  }, [getFxPal]);

  // ── Turn management
  const startTurnAt = useCallback((idx: number, turnIdx: number) => {
    activeIdxRef.current = idx;
    turnIndexRef.current = turnIdx;
    windRef.current = windAt(seed, turnIdx);
    staminaRef.current = BA_WALK_STAMINA_PX;
    turnEndsAtRef.current = Date.now() + turnTimeMs;
    walkHeldRef.current = 0;
    airborneRef.current = null;
    previewRef.current = null;
    setTurnIndex(turnIdx);
    setWind(windRef.current);
    setStaminaLeft(BA_WALK_STAMINA_PX);
    setTurnTimeLeft(turnTimeMs / 1000);
    setPhase('aiming');
  }, [seed, setPhase, turnTimeMs]);

  const finishGame = useCallback(() => {
    const alive = unitsRef.current.filter(u => u.hp > 0);
    setWinner(alive.length === 1 ? { ...alive[0] } : null);
    setDamageDealt({ ...damageDealtRef.current });
    syncUnits();
    setPhase('done');
  }, [setPhase, syncUnits]);

  // Advances to the next turn; returns false when the game ended instead
  const advanceTurn = useCallback((): boolean => {
    const units = unitsRef.current;
    const aliveCount = units.filter(u => u.hp > 0).length;
    if (aliveCount <= 1) {
      finishGame();
      return false;
    }

    let nextTurn = turnIndexRef.current + 1;
    let nextIdx = (activeIdxRef.current + 1) % units.length;
    while (units[nextIdx].hp <= 0) {
      nextIdx = (nextIdx + 1) % units.length;
      nextTurn++;
    }

    // Sudden death: after the round budget, every turn start drains all units
    if (Math.floor(nextTurn / units.length) >= maxRounds) {
      for (const u of units) {
        if (u.hp > 0) {
          u.hp = Math.max(0, u.hp - BA_SUDDEN_DEATH_DRAIN);
          fxDamage(u, BA_SUDDEN_DEATH_DRAIN, u.hp <= 0);
        }
      }
      syncUnits();
      const survivors = units.filter(u => u.hp > 0);
      if (survivors.length <= 1) {
        finishGame();
        return false;
      }
      while (units[nextIdx].hp <= 0) {
        nextIdx = (nextIdx + 1) % units.length;
        nextTurn++;
      }
    }

    startTurnAt(nextIdx, nextTurn);
    return true;
  }, [finishGame, fxDamage, startTurnAt, syncUnits, maxRounds]);

  const buildResolution = useCallback((resolvedTurn: number, carve: TurnResolution['carve']): TurnResolution => ({
    resolved_turn: resolvedTurn,
    next_turn: turnIndexRef.current,
    next_active_id: unitsRef.current[activeIdxRef.current]?.id ?? '',
    hp: Object.fromEntries(unitsRef.current.map(u => [u.id, u.hp])),
    positions: Object.fromEntries(unitsRef.current.map(u => [u.id, { x: u.x, y: u.y }])),
    carve,
  }), []);

  const clearPendingResolution = useCallback(() => {
    pendingResolutionRef.current = null;
    if (forceTimerRef.current) {
      clearTimeout(forceTimerRef.current);
      forceTimerRef.current = null;
    }
  }, []);

  // Explosion visuals + crater. Called by the renderer at the projectile/flight seam
  // so the world reacts before knocked units fly; applyShotResult re-calls it as the
  // fallback for throttled tabs. Both paths are idempotent via the flags/guards.
  const showExplosion = useCallback((playback: Playback) => {
    if (playback.explosionShown) return;
    playback.explosionShown = true;
    const { result, turnIndex: resolvedTurn } = playback;

    if (result.explosionAt) {
      const weaponRadius = result.carves[0]?.r ?? 10;
      explosionRef.current = {
        x: result.explosionAt.x,
        y: result.explosionAt.y,
        r: weaponRadius,
        endsAt: Date.now() + EXPLOSION_FLASH_MS,
      };
      const fx = fxRef.current;
      if (fx) {
        if (playback.weapon === 'boot') {
          spawnBootImpactFx(fx, getFxPal(), result.explosionAt.x, result.explosionAt.y, Date.now());
        } else {
          spawnExplosionFx(fx, getFxPal(), result.explosionAt.x, result.explosionAt.y, weaponRadius, Date.now());
        }
      }
    }
    if (result.carves.length > 0 && lastCarvedTurnRef.current < resolvedTurn) {
      for (const carve of result.carves) {
        carveCircle(terrainRef.current, carve.x, carve.y, carve.r);
      }
      lastCarvedTurnRef.current = resolvedTurn;
      repaintTerrain();
    }
  }, [getFxPal, repaintTerrain]);

  const showExplosionRef = useRef(showExplosion);
  showExplosionRef.current = showExplosion;

  // ── Shot resolution (applied when playback finishes or the fallback timer fires)
  const applyShotResult = useCallback((playback: Playback) => {
    const { result, shooterId, turnIndex: resolvedTurn } = playback;
    const units = unitsRef.current;

    showExplosion(playback);
    airborneRef.current = null;

    let dealtToOthers = 0;
    for (const unit of units) {
      const wasAlive = unit.hp > 0;
      if (!wasAlive) continue;
      const dmg = result.damage[unit.id] ?? 0;
      const fall = result.fallDamage[unit.id] ?? 0;
      const drowned = result.hazardKO.includes(unit.id);

      // Snap to the sim's landing spot first so damage numbers appear where the unit is
      const pos = result.finalPositions[unit.id];
      if (pos) {
        unit.x = pos.x;
        unit.y = pos.y;
      }

      if (dmg > 0) {
        unit.hp = Math.max(0, unit.hp - dmg);
        if (unit.id !== shooterId) dealtToOthers += dmg;
        fxDamage(unit, dmg, unit.hp <= 0 && fall === 0 && !drowned);
      }
      if (fall > 0 && unit.hp > 0) {
        unit.hp = Math.max(0, unit.hp - fall);
        if (unit.id !== shooterId) dealtToOthers += fall;
        fxDamage(unit, fall, unit.hp <= 0 && !drowned);
        if (fxRef.current) spawnLandingFx(fxRef.current, getFxPal(), unit.x, unit.y, fall, Date.now());
      }
      if (drowned && unit.hp > 0) {
        unit.hp = 0;
        const fx = fxRef.current;
        if (fx) {
          spawnSplashFx(fx, getFxPal(), unit.x, unit.y, Date.now());
          spawnKoFx(fx, getFxPal(), unit.x, unit.y, Date.now());
        }
      }
    }
    damageDealtRef.current[shooterId] =
      (damageDealtRef.current[shooterId] ?? 0) + dealtToOthers;

    syncUnits();

    const advanced = advanceTurn();
    if (advanced) {
      onTurnResolvedRef.current?.(buildResolution(resolvedTurn, result.carves[0] ?? null));
    }

    // A host resolution may have arrived while we were animating — it wins
    const pending = pendingResolutionRef.current;
    if (pending && pending.resolved_turn === resolvedTurn) {
      clearPendingResolution();
      hardApplyResolutionRef.current(pending);
    }
  }, [advanceTurn, buildResolution, clearPendingResolution, fxDamage, getFxPal, showExplosion, syncUnits]);

  const applyShotResultRef = useRef(applyShotResult);
  applyShotResultRef.current = applyShotResult;

  // ── Authoritative resolution from the host: snap to its state unconditionally
  const hardApplyResolution = useCallback((res: TurnResolution) => {
    if (phaseRef.current === 'done') return;
    playbackRef.current = null;
    airborneRef.current = null;

    if (res.carve && lastCarvedTurnRef.current < res.resolved_turn) {
      carveCircle(terrainRef.current, res.carve.x, res.carve.y, res.carve.r);
      lastCarvedTurnRef.current = res.resolved_turn;
      repaintTerrain();
    }
    for (const unit of unitsRef.current) {
      if (unit.id in res.hp) {
        const drop = unit.hp - res.hp[unit.id];
        if (drop > 0) fxDamage(unit, drop, res.hp[unit.id] <= 0);
        unit.hp = res.hp[unit.id];
      }
      const pos = res.positions[unit.id];
      if (pos) {
        unit.x = pos.x;
        unit.y = pos.y;
      }
    }
    syncUnits();

    if (unitsRef.current.filter(u => u.hp > 0).length <= 1) {
      finishGame();
      return;
    }
    const nextIdx = unitsRef.current.findIndex(u => u.id === res.next_active_id);
    if (nextIdx >= 0) startTurnAt(nextIdx, res.next_turn);
  }, [finishGame, fxDamage, repaintTerrain, startTurnAt, syncUnits]);

  const hardApplyResolutionRef = useRef(hardApplyResolution);
  hardApplyResolutionRef.current = hardApplyResolution;

  const applyTurnResolution = useCallback((res: TurnResolution) => {
    // Stale or duplicate boundary — we're already past it
    if (res.next_turn <= turnIndexRef.current && phaseRef.current === 'aiming') return;
    if (phaseRef.current === 'done') return;

    const playback = playbackRef.current;
    if (playback && playback.turnIndex === res.resolved_turn) {
      // We're animating this same shot: let it finish, then reconcile. A force timer
      // covers throttled background tabs where the animation never completes.
      pendingResolutionRef.current = res;
      if (forceTimerRef.current) clearTimeout(forceTimerRef.current);
      forceTimerRef.current = setTimeout(() => {
        const pending = pendingResolutionRef.current;
        if (pending) {
          clearPendingResolution();
          hardApplyResolutionRef.current(pending);
        }
      }, BA_RESOLUTION_FORCE_MS);
      return;
    }

    clearPendingResolution();
    hardApplyResolution(res);
  }, [clearPendingResolution, hardApplyResolution]);

  const fireShot = useCallback((input: ShotInput) => {
    if (phaseRef.current !== 'aiming') return;
    const shooter = unitsRef.current[activeIdxRef.current];
    // Snap the shooter to the shot origin — remote clients don't see mid-turn walking,
    // so the payload's origin is the agreed position for this turn's simulation
    shooter.x = input.x;
    shooter.y = input.y + BA_UNIT_H;
    const result = simulateShot(
      input,
      terrainRef.current,
      unitsRef.current,
      windRef.current,
      shooter.id,
      hazardYRef.current,
    );
    previewRef.current = null;
    const flightFrames = Object.values(result.unitFrames)
      .reduce((max, f) => Math.max(max, f.length), 0);
    const playback: Playback = {
      result,
      weapon: input.weapon,
      shooterId: shooter.id,
      turnIndex: turnIndexRef.current,
      startedAt: Date.now(),
      totalFrames: result.frames.length + flightFrames,
      explosionShown: false,
      trailFrame: -1,
    };
    playbackRef.current = playback;
    // Firing recoil + muzzle puff (cosmetic)
    recoilRef.current = { id: shooter.id, until: Date.now() + 200, dir: input.vx >= 0 ? -1 : 1 };
    if (fxRef.current) spawnMuzzleFx(fxRef.current, getFxPal(), input.x, input.y, Date.now());
    setPhase('projectile');

    // Fallback: rAF is suspended in hidden tabs — state must advance regardless
    const durationMs = (playback.totalFrames / SIM_FPS) * 1000;
    setTimeout(() => {
      if (playbackRef.current === playback) {
        playbackRef.current = null;
        applyShotResultRef.current(playback);
      }
    }, durationMs + 600);
  }, [getFxPal, setPhase]);

  const commitShot = useCallback((vx: number, vy: number) => {
    const active = unitsRef.current[activeIdxRef.current];
    if (!active?.isLocal || phaseRef.current !== 'aiming') return;
    const input: ShotInput = {
      weapon: selectedWeaponRef.current,
      x: active.x,
      y: active.y - BA_UNIT_H,
      vx,
      vy,
    };
    onShotCommitted?.(input, turnIndexRef.current);
    fireShot(input);
  }, [fireShot, onShotCommitted]);

  // Remote shots are only valid for the turn they were fired in
  const applyRemoteShot = useCallback((input: ShotInput, turnIdx: number) => {
    if (turnIdx !== turnIndexRef.current || phaseRef.current !== 'aiming') return;
    fireShot(input);
  }, [fireShot]);

  const skipCurrentTurn = useCallback(() => {
    if (phaseRef.current !== 'aiming') return;
    const resolvedTurn = turnIndexRef.current;
    previewRef.current = null;
    const advanced = advanceTurn();
    if (advanced) {
      onTurnResolvedRef.current?.(buildResolution(resolvedTurn, null));
    }
  }, [advanceTurn, buildResolution]);

  // ── Aim preview: truncated run of the real sim so the preview never lies
  const updateAim = useCallback((vx: number, vy: number) => {
    const active = unitsRef.current[activeIdxRef.current];
    if (!active?.isLocal || phaseRef.current !== 'aiming') return;
    active.facing = vx >= 0 ? 1 : -1;
    // Preview only needs the projectile arc — skip the (heavier) unit resolution
    const result = simulateShot(
      { weapon: selectedWeaponRef.current, x: active.x, y: active.y - BA_UNIT_H, vx, vy },
      terrainRef.current,
      unitsRef.current,
      windRef.current,
      active.id,
      hazardYRef.current,
      false,
    );
    previewRef.current = result.frames.slice(0, PREVIEW_STEPS);
  }, []);

  const clearAim = useCallback(() => {
    previewRef.current = null;
  }, []);

  const setWeapon = useCallback((w: BlastWeaponId) => {
    selectedWeaponRef.current = w;
    setSelectedWeapon(w);
  }, []);

  const setWalkHeld = useCallback((dir: -1 | 0 | 1) => {
    walkHeldRef.current = dir;
  }, []);

  // Jump is local-only, like walking: remote clients learn the position from the
  // shot payload and the host's turn resolution, so this needs zero netcode.
  const jump = useCallback(() => {
    if (phaseRef.current !== 'aiming') return;
    const unit = unitsRef.current[activeIdxRef.current];
    if (!unit?.isLocal || unit.hp <= 0) return;
    if (airborneRef.current) return;
    if (!isSolid(terrainRef.current, unit.x, unit.y + 1)) return;
    if (staminaRef.current < BA_JUMP_STAMINA_COST) return;
    staminaRef.current -= BA_JUMP_STAMINA_COST;
    setStaminaLeft(Math.round(staminaRef.current));
    airborneRef.current = { vy: BA_JUMP_IMPULSE, peakY: unit.y };
    if (fxRef.current) spawnWalkDust(fxRef.current, getFxPal(), unit.x, unit.y, Date.now());
  }, [getFxPal]);

  const getSimState = useCallback((): SimStateSnapshot => ({
    terrain: terrainRef.current,
    units: unitsRef.current,
    wind: windRef.current,
    hazardY: hazardYRef.current,
  }), []);

  // ── Countdown until startAt (startAt 0 = game not begun; stay in countdown phase)
  useEffect(() => {
    if (startAt <= 0) return;
    const tick = () => {
      if (unitsRef.current.length === 0) return;
      const left = startAt - Date.now();
      if (left <= 0) {
        clearInterval(interval);
        startTurnAt(0, 0);
      } else {
        setCountdown(Math.ceil(left / 1000));
      }
    };
    const interval = setInterval(tick, 100);
    tick();
    return () => clearInterval(interval);
  }, [startAt, startTurnAt]);

  // ── Turn timer: display for everyone; only the authority (solo player / MP host) skips
  useEffect(() => {
    if (phase !== 'aiming') return;
    const interval = setInterval(() => {
      const leftMs = turnEndsAtRef.current - Date.now();
      setTurnTimeLeft(Math.max(0, Math.ceil(leftMs / 1000)));
      if (leftMs <= -skipGraceMs && autoSkipTurns) {
        clearInterval(interval);
        skipCurrentTurn();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [phase, turnIndex, autoSkipTurns, skipGraceMs, skipCurrentTurn]);

  // ── Walking + local vertical physics (interval, not rAF — discrete steps).
  // Movement is local-only during your own turn; the shot payload / host resolution
  // carry the outcome, so falls and hazard deaths here reconcile at the turn boundary.
  useEffect(() => {
    if (phase !== 'aiming') return;
    let stepCount = 0;

    const interval = setInterval(() => {
      const unit = unitsRef.current[activeIdxRef.current];
      if (!unit?.isLocal || unit.hp <= 0) return;
      const terrain = terrainRef.current;
      const hazardY = hazardYRef.current;
      const dir = walkHeldRef.current;

      const die = (drowned: boolean) => {
        unit.hp = 0;
        airborneRef.current = null;
        const fx = fxRef.current;
        if (fx) {
          if (drowned) spawnSplashFx(fx, getFxPal(), unit.x, unit.y, Date.now());
          spawnKoFx(fx, getFxPal(), unit.x, unit.y, Date.now());
        }
        syncUnits();
        // Solo player / MP host advance immediately; non-hosts wait for the host skip
        if (autoSkipTurns) skipCurrentTurn();
      };

      // Horizontal: works grounded and mid-air (so jumps can cross gaps); same stamina
      if (dir !== 0 && staminaRef.current > 0) {
        const nx = Math.max(BA_UNIT_W / 2, Math.min(BA_CANVAS_W - BA_UNIT_W / 2, unit.x + dir * WALK_STEP_PX));
        if (airborneRef.current) {
          if (!isSolid(terrain, nx, unit.y) && !isSolid(terrain, nx, unit.y - BA_UNIT_H + 1)) {
            unit.x = nx;
          }
          unit.facing = dir;
          staminaRef.current = Math.max(0, staminaRef.current - WALK_STEP_PX);
          setStaminaLeft(Math.round(staminaRef.current));
        } else {
          let ny = unit.y;
          let climbed = 0;
          while (isSolid(terrain, nx, ny) && climbed < 4) {
            ny--;
            climbed++;
          }
          if (!isSolid(terrain, nx, ny)) {
            unit.x = nx;
            unit.y = ny;
            unit.facing = dir;
            staminaRef.current = Math.max(0, staminaRef.current - WALK_STEP_PX);
            setStaminaLeft(Math.round(staminaRef.current));
            // Occasional heel-dust puff while walking
            if (++stepCount % 5 === 0 && fxRef.current) {
              spawnWalkDust(fxRef.current, getFxPal(), unit.x - dir * 3, unit.y, Date.now());
            }
          }
        }
      }

      // Ground-follow: snap down small slope steps; a bigger ledge starts a real fall
      if (!airborneRef.current && !isSolid(terrain, unit.x, unit.y + 1)) {
        let snapped = false;
        for (let k = 1; k <= 3; k++) {
          if (isSolid(terrain, unit.x, unit.y + k + 1)) {
            unit.y += k;
            snapped = true;
            break;
          }
        }
        if (!snapped) airborneRef.current = { vy: 0, peakY: unit.y };
      }

      // Vertical integration: 3 sim substeps per 50ms tick keeps 60Hz physics constants
      const air = airborneRef.current;
      if (!air) return;
      for (let s = 0; s < 3 && airborneRef.current; s++) {
        air.vy += BA_GRAVITY;
        if (air.vy < 0) {
          const ny = unit.y + air.vy;
          if (isSolid(terrain, unit.x, ny - BA_UNIT_H)) {
            air.vy = 0; // ceiling
          } else {
            unit.y = ny;
            if (unit.y < air.peakY) air.peakY = unit.y;
          }
        } else {
          let remaining = air.vy;
          while (remaining > 0) {
            if (hazardY !== null && unit.y >= hazardY) {
              unit.y = hazardY;
              die(true);
              return;
            }
            if (isSolid(terrain, unit.x, unit.y + 1)) {
              const drop = unit.y - air.peakY;
              airborneRef.current = null;
              if (drop > BA_FALL_SAFE_PX) {
                const dmg = Math.floor(
                  Math.min(BA_FALL_DMG_CAP, (drop - BA_FALL_SAFE_PX) * BA_FALL_DMG_PER_PX),
                );
                if (dmg > 0) {
                  unit.hp = Math.max(0, unit.hp - dmg);
                  fxDamage(unit, dmg, unit.hp <= 0);
                  if (fxRef.current) {
                    spawnLandingFx(fxRef.current, getFxPal(), unit.x, unit.y, dmg, Date.now());
                  }
                  syncUnits();
                  if (unit.hp <= 0 && autoSkipTurns) skipCurrentTurn();
                }
              }
              break;
            }
            const d = Math.min(1, remaining);
            unit.y += d;
            remaining -= d;
          }
        }
      }
    }, WALK_TICK_MS);
    return () => clearInterval(interval);
  }, [phase, turnIndex, getFxPal, autoSkipTurns, skipCurrentTurn, fxDamage, syncUnits]);

  // ── Renderer (rAF; reads refs only — state application never depends on this loop).
  // Everything here is presentation: sprites, particles, shake. Sim state is applied
  // by applyShotResult/hardApplyResolution regardless of what this loop draws.
  useEffect(() => {
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const pal = paletteRef.current;
      const fx = fxRef.current;
      const now = Date.now();

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = pal.sky;
      ctx.fillRect(0, 0, BA_CANVAS_W, BA_CANVAS_H);

      if (fx) {
        drawFxAmbient(ctx, fx, {
          explosion: pal.explosion, smoke: pal.smoke, dirt: pal.dirt,
          terrain: pal.terrain, cloud: pal.cloud, trajectory: pal.trajectory,
          hazard: pal.hazard,
        }, windRef.current, BA_WIND_MAX, now);
      }

      // Camera shake wraps everything world-space; HUD lives outside the canvas
      const shake = fx ? fxShakeOffset(fx, now) : { x: 0, y: 0 };
      ctx.save();
      ctx.translate(Math.round(shake.x), Math.round(shake.y));

      if (terrainCanvasRef.current) ctx.drawImage(terrainCanvasRef.current, 0, 0);

      // Hazard floor: animated water strip (drawn behind units)
      const hazardY = hazardYRef.current;
      if (hazardY !== null) {
        ctx.fillStyle = pal.hazardDeep;
        ctx.fillRect(0, hazardY + 1, BA_CANVAS_W, BA_CANVAS_H - hazardY - 1);
        ctx.fillStyle = pal.hazard;
        ctx.fillRect(0, hazardY, BA_CANVAS_W, 1);
        const wave = fx && !fx.reducedMotion ? Math.floor(now / 400) % 3 : 0;
        for (let wx = -8 + wave * 3; wx < BA_CANVAS_W; wx += 8) {
          ctx.fillRect(wx, hazardY + 2, 4, 1);
        }
      }

      const sprites = projSpritesRef.current;

      // Tombstones where units fell
      if (sprites) {
        for (const unit of unitsRef.current) {
          if (unit.hp > 0) continue;
          ctx.drawImage(
            sprites.tombstone,
            Math.round(unit.x - TOMBSTONE_W / 2),
            Math.round(unit.y - TOMBSTONE_H),
          );
        }
      }

      // Units
      const activeIdx = activeIdxRef.current;
      const playback = playbackRef.current;
      const playbackFrameIdx = playback
        ? Math.floor(((now - playback.startedAt) / 1000) * SIM_FPS)
        : 0;
      unitsRef.current.forEach((unit, i) => {
        if (unit.hp <= 0) return;
        const anim = unitAnimRef.current[unit.id];
        const isActive = i === activeIdx;
        const isAiming = isActive && phaseRef.current === 'aiming';

        // Frame selection: hit > airborne > walk > fire > aim > idle/blink
        let frame: number = UNIT_FRAME.idle1;
        if (anim && anim.hitUntil > now) {
          frame = UNIT_FRAME.hit;
        } else if (isAiming && unit.isLocal && airborneRef.current) {
          frame = UNIT_FRAME.walk2;
        } else if (isAiming && unit.isLocal && walkHeldRef.current !== 0) {
          frame = Math.floor(now / 140) % 2 === 0 ? UNIT_FRAME.walk1 : UNIT_FRAME.walk2;
        } else if (playback && playback.shooterId === unit.id) {
          frame = UNIT_FRAME.fire;
        } else if (isAiming && unit.isLocal && previewRef.current) {
          frame = UNIT_FRAME.aim;
        } else if ((now + unit.colorIndex * 700) % 3400 < 160) {
          frame = UNIT_FRAME.idle2;
        }

        // Knockback flight: draw the unit along its ballistic arc during playback
        let drawUx = unit.x;
        let drawUy = unit.y;
        if (playback) {
          const arc = playback.result.unitFrames[unit.id];
          if (arc && arc.length > 0) {
            const fi = playbackFrameIdx - playback.result.frames.length;
            if (fi >= 0) {
              const p = arc[Math.min(fi, arc.length - 1)];
              drawUx = p.x;
              drawUy = p.y;
              frame = UNIT_FRAME.hit;
            }
          }
        }

        // Firing recoil: brief lean opposite the launch direction
        const recoil = recoilRef.current;
        const recoilX = recoil && recoil.id === unit.id && recoil.until > now
          ? recoil.dir * Math.ceil(((recoil.until - now) / 200) * 2)
          : 0;

        const px = Math.round(drawUx - UNIT_SPR_W / 2) + recoilX;
        const py = Math.round(drawUy) - UNIT_SPR_H;
        const sheet = unitSheetsRef.current[unit.colorIndex];

        const blit = (img: HTMLCanvasElement) => {
          if (unit.facing === -1) {
            ctx.save();
            ctx.translate(px + UNIT_SPR_W, py);
            ctx.scale(-1, 1);
            ctx.drawImage(img, frame * UNIT_SPR_W, 0, UNIT_SPR_W, UNIT_SPR_H, 0, 0, UNIT_SPR_W, UNIT_SPR_H);
            ctx.restore();
          } else {
            ctx.drawImage(img, frame * UNIT_SPR_W, 0, UNIT_SPR_W, UNIT_SPR_H, px, py, UNIT_SPR_W, UNIT_SPR_H);
          }
        };

        if (sheet) {
          blit(sheet);
        } else {
          // Sheets not built yet (first frames before palette effect): plain block
          ctx.fillStyle = pal[`player${unit.colorIndex}`] ?? pal.foreground;
          ctx.fillRect(px, py + 2, BA_UNIT_W, BA_UNIT_H);
        }

        // Hit flash: white silhouette blink (skipped under reduced motion)
        if (anim && anim.hitUntil > now && flashSheetRef.current && fx && !fx.reducedMotion) {
          ctx.globalAlpha = Math.floor(now / 60) % 2 === 0 ? 0.85 : 0.3;
          blit(flashSheetRef.current);
          ctx.globalAlpha = 1;
        }

        // HP bar: eased value + low-HP pulse below 25%
        if (anim) anim.displayHp += (unit.hp - anim.displayHp) * 0.12;
        const shownHp = anim ? anim.displayHp : unit.hp;
        const lowHp = unit.hp / BA_UNIT_HP < 0.25;
        const barW = 12;
        const bx = Math.round(drawUx - barW / 2);
        const by = py - 5;
        ctx.fillStyle = pal.muted;
        ctx.fillRect(bx, by, barW, 2);
        if (lowHp && fx && !fx.reducedMotion) {
          ctx.globalAlpha = 0.55 + 0.45 * Math.abs(((now % 900) / 450) - 1);
        }
        ctx.fillStyle = lowHp ? pal.destructive
          : unit.hp > 35 ? (pal[`player${unit.colorIndex}`] ?? pal.foreground) : pal.destructive;
        ctx.fillRect(bx, by, Math.max(1, Math.round((shownHp / BA_UNIT_HP) * barW)), 2);
        ctx.globalAlpha = 1;

        // Active turn marker
        if (isAiming) {
          ctx.fillStyle = pal.trajectory;
          ctx.fillRect(Math.round(unit.x) - 1, by - 5, 2, 2);
          ctx.fillRect(Math.round(unit.x) - 2, by - 3, 4, 1);
        }
      });

      // Aim preview (dotted)
      const preview = previewRef.current;
      if (preview && phaseRef.current === 'aiming') {
        ctx.fillStyle = pal.trajectory;
        for (let i = 0; i < preview.length; i += 5) {
          ctx.fillRect(Math.round(preview[i].x), Math.round(preview[i].y), 1, 1);
        }
      }

      // Projectile playback (cosmetic — the fallback timer owns state application)
      if (playback) {
        const frameIdx = playbackFrameIdx;
        // Seam: the projectile has landed — show the explosion/crater while any
        // knocked units are still animating their flight arcs
        if (frameIdx >= playback.result.frames.length && !playback.explosionShown) {
          showExplosionRef.current(playback);
        }
        if (frameIdx >= playback.totalFrames) {
          playbackRef.current = null;
          applyShotResultRef.current(playback);
        } else if (frameIdx >= playback.result.frames.length) {
          // Flight portion: units are drawn along their arcs above; no projectile left
        } else {
          const framePt = playback.result.frames[frameIdx];
          const fxPal = {
            explosion: pal.explosion, smoke: pal.smoke, dirt: pal.dirt,
            terrain: pal.terrain, cloud: pal.cloud, trajectory: pal.trajectory,
            hazard: pal.hazard,
          };
          const prev = playback.result.frames[Math.max(0, frameIdx - 2)];
          ctx.save();
          ctx.translate(Math.round(framePt.x), Math.round(framePt.y));
          if (sprites && playback.weapon === 'bazooka') {
            ctx.rotate(Math.atan2(framePt.y - prev.y, framePt.x - prev.x));
            ctx.drawImage(sprites.rocket, -Math.round(ROCKET_W / 2), -Math.round(ROCKET_H / 2));
            if (fx && frameIdx - playback.trailFrame >= 3) {
              playback.trailFrame = frameIdx;
              spawnTrailSmoke(fx, fxPal, prev.x, prev.y, now);
            }
          } else if (sprites && playback.weapon === 'grenade') {
            const spinDir = playback.result.frames[0].x <= framePt.x ? 1 : -1;
            ctx.rotate(frameIdx * 0.12 * spinDir);
            ctx.drawImage(sprites.grenade, -Math.round(GRENADE_W / 2), -Math.round(GRENADE_H / 2));
            // Fuse blink accelerates as detonation approaches
            const fuse = BA_WEAPONS.grenade.fuseSteps ?? 180;
            const period = fuse - frameIdx < 60 ? 6 : 14;
            if (Math.floor(frameIdx / period) % 2 === 0) {
              ctx.fillStyle = pal.explosion;
              ctx.fillRect(-1, -Math.round(GRENADE_H / 2) - 1, 2, 2);
            }
          } else if (sprites && playback.weapon === 'boot') {
            // Kick flip toward travel direction with a comedic wobble
            if (framePt.x - prev.x < 0) ctx.scale(-1, 1);
            ctx.rotate(Math.floor(now / 90) % 2 === 0 ? -0.2 : 0.2);
            ctx.drawImage(sprites.boot, -Math.round(BOOT_W / 2), -Math.round(BOOT_H / 2));
          } else {
            ctx.fillStyle = pal.explosion;
            ctx.fillRect(-1, -1, 2, 2);
          }
          ctx.restore();
        }
      }

      // Explosion core flash (expanding filled circle)
      const explosion = explosionRef.current;
      if (explosion) {
        const left = explosion.endsAt - now;
        if (left <= 0) {
          explosionRef.current = null;
        } else {
          const progress = 1 - left / EXPLOSION_FLASH_MS;
          ctx.globalAlpha = 1 - progress;
          ctx.fillStyle = pal.explosion;
          ctx.beginPath();
          ctx.arc(explosion.x, explosion.y, explosion.r * (0.5 + progress * 0.7), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Particles, shockwave rings, floating damage numbers
      if (fx) {
        drawFxParticles(ctx, fx, pal.explosion, now);
        for (const num of pruneNumbers(fx, now)) {
          const t = numberProgress(num, now);
          ctx.globalAlpha = 1 - t * t;
          drawPixelText(
            ctx,
            num.text,
            num.x,
            num.y - (fx.reducedMotion ? 0 : t * 10),
            pal.foreground,
            pal.unitOutline,
          );
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();

      // Screen flash overlays the whole battlefield, unshaken
      if (fx) drawFxScreenFlash(ctx, fx, pal.explosion, now);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Clear the force timer on unmount
  useEffect(() => () => {
    if (forceTimerRef.current) clearTimeout(forceTimerRef.current);
  }, []);

  const registerCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
  }, []);

  const activeUnit = useMemo(
    () => unitsView[activeIdxRef.current] ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unitsView, turnIndex],
  );

  return {
    phase,
    countdown,
    turnIndex,
    activeUnit,
    unitsView,
    wind,
    turnTimeLeft,
    winner,
    damageDealt,
    selectedWeapon,
    setWeapon,
    staminaLeft,
    jump,
    commitShot,
    applyRemoteShot,
    skipCurrentTurn,
    applyTurnResolution,
    setWalkHeld,
    updateAim,
    clearAim,
    registerCanvas,
    getSimState,
  };
}
