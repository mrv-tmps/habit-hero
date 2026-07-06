import { WORD_LIST } from '@/data/wordList';
import { CODE_SNIPPETS, type CodeSnippet } from '@/data/codeSnippets';
import { MP_TYPING_WORD_COUNT } from '@/config/constants';
import type { CodeLanguage } from '@/types/multiplayer';

// Same PRNG as src/lib/mathQuestions.ts — duplicated to keep this file self-contained.
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function generateWordSet(seed: number, count: number = MP_TYPING_WORD_COUNT): string[] {
  const rng = mulberry32(seed);
  const pool = [...WORD_LIST];
  // Fisher–Yates so every client with the same seed gets the same order
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function getCodeSnippet(seed: number, language: CodeLanguage): CodeSnippet | null {
  const candidates = CODE_SNIPPETS.filter(s => s.language === language);
  if (candidates.length === 0) return null;
  return candidates[Math.abs(seed) % candidates.length];
}
