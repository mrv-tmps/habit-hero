import { useEffect } from 'react';
import { Crosshair, Skull } from 'lucide-react';
import ReadyScreen from '@/components/multiplayer/ReadyScreen';
import MultiplayerResults from '@/components/multiplayer/MultiplayerResults';
import { slotColor } from '@/components/multiplayer/playerColors';
import BlastCanvas from '@/components/blast/BlastCanvas';
import BlastHud from '@/components/blast/BlastHud';
import { useMultiplayerBlast } from '@/hooks/useMultiplayerBlast';
import { BA_UNIT_HP, BA_WEAPONS } from '@/config/constants';
import type { MultiplayerRoom } from '@/types/multiplayer';
import { cn } from '@/lib/utils';

export default function MultiplayerBlast({ room }: { room: MultiplayerRoom }) {
  const {
    mpPhase,
    engine,
    rankings,
    ownNickname,
    participants,
    readyNicknames,
    markReady,
  } = useMultiplayerBlast(room);

  const {
    phase, countdown, activeUnit, unitsView, wind, turnTimeLeft,
    selectedWeapon, setWeapon, staminaLeft,
    commitShot, setWalkHeld, updateAim, clearAim, registerCanvas,
  } = engine;

  const isLocalTurn = phase === 'aiming' && !!activeUnit?.isLocal;

  // Keyboard: arrows/AD walk, 1/2/3 weapon (active on own turn only via engine guards)
  useEffect(() => {
    if (mpPhase !== 'active') return;
    const weaponIds = Object.keys(BA_WEAPONS) as (keyof typeof BA_WEAPONS)[];
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        setWalkHeld(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        setWalkHeld(1);
      } else if (e.key >= '1' && e.key <= '3') {
        setWeapon(weaponIds[parseInt(e.key, 10) - 1]);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) setWalkHeld(0);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [mpPhase, setWalkHeld, setWeapon]);

  if (mpPhase === 'ready') {
    return (
      <ReadyScreen
        title="BLAST ARENA"
        subtitle="Last one standing wins — get ready to fire"
        participants={participants}
        readyNicknames={readyNicknames}
        ownNickname={ownNickname}
        onReady={markReady}
      />
    );
  }

  if (mpPhase === 'done') {
    return (
      <MultiplayerResults
        title="Battle Complete!"
        rankings={rankings}
        participants={participants}
        ownNickname={ownNickname}
        scoreUnit="dmg"
        playAgainGameId="blast-arena"
      />
    );
  }

  const turnLabel =
    phase === 'projectile' ? '...' :
    isLocalTurn ? 'your turn' :
    `${activeUnit?.nickname ?? ''}'s turn`;

  return (
    <div data-mode="arcade" className="min-h-screen flex flex-col items-center px-4 sm:px-8 pt-6 sm:pt-10 pb-8 select-none">
      <div className="w-full max-w-[760px] flex flex-col gap-3">

        {/* Player strip */}
        <div className="flex flex-wrap gap-2">
          {unitsView.map((unit, i) => {
            const isActive = unit.id === activeUnit?.id && phase !== 'done';
            const isMe = unit.nickname === ownNickname;
            return (
              <div
                key={unit.id}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 border text-xs font-mono',
                  isActive ? 'border-primary/50 bg-white/[0.06]' : 'border-white/[0.07] bg-white/[0.02]',
                  unit.hp <= 0 && 'opacity-50',
                )}
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', slotColor(i))} />
                <span className="text-focused-correct truncate max-w-[90px]">
                  {unit.nickname}
                  {isMe && <span className="text-focused-dim ml-1">(you)</span>}
                </span>
                {unit.hp > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-10 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <span
                        className={cn('block h-full rounded-full', slotColor(i))}
                        style={{ width: `${(unit.hp / BA_UNIT_HP) * 100}%` }}
                      />
                    </span>
                    <span className="text-focused-dim tabular-nums">{unit.hp}</span>
                  </span>
                ) : (
                  <Skull className="w-3.5 h-3.5 text-focused-dim" />
                )}
                {isActive && <Crosshair className="w-3.5 h-3.5 text-focused-caret" />}
              </div>
            );
          })}
        </div>

        <div className="relative flex flex-col gap-3">
          <BlastHud
            turnLabel={turnLabel}
            isLocalTurn={isLocalTurn}
            timeLeft={turnTimeLeft}
            wind={wind}
            selectedWeapon={selectedWeapon}
            setWeapon={setWeapon}
            staminaLeft={staminaLeft}
            setWalkHeld={setWalkHeld}
          />
          <BlastCanvas
            registerCanvas={registerCanvas}
            updateAim={updateAim}
            clearAim={clearAim}
            commitShot={commitShot}
            maxSpeed={BA_WEAPONS[selectedWeapon].maxSpeed}
            canAim={isLocalTurn}
          />
          <p className="text-center text-xs font-mono text-focused-dim">
            {isLocalTurn
              ? 'drag to aim, release to fire · arrows to walk · 1/2/3 weapons'
              : `waiting for ${activeUnit?.nickname ?? 'opponent'}…`}
          </p>

          {phase === 'countdown' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <span
                key={countdown}
                className="font-pixel text-6xl text-focused-caret animate-countdown-pop"
              >
                {countdown}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
