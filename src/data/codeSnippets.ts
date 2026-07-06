import type { CodeLanguage } from '@/types/multiplayer';

export interface CodeSnippet {
  language: CodeLanguage;
  title: string;
  code: string;
}

// Starter pool for the multiplayer typing race code mode. Session 4 expands this list.
export const CODE_SNIPPETS: CodeSnippet[] = [
  {
    language: 'javascript',
    title: 'debounce',
    code: `function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}`,
  },
  {
    language: 'javascript',
    title: 'unique',
    code: `function unique(items) {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}`,
  },
  {
    language: 'python',
    title: 'fibonacci',
    code: `def fibonacci(n):
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result`,
  },
  {
    language: 'python',
    title: 'word_count',
    code: `def word_count(text):
    counts = {}
    for word in text.lower().split():
        counts[word] = counts.get(word, 0) + 1
    return counts`,
  },
  {
    language: 'c',
    title: 'swap',
    code: `void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}`,
  },
  {
    language: 'c',
    title: 'strlen',
    code: `size_t my_strlen(const char *s) {
    const char *p = s;
    while (*p) {
        p++;
    }
    return p - s;
}`,
  },
];
