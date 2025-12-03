-- 1. Add title fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_title TEXT NOT NULL DEFAULT 'New Traveler',
  ADD COLUMN IF NOT EXISTS current_title_unlocked_at TIMESTAMPTZ;

-- 2. Backfill current_title based on total_xp
UPDATE public.profiles
SET
  current_title = CASE
    WHEN total_xp >= 100000 THEN 'Shadow Monarch'
    WHEN total_xp >= 75000  THEN 'Apex'
    WHEN total_xp >= 50000  THEN 'Origin'
    WHEN total_xp >= 35000  THEN 'Immortal'
    WHEN total_xp >= 20000  THEN 'Legend Forged'
    WHEN total_xp >= 12000  THEN 'Ascended'
    WHEN total_xp >= 8000   THEN 'Mythic'
    WHEN total_xp >= 5000   THEN 'Eternal Flame'
    WHEN total_xp >= 3500   THEN 'Void Walker'
    WHEN total_xp >= 2000   THEN 'Titan Awakened'
    WHEN total_xp >= 1000   THEN 'Unbroken'
    WHEN total_xp >= 600    THEN 'Storm Chaser'
    WHEN total_xp >= 300    THEN 'Dawn Breaker'
    WHEN total_xp >= 150    THEN 'Iron Will'
    WHEN total_xp >= 50     THEN 'Rising Flame'
    ELSE 'New Traveler'
  END,
  current_title_unlocked_at = COALESCE(current_title_unlocked_at, NOW());
