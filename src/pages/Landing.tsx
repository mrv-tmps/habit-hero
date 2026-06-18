import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sword, Zap, Trophy, Target, ChevronRight,
  Star, Keyboard, Brain, Flame, Menu, X,
} from "lucide-react";
import { TITLE_TIERS } from "@/lib/titles";

// ---------------------------------------------------------------------------
// Typewriter hook — cycles through an array of words with a blinking cursor
// ---------------------------------------------------------------------------
function useTypewriter(words: string[], speed = 80, pause = 1800) {
  const [display, setDisplay] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIdx];
    let delay = deleting ? speed / 2 : speed;
    if (!deleting && charIdx === word.length) delay = pause;
    if (deleting && charIdx === 0) delay = 300;

    const t = setTimeout(() => {
      if (!deleting && charIdx < word.length) {
        setDisplay(word.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      } else if (!deleting && charIdx === word.length) {
        setDeleting(true);
      } else if (deleting && charIdx > 0) {
        setDisplay(word.slice(0, charIdx - 1));
        setCharIdx((c) => c - 1);
      } else {
        setDeleting(false);
        setWordIdx((i) => (i + 1) % words.length);
      }
    }, delay);

    return () => clearTimeout(t);
  }, [charIdx, deleting, wordIdx, words, speed, pause]);

  return display;
}

// ---------------------------------------------------------------------------
// Scroll-reveal hook — fades + slides up an element when it enters viewport
// ---------------------------------------------------------------------------
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini typing demo
// ---------------------------------------------------------------------------
const DEMO_TEXT = "Build habits. Earn XP. Level up your life every single day.";

function TypingDemo() {
  const [typed, setTyped] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!started) setStarted(true);
    if (val.length <= DEMO_TEXT.length) {
      setTyped(val);
      if (val === DEMO_TEXT) setFinished(true);
    }
  };

  const reset = () => {
    setTyped("");
    setStarted(false);
    setFinished(false);
    inputRef.current?.focus();
  };

  const accuracy =
    typed.length > 0
      ? Math.round(
          (typed.split("").filter((c, i) => c === DEMO_TEXT[i]).length / typed.length) * 100
        )
      : 100;

  return (
    <div
      className="relative rounded-xl border border-border bg-background/60 p-5 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-pixel text-primary">DEMO MODE</span>
        {started && !finished && (
          <span className="text-xs font-mono text-muted-foreground">ACC {accuracy}%</span>
        )}
        {finished && (
          <span className="text-xs font-pixel text-primary animate-pulse">+10 XP!</span>
        )}
      </div>

      <div className="font-mono text-base leading-loose tracking-wide select-none mb-3 min-h-[3rem] break-words">
        {DEMO_TEXT.split("").map((char, i) => {
          let cls = "text-muted-foreground/40";
          if (i < typed.length) {
            cls = typed[i] === char
              ? "text-foreground"
              : "text-destructive bg-destructive/20 rounded-sm";
          } else if (i === typed.length) {
            cls = "text-foreground border-b-2 border-primary animate-pulse";
          }
          return <span key={i} className={cls}>{char}</span>;
        })}
      </div>

      <input
        ref={inputRef}
        value={typed}
        onChange={handleInput}
        className="opacity-0 absolute inset-0 w-full h-full cursor-text"
        disabled={finished}
        aria-label="Typing demo input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {finished ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full w-full transition-all duration-700" />
          </div>
          <button onClick={reset} className="text-xs text-primary hover:underline cursor-pointer">
            Try again
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {started ? "Keep going..." : "Tap here and start typing ↑"}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rank showcase
// ---------------------------------------------------------------------------
const SHOWCASE_TITLES = [
  TITLE_TIERS[0],
  TITLE_TIERS[2],
  TITLE_TIERS[5],
  TITLE_TIERS[8],
  TITLE_TIERS[11],
  TITLE_TIERS[15],
];

function RankShowcase() {
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback((i: number) => {
    if (i === active || animating) return;
    setPrev(active);
    setAnimating(true);
    setTimeout(() => {
      setActive(i);
      setAnimating(false);
    }, 250);
  }, [active, animating]);

  useEffect(() => {
    const id = setInterval(() => goTo((active + 1) % SHOWCASE_TITLES.length), 2000);
    return () => clearInterval(id);
  }, [active, goTo]);

  const current = animating ? SHOWCASE_TITLES[prev] : SHOWCASE_TITLES[active];

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="text-center min-h-[5rem] flex flex-col items-center justify-center"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating ? "translateY(-8px)" : "translateY(0)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}
      >
        <span className="font-pixel text-primary text-sm leading-none mb-2">
          {current.name.toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          {current.minXp.toLocaleString()} XP required
        </span>
      </div>

      <div className="flex gap-2">
        {SHOWCASE_TITLES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 cursor-pointer ${
              i === active ? "bg-primary w-4 h-2" : "bg-border w-2 h-2"
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-xs h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${((active + 1) / SHOWCASE_TITLES.length) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        16 titles — New Traveler to Shadow Monarch
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating XP burst
// ---------------------------------------------------------------------------
function XpBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setGone(true), 600);
    const t2 = setTimeout(onDone, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <span
      className="pointer-events-none fixed font-pixel text-primary text-xs z-50 select-none"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        opacity: gone ? 0 : 1,
        transition: "opacity 0.3s ease, transform 0.6s ease",
        marginTop: gone ? "-24px" : "0",
      }}
    >
      +1 XP
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Landing Page
// ---------------------------------------------------------------------------
export default function Landing() {
  const navigate = useNavigate();
  const { continueAsGuest } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [xpBursts, setXpBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const burstId = useRef(0);
  const prefersReducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const typeword = useTypewriter(["HABITS", "SKILLS", "STREAKS", "TITLES"], 90, 1600);

  // Parallax — desktop only, skip if reduced motion
  useEffect(() => {
    if (prefersReducedMotion.current) return;
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const spawnBurst = useCallback((e: React.MouseEvent) => {
    // Don't burst on nav / interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input")) return;
    const id = ++burstId.current;
    setXpBursts((p) => [...p, { id, x: e.clientX, y: e.clientY }]);
  }, []);

  const removeBurst = useCallback((id: number) => {
    setXpBursts((p) => p.filter((b) => b.id !== id));
  }, []);

  const handleGuest = () => {
    continueAsGuest();
    navigate("/");
  };

  return (
    <div className="min-h-screen page-bg text-foreground overflow-x-hidden" onClick={spawnBurst}>
      {/* XP bursts */}
      {xpBursts.map((b) => (
        <XpBurst key={b.id} x={b.x} y={b.y} onDone={() => removeBurst(b.id)} />
      ))}

      {/* ------------------------------------------------------------------ */}
      {/* NAV                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <nav className="fixed top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-40">
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card/85 backdrop-blur-md">
          <span className="font-pixel text-primary text-[10px] sm:text-xs leading-none">
            HABIT QUEST
          </span>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="text-sm bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              Start Free
            </button>
          </div>

          {/* Mobile: single CTA + hamburger */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              onClick={() => navigate("/auth")}
              className="text-xs bg-primary text-primary-foreground font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
            >
              Start Free
            </button>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <div
          className={`mt-2 rounded-xl border border-border bg-card/95 backdrop-blur-md overflow-hidden transition-all duration-300 sm:hidden ${
            menuOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="p-4 flex flex-col gap-3">
            <button
              onClick={() => { navigate("/auth"); setMenuOpen(false); }}
              className="text-sm text-foreground font-medium text-left cursor-pointer"
            >
              Sign in
            </button>
            <button
              onClick={() => { handleGuest(); setMenuOpen(false); }}
              className="text-sm text-muted-foreground text-left cursor-pointer"
            >
              Try as guest
            </button>
          </div>
        </div>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* HERO — full screen                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        {/* Parallax decorative glow orbs — desktop only */}
        <div
          className="absolute inset-0 pointer-events-none hidden md:block"
          aria-hidden
          style={{
            transform: prefersReducedMotion.current ? "none" : `translateY(${scrollY * 0.2}px)`,
          }}
        >
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        </div>

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 mb-8"
          style={{ animation: "fadeSlideUp 0.6s ease 0.1s both" }}
        >
          <Flame className="w-3 h-3 text-primary" />
          <span className="text-xs font-mono text-primary">RPG habit tracker · Free to play</span>
        </div>

        {/* Headline with typewriter */}
        <div
          className="mb-6"
          style={{ animation: "fadeSlideUp 0.6s ease 0.2s both" }}
        >
          <h1 className="font-pixel text-primary leading-relaxed">
            <span className="block text-lg sm:text-2xl md:text-3xl">LEVEL UP YOUR</span>
            <span className="block text-xl sm:text-3xl md:text-4xl mt-2 min-h-[1.4em]">
              {typeword}
              <span className="animate-pulse ml-0.5">|</span>
            </span>
          </h1>
        </div>

        <p
          className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg mb-10"
          style={{ animation: "fadeSlideUp 0.6s ease 0.35s both" }}
        >
          Habit Quest turns your daily routines into an RPG. Complete habits,
          earn XP, unlock titles — and watch your character grow one day at a time.
        </p>

        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs sm:max-w-none"
          style={{ animation: "fadeSlideUp 0.6s ease 0.5s both" }}
        >
          <button
            onClick={() => navigate("/auth")}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer text-base"
          >
            Start Your Journey
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleGuest}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-border text-foreground px-8 py-3.5 rounded-xl hover:border-primary/40 hover:bg-card transition-all cursor-pointer text-base"
          >
            Try as Guest
          </button>
        </div>

        <p
          className="mt-4 text-xs text-muted-foreground"
          style={{ animation: "fadeSlideUp 0.6s ease 0.6s both" }}
        >
          No credit card · Free forever · Guest data saved locally
        </p>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          style={{ animation: "fadeSlideUp 0.6s ease 0.9s both" }}
        >
          <span className="text-xs text-muted-foreground/50 font-mono">scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-border to-transparent" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* HOW IT WORKS                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 px-4 max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <span className="font-pixel text-primary text-xs tracking-widest">HOW IT WORKS</span>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: Target,
              step: "01",
              title: "Build Your Stats",
              desc: "Create custom habits mapped to stats — Strength, Intelligence, Endurance, or whatever fits your goals.",
              delay: 0,
            },
            {
              icon: Zap,
              step: "02",
              title: "Complete & Earn XP",
              desc: "Check off habits daily. Each completion awards XP that feeds directly into your character.",
              delay: 100,
            },
            {
              icon: Trophy,
              step: "03",
              title: "Unlock Titles & Ranks",
              desc: "Rise through 16 ranks — from New Traveler to the legendary Shadow Monarch.",
              delay: 200,
            },
          ].map(({ icon: Icon, step, title, desc, delay }) => (
            <Reveal key={step} delay={delay}>
              <div className="rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 cursor-default h-full">
                <div className="flex items-start justify-between mb-5">
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground/40">{step}</span>
                </div>
                <h3 className="text-foreground font-semibold text-base mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* TYPING DEMO                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 px-4 max-w-3xl mx-auto">
        <Reveal>
          <div className="rounded-2xl border border-border bg-card/60 p-6 sm:p-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-accent/20 border border-accent/30">
                <Keyboard className="w-4 h-4 text-accent" />
              </div>
              <span className="font-pixel text-accent text-[9px] sm:text-xs">MINIGAME: TYPING TEST</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
              Skills that level you up
            </h2>
            <p className="text-muted-foreground text-sm mb-7 max-w-md">
              Play mini-games to earn bonus XP on top of your habits. The typing test
              challenges your speed and accuracy — more games on the way.
            </p>
            <TypingDemo />
            <div className="mt-5 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Brain className="w-3.5 h-3.5 shrink-0" />
                <span>Tracks WPM &amp; accuracy</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>Awards XP on completion</span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* RANK SHOWCASE                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 px-4 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
          <Reveal>
            <span className="font-pixel text-primary text-xs tracking-widest">YOUR RANK AWAITS</span>
            <h3 className="text-2xl sm:text-3xl font-semibold text-foreground mt-4 mb-4 leading-snug">
              Every habit pushes you closer to legend
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-7">
              XP accumulates permanently. Miss a day and you won't lose your rank.
              Stay consistent and titles come naturally — a reflection of the work
              you've already put in.
            </p>
            <div className="flex flex-col gap-3.5">
              {[
                { label: "16 unique titles", sub: "New Traveler → Shadow Monarch" },
                { label: "Permanent XP", sub: "No streaks to break, no resets" },
                { label: "Custom character", sub: "Name and avatar of your choosing" },
              ].map(({ label, sub }) => (
                <div key={label} className="flex items-center gap-3">
                  <Star className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="rounded-xl border border-border bg-card p-8">
              <RankShowcase />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* THE ARENA                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 px-4 max-w-5xl mx-auto">
        <Reveal className="text-center mb-3">
          <span className="font-pixel text-primary text-xs tracking-widest">THE ARENA</span>
        </Reveal>
        <Reveal delay={80} className="text-center mb-10">
          <p className="text-muted-foreground text-sm">More ways to earn XP are on the way</p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Reveal delay={0}>
            <div
              className="rounded-xl border border-primary/30 bg-card p-5 hover:border-primary/60 hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full"
              onClick={() => navigate("/auth")}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Keyboard className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary">LIVE</span>
              </div>
              <h4 className="font-semibold text-foreground mb-1">Typing Test</h4>
              <p className="text-xs text-muted-foreground">Race through words. Earn XP for speed and accuracy.</p>
            </div>
          </Reveal>

          {[
            { icon: Brain, label: "Memory Match", desc: "Train your recall. Pattern recognition mini-game.", delay: 100 },
            { icon: Sword, label: "Focus Sprint", desc: "Deep work timer with XP rewards for staying locked in.", delay: 200 },
          ].map(({ icon: Icon, label, desc, delay }) => (
            <Reveal key={label} delay={delay}>
              <div className="rounded-xl border border-border bg-card/40 p-5 opacity-50 h-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">SOON</span>
                </div>
                <h4 className="font-semibold text-muted-foreground mb-1">{label}</h4>
                <p className="text-xs text-muted-foreground/60">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FINAL CTA                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-28 px-4">
        <Reveal className="max-w-xl mx-auto text-center">
          <span className="font-pixel text-primary text-xs tracking-widest">READY TO BEGIN?</span>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mt-4 mb-4">
            Your character is waiting.
          </h2>
          <p className="text-muted-foreground text-base mb-10">
            Your first XP is one habit away.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate("/auth")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer text-base"
            >
              Create Your Character
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleGuest}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-4"
            >
              Continue as guest
            </button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 text-center">
        <span className="font-pixel text-primary text-xs">HABIT QUEST</span>
        <p className="text-xs text-muted-foreground mt-2">Build better habits. Earn your title.</p>
      </footer>

      {/* Hero entrance animation keyframes */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
