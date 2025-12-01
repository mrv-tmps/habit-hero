import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const ErrorPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-levelBadge/10" />

      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <button
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
            onClick={() => navigate(-1)}
          >
            ← Go Back
          </button>
          <span className="font-pixel text-sm text-primary text-glow">
            HABIT QUEST
          </span>
        </header>

        {/* Main card */}
        <main className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card/90 card-glow px-6 py-8 sm:px-10 sm:py-10 text-center space-y-6">
            {/* Icon / avatar */}
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-background/80 border border-border/80 shadow-lg">
                <span className="text-4xl" aria-hidden="true">
                  😵‍💫
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <h1 className="font-pixel text-2xl text-primary text-glow">
                QUEST INTERRUPTED
              </h1>
              <p className="text-sm text-muted-foreground">
                Something went wrong while loading your progress.
              </p>
            </div>

            {/* Message */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Don&apos;t worry — your habits and XP are safe. This is just a
                glitch in the interface.
              </p>
              <p>
                Try reloading the page, or return to your dashboard to continue
                your quest.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse items-center justify-center gap-3 pt-2 sm:flex-row sm:justify-center">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                🔁 Reload Page
              </Button>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => navigate('/')}
              >
                🧭 Back to Dashboard
              </Button>
            </div>

            {/* Tiny debug hint for you (users just see flavor text) */}
            <p className="pt-2 text-[11px] text-muted-foreground/70">
              If this keeps happening, send a feedback in <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => navigate('/settings')}
              >
                <span aria-hidden="true">⚙️</span>
                <span className="text-xs font-medium uppercase tracking-wide">Settings</span>
              </Button>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ErrorPage;
