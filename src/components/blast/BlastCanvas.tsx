import { useCallback, useEffect, useRef, useState } from 'react';
import { BA_CANVAS_W, BA_CANVAS_H } from '@/config/constants';

interface BlastCanvasProps {
  registerCanvas: (el: HTMLCanvasElement | null) => void;
  updateAim: (vx: number, vy: number) => void;
  clearAim: () => void;
  commitShot: (vx: number, vy: number) => void;
  maxSpeed: number;
  canAim: boolean;
}

const DRAG_FULL_POWER_PX = 60;
const MIN_FIRE_POWER = 0.2;

// Integer-scaled canvas: this is what produces the crisp pixel-art look
export default function BlastCanvas({
  registerCanvas,
  updateAim,
  clearAim,
  commitShot,
  maxSpeed,
  canAim,
}: BlastCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastVelRef = useRef<{ vx: number; vy: number } | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const width = containerRef.current?.clientWidth ?? BA_CANVAS_W;
      const maxH = window.innerHeight * 0.55;
      setScale(Math.max(1, Math.floor(Math.min(width / BA_CANVAS_W, maxH / BA_CANVAS_H))));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const toVelocity = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragStartRef.current;
    if (!start) return null;
    // Slingshot: launch opposite the drag direction, power from drag length
    const dx = start.x - e.clientX;
    const dy = start.y - e.clientY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { vx: 0, vy: 0, power: 0 };
    const power = Math.min(len / (DRAG_FULL_POWER_PX * scale), 1);
    const speed = power * maxSpeed;
    return { vx: (dx / len) * speed, vy: (dy / len) * speed, power };
  }, [maxSpeed, scale]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canAim) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastVelRef.current = null;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canAim || !dragStartRef.current) return;
    const vel = toVelocity(e);
    if (!vel) return;
    lastVelRef.current = vel.power >= MIN_FIRE_POWER ? { vx: vel.vx, vy: vel.vy } : null;
    if (vel.power >= MIN_FIRE_POWER) {
      updateAim(vel.vx, vel.vy);
    } else {
      clearAim();
    }
  };

  const onPointerUp = () => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    const vel = lastVelRef.current;
    lastVelRef.current = null;
    if (canAim && vel) {
      commitShot(vel.vx, vel.vy);
    } else {
      clearAim();
    }
  };

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      <canvas
        ref={registerCanvas}
        width={BA_CANVAS_W}
        height={BA_CANVAS_H}
        style={{ width: BA_CANVAS_W * scale, height: BA_CANVAS_H * scale, touchAction: 'none' }}
        className="pixelated rounded-lg border border-white/[0.07] select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="application"
        aria-label="Blast Arena battlefield. Drag to aim and release to fire."
      />
    </div>
  );
}
