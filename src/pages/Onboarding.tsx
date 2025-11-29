import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EMOJI_OPTIONS = ['💪', '📚', '🧘', '💰', '💻', '🎯', '🏃', '✍️', '🎨', '🎵', '🥗', '😴'];
const COLOR_OPTIONS = [
  { name: 'strength', class: 'bg-strength', label: 'Red' },
  { name: 'intelligence', class: 'bg-intelligence', label: 'Blue' },
  { name: 'endurance', class: 'bg-endurance', label: 'Green' },
  { name: 'primary', class: 'bg-primary', label: 'Cyan' },
];

interface StatDraft {
  name: string;
  emoji: string;
  color: string;
  habitDescription: string;
}

const defaultStats: StatDraft[] = [
  { name: 'Strength', emoji: '💪', color: 'strength', habitDescription: 'Exercise or workout' },
  { name: 'Intelligence', emoji: '📚', color: 'intelligence', habitDescription: 'Read or learn something new' },
  { name: 'Endurance', emoji: '🧘', color: 'endurance', habitDescription: 'Meditate or practice mindfulness' },
];

const Onboarding = () => {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [characterName, setCharacterName] = useState('Hero');
  const [avatar, setAvatar] = useState('🧑‍🚀');
  const [stats, setStats] = useState<StatDraft[]>(defaultStats);
  const [loading, setLoading] = useState(false);

  const addStat = () => {
    if (stats.length >= 6) {
      toast.error('Maximum 6 stats allowed');
      return;
    }
    setStats([...stats, { name: '', emoji: '⭐', color: 'primary', habitDescription: '' }]);
  };

  const removeStat = (index: number) => {
    if (stats.length <= 3) {
      toast.error('Minimum 3 stats required');
      return;
    }
    setStats(stats.filter((_, i) => i !== index));
  };

  const updateStat = (index: number, field: keyof StatDraft, value: string) => {
    const newStats = [...stats];
    newStats[index] = { ...newStats[index], [field]: value };
    setStats(newStats);
  };

  const handleComplete = async () => {
    // Validate
    const emptyStats = stats.filter(s => !s.name.trim());
    if (emptyStats.length > 0) {
      toast.error('Please fill in all stat names');
      return;
    }

    setLoading(true);

    try {
      if (isGuest) {
        // Save to localStorage for guest users
        const guestData = {
          characterName,
          avatar,
          stats: stats.map((s, i) => ({
            id: `guest-${i}`,
            stat_name: s.name,
            emoji: s.emoji,
            color: s.color,
            habit_description: s.habitDescription,
            order_index: i,
            total_points: 0,
          })),
          onboardingCompleted: true,
          totalXp: 0,
        };
        localStorage.setItem('habit-quest-guest-data', JSON.stringify(guestData));
        toast.success('Character created! Let the quest begin!');
        navigate('/');
        return;
      }

      if (!user) {
        toast.error('Please log in to continue');
        return;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          character_name: characterName,
          avatar: avatar,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Create stats
      const statsToInsert = stats.map((s, i) => ({
        user_id: user.id,
        stat_name: s.name,
        emoji: s.emoji,
        color: s.color,
        habit_description: s.habitDescription,
        order_index: i,
      }));

      const { error: statsError } = await supabase
        .from('user_stats')
        .insert(statsToInsert);

      if (statsError) throw statsError;

      toast.success('Character created! Let the quest begin!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save character');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-levelBadge/10 pointer-events-none" />

      <div className="relative max-w-lg mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-pixel text-xl text-primary text-glow">CREATE YOUR HERO</h1>
          <p className="text-muted-foreground">Customize your character and stats</p>
        </div>

        {/* Avatar Section */}
        <div className="rounded-xl bg-card border border-border p-6 card-glow text-center">
          <div className="text-8xl mb-4">{avatar}</div>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {['🧑‍🚀', '🦸', '🧙', '🥷', '👨‍💻', '🧝', '🤖', '👾'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => setAvatar(emoji)}
                className={cn(
                  "text-3xl p-2 rounded-lg transition-all",
                  avatar === emoji ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Character Name</Label>
            <Input
              id="name"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="Enter your hero name"
              className="text-center bg-background/50"
              maxLength={20}
            />
          </div>
        </div>

        {/* Stats Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-pixel text-sm text-primary">YOUR STATS ({stats.length}/6)</h2>
            <Button onClick={addStat} variant="outline" size="sm" disabled={stats.length >= 6}>
              + Add Stat
            </Button>
          </div>

          {stats.map((stat, index) => (
            <div key={index} className="rounded-xl bg-card border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{stat.emoji}</span>
                {stats.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStat(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Stat Name</Label>
                  <Input
                    value={stat.name}
                    onChange={(e) => updateStat(index, 'name', e.target.value)}
                    placeholder="e.g. Strength, Discipline"
                    className="bg-background/50"
                    maxLength={20}
                  />
                </div>

                <div>
                  <Label className="text-xs">Daily Habit</Label>
                  <Input
                    value={stat.habitDescription}
                    onChange={(e) => updateStat(index, 'habitDescription', e.target.value)}
                    placeholder="e.g. 30 min workout"
                    className="bg-background/50"
                    maxLength={50}
                  />
                </div>

                <div>
                  <Label className="text-xs">Emoji</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => updateStat(index, 'emoji', emoji)}
                        className={cn(
                          "text-xl p-1 rounded transition-all",
                          stat.emoji === emoji ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-muted"
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Color</Label>
                  <div className="flex gap-2 mt-1">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => updateStat(index, 'color', color.name)}
                        className={cn(
                          "w-8 h-8 rounded-full transition-all",
                          color.class,
                          stat.color === color.name ? "ring-2 ring-offset-2 ring-offset-card ring-foreground" : "opacity-60 hover:opacity-100"
                        )}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Complete Button */}
        <Button
          onClick={handleComplete}
          className="w-full font-pixel text-lg py-6"
          disabled={loading}
        >
          {loading ? 'Creating...' : '⚔️ BEGIN QUEST'}
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
