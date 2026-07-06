// Pure typing-metric helpers shared by the solo TypingTest and MultiplayerTyping.

export interface WordResult {
  typed: string;
  target: string;
}

export type CharStatus = 'correct' | 'incorrect' | 'upcoming';

export interface CharCell {
  char: string;
  status: CharStatus;
}

// Maps a target word + what was typed so far to per-character render statuses.
// Characters typed beyond the word's length are appended as incorrect overflow.
export function getCharStatuses(word: string, typed: string): CharCell[] {
  const cells: CharCell[] = word.split('').map((char, i) => ({
    char,
    status: typed[i] === undefined ? 'upcoming' : typed[i] === char ? 'correct' : 'incorrect',
  }));
  for (const char of typed.slice(word.length)) {
    cells.push({ char, status: 'incorrect' });
  }
  return cells;
}

export function calculateWpm(wordsCompleted: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return Math.round((wordsCompleted / elapsedSeconds) * 60);
}

// Standard chars-per-word WPM used for code mode, where progress is per character.
export function calculateCharWpm(charsCompleted: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return Math.round((charsCompleted / 5 / elapsedSeconds) * 60);
}

export function calculateAccuracy(results: WordResult[]): number {
  const totalTyped = results.reduce((s, r) => s + r.typed.length, 0);
  const correctTyped = results.reduce(
    (s, r) => s + r.typed.split('').filter((c, i) => c === r.target[i]).length,
    0,
  );
  return totalTyped > 0 ? Math.round((correctTyped / totalTyped) * 100) : 100;
}
