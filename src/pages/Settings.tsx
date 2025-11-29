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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
const FEEDBACK_CATEGORIES = [
  { value: 'feature', label: 'New feature / improvement' },
  { value: 'bug', label: 'Bug or issue' },
  { value: 'content', label: 'Content idea' },
  { value: 'other', label: 'Something else' },
];

const Settings = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const { profile, refetch } = useUserData();

  const [characterName, setCharacterName] = useState(profile?.character_name || 'Hero');
  const [avatar, setAvatar] = useState(profile?.avatar || '🧑‍🚀');
  const [saving, setSaving] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState(user?.email || '');
  const [feedbackCategory, setFeedbackCategory] = useState('feature');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setCharacterName(profile.character_name || 'Hero');
      setAvatar(profile.avatar || '🧑‍🚀');
    }
  }, [profile]);

  useEffect(() => {
    setFeedbackEmail(user?.email || '');
  }, [user]);

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

  const handleFeedbackSubmit = async () => {
    if (!feedbackMessage.trim()) {
      toast.error('Tell us a little more about the improvement you need.');
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const payload = {
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        email: feedbackEmail?.trim() || user?.email || null,
        user_id: user?.id || null,
      };

      const { error } = await supabase.from('feedback_requests').insert(payload);
      if (error) throw error;

      toast.success('Thanks for the feedback! We read every submission.');
      setFeedbackMessage('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send feedback');
    } finally {
      setFeedbackSubmitting(false);
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
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-levelBadge/10 pointer-events-none -z-10" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            ← Back
          </Button>
          <h1 className="font-pixel text-lg text-primary text-glow">SETTINGS</h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px,minmax(0,1fr)] lg:items-start">
          <section className="space-y-6">
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

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={saving} className="w-full">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Save character changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will update your character name and avatar. You can always change these again later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSave}>
                      Confirm Save
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
          </section>

          <section className="space-y-6">
            {/* Feedback */}
            <div className="rounded-xl bg-card border border-border/80 p-6 space-y-4">
              <div>
                <h2 className="font-semibold">Feedback & Ideas</h2>
                <p className="text-sm text-muted-foreground">
                  Request features, report issues, or tell us what would make Habit Hero better.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-category">Category</Label>
                <Select value={feedbackCategory} onValueChange={setFeedbackCategory}>
                  <SelectTrigger id="feedback-category" className="bg-background/50">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-email">Contact Email (optional)</Label>
                <Input
                  id="feedback-email"
                  type="email"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-message">What should we build next?</Label>
                <Textarea
                  id="feedback-message"
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Describe the update, improvement, or issue..."
                  rows={4}
                  className="bg-background/50"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {feedbackMessage.length}/500 characters
                </p>
              </div>

              {isGuest && (
                <p className="text-xs text-muted-foreground">
                  Guest submissions are stored without an account. Leave your email so we can reply.
                </p>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={feedbackSubmitting}
                    className="w-full"
                  >
                    {feedbackSubmitting ? 'Sending...' : 'Send Feedback'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Send this feedback?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your message will be sent to the Habit Quest team. Please make sure it doesn&apos;t include any sensitive information.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Review Again</AlertDialogCancel>
                    <AlertDialogAction onClick={handleFeedbackSubmit}>
                      Send Feedback
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
