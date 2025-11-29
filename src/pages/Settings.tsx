import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AVATAR_OPTIONS = ['🧑‍🚀', '🦸', '🧙', '🥷', '👨‍💻', '🧝', '🤖', '👾', '🦊', '🐉'];

const Settings = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const { profile, refetch } = useUserData();

  const [characterName, setCharacterName] = useState(profile?.character_name || 'Hero');
  const [avatar, setAvatar] = useState(profile?.avatar || '🧑‍🚀');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setCharacterName(profile.character_name || 'Hero');
      setAvatar(profile.avatar || '🧑‍🚀');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isGuest) {
        const stored = localStorage.getItem('habit-quest-guest-data');
        if (stored) {
          const data = JSON.parse(stored);
          data.characterName = characterName;
          data.avatar = avatar;
          localStorage.setItem('habit-quest-guest-data', JSON.stringify(data));
        }
        toast.success('Character updated!');
        refetch();
      } else if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ character_name: characterName, avatar })
          .eq('id', user.id);

        if (error) throw error;
        toast.success('Character updated!');
        refetch();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      if (isGuest) {
        localStorage.removeItem('habit-quest-guest-data');
        localStorage.removeItem('habit-quest-guest');
        toast.success('Progress reset!');
        navigate('/auth');
      } else if (user) {
        // Delete all habit logs
        await supabase.from('habit_log').delete().eq('user_id', user.id);
        // Reset stat points
        await supabase.from('user_stats').update({ total_points: 0 }).eq('user_id', user.id);
        // Reset profile XP
        await supabase.from('profiles').update({ total_xp: 0 }).eq('id', user.id);

        toast.success('Progress reset!');
        refetch();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset');
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-levelBadge/10 pointer-events-none" />

      <div className="relative max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            ← Back
          </Button>
          <h1 className="font-pixel text-lg text-primary text-glow">SETTINGS</h1>
        </header>

        {/* Character Settings */}
        <div className="rounded-xl bg-card border border-border p-6 space-y-4">
          <h2 className="font-semibold">Character</h2>

          <div className="text-center">
            <div className="text-7xl mb-4">{avatar}</div>
            <div className="flex flex-wrap justify-center gap-2">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setAvatar(emoji)}
                  className={cn(
                    "text-2xl p-2 rounded-lg transition-all",
                    avatar === emoji ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Character Name</Label>
            <Input
              id="name"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              maxLength={20}
              className="bg-background/50"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl bg-card border border-destructive/30 p-6 space-y-4">
          <h2 className="font-semibold text-destructive">Danger Zone</h2>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10">
                Reset All Progress
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset your XP, level, and all habit completions. Your stats will remain but points will be cleared. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} className="bg-destructive hover:bg-destructive/90">
                  Reset Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {!isGuest && (
            <Button variant="ghost" onClick={handleLogout} className="w-full">
              Logout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
