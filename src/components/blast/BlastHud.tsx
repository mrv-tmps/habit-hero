import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BA_WEAPONS,
  BA_WIND_MAX,
  BA_WALK_STAMINA_PX,
  type BlastWeaponId,
} from '@/config/constants';

interface BlastHudProps {
  turnLabel: string;
  isLocalTurn: boolean;
  timeLeft: number;
  wind: number;
  selectedWeapon: BlastWeaponId;
  setWeapon: (w: BlastWeaponId) => void;
  staminaLeft: number;
  setWalkHeld: (dir: -1 | 0 | 1) => void;
}

const WEAPON_IDS = Object.keys(BA_WEAPONS) as BlastWeaponId[];

export default function BlastHud({
  turnLabel,
  isLocalTurn,
  timeLeft,
  wind,
  selectedWeapon,
  setWeapon,
  staminaLeft,
  setWalkHeld,
}: BlastHudProps) {
  const [coarsePointer, setCoarsePointer] = useState(false);
  useEffect(() => {
    setCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const windStrength = Math.min(3, Math.ceil((Math.abs(wind) / BA_WIND_MAX) * 3));

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Top bar: turn + wind + timer */}
      <div className="flex items-center justify-between font-mono text-sm">
        <span className={cn(isLocalTurn ? 'text-focused-caret' : 'text-focused-dim')}>
          {turnLabel}
        </span>
        <span className="flex items-center gap-1.5 text-focused-dim" aria-label={`Wind ${wind >= 0 ? 'right' : 'left'}, strength ${windStrength} of 3`}>
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
        <span
          className={cn(
            'font-bold text-lg tabular-nums w-8 text-right',
            timeLeft <= 5 ? 'text-focused-incorrect' : 'text-focused-caret',
          )}
        >
          {timeLeft}
        </span>
      </div>

      {/* Bottom bar: weapons + stamina + walk buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Weapon">
          {WEAPON_IDS.map((id, i) => (
            <button
              key={id}
              onClick={() => setWeapon(id)}
              onMouseDown={e => e.preventDefault()}
              disabled={!isLocalTurn}
              role="radio"
              aria-checked={selectedWeapon === id}
              className={cn(
                'font-mono text-xs px-2.5 py-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-40',
                selectedWeapon === id
                  ? 'text-focused-caret bg-white/[0.08]'
                  : 'text-focused-dim hover:text-focused-correct',
              )}
            >
              <span className="opacity-50 mr-1">{i + 1}</span>
              {BA_WEAPONS[id].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
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
                  disabled={!isLocalTurn}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
