import { useEffect } from 'react';
import { Crosshair, Skull } from 'lucide-react';
import ReadyScreen from '@/components/multiplayer/ReadyScreen';
import MultiplayerResults from '@/components/multiplayer/MultiplayerResults';
import { slotColor } from '@/components/multiplayer/playerColors';
import BlastCanvas from '@/components/blast/BlastCanvas';
import BlastHud from '@/components/blast/BlastHud';
import { useMultiplayerBlast } from '@/hooks/useMultiplayerBlast';
import { BA_BONUS_WEAPONS, BA_UNIT_HP, BA_WEAPONS } from '@/config/constants';
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
    phase, countdown, turnIndex, activeUnit, unitsView, wind, turnTimeLeft,
    selectedWeapon, setWeapon, staminaLeft, bonusWeapon, jump, endReposition,
    commitShot, setWalkHeld, updateAim, clearAim, registerCanvas,
  } = engine;

  const isLocalTurn = phase === 'aiming' && !!activeUnit?.isLocal;
  const isRepositioning = phase === 'reposition';

  // Keyboard: arrows/AD walk, up/W/space jump, 1/2/3 weapon, 4 held bonus weapon
  // (own turn only via engine guards)
  useEffect(() => {
    if (mpPhase !== 'active') return;
    const weaponIds = (Object.keys(BA_WEAPONS) as (keyof typeof BA_WEAPONS)[])
      .filter(id => !BA_BONUS_WEAPONS.includes(id));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        setWalkHeld(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        setWalkHeld(1);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        e.preventDefault();
        jump();
      } else if (e.key >= '1' && e.key <= '3') {
        setWeapon(weaponIds[parseInt(e.key, 10) - 1]);
      } else if (e.key === '4' && bonusWeapon) {
        setWeapon(bonusWeapon);
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
  }, [mpPhase, setWalkHeld, setWeapon, jump, bonusWeapon]);

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
        room={room}
        rankings={rankings}
        participants={participants}
        ownNickname={ownNickname}
        scoreUnit="dmg"
      />
    );
  }

  const turnLabel =
    phase === 'projectile' ? '...' :
    isRepositioning ? 'move!' :
    isLocalTurn ? 'your turn' :
    `${activeUnit?.nickname ?? ''}'s turn`;
  const bannerText = isLocalTurn ? 'your turn' : `${activeUnit?.nickname ?? ''}'s turn`;

  return (
    <div data-mode="arcade" className="min-h-screen flex flex-col items-center px-3 sm:px-8 pt-3 sm:pt-5 pb-4 select-none">
      <div className="w-full max-w-[1100px] flex flex-col gap-2">

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

        <div className="relative flex flex-col gap-2">
          <BlastHud
            turnLabel={turnLabel}
            isLocalTurn={isLocalTurn}
            timeLeft={turnTimeLeft}
            wind={wind}
            selectedWeapon={selectedWeapon}
            setWeapon={setWeapon}
            staminaLeft={staminaLeft}
            setWalkHeld={setWalkHeld}
            onJump={jump}
            bonusWeapon={bonusWeapon}
            isRepositioning={isRepositioning}
            onDoneMoving={endReposition}
          />
          <BlastCanvas
            registerCanvas={registerCanvas}
            updateAim={updateAim}
            clearAim={clearAim}
            commitShot={commitShot}
            maxSpeed={BA_WEAPONS[selectedWeapon].maxSpeed}
            canAim={isLocalTurn}
            banner={
              phase === 'aiming' ? { text: bannerText, key: turnIndex } :
              isRepositioning ? { text: 'MOVE!', key: -turnIndex - 1 } : null
            }
            hint="drag to aim, release to fire · arrows walk · space jumps · 1/2/3 weapons"
          />

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
