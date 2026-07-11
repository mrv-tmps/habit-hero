import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bomb,
  Check,
  ChevronLeft,
  ChevronRight,
  Cylinder,
  Footprints,
  Music,
  Radiation,
  Rocket,
  Timer,
  Volume2,
  VolumeX,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BA_BONUS_WEAPONS,
  BA_WEAPONS,
  BA_WIND_MAX,
  BA_WALK_STAMINA_PX,
  type BlastWeaponId,
} from '@/config/constants';
import { isBgmOn, isSfxOn, setBgmOn, setSfxOn, playSfx } from '@/lib/blastAudio';

interface BlastHudProps {
  turnLabel: string;
  isLocalTurn: boolean;
  timeLeft: number;
  wind: number;
  selectedWeapon: BlastWeaponId;
  setWeapon: (w: BlastWeaponId) => void;
  staminaLeft: number;
  setWalkHeld: (dir: -1 | 0 | 1) => void;
  onJump: () => void;
  // One-use crate weapon held by the local unit; renders as the 4th pill
  bonusWeapon: BlastWeaponId | null;
  // Post-fire reposition window: firing is disabled, "done" ends the window early
  isRepositioning: boolean;
  onDoneMoving: () => void;
}

const WEAPON_IDS = (Object.keys(BA_WEAPONS) as BlastWeaponId[])
  .filter(id => !BA_BONUS_WEAPONS.includes(id));

const WEAPON_ICONS: Partial<Record<BlastWeaponId, LucideIcon>> = {
  bazooka: Rocket,
  grenade: Bomb,
  boot: Footprints,
  nuke: Radiation,
  barrel: Cylinder,
};

export default function BlastHud({
  turnLabel,
  isLocalTurn,
  timeLeft,
  wind,
  selectedWeapon,
  setWeapon,
  staminaLeft,
  setWalkHeld,
  onJump,
  bonusWeapon,
  isRepositioning,
  onDoneMoving,
}: BlastHudProps) {
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [bgm, setBgm] = useState(isBgmOn);
  const [sfx, setSfx] = useState(isSfxOn);
  useEffect(() => {
    setCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const toggleBgm = () => {
    setBgmOn(!bgm);
    setBgm(!bgm);
  };
  const toggleSfx = () => {
    setSfxOn(!sfx);
    setSfx(!sfx);
    if (!sfx) playSfx('click');
  };

  const windStrength = Math.min(3, Math.ceil((Math.abs(wind) / BA_WIND_MAX) * 3));
  const canWalk = isLocalTurn || isRepositioning;
  const BonusIcon = bonusWeapon ? WEAPON_ICONS[bonusWeapon] : undefined;

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Top bar: turn + wind + timer + audio toggles */}
      <div className="flex items-center justify-between gap-3 font-mono">
        <span
          className={cn(
            'text-base sm:text-lg font-semibold truncate',
            isLocalTurn || isRepositioning ? 'text-focused-caret' : 'text-focused-dim',
          )}
        >
          {turnLabel}
        </span>
        <span
          className="flex items-center gap-1.5 text-focused-dim shrink-0"
          aria-label={`Wind ${wind >= 0 ? 'right' : 'left'}, strength ${windStrength} of 3`}
        >
          <Wind className="w-3.5 h-3.5" />
          {wind < 0 && <ArrowLeft className="w-3 h-3" />}
          <span className="flex gap-0.5">
            {[1, 2, 3].map(i => (
              <span
                key={i}
                className={cn(
                  'w-1 h-3 rounded-sm',
                  i <= windStrength ? 'bg-focused-caret opacity-70' : 'bg-white/10',
                )}
              />
            ))}
          </span>
          {wind >= 0 && <ArrowRight className="w-3 h-3" />}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'flex items-center gap-1.5 font-bold text-xl tabular-nums',
              timeLeft <= 5 ? 'text-focused-incorrect animate-pulse-glow' : 'text-focused-caret',
            )}
            aria-label={`${timeLeft} seconds left`}
          >
            <Timer className="w-4 h-4 opacity-60" />
            <span className="w-7 text-right">{timeLeft}</span>
          </span>
          <button
            onClick={toggleBgm}
            onMouseDown={e => e.preventDefault()}
            className={cn(
              'p-1 rounded-md transition-colors cursor-pointer',
              bgm ? 'text-focused-correct' : 'text-focused-dim opacity-50',
            )}
            aria-label={bgm ? 'Turn music off' : 'Turn music on'}
            aria-pressed={bgm}
          >
            <Music className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleSfx}
            onMouseDown={e => e.preventDefault()}
            className={cn(
              'p-1 rounded-md transition-colors cursor-pointer',
              sfx ? 'text-focused-correct' : 'text-focused-dim opacity-50',
            )}
            aria-label={sfx ? 'Turn sound effects off' : 'Turn sound effects on'}
            aria-pressed={sfx}
          >
            {sfx ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </span>
      </div>

      {/* Bottom bar: weapons + stamina + walk buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Weapon">
          {WEAPON_IDS.map((id, i) => {
            const Icon = WEAPON_ICONS[id] ?? Rocket;
            return (
              <button
                key={id}
                onClick={() => setWeapon(id)}
                onMouseDown={e => e.preventDefault()}
                disabled={!isLocalTurn}
                role="radio"
                aria-checked={selectedWeapon === id}
                className={cn(
                  'flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-40',
                  selectedWeapon === id
                    ? 'text-focused-caret bg-white/[0.08] ring-1 ring-white/[0.12]'
                    : 'text-focused-dim hover:text-focused-correct',
                )}
              >
                <span className="opacity-50">{i + 1}</span>
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{BA_WEAPONS[id].label}</span>
              </button>
            );
          })}
          {bonusWeapon && BonusIcon && (
            <button
              onClick={() => setWeapon(bonusWeapon)}
              onMouseDown={e => e.preventDefault()}
              disabled={!isLocalTurn}
              role="radio"
              aria-checked={selectedWeapon === bonusWeapon}
              className={cn(
                'flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-40',
                selectedWeapon === bonusWeapon
                  ? 'text-baCrate bg-white/[0.08] ring-1 ring-baCrate/50'
                  : 'text-baCrate/70 hover:text-baCrate',
              )}
            >
              <span className="opacity-50">4</span>
              <BonusIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{BA_WEAPONS[bonusWeapon].label}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isRepositioning && (
            <button
              onClick={onDoneMoving}
              onMouseDown={e => e.preventDefault()}
              className="flex items-center gap-1 font-mono text-xs px-2.5 py-1.5 rounded-md text-focused-caret bg-white/[0.08] ring-1 ring-white/[0.12] cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              done
            </button>
          )}

          {/* Stamina */}
          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden" aria-label="Walk stamina">
            <div
              className="h-full rounded-full bg-focused-caret opacity-70 transition-[width] duration-100"
              style={{ width: `${(staminaLeft / BA_WALK_STAMINA_PX) * 100}%` }}
            />
          </div>

          {coarsePointer && (
            <div className="flex gap-1.5">
              {([-1, 1] as const).map(dir => (
                <button
                  key={dir}
                  disabled={!canWalk}
                  className="w-11 h-11 rounded-lg bg-white/[0.06] text-focused-correct flex items-center justify-center active:bg-white/[0.12] disabled:opacity-40"
                  style={{ touchAction: 'none' }}
                  onPointerDown={e => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setWalkHeld(dir);
                  }}
                  onPointerUp={() => setWalkHeld(0)}
                  onPointerCancel={() => setWalkHeld(0)}
                  aria-label={dir === -1 ? 'Walk left' : 'Walk right'}
                >
                  {dir === -1 ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              ))}
              <button
                disabled={!canWalk}
                className="w-11 h-11 rounded-lg bg-white/[0.06] text-focused-correct flex items-center justify-center active:bg-white/[0.12] disabled:opacity-40"
                style={{ touchAction: 'none' }}
                onPointerDown={onJump}
                aria-label="Jump"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
