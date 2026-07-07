import type { CodeLanguage } from '@/types/multiplayer';

export interface CodeSnippet {
  language: CodeLanguage;
  title: string;
  code: string;
}

// Shared pool for the multiplayer typing race and solo code typing mode.
// Authoring rules: ~150-300 chars, spaces only (no tabs), no trailing whitespace,
// classic algorithms so players of any background can read them.
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
    language: 'javascript',
    title: 'fizzBuzz',
    code: `function fizzBuzz(n) {
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) console.log("FizzBuzz");
    else if (i % 3 === 0) console.log("Fizz");
    else if (i % 5 === 0) console.log("Buzz");
    else console.log(i);
  }
}`,
  },
  {
    language: 'javascript',
    title: 'binarySearch',
    code: `function binarySearch(arr, target) {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
  },
  {
    language: 'javascript',
    title: 'isPalindrome',
    code: `function isPalindrome(str) {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  let i = 0;
  let j = clean.length - 1;
  while (i < j) {
    if (clean[i] !== clean[j]) return false;
    i++;
    j--;
  }
  return true;
}`,
  },
  {
    language: 'javascript',
    title: 'fibonacci',
    code: `function fibonacci(n) {
  if (n <= 1) return n;
  let prev = 0;
  let curr = 1;
  for (let i = 2; i <= n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }
  return curr;
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
    language: 'python',
    title: 'fizzbuzz',
    code: `def fizzbuzz(n):
    for i in range(1, n + 1):
        if i % 15 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)`,
  },
  {
    language: 'python',
    title: 'is_palindrome',
    code: `def is_palindrome(text):
    clean = [c.lower() for c in text if c.isalnum()]
    left, right = 0, len(clean) - 1
    while left < right:
        if clean[left] != clean[right]:
            return False
        left += 1
        right -= 1
    return True`,
  },
  {
    language: 'python',
    title: 'bubble_sort',
    code: `def bubble_sort(items):
    n = len(items)
    for i in range(n - 1):
        for j in range(n - 1 - i):
            if items[j] > items[j + 1]:
                items[j], items[j + 1] = items[j + 1], items[j]
    return items`,
  },
  {
    language: 'python',
    title: 'binary_search',
    code: `def binary_search(items, target):
    lo, hi = 0, len(items) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`,
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
  {
    language: 'c',
    title: 'fizzbuzz',
    code: `void fizzbuzz(int n) {
    for (int i = 1; i <= n; i++) {
        if (i % 15 == 0) printf("FizzBuzz\\n");
        else if (i % 3 == 0) printf("Fizz\\n");
        else if (i % 5 == 0) printf("Buzz\\n");
        else printf("%d\\n", i);
    }
}`,
  },
  {
    language: 'c',
    title: 'fibonacci',
    code: `int fibonacci(int n) {
    if (n <= 1) return n;
    int prev = 0, curr = 1;
    for (int i = 2; i <= n; i++) {
        int next = prev + curr;
        prev = curr;
        curr = next;
    }
    return curr;
}`,
  },
  {
    language: 'c',
    title: 'array_max',
    code: `int array_max(const int *arr, int len) {
    int max = arr[0];
    for (int i = 1; i < len; i++) {
        if (arr[i] > max) {
            max = arr[i];
        }
    }
    return max;
}`,
  },
  {
    language: 'c',
    title: 'factorial',
    code: `unsigned long factorial(int n) {
    unsigned long result = 1;
    for (int i = 2; i <= n; i++) {
        result *= (unsigned long)i;
    }
    return result;
}`,
  },
];
