import type { LucideIcon } from 'lucide-react';
import { Keyboard, Calculator } from 'lucide-react';
import { XP_PER_SESSION_CAP, DAILY_SESSION_CAP } from './constants';

export interface GameConfig {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  route: string;
  status: 'live' | 'coming-soon';
  defaultStatType: string;
  xpFormula: (score: number, accuracy: number) => number;
  sessionCapPerDay: number;
  xpCapPerSession: number;
}

export const GAMES: GameConfig[] = [
  {
    id: 'typing',
    label: 'Typing Test',
    description: 'Race against the clock. Earn XP for speed and accuracy.',
    icon: Keyboard,
    route: '/games/typing',
    status: 'live',
    defaultStatType: 'intelligence',
    xpFormula: (wpm, accuracy) =>
      Math.min(Math.floor((wpm / 10) * accuracy), XP_PER_SESSION_CAP),
    sessionCapPerDay: DAILY_SESSION_CAP,
    xpCapPerSession: XP_PER_SESSION_CAP,
  },
  {
    id: 'math',
    label: 'Math Challenge',
    description: 'Solve arithmetic problems under pressure.',
    icon: Calculator,
    route: '/games/math',
    status: 'live',
    defaultStatType: 'intelligence',
    xpFormula: (score, accuracy) =>
      Math.min(Math.floor((score / 10) * accuracy), XP_PER_SESSION_CAP),
    sessionCapPerDay: DAILY_SESSION_CAP,
    xpCapPerSession: XP_PER_SESSION_CAP,
  },
];
