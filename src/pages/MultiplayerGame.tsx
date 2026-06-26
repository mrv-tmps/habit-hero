import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';
import type { MultiplayerRoom } from '@/types/multiplayer';

function MultiplayerMath({ room }: { room: MultiplayerRoom }) {
  return (
    <div className="min-h-screen page-bg flex items-center justify-center">
      <div className="text-center">
        <p className="font-pixel text-primary text-sm mb-2">MATH BUZZER</p>
        <p className="text-muted-foreground font-sans text-sm">Coming in Session 2</p>
        <p className="text-muted-foreground font-mono text-xs mt-2">Room: {room.code}</p>
      </div>
    </div>
  );
}

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
      <div className="min-h-screen page-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (room.game_type === 'math-buzzer') return <MultiplayerMath room={room} />;
  return <MultiplayerTyping room={room} />;
}
