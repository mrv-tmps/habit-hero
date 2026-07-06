import { useState, useMemo } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { slotColor } from '@/components/multiplayer/playerColors';
import type { MultiplayerParticipant } from '@/types/multiplayer';
import { cn } from '@/lib/utils';

interface ReadyScreenProps {
  title: string;
  subtitle: string;
  participants: MultiplayerParticipant[];
  readyNicknames: string[];
  ownNickname: string;
  onReady: () => void;
}

export default function ReadyScreen({
  title,
  subtitle,
  participants,
  readyNicknames,
  ownNickname,
  onReady,
}: ReadyScreenProps) {
  const [hasMarkedReady, setHasMarkedReady] = useState(false);
  const readySet = new Set(readyNicknames);
  const isLoading = participants.length === 0;

  function handleReady() {
    setHasMarkedReady(true);
    onReady();
  }

  const nicknameToSlot = useMemo(() => {
    const m: Record<string, number> = {};
    participants.forEach((p, i) => { m[p.nickname] = i; });
    return m;
  }, [participants]);

  return (
    <div data-mode="multiplayer" className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center flex flex-col gap-1">
        <p className="font-pixel text-sm text-primary tracking-widest">{title}</p>
        <p className="font-mono text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          participants.map(p => {
            const slotIdx = nicknameToSlot[p.nickname] ?? 0;
            const isReady = readySet.has(p.nickname);
            const isMe = p.nickname === ownNickname;
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md border',
                  isMe ? 'bg-secondary border-border' : 'bg-card border-border',
                )}
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', slotColor(slotIdx))} />
                <span className="font-sans text-sm flex-1 truncate">
                  {p.nickname}
                  {isMe && <span className="text-muted-foreground text-xs ml-1">(you)</span>}
                  {p.is_host && <span className="text-muted-foreground text-xs ml-1">· host</span>}
                </span>
                {isReady ? (
                  <Check className="w-4 h-4 text-[hsl(var(--focused-text-correct))] shrink-0" />
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">…</span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={handleReady}
          disabled={hasMarkedReady || !ownNickname || isLoading}
          className="min-w-[160px] cursor-pointer"
        >
          {hasMarkedReady ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Waiting…
            </>
          ) : (
            "I'm Ready!"
          )}
        </Button>

        {!isLoading && (
          <p className="text-muted-foreground text-xs font-sans">
            {readyNicknames.length} / {participants.length} ready
          </p>
        )}
      </div>
    </div>
  );
}
