import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Users, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GAMES, type GameConfig } from '@/config/games';
import { cn } from '@/lib/utils';

function GameCard({ game, onPlay, onMultiplayer }: { game: GameConfig; onPlay: () => void; onMultiplayer?: () => void }) {
  const Icon = game.icon;
  const isLive = game.status === 'live';

  return (
    <div
      className={cn(
        'group rounded-xl border bg-card p-6 flex flex-col gap-4 transition-all duration-200',
        isLive
          ? 'cursor-pointer border-border hover:border-primary/50 hover:bg-secondary/60 hover:shadow-[0_0_24px_hsl(var(--primary)/0.12)]'
          : 'border-border/50 opacity-60 cursor-default',
      )}
      onClick={isLive ? onPlay : undefined}
    >
      <div className="flex items-start justify-between">
        <div className={cn(
          'w-11 h-11 rounded-lg flex items-center justify-center border transition-colors duration-200',
          isLive
            ? 'bg-primary/10 border-primary/25 group-hover:bg-primary/15 group-hover:border-primary/40'
            : 'bg-muted/40 border-border/40',
        )}>
          <Icon className={cn('w-5 h-5', isLive ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <Badge
          className={cn(
            'text-xs font-sans',
            isLive
              ? 'bg-[hsl(var(--game-live)/0.15)] text-[hsl(var(--game-live))] border-[hsl(var(--game-live)/0.3)]'
              : 'bg-muted text-[hsl(var(--game-coming-soon))] border-border',
          )}
          variant="outline"
        >
          {isLive ? 'LIVE' : 'COMING SOON'}
        </Badge>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className={cn(
          'text-lg font-semibold transition-colors duration-200',
          isLive ? 'text-foreground group-hover:text-primary' : 'text-muted-foreground',
        )}>
          {game.label}
        </h2>
        <p className="text-sm text-muted-foreground">{game.description}</p>
      </div>

      {isLive && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex items-center gap-1 cursor-pointer"
            onClick={e => { e.stopPropagation(); onPlay(); }}
          >
            Play Now <ChevronRight className="w-4 h-4" />
          </Button>
          {onMultiplayer && (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1 cursor-pointer"
              onClick={e => { e.stopPropagation(); onMultiplayer(); }}
            >
              <Users className="w-4 h-4" /> Multiplayer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function GamesHub() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setJoinError('Room codes are 4 letters');
      return;
    }
    navigate(`/games/room/${code}`);
  }

  return (
    <div className="min-h-screen page-bg p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="font-pixel text-primary text-glow text-sm leading-none">
              MINIGAMES
            </h1>
            <p className="text-muted-foreground text-xs mt-1">
              Play skill-based games to earn XP for your stats
            </p>
          </div>
        </div>

        {/* Game grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GAMES.map(game => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={() => navigate(game.route)}
              onMultiplayer={
                game.status === 'live' && game.multiplayerRoute
                  ? () => navigate(`/games/room/new?game=${game.id}`)
                  : undefined
              }
            />
          ))}
        </div>

        {/* Join a room */}
        <div className="mt-6 rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold font-sans text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Join a room
          </p>
          <div className="flex gap-2">
            <Input
              value={joinCode}
              onChange={e => {
                setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''));
                setJoinError('');
              }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="ABCD"
              maxLength={4}
              className="font-mono text-base tracking-widest max-w-[120px] uppercase"
            />
            <Button
              onClick={handleJoin}
              disabled={!joinCode.trim()}
              className="cursor-pointer flex items-center gap-1"
            >
              <LogIn className="w-4 h-4" />
              Join
            </Button>
          </div>
          {joinError && <p className="text-destructive text-xs">{joinError}</p>}
          <p className="text-muted-foreground text-xs font-sans">
            Enter the 4-letter code shared by the room host.
          </p>
        </div>

        {/* XP rules */}
        <div className="mt-4 rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">XP rules:</span>{' '}
            Each game awards up to <span className="text-primary">10 XP</span> per session based on
            performance. The first <span className="text-primary">3 sessions</span> per day per game
            earn XP — unlimited free play after that. XP goes to the stat you link in the game.
          </p>
        </div>
      </div>
    </div>
  );
}
