import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/habit-quest-logo.png';

export function DashboardHeader({
  onOpenLeaderboard,
}: {
  onOpenLeaderboard: () => void;
}) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/auth'); // or your login page
  };

  // --- SHARED NAV BUTTONS (used in both desktop + mobile) ---
  const navButtons = [
    {
      key: 'history',
      label: '📊 History',
      onClick: () => navigate('/history'),
      variant: 'ghost',
    },
    {
      key: 'settings',
      label: '⚙️ Settings',
      onClick: () => navigate('/settings'),
      variant: 'ghost',
    },
    {
      key: 'leaderboard',
      label: '🏆 Leaderboard',
      onClick: onOpenLeaderboard,
      variant: 'outline',
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogOut className="h-4 w-4" />,
      onClick: handleLogout,
      variant: 'destructive',
    },
  ];

  return (
    <>
      {/* HEADER */}
      <header className="mb-6 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-card border border-border">
            <img
              src={logo}
              alt="Habit Quest logo"
              className="h-8 w-auto drop-shadow"
            />
          </div>
          <span className="font-pixel text-lg text-primary text-glow">
            HABIT QUEST
          </span>
        </div>

        {/* Right: DESKTOP navigation */}
        <div className="hidden md:flex items-center gap-2">
          {navButtons.map((btn) => (
            <Button
              key={btn.key}
              variant={btn.variant as any}
              size="sm"
              onClick={btn.onClick}
              className="flex items-center gap-2"
            >
              {btn.icon}
              <span>{btn.label}</span>
            </Button>
          ))}
        </div>

        {/* Right: MOBILE hamburger */}
        <button
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/60 transition-colors"
          onClick={() => setMenuOpen((p) => !p)}
          aria-label="Toggle navigation menu"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="md:hidden mb-4 rounded-xl border border-border bg-card/95 shadow-lg p-3 space-y-2">
          {navButtons.map((btn) => (
            <div key={btn.key} className="w-full">
              <Button
                variant={btn.variant as any}
                size="sm"
                className="w-full justify-start flex items-center gap-2"
                onClick={btn.onClick}
              >
                {btn.icon}
                {btn.label}
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
