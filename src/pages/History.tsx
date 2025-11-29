import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserData } from '@/hooks/useUserData';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const History = () => {
  const navigate = useNavigate();
  const { stats, allLogs, loading } = useUserData();

  // Generate calendar data for the last 12 weeks
  const calendarData = useMemo(() => {
    const weeks: { date: string; count: number }[][] = [];
    const today = new Date();
    
    for (let w = 11; w >= 0; w--) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const dateStr = date.toISOString().split('T')[0];
        const count = allLogs.filter(l => l.completed_date === dateStr).length;
        week.push({ date: dateStr, count });
      }
      weeks.push(week);
    }
    return weeks;
  }, [allLogs]);

  // Calculate current streak
  const currentStreak = useMemo(() => {
    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const hasLog = allLogs.some(l => l.completed_date === dateStr);
      
      if (hasLog) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }, [allLogs]);

  // Group logs by date for timeline
  const timelineData = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    
    allLogs.forEach(log => {
      if (!grouped[log.completed_date]) {
        grouped[log.completed_date] = [];
      }
      grouped[log.completed_date].push(log.stat_id);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14)
      .map(([date, statIds]) => ({
        date,
        statIds,
        stats: statIds.map(id => stats.find(s => s.id === id)).filter(Boolean),
      }));
  }, [allLogs, stats]);

  const getHeatColor = (count: number) => {
    if (count === 0) return 'bg-muted/30';
    if (count === 1) return 'bg-endurance/30';
    if (count === 2) return 'bg-endurance/50';
    if (count === 3) return 'bg-endurance/70';
    return 'bg-endurance';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary animate-pulse font-pixel">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-levelBadge/10 pointer-events-none" />

      <div className="relative max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            ← Back
          </Button>
          <h1 className="font-pixel text-lg text-primary text-glow">HISTORY</h1>
        </header>

        {/* Streak Card */}
        <div className="rounded-xl bg-card border border-border p-6 card-glow text-center">
          <div className="text-5xl mb-2">🔥</div>
          <div className="font-pixel text-3xl text-primary">{currentStreak}</div>
          <p className="text-sm text-muted-foreground">Day Streak</p>
        </div>

        {/* Contribution Calendar */}
        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Last 12 Weeks</h3>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {calendarData.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={cn(
                      "w-3 h-3 rounded-sm transition-colors",
                      getHeatColor(day.count)
                    )}
                    title={`${day.date}: ${day.count} habits`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 mt-2 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className={cn("w-3 h-3 rounded-sm", getHeatColor(i))} />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Recent Activity</h3>
          {timelineData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No activity yet. Complete your first habit!</p>
          ) : (
            <div className="space-y-2">
              {timelineData.map(({ date, stats: completedStats }) => (
                <div key={date} className="rounded-lg bg-card border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {new Date(date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {completedStats.length}/{stats.length} habits
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {completedStats.map((stat, i) => (
                      <span key={i} className="text-lg" title={stat?.stat_name}>
                        {stat?.emoji}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
