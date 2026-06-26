import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface JoystickProps {
  onVector: (dx: number, dy: number) => void;
  className?: string;
}

const BASE_RADIUS = 56;   // px — half of w-28
const THUMB_RADIUS = 28;  // px — half of w-14
const MAX_OFFSET = BASE_RADIUS - THUMB_RADIUS;

export function Joystick({ onVector, className }: JoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const onVectorRef = useRef(onVector);
  onVectorRef.current = onVector;
  const [visible, setVisible] = useState(false);

  // Only show on coarse-pointer devices
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setVisible(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Also show after first touchstart (catches hybrid devices)
  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('touchstart', handler, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', handler);
  }, []);

  const moveThumb = useCallback((dx: number, dy: number) => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const len = Math.sqrt(dx * dx + dy * dy);
    const clamped = len > MAX_OFFSET ? MAX_OFFSET / len : 1;
    const tx = dx * clamped;
    const ty = dy * clamped;
    thumb.style.transform = `translate3d(calc(-50% + ${tx}px), calc(-50% + ${ty}px), 0)`;
    const norm = len > 0 ? Math.min(len / MAX_OFFSET, 1) : 0;
    onVectorRef.current(
      len > 0 ? (dx / len) * norm : 0,
      len > 0 ? (dy / len) * norm : 0,
    );
  }, []);

  const resetThumb = useCallback(() => {
    const thumb = thumbRef.current;
    if (thumb) thumb.style.transform = 'translate3d(-50%, -50%, 0)';
    onVectorRef.current(0, 0);
    originRef.current = null;
    activePointerRef.current = null;
  }, []);

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    function onPointerDown(e: PointerEvent) {
      if (activePointerRef.current !== null) return;
      e.preventDefault();
      activePointerRef.current = e.pointerId;
      base!.setPointerCapture(e.pointerId);
      const rect = base!.getBoundingClientRect();
      originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      moveThumb(e.clientX - originRef.current.x, e.clientY - originRef.current.y);
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== activePointerRef.current || !originRef.current) return;
      e.preventDefault();
      moveThumb(e.clientX - originRef.current.x, e.clientY - originRef.current.y);
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerId !== activePointerRef.current) return;
      resetThumb();
    }

    base.addEventListener('pointerdown', onPointerDown);
    base.addEventListener('pointermove', onPointerMove);
    base.addEventListener('pointerup', onPointerUp);
    base.addEventListener('pointercancel', onPointerUp);
    return () => {
      base.removeEventListener('pointerdown', onPointerDown);
      base.removeEventListener('pointermove', onPointerMove);
      base.removeEventListener('pointerup', onPointerUp);
      base.removeEventListener('pointercancel', onPointerUp);
    };
  }, [moveThumb, resetThumb]);

  if (!visible) return null;

  return (
    <div
      className={cn('absolute bottom-6 left-1/2 -translate-x-1/2 z-20', className)}
      aria-label="Movement joystick"
      role="application"
    >
      {/* Base */}
      <div
        ref={baseRef}
        className="relative rounded-full bg-secondary/40 border border-border cursor-pointer"
        style={{
          width: BASE_RADIUS * 2,
          height: BASE_RADIUS * 2,
          touchAction: 'none',
        }}
      >
        {/* Thumb */}
        <div
          ref={thumbRef}
          className="absolute top-1/2 left-1/2 rounded-full bg-primary/80"
          style={{
            width: THUMB_RADIUS * 2,
            height: THUMB_RADIUS * 2,
            minWidth: 44,
            minHeight: 44,
            transform: 'translate3d(-50%, -50%, 0)',
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
}
