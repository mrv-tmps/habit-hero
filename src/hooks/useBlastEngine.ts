import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BA_CANVAS_W,
  BA_CANVAS_H,
  BA_MAX_ROUNDS,
  BA_SUDDEN_DEATH_DRAIN,
  BA_TURN_TIME_MS,
  BA_UNIT_HP,
  BA_UNIT_W,
  BA_UNIT_H,
  BA_WALK_STAMINA_PX,
  BA_WEAPONS,
  type BlastWeaponId,
} from '@/config/constants';
import { generateTerrain, carveCircle, isSolid, spawnPositions } from '@/lib/blastTerrain';
import {
  simulateShot,
  settleUnits,
  windAt,
  type ShotInput,
  type ShotResult,
  type UnitState,
  type SimFrame,
} from '@/lib/blastSim';

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
  unitInits: BlastUnitInit[];
  onShotCommitted?: (input: ShotInput, turnIndex: number) => void;
  // Multiplayer: host reconciliation broadcast after each shot resolves
  onTurnResolved?: (hp: Record<string, number>, turnIndex: number) => void;
  // Multiplayer: host announces timer/absence skips; non-hosts wait for the event
  onTurnSkipped?: (turnIndex: number) => void;
  autoSkipTurns?: boolean;
}

export interface SimStateSnapshot {
  terrain: Uint8Array;
  units: UnitState[];
  wind: number;
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
  commitShot: (vx: number, vy: number) => void;
  applyRemoteShot: (input: ShotInput) => void;
  skipCurrentTurn: () => void;
  forceSkipTurn: (turnIndex: number) => void;
  reconcileHp: (hp: Record<string, number>) => void;
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

function readToken(css: CSSStyleDeclaration, name: string): string {
  return `hsl(${css.getPropertyValue(name).trim()})`;
}

export function useBlastEngine({
  seed,
  startAt,
  unitInits,
  onShotCommitted,
  onTurnResolved,
  onTurnSkipped,
  autoSkipTurns = true,
}: UseBlastEngineArgs): UseBlastEngineReturn {
  const onTurnResolvedRef = useRef(onTurnResolved);
  onTurnResolvedRef.current = onTurnResolved;
  const onTurnSkippedRef = useRef(onTurnSkipped);
  onTurnSkippedRef.current = onTurnSkipped;
  // ── Simulation state (refs — the rAF renderer reads these; never setState per frame)
  const terrainRef = useRef<Uint8Array>(new Uint8Array(0));
  const unitsRef = useRef<UnitState[]>([]);
  const windRef = useRef(0);
  const damageDealtRef = useRef<Record<string, number>>({});
  const playbackRef = useRef<{
    result: ShotResult;
    weapon: BlastWeaponId;
    shooterId: string;
    startedAt: number;
  } | null>(null);
  const explosionRef = useRef<{ x: number; y: number; r: number; endsAt: number } | null>(null);
  const previewRef = useRef<SimFrame[] | null>(null);
  const walkHeldRef = useRef<-1 | 0 | 1>(0);
  const staminaRef = useRef(BA_WALK_STAMINA_PX);
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

  // ── React state (discrete events only)
  const [phase, setPhaseState] = useState<BlastPhase>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [turnIndex, setTurnIndex] = useState(0);
  const [unitsView, setUnitsView] = useState<UnitState[]>([]);
  const [wind, setWind] = useState(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState(BA_TURN_TIME_MS / 1000);
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

  // ── World init (once per seed/roster)
  useEffect(() => {
    const terrain = generateTerrain(seed);
    terrainRef.current = terrain;
    const spawns = spawnPositions(seed, terrain, unitInits.length);
    unitsRef.current = unitInits.map((init, i) => ({
      ...init,
      hp: BA_UNIT_HP,
      x: spawns[i].x,
      y: spawns[i].y,
      facing: (i % 2 === 0 ? 1 : -1) as 1 | -1,
    }));
    damageDealtRef.current = Object.fromEntries(unitInits.map(u => [u.id, 0]));
    repaintTerrain();
    syncUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // ── Terrain offscreen canvas
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
    ctx.clearRect(0, 0, BA_CANVAS_W, BA_CANVAS_H);
    ctx.fillStyle = paletteRef.current.terrain ?? '#000';
    ctx.beginPath();
    for (let y = 0; y < BA_CANVAS_H; y++) {
      let runStart = -1;
      for (let x = 0; x <= BA_CANVAS_W; x++) {
        const solid = x < BA_CANVAS_W && terrain[y * BA_CANVAS_W + x] === 1;
        if (solid && runStart < 0) runStart = x;
        if (!solid && runStart >= 0) {
          ctx.rect(runStart, y, x - runStart, 1);
          runStart = -1;
        }
      }
    }
    ctx.fill();
  }, []);

  // ── Palette sampled from CSS tokens once (design rule: no hex literals in TS)
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const palette: Record<string, string> = {
      sky: readToken(css, '--ba-sky'),
      terrain: readToken(css, '--ba-terrain'),
      explosion: readToken(css, '--ba-explosion'),
      trajectory: readToken(css, '--ba-trajectory'),
      foreground: readToken(css, '--foreground'),
      muted: readToken(css, '--muted'),
      destructive: readToken(css, '--destructive'),
    };
    for (let i = 1; i <= 8; i++) {
      palette[`player${i}`] = readToken(css, `--player-${i}`);
    }
    paletteRef.current = palette;
    repaintTerrain();
  }, [repaintTerrain]);

  // ── Turn management
  const startTurnAt = useCallback((idx: number, turnIdx: number) => {
    activeIdxRef.current = idx;
    turnIndexRef.current = turnIdx;
    windRef.current = windAt(seed, turnIdx);
    staminaRef.current = BA_WALK_STAMINA_PX;
    turnEndsAtRef.current = Date.now() + BA_TURN_TIME_MS;
    walkHeldRef.current = 0;
    previewRef.current = null;
    setTurnIndex(turnIdx);
    setWind(windRef.current);
    setStaminaLeft(BA_WALK_STAMINA_PX);
    setTurnTimeLeft(BA_TURN_TIME_MS / 1000);
    setPhase('aiming');
  }, [seed, setPhase]);

  const finishGame = useCallback(() => {
    const alive = unitsRef.current.filter(u => u.hp > 0);
    setWinner(alive.length === 1 ? { ...alive[0] } : null);
    setDamageDealt({ ...damageDealtRef.current });
    syncUnits();
    setPhase('done');
  }, [setPhase, syncUnits]);

  const advanceTurn = useCallback(() => {
    const units = unitsRef.current;
    const aliveCount = units.filter(u => u.hp > 0).length;
    if (aliveCount <= 1) {
      finishGame();
      return;
    }

    let nextTurn = turnIndexRef.current + 1;
    let nextIdx = (activeIdxRef.current + 1) % units.length;
    while (units[nextIdx].hp <= 0) {
      nextIdx = (nextIdx + 1) % units.length;
      nextTurn++;
    }

    // Sudden death: after the round budget, every turn start drains all units
    if (Math.floor(nextTurn / units.length) >= BA_MAX_ROUNDS) {
      for (const u of units) {
        if (u.hp > 0) u.hp = Math.max(0, u.hp - BA_SUDDEN_DEATH_DRAIN);
      }
      syncUnits();
      const survivors = units.filter(u => u.hp > 0);
      if (survivors.length <= 1) {
        finishGame();
        return;
      }
      if (units[nextIdx].hp <= 0) {
        while (units[nextIdx].hp <= 0) {
          nextIdx = (nextIdx + 1) % units.length;
          nextTurn++;
        }
      }
    }

    startTurnAt(nextIdx, nextTurn);
  }, [finishGame, startTurnAt, syncUnits]);

  // ── Shot resolution (applied after playback finishes)
  const applyShotResult = useCallback((result: ShotResult, shooterId: string) => {
    const terrain = terrainRef.current;
    const units = unitsRef.current;

    if (result.explosionAt) {
      const weaponRadius = result.carves[0]?.r ?? 10;
      explosionRef.current = {
        x: result.explosionAt.x,
        y: result.explosionAt.y,
        r: weaponRadius,
        endsAt: Date.now() + EXPLOSION_FLASH_MS,
      };
    }
    for (const carve of result.carves) {
      carveCircle(terrain, carve.x, carve.y, carve.r);
    }
    if (result.carves.length > 0) repaintTerrain();

    let dealtToOthers = 0;
    for (const unit of units) {
      const dmg = result.damage[unit.id];
      if (!dmg) continue;
      unit.hp = Math.max(0, unit.hp - dmg);
      if (unit.id !== shooterId) dealtToOthers += dmg;
      const kb = result.knockback[unit.id];
      if (kb && unit.hp > 0) {
        unit.x += kb.dx;
        unit.y += kb.dy;
      }
    }
    damageDealtRef.current[shooterId] =
      (damageDealtRef.current[shooterId] ?? 0) + dealtToOthers;

    settleUnits(terrain, units);
    syncUnits();
    onTurnResolvedRef.current?.(
      Object.fromEntries(units.map(u => [u.id, u.hp])),
      turnIndexRef.current,
    );
    advanceTurn();
  }, [advanceTurn, repaintTerrain, syncUnits]);

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
    );
    previewRef.current = null;
    playbackRef.current = {
      result,
      weapon: input.weapon,
      shooterId: shooter.id,
      startedAt: Date.now(),
    };
    setPhase('projectile');
  }, [setPhase]);

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

  const applyRemoteShot = useCallback((input: ShotInput) => {
    fireShot(input);
  }, [fireShot]);

  // ── Aim preview: truncated run of the real sim so the preview never lies
  const updateAim = useCallback((vx: number, vy: number) => {
    const active = unitsRef.current[activeIdxRef.current];
    if (!active?.isLocal || phaseRef.current !== 'aiming') return;
    active.facing = vx >= 0 ? 1 : -1;
    const result = simulateShot(
      { weapon: selectedWeaponRef.current, x: active.x, y: active.y - BA_UNIT_H, vx, vy },
      terrainRef.current,
      unitsRef.current,
      windRef.current,
      active.id,
    );
    previewRef.current = result.frames.slice(0, PREVIEW_STEPS);
  }, []);

  const clearAim = useCallback(() => {
    previewRef.current = null;
  }, []);

  const skipCurrentTurn = useCallback(() => {
    if (phaseRef.current !== 'aiming') return;
    previewRef.current = null;
    onTurnSkippedRef.current?.(turnIndexRef.current);
    advanceTurn();
  }, [advanceTurn]);

  // Remote skip: only honored if we're still on that turn (dedupe/ordering guard)
  const forceSkipTurn = useCallback((turnIdx: number) => {
    if (phaseRef.current !== 'aiming' || turnIndexRef.current !== turnIdx) return;
    previewRef.current = null;
    advanceTurn();
  }, [advanceTurn]);

  // Host-authoritative safety net: overwrite local HP with the host's values
  const reconcileHp = useCallback((hp: Record<string, number>) => {
    let changed = false;
    for (const unit of unitsRef.current) {
      if (unit.id in hp && unit.hp !== hp[unit.id]) {
        unit.hp = hp[unit.id];
        changed = true;
      }
    }
    if (!changed) return;
    syncUnits();
    if (unitsRef.current.filter(u => u.hp > 0).length <= 1 && phaseRef.current !== 'done') {
      finishGame();
    }
  }, [syncUnits, finishGame]);

  const setWeapon = useCallback((w: BlastWeaponId) => {
    selectedWeaponRef.current = w;
    setSelectedWeapon(w);
  }, []);

  const setWalkHeld = useCallback((dir: -1 | 0 | 1) => {
    walkHeldRef.current = dir;
  }, []);

  const getSimState = useCallback((): SimStateSnapshot => ({
    terrain: terrainRef.current,
    units: unitsRef.current,
    wind: windRef.current,
  }), []);

  // ── Countdown until startAt
  useEffect(() => {
    const tick = () => {
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

  // ── Turn timer
  useEffect(() => {
    if (phase !== 'aiming') return;
    const interval = setInterval(() => {
      const leftMs = turnEndsAtRef.current - Date.now();
      setTurnTimeLeft(Math.max(0, Math.ceil(leftMs / 1000)));
      if (leftMs <= 0) {
        clearInterval(interval);
        previewRef.current = null;
        if (autoSkipTurns) {
          onTurnSkippedRef.current?.(turnIndexRef.current);
          advanceTurn();
        }
        // Non-authoritative clients wait for the host's turn_skipped event
      }
    }, 250);
    return () => clearInterval(interval);
  }, [phase, turnIndex, advanceTurn, autoSkipTurns]);

  // ── Walking (interval, not rAF — discrete steps, throttled state sync)
  useEffect(() => {
    if (phase !== 'aiming') return;
    const interval = setInterval(() => {
      const dir = walkHeldRef.current;
      if (dir === 0 || staminaRef.current <= 0) return;
      const unit = unitsRef.current[activeIdxRef.current];
      if (!unit?.isLocal || unit.hp <= 0) return;

      const terrain = terrainRef.current;
      const nx = Math.max(BA_UNIT_W / 2, Math.min(BA_CANVAS_W - BA_UNIT_W / 2, unit.x + dir * WALK_STEP_PX));
      let ny = unit.y;
      let climbed = 0;
      while (isSolid(terrain, nx, ny) && climbed < 4) {
        ny--;
        climbed++;
      }
      if (isSolid(terrain, nx, ny)) return; // wall too steep
      while (ny < BA_CANVAS_H - 1 && !isSolid(terrain, nx, ny + 1)) ny++;

      unit.x = nx;
      unit.y = ny;
      unit.facing = dir;
      staminaRef.current = Math.max(0, staminaRef.current - WALK_STEP_PX);
      setStaminaLeft(Math.round(staminaRef.current));
    }, WALK_TICK_MS);
    return () => clearInterval(interval);
  }, [phase, turnIndex]);

  // ── Renderer (rAF; reads refs only)
  useEffect(() => {
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const pal = paletteRef.current;

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = pal.sky;
      ctx.fillRect(0, 0, BA_CANVAS_W, BA_CANVAS_H);
      if (terrainCanvasRef.current) ctx.drawImage(terrainCanvasRef.current, 0, 0);

      // Units
      const activeIdx = activeIdxRef.current;
      unitsRef.current.forEach((unit, i) => {
        if (unit.hp <= 0) return;
        const px = Math.round(unit.x - BA_UNIT_W / 2);
        const py = Math.round(unit.y - BA_UNIT_H);
        ctx.fillStyle = pal[`player${unit.colorIndex}`] ?? pal.foreground;
        ctx.fillRect(px, py, BA_UNIT_W, BA_UNIT_H);
        ctx.fillStyle = pal.foreground;
        const eyeX = unit.facing === 1 ? px + BA_UNIT_W - 3 : px + 1;
        ctx.fillRect(eyeX, py + 2, 2, 2);

        // HP bar
        const barW = 12;
        const bx = Math.round(unit.x - barW / 2);
        const by = py - 5;
        ctx.fillStyle = pal.muted;
        ctx.fillRect(bx, by, barW, 2);
        ctx.fillStyle = unit.hp > 35 ? (pal[`player${unit.colorIndex}`] ?? pal.foreground) : pal.destructive;
        ctx.fillRect(bx, by, Math.max(1, Math.round((unit.hp / BA_UNIT_HP) * barW)), 2);

        // Active turn marker
        if (i === activeIdx && phaseRef.current === 'aiming') {
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

      // Projectile playback
      const playback = playbackRef.current;
      if (playback) {
        const elapsed = Date.now() - playback.startedAt;
        const frameIdx = Math.floor((elapsed / 1000) * 60);
        if (frameIdx >= playback.result.frames.length) {
          playbackRef.current = null;
          applyShotResult(playback.result, playback.shooterId);
        } else {
          const frame = playback.result.frames[frameIdx];
          ctx.fillStyle = pal.explosion;
          const size = playback.weapon === 'grenade' ? 3 : 2;
          ctx.fillRect(Math.round(frame.x) - 1, Math.round(frame.y) - 1, size, size);
        }
      }

      // Explosion flash
      const explosion = explosionRef.current;
      if (explosion) {
        const left = explosion.endsAt - Date.now();
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
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [applyShotResult]);

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
    commitShot,
    applyRemoteShot,
    skipCurrentTurn,
    forceSkipTurn,
    reconcileHp,
    setWalkHeld,
    updateAim,
    clearAim,
    registerCanvas,
    getSimState,
  };
}
