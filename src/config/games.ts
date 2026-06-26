import type { LucideIcon } from 'lucide-react';
import { Keyboard, Calculator, Coins } from 'lucide-react';
import { XP_PER_SESSION_CAP, DAILY_SESSION_CAP } from './constants';
import type { GameType } from '@/types/multiplayer';

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
  multiplayerRoute?: string;
  multiplayerGameType?: GameType;
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
    multiplayerRoute: '/games/typing/multiplayer',
    multiplayerGameType: 'typing-race',
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
    multiplayerRoute: '/games/math/multiplayer',
    multiplayerGameType: 'math-buzzer',
  },
  {
    id: 'coin-rush',
    label: 'Coin Rush',
    description: 'Grab the most coins before the clock runs out. Dodge the saw blades!',
    icon: Coins,
    route: '/games/coin-rush',
    status: 'live',
    defaultStatType: 'dexterity',
    xpFormula: (score) => Math.min(Math.floor(score / 10), XP_PER_SESSION_CAP),
    sessionCapPerDay: DAILY_SESSION_CAP,
    xpCapPerSession: XP_PER_SESSION_CAP,
    multiplayerRoute: '/games/room/new?game=coin-rush',
    multiplayerGameType: 'coin-rush',
  },
];
