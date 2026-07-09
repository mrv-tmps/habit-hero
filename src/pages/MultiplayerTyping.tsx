import { useState, useEffect, useRef, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { MonitorSmartphone, X, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useMultiplayerTyping } from '@/hooks/useMultiplayerTyping';
import { useIsMobile } from '@/hooks/use-mobile';
import ReadyScreen from '@/components/multiplayer/ReadyScreen';
import MultiplayerResults from '@/components/multiplayer/MultiplayerResults';
import CountdownOverlay from '@/components/multiplayer/CountdownOverlay';
import { slotColor, slotColorVar } from '@/components/multiplayer/playerColors';
import { getCharStatuses } from '@/lib/typingRender';
import type { MultiplayerRoom } from '@/types/multiplayer';
import { cn } from '@/lib/utils';

const CHAR_STATUS_CLS: Record<string, string> = {
  upcoming: 'text-focused-dim',
  correct: 'text-focused-correct',
  incorrect: 'text-focused-incorrect',
};

function Caret() {
  return (
    <span
      className="inline-block w-0.5 h-[1.2em] bg-focused-caret animate-caret-blink align-[-0.15em] mx-px"
      aria-hidden="true"
    />
  );
}

// ─── English word display (same look as solo TypingTest) ─────────────────────

interface WordDisplayProps {
  words: string[];
  wordIdx: number;
  typedChars: string;
}

function WordDisplay({ words, wordIdx, typedChars }: WordDisplayProps) {
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const el = wordRefs.current[wordIdx];
    if (!el) return;
    const lineH = el.offsetHeight + 4;
    setScrollOffset(Math.max(0, el.offsetTop - lineH));
  }, [wordIdx]);

  return (
    <div className="overflow-hidden relative" style={{ height: '9rem' }}>
      <div
        className="font-mono text-2xl leading-[3rem]"
        style={{
          transform: `translateY(-${scrollOffset}px)`,
          transition: 'transform 80ms ease-out',
        }}
      >
        {words.map((word, wIdx) => {
          const isCurrent = wIdx === wordIdx;
          const typed = isCurrent ? typedChars : '';
          const cells = getCharStatuses(word, typed);
          // Words already committed are always fully correct in race mode
          const spans = cells.map((cell, cIdx) => (
            <span
              key={cIdx}
              className={wIdx < wordIdx ? 'text-focused-correct' : CHAR_STATUS_CLS[cell.status]}
            >
              {cell.char}
            </span>
          ));

          if (isCurrent) {
            const caretPos = Math.min(typedChars.length, spans.length);
            spans.splice(caretPos, 0, <Caret key="caret" />);
          }

          return (
            <span
              key={wIdx}
              ref={el => { wordRefs.current[wIdx] = el; }}
              className="inline-block mr-3 mb-2"
            >
              {spans}
            </span>
          );
        })}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-focused-bg to-transparent pointer-events-none" />
    </div>
  );
}

// ─── Code snippet display ─────────────────────────────────────────────────────

interface CodeDisplayProps {
  snippetText: string;
  charIdx: number;
  errorFlash: number;
}

function CodeDisplay({ snippetText, charIdx, errorFlash }: CodeDisplayProps) {
  return (
    <pre
      className={cn(
        'font-mono text-base leading-relaxed whitespace-pre m-0',
        errorFlash > 0 && 'animate-char-error',
      )}
      key={errorFlash}
    >
      {snippetText.split('').map((char, i) => {
        const status = i < charIdx ? 'correct' : 'upcoming';
        return (
          <span key={i}>
            {i === charIdx && <Caret />}
            <span className={CHAR_STATUS_CLS[status]}>{char}</span>
          </span>
        );
      })}
      {charIdx >= snippetText.length && <Caret />}
    </pre>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MultiplayerTyping({ room }: { room: MultiplayerRoom }) {
  const isMobile = useIsMobile();

  const {
    phase,
    mode,
    language,
    words,
    snippetText,
    wordIdx,
    typedChars,
    charIdx,
    myWpm,
    myFinished,
    playerProgress,
    timeRemaining,
    rankings,
    ownNickname,
    participants,
    readyNicknames,
    markReady,
    startRace,
    handleEnglishInput,
    handleCodeKey,
  } = useMultiplayerTyping(room);

  const [mobileDismissed, setMobileDismissed] = useState(false);
  const [errorFlash, setErrorFlash] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'active') inputRef.current?.focus();
  }, [phase]);

  const nicknameToSlot = useMemo(() => {
    const m: Record<string, number> = {};
    participants.forEach((p, i) => { m[p.nickname] = i; });
    return m;
  }, [participants]);

  // Own row pinned first, others by progress descending
  const progressRows = useMemo(() => {
    const entries = Object.entries(playerProgress);
    entries.sort(([aName, a], [bName, b]) => {
      if (aName === ownNickname) return -1;
      if (bName === ownNickname) return 1;
      return b.progress_pct - a.progress_pct;
    });
    return entries;
  }, [playerProgress, ownNickname]);

  function handleCodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mode !== 'code') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') e.preventDefault();
    if (e.key.length !== 1 && e.key !== 'Enter') return;

    const correct = handleCodeKey(e.key);
    if (!correct) setErrorFlash(k => k + 1);
  }

  if (phase === 'ready') {
    const sessionDesc = room.time_limit_seconds !== null
      ? `${room.time_limit_seconds}s`
      : `${words.length || snippetText.length} ${mode === 'code' ? 'chars' : 'words'}`;
    return (
      <ReadyScreen
        title="TYPING RACE"
        subtitle={`${room.code} · ${mode === 'code' ? language : 'english'} · ${sessionDesc}`}
        participants={participants}
        readyNicknames={readyNicknames}
        ownNickname={ownNickname}
        onReady={markReady}
      />
    );
  }

  if (phase === 'done') {
    return (
      <MultiplayerResults
        room={room}
        rankings={rankings}
        participants={participants}
        ownNickname={ownNickname}
        scoreUnit="wpm"
      />
    );
  }

  const isTimerPulsing = timeRemaining !== null && timeRemaining <= 10;

  return (
    <div data-mode="multiplayer" className="min-h-screen flex flex-col">
      {/* Start countdown — clock does not start until this finishes (phase → active) */}
      {phase === 'countdown' && (
        <CountdownOverlay label="Race starts in" onDone={startRace} className="z-30" />
      )}

      {/* Mobile warning */}
      {isMobile && !mobileDismissed && (
        <div className="z-20 flex items-center gap-2 px-4 py-2 bg-card border-b border-border text-sm font-sans text-muted-foreground">
          <MonitorSmartphone className="w-4 h-4 shrink-0" />
          <span className="flex-1">Multiplayer games work best on a larger screen.</span>
          <button
            onClick={() => setMobileDismissed(true)}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Progress panel */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border px-6 py-3 flex flex-col gap-1.5">
        {progressRows.map(([nickname, p]) => {
          const slotIdx = nicknameToSlot[nickname] ?? 0;
          const isMe = nickname === ownNickname;
          const pct = isMe && !p.finished
            ? Math.max(p.progress_pct, 0)
            : p.progress_pct;
          const wpm = isMe && !p.finished ? myWpm : p.wpm;

          return (
            <div
              key={nickname}
              className={cn(
                'flex items-center gap-3 py-0.5',
                isMe && 'bg-secondary/50 rounded-md -mx-1 px-1',
              )}
              style={{ '--progress-color': slotColorVar(slotIdx) } as CSSProperties}
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', slotColor(slotIdx))} />
              <span className="font-sans text-xs w-24 truncate text-foreground">
                {nickname}
                {isMe && <span className="text-muted-foreground ml-1">(you)</span>}
              </span>
              <Progress
                value={pct}
                className={cn(
                  'h-2 flex-1',
                  '[&>div]:bg-[var(--progress-color)]',
                  '[&>div]:transition-transform [&>div]:duration-200 [&>div]:ease-out',
                  'motion-reduce:[&>div]:transition-none',
                )}
              />
              <span className="font-mono text-xs text-muted-foreground w-16 text-right shrink-0">
                {p.finished ? (
                  <span className="inline-flex items-center gap-1 justify-end">
                    <CheckCircle2 className="w-3 h-3 text-[hsl(var(--focused-text-correct))]" />
                    {wpm}
                  </span>
                ) : (
                  `${wpm} wpm`
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Typing area */}
      <div
        className="flex-1 flex flex-col relative px-6 py-8 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {timeRemaining !== null && (
          <span
            className={cn(
              'absolute top-3 left-3 font-mono text-sm text-primary',
              isTimerPulsing && 'animate-pulse-glow',
            )}
          >
            {timeRemaining}s
          </span>
        )}

        {mode === 'code' && language && (
          <Badge variant="outline" className="absolute top-3 right-3 text-xs font-mono">
            {language}
          </Badge>
        )}

        <div className="flex-1 flex flex-col justify-center max-w-[680px] w-full mx-auto">
          {myFinished ? (
            <div className="text-center flex flex-col gap-2">
              <p className="font-mono text-2xl text-focused-correct">Finished!</p>
              <p className="font-sans text-sm text-muted-foreground">
                Waiting for the other racers…
              </p>
            </div>
          ) : mode === 'code' ? (
            <CodeDisplay snippetText={snippetText} charIdx={charIdx} errorFlash={errorFlash} />
          ) : (
            <WordDisplay words={words} wordIdx={wordIdx} typedChars={typedChars} />
          )}
        </div>
      </div>

      {/* Hidden keyboard sink — onChange drives english mode (mobile-safe),
          onKeyDown drives code mode (char-by-char incl. Enter). */}
      <input
        ref={inputRef}
        value={mode === 'english' ? typedChars : ''}
        onChange={e => { if (mode === 'english') handleEnglishInput(e.target.value); }}
        onKeyDown={handleCodeKeyDown}
        onBlur={() => {
          if (phase === 'active' && !myFinished) {
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
        className="fixed -left-96 -top-96 opacity-0 w-px h-px"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        inputMode="text"
        enterKeyHint="none"
        spellCheck={false}
      />
    </div>
  );
}
