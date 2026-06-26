export interface MathProblem {
  question: string;
  answer: number;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function rngInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function generateEasy(rng: () => number): MathProblem {
  const op = rng() < 0.5 ? '+' : '-';
  const a = rngInt(rng, 1, 20);
  const b = rngInt(rng, 1, 20);
  if (op === '+') {
    return { question: `${a} + ${b}`, answer: a + b };
  }
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  return { question: `${big} − ${small}`, answer: big - small };
}

function generateMedium(rng: () => number): MathProblem {
  const opIdx = Math.floor(rng() * 4);
  switch (opIdx) {
    case 0: {
      const a = rngInt(rng, 1, 50); const b = rngInt(rng, 1, 50);
      return { question: `${a} + ${b}`, answer: a + b };
    }
    case 1: {
      const a = rngInt(rng, 1, 50); const b = rngInt(rng, 1, 50);
      const big = Math.max(a, b); const small = Math.min(a, b);
      return { question: `${big} − ${small}`, answer: big - small };
    }
    case 2: {
      const a = rngInt(rng, 1, 12); const b = rngInt(rng, 1, 12);
      return { question: `${a} × ${b}`, answer: a * b };
    }
    default: {
      const a = rngInt(rng, 2, 12); const b = rngInt(rng, 2, 12);
      return { question: `${a * b} ÷ ${a}`, answer: b };
    }
  }
}

function generateHard(rng: () => number): MathProblem {
  const form = Math.floor(rng() * 3);
  switch (form) {
    case 0: {
      const a = rngInt(rng, 1, 20); const b = rngInt(rng, 1, 20); const c = rngInt(rng, 1, 100);
      return { question: `(${a} × ${b}) + ${c}`, answer: a * b + c };
    }
    case 1: {
      const a = rngInt(rng, 1, 20); const b = rngInt(rng, 1, 20); const c = rngInt(rng, 1, 100);
      return { question: `(${a} × ${b}) − ${c}`, answer: a * b - c };
    }
    default: {
      const a = rngInt(rng, 1, 100); const b = rngInt(rng, 2, 12); const c = rngInt(rng, 2, 12);
      return { question: `${a} + (${b} × ${c})`, answer: a + b * c };
    }
  }
}

export function generateQuestions(
  seed: number,
  count: number,
  difficulty: 'easy' | 'medium' | 'hard',
): MathProblem[] {
  const rng = mulberry32(seed);
  const questions: MathProblem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    let problem: MathProblem;
    let attempts = 0;
    do {
      if (difficulty === 'easy') problem = generateEasy(rng);
      else if (difficulty === 'medium') problem = generateMedium(rng);
      else problem = generateHard(rng);
      attempts++;
    } while (seen.has(problem!.question) && attempts < 3);
    seen.add(problem!.question);
    questions.push(problem!);
  }

  return questions;
}
