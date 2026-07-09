import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MP_QUESTION_COUNT_OPTIONS,
  MP_TIME_LIMIT_OPTIONS,
  MP_MATH_DIFFICULTY,
  MP_CODE_LANGUAGES,
} from '@/config/constants';
import type { RoomConfigUpdate } from '@/hooks/useMultiplayerRoom';
import type {
  MultiplayerRoom,
  GameType,
  MathDifficulty,
  TypingMode,
  CodeLanguage,
} from '@/types/multiplayer';

const GAME_TYPE_OPTIONS: { value: GameType; label: string }[] = [
  { value: 'math-buzzer', label: 'Math Buzzer' },
  { value: 'typing-race', label: 'Typing Race' },
  { value: 'blast-arena', label: 'Blast Arena' },
];

const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  c: 'C',
};

// Blast supports up to 4 units; the other games seat up to 8.
function maxPlayerOptions(gameType: GameType): number[] {
  return gameType === 'blast-arena' ? [2, 3, 4] : [2, 4, 6, 8];
}

function gameHardCap(gameType: GameType): number {
  return gameType === 'blast-arena' ? 4 : 8;
}

// Switching game type resets settings that do not apply to the new game to that
// game's defaults, matching the create-room form.
function defaultConfigFor(gameType: GameType): RoomConfigUpdate {
  const base: RoomConfigUpdate = {
    game_type: gameType,
    difficulty: null,
    typing_mode: null,
    code_language: null,
    question_count: null,
    time_limit_seconds: null,
    max_players: gameHardCap(gameType),
  };
  if (gameType === 'math-buzzer') return { ...base, difficulty: 'medium', question_count: 10 };
  if (gameType === 'typing-race') return { ...base, typing_mode: 'english', question_count: 10 };
  return { ...base, difficulty: 'medium' };
}

interface RoomConfigPanelProps {
  room: MultiplayerRoom;
  playerCount: number;
  disabled?: boolean;
  onChange: (config: RoomConfigUpdate) => void;
}

export default function RoomConfigPanel({ room, playerCount, disabled, onChange }: RoomConfigPanelProps) {
  const current: RoomConfigUpdate = {
    game_type: room.game_type,
    difficulty: room.difficulty,
    typing_mode: room.typing_mode,
    code_language: room.code_language,
    question_count: room.question_count,
    time_limit_seconds: room.time_limit_seconds,
    max_players: room.max_players,
  };

  const isMath = room.game_type === 'math-buzzer';
  const isBlast = room.game_type === 'blast-arena';
  const isTyping = room.game_type === 'typing-race';

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold font-sans">Game Setup</h2>

      {/* Game type */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-sans text-muted-foreground">Game</Label>
        <Select
          value={room.game_type}
          disabled={disabled}
          onValueChange={v => onChange(defaultConfigFor(v as GameType))}
        >
          <SelectTrigger className="cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GAME_TYPE_OPTIONS.map(opt => {
              const tooManyPlayers = playerCount > gameHardCap(opt.value);
              return (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={tooManyPlayers}
                  className="cursor-pointer"
                >
                  {opt.label}
                  {tooManyPlayers && ' (too many players)'}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Difficulty (math + blast) */}
      {(isMath || isBlast) && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-sans text-muted-foreground">Difficulty</Label>
          <Select
            value={current.difficulty ?? 'medium'}
            disabled={disabled}
            onValueChange={v => onChange({ ...current, difficulty: v as MathDifficulty })}
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MP_MATH_DIFFICULTY.map(d => (
                <SelectItem key={d} value={d} className="cursor-pointer capitalize">
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Mode (typing only) */}
      {isTyping && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-sans text-muted-foreground">Mode</Label>
          <Select
            value={current.typing_mode ?? 'english'}
            disabled={disabled}
            onValueChange={v => {
              const mode = v as TypingMode;
              onChange({
                ...current,
                typing_mode: mode,
                code_language: mode === 'code' ? (current.code_language ?? 'javascript') : null,
              });
            }}
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="english" className="cursor-pointer">English Words</SelectItem>
              <SelectItem value="code" className="cursor-pointer">Code Snippet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Language (typing code mode only) */}
      {isTyping && current.typing_mode === 'code' && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-sans text-muted-foreground">Language</Label>
          <Select
            value={current.code_language ?? 'javascript'}
            disabled={disabled}
            onValueChange={v => onChange({ ...current, code_language: v as CodeLanguage })}
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MP_CODE_LANGUAGES.map(lang => (
                <SelectItem key={lang} value={lang} className="cursor-pointer">
                  {CODE_LANGUAGE_LABELS[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Session length (math + typing) */}
      {!isBlast && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-sans text-muted-foreground">Session length</Label>
          <Select
            value={current.question_count ? String(current.question_count) : ''}
            disabled={disabled}
            onValueChange={v =>
              onChange({ ...current, question_count: Number(v), time_limit_seconds: null })
            }
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder={isMath ? 'Number of questions' : 'Number of words'} />
            </SelectTrigger>
            <SelectContent>
              {MP_QUESTION_COUNT_OPTIONS.map(n => (
                <SelectItem key={n} value={String(n)} className="cursor-pointer">
                  {n} {isMath ? 'questions' : 'words'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <hr className="flex-1 border-border" />
            <span>or by time</span>
            <hr className="flex-1 border-border" />
          </div>

          <Select
            value={current.time_limit_seconds ? String(current.time_limit_seconds) : ''}
            disabled={disabled}
            onValueChange={v =>
              onChange({ ...current, time_limit_seconds: Number(v), question_count: null })
            }
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Time limit" />
            </SelectTrigger>
            <SelectContent>
              {MP_TIME_LIMIT_OPTIONS.map(t => (
                <SelectItem key={t} value={String(t)} className="cursor-pointer">
                  {t}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Max players — cannot drop below the current headcount */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-sans text-muted-foreground">Max players</Label>
        <Select
          value={String(room.max_players)}
          disabled={disabled}
          onValueChange={v => onChange({ ...current, max_players: Number(v) })}
        >
          <SelectTrigger className="cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {maxPlayerOptions(room.game_type).map(n => (
              <SelectItem
                key={n}
                value={String(n)}
                disabled={n < playerCount}
                className="cursor-pointer"
              >
                {n} players
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
