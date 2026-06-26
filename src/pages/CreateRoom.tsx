import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { GAMES } from '@/config/games';
import {
  MP_QUESTION_COUNT_OPTIONS,
  MP_TIME_LIMIT_OPTIONS,
  MP_MATH_DIFFICULTY,
} from '@/config/constants';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';
import { useAuth } from '@/contexts/AuthContext';
import type { MathDifficulty, GameType } from '@/types/multiplayer';

const schema = z
  .object({
    nickname: z.string().min(1, 'Nickname is required').max(16),
    difficulty: z.enum(MP_MATH_DIFFICULTY).optional(),
    question_count: z.string().optional(),
    time_limit_seconds: z.string().optional(),
    max_players: z.string(),
  })
  .refine(data => data.question_count || data.time_limit_seconds, {
    message: 'Pick a question count or a time limit',
    path: ['question_count'],
  });

type FormValues = z.infer<typeof schema>;

const GAME_TYPE_MAP: Record<string, GameType> = {
  math: 'math-buzzer',
  typing: 'typing-race',
};

export default function CreateRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { createRoom } = useMultiplayerRoom();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gameId = searchParams.get('game') ?? 'math';
  const game = GAMES.find(g => g.id === gameId) ?? GAMES[0];
  const gameType = GAME_TYPE_MAP[gameId] ?? 'math-buzzer';
  const isMath = gameType === 'math-buzzer';
  const Icon = game.icon;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nickname: '',
      max_players: '8',
    },
  });

  const questionCount = watch('question_count');
  const timeLimit = watch('time_limit_seconds');

  async function onSubmit(values: FormValues) {
    setError(null);
    setIsCreating(true);
    try {
      const { room } = await createRoom({
        game_type: gameType,
        difficulty: isMath ? (values.difficulty as MathDifficulty) : undefined,
        question_count: values.question_count ? Number(values.question_count) : undefined,
        time_limit_seconds: values.time_limit_seconds
          ? Number(values.time_limit_seconds)
          : undefined,
        max_players: Number(values.max_players),
        nickname: values.nickname,
        user_id: user?.id ?? null,
      });
      navigate(`/games/room/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen page-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/games')}
          className="mb-6 flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Games
        </Button>

        <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-pixel text-primary leading-none">{game.label}</h1>
              <p className="text-sm font-sans text-muted-foreground mt-1">Multiplayer</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Nickname */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-sans">Your nickname</Label>
              <Input
                {...register('nickname')}
                placeholder="YourName"
                maxLength={16}
                className="font-mono"
              />
              {errors.nickname && (
                <p className="text-destructive text-xs">{errors.nickname.message}</p>
              )}
            </div>

            {/* Difficulty (math only) */}
            {isMath && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-sans">Difficulty</Label>
                <Select
                  onValueChange={v => setValue('difficulty', v as MathDifficulty)}
                  defaultValue="medium"
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Pick difficulty" />
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

            {/* Session length */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-sans">Session length</Label>

              <Select
                value={questionCount ?? ''}
                onValueChange={v => {
                  setValue('question_count', v);
                  setValue('time_limit_seconds', undefined);
                }}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Number of questions" />
                </SelectTrigger>
                <SelectContent>
                  {MP_QUESTION_COUNT_OPTIONS.map(n => (
                    <SelectItem key={n} value={String(n)} className="cursor-pointer">
                      {n} questions
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
                value={timeLimit ?? ''}
                onValueChange={v => {
                  setValue('time_limit_seconds', v);
                  setValue('question_count', undefined);
                }}
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

              {errors.question_count && (
                <p className="text-destructive text-xs">{errors.question_count.message}</p>
              )}
            </div>

            {/* Max players */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-sans">Max players</Label>
              <Select
                onValueChange={v => setValue('max_players', v)}
                defaultValue="8"
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 4, 6, 8].map(n => (
                    <SelectItem key={n} value={String(n)} className="cursor-pointer">
                      {n} players
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="submit" className="w-full cursor-pointer" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating room…
                </>
              ) : (
                'Create Room'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
