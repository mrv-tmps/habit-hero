import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserData } from '@/hooks/useUserData';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const History = () => {
  const navigate = useNavigate();
  const { stats, allLogs, loading } = useUserData();
  const currentYear = new Date().getFullYear();
  const [viewMode, setViewMode] = useState<'recent' | 'year'>('recent');
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const logCountByDate = useMemo(() => {
    return allLogs.reduce<Record<string, number>>((acc, log) => {
      acc[log.completed_date] = (acc[log.completed_date] || 0) + 1;
      return acc;
    }, {});
  }, [allLogs]);

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
        const count = logCountByDate[dateStr] || 0;
        week.push({ date: dateStr, count });
      }
      weeks.push(week);
    }
    return weeks;
  }, [logCountByDate]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    allLogs.forEach(log => {
      const year = new Date(log.completed_date).getFullYear();
      if (!Number.isNaN(year)) {
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allLogs, currentYear]);

  const yearlyCalendarData = useMemo(() => {
    const start = new Date(selectedYear, 0, 1);
    const end = new Date(selectedYear, 11, 31);
    const startDate = new Date(start);
    const endDate = new Date(end);

    // align to Sunday -> Saturday grid
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1);
    }
    while (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const weeks: { date: string; count: number }[][] = [];
    let currentWeek: { date: string; count: number }[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      currentWeek.push({
        date: dateStr,
        count: logCountByDate[dateStr] || 0,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [logCountByDate, selectedYear]);

  const monthMarkers = useMemo(() => {
    const labels: { label: string; weekIndex: number }[] = [];
    const monthsSeen = new Set<number>();

    yearlyCalendarData.forEach((week, index) => {
      const firstActiveDay = week.find(day => day.date.startsWith(`${selectedYear}`));
      if (!firstActiveDay) return;
      const month = new Date(firstActiveDay.date).getMonth();

      // Only add month label if we have at least 2 weeks space OR it's the first month
      if (!monthsSeen.has(month) && (labels.length === 0 || index - labels[labels.length - 1].weekIndex >= 2)) {
        monthsSeen.add(month);
        labels.push({
          label: new Date(selectedYear, month, 1).toLocaleString('default', { month: 'short' }),
          weekIndex: index,
        });
      }
    });

    return labels;
  }, [selectedYear, yearlyCalendarData]);

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
    if (count === 1) return 'bg-emerald-500/30';
    if (count === 2) return 'bg-emerald-500/50';
    if (count === 3) return 'bg-emerald-500/70';
    return 'bg-emerald-500';
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
      <div className="relative inset-0 bg-gradient-to-br from-background via-background to-levelBadge/10 pointer-events-none -z-10" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 space-y-8">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            ← Back
          </Button>
          <h1 className="font-pixel text-lg text-primary text-glow">HISTORY</h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)] lg:items-start">
          <section className="space-y-4">
            {/* Streak Card */}
            <div className="rounded-xl bg-card border border-border p-6 card-glow text-center">
              <div className="text-5xl mb-2">🔥</div>
              <div className="font-pixel text-3xl text-primary">{currentStreak}</div>
              <p className="text-sm text-muted-foreground">Day Streak</p>
            </div>

            {/* Quick summary */}
            <div className="rounded-xl bg-card border border-border/80 p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Keep your streak alive by completing at least one quest per day. Your best run fuels Habit Quest's leaderboards (coming soon!).
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Back to Dashboard →
              </Button>
            </div>
          </section>

          <section className="space-y-6">
            {/* Quest Activity Heatmap */}
            <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-semibold">Quest Activity Heatmap</h3>
                  <p className="text-xs text-muted-foreground">
                    Track your daily habit completion activity
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-border overflow-hidden">
                    {(['recent', 'year'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium transition-colors',
                          viewMode === mode ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        {mode === 'recent' ? '12 Weeks' : 'Full Year'}
                      </button>
                    ))}
                  </div>
                  {viewMode === 'year' && (
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {availableYears.map(year => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {viewMode === 'recent' ? (
                <div className="space-y-4">
                  {/* 12 weeks view - scrollable on mobile */}
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-[3px] min-w-[600px]">
                      {calendarData.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px]">
                          {week.map((day, di) => (
                            <div
                              key={di}
                              className={cn(
                                "w-[11px] h-[11px] rounded-sm transition-all hover:ring-2 hover:ring-primary/50 cursor-pointer",
                                getHeatColor(day.count)
                              )}
                              title={`${day.date}: ${day.count} habit${day.count !== 1 ? 's' : ''} completed`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                    <span>Last 12 weeks</span>
                    <div className="flex items-center gap-2">
                      <span>Less</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(i => (
                          <div key={i} className={cn("w-[11px] h-[11px] rounded-sm", getHeatColor(i))} />
                        ))}
                      </div>
                      <span>More</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Year view - scrollable on mobile */}
                  <div className="overflow-x-auto pb-2">
                    <div className="inline-block min-w-full">
                      {/* Month labels - positioned above the calendar */}
                      <div className="relative h-4 mb-2">
                        <div className="absolute inset-0 flex text-[10px] text-muted-foreground">
                          <div className="w-8 flex-shrink-0" /> {/* Space for day labels */}
                          <div className="relative flex-1">
                            {monthMarkers.map(({ label, weekIndex }) => (
                              <div
                                key={label + weekIndex}
                                className="absolute whitespace-nowrap"
                                style={{ left: `${weekIndex * 14}px` }}
                              >
                                {label}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Calendar grid */}
                      <div className="flex gap-[3px]">
                        {/* Day labels */}
                        <div className="flex flex-col gap-[3px] text-[9px] text-muted-foreground w-8 flex-shrink-0 pr-1 pt-0.5">
                          <span className="h-[11px] leading-[11px]">Sun</span>
                          <span className="h-[11px] leading-[11px] invisible">Mon</span>
                          <span className="h-[11px] leading-[11px]">Wed</span>
                          <span className="h-[11px] leading-[11px] invisible">Thu</span>
                          <span className="h-[11px] leading-[11px]">Fri</span>
                          <span className="h-[11px] leading-[11px] invisible">Sat</span>
                        </div>

                        {/* Weeks */}
                        <div className="flex gap-[3px]">
                          {yearlyCalendarData.map((week, wi) => (
                            <div key={wi} className="flex flex-col gap-[3px]">
                              {week.map((day, di) => {
                                const isCurrentYear = day.date.startsWith(`${selectedYear}`);
                                return (
                                  <div
                                    key={di}
                                    className={cn(
                                      "w-[11px] h-[11px] rounded-sm transition-all",
                                      isCurrentYear && "hover:ring-2 hover:ring-primary/50 cursor-pointer",
                                      getHeatColor(day.count),
                                      !isCurrentYear && 'opacity-20'
                                    )}
                                    title={isCurrentYear ? `${day.date}: ${day.count} habit${day.count !== 1 ? 's' : ''} completed` : ''}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground pt-2">
                    <span>Less</span>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className={cn("w-[11px] h-[11px] rounded-sm", getHeatColor(i))} />
                      ))}
                    </div>
                    <span>More</span>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="rounded-xl bg-card border border-border p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-semibold">Recent Activity</h3>
                <span className="text-xs text-muted-foreground">
                  Last {timelineData.length} days
                </span>
              </div>
              {timelineData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No activity yet. Complete your first habit!</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {timelineData.map(({ date, stats: completedStats }) => (
                    <div key={date} className="rounded-lg bg-background/40 border border-border/60 p-3 sm:p-4 hover:border-border transition-colors">
                      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {new Date(date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {completedStats.length}/{stats.length} completed
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {completedStats.map((stat, i) => (
                          <span key={i} className="text-2xl" title={stat?.stat_name}>
                            {stat?.emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default History;
