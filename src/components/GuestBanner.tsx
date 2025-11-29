import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function GuestBanner() {
  const navigate = useNavigate();

  return (
    <div className="bg-levelBadge/20 border border-levelBadge/50 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="text-foreground font-medium">Guest Mode</span> — Sign in to save progress forever
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/auth')}
        className="shrink-0"
      >
        Sign In
      </Button>
    </div>
  );
}
