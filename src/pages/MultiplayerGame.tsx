import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Zap } from 'lucide-react';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';
import MultiplayerMath from '@/pages/MultiplayerMath';
import type { MultiplayerRoom } from '@/types/multiplayer';

function MultiplayerTyping({ room }: { room: MultiplayerRoom }) {
  return (
    <div className="min-h-screen page-bg flex items-center justify-center">
      <div className="text-center">
        <p className="font-pixel text-primary text-sm mb-2">TYPING RACE</p>
        <p className="text-muted-foreground font-sans text-sm">Coming in Session 3</p>
        <p className="text-muted-foreground font-mono text-xs mt-2">Room: {room.code}</p>
      </div>
    </div>
  );
}

export default function MultiplayerGame() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { fetchRoom } = useMultiplayerRoom();
  const [room, setRoom] = useState<MultiplayerRoom | null>(null);

  useEffect(() => {
    if (!code) return;
    fetchRoom(code).then(r => {
      if (!r) {
        navigate('/games');
        return;
      }
      setRoom(r);
    });
  }, [code, fetchRoom, navigate]);

  if (!room) {
    return (
      <div className="min-h-screen page-bg flex flex-col items-center justify-center gap-6 p-4">
        <div className="w-24 h-24 rounded-3xl bg-primary/10 border-2 border-primary/25 flex items-center justify-center">
          <Zap className="w-12 h-12 text-primary animate-pulse" />
        </div>
        <div className="text-center flex flex-col gap-1">
          <p className="font-pixel text-xl text-primary">MULTIPLAYER</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <p className="font-mono text-sm text-muted-foreground">Loading room {code}…</p>
          </div>
        </div>
      </div>
    );
  }

  if (room.game_type === 'math-buzzer') return <MultiplayerMath room={room} />;
  return <MultiplayerTyping room={room} />;
}
