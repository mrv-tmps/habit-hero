import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface CountdownOverlayProps {
  label: string;
  onDone: () => void;
  className?: string;
}

// 3-2-1 overlay. Fires onDone once, after the count reaches zero.
export default function CountdownOverlay({ label, onDone, className }: CountdownOverlayProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const [count, setCount] = useState(3);

  useEffect(() => {
    const t1 = setTimeout(() => setCount(2), 900);
    const t2 = setTimeout(() => setCount(1), 1800);
    const t3 = setTimeout(() => onDoneRef.current(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // intentionally empty — must only fire once per mount

  return (
    <div
      className={cn(
        'fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-md',
        className,
      )}
    >
      <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
        {label}
      </p>
      <p className="font-pixel text-8xl text-primary animate-pulse-glow leading-none">
        {count}
      </p>
    </div>
  );
}
