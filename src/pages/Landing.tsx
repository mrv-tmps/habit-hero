import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sword, Zap, Trophy, Target, ChevronRight, Star, Keyboard, Brain, Flame } from "lucide-react";
import { TITLE_TIERS } from "@/lib/titles";

// --- Mini typing demo ---
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
          (typed.split("").filter((c, i) => c === DEMO_TEXT[i]).length /
            typed.length) *
            100
        )
      : 100;

  return (
    <div
      className="relative rounded-xl border border-border bg-card p-6 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-pixel text-primary">DEMO MODE</span>
        {started && !finished && (
          <span className="text-xs font-mono text-muted-foreground">
            ACC {accuracy}%
          </span>
        )}
        {finished && (
          <span className="text-xs font-pixel text-primary animate-pulse">
            +10 XP!
          </span>
        )}
      </div>

      {/* Character display */}
      <div className="font-mono text-lg leading-loose tracking-wide select-none mb-4 min-h-[3.5rem]">
        {DEMO_TEXT.split("").map((char, i) => {
          let cls = "text-muted-foreground/50";
          if (i < typed.length) {
            cls = typed[i] === char ? "text-foreground" : "text-destructive bg-destructive/20 rounded";
          } else if (i === typed.length) {
            cls = "text-foreground border-b-2 border-primary";
          }
          return (
            <span key={i} className={cls}>
              {char}
            </span>
          );
        })}
      </div>

      <input
        ref={inputRef}
        value={typed}
        onChange={handleInput}
        className="opacity-0 absolute inset-0 w-full h-full cursor-text"
        disabled={finished}
        aria-label="Typing demo input"
      />

      {finished ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full w-full transition-all duration-500" />
          </div>
          <button
            onClick={reset}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {started ? "Keep going..." : "Click here and start typing ↑"}
        </p>
      )}
    </div>
  );
}

// --- Rank progression showcase ---
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

  useEffect(() => {
    const id = setInterval(() => setActive((p) => (p + 1) % SHOWCASE_TITLES.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center min-h-[4rem] flex flex-col items-center justify-center">
        <span className="font-pixel text-primary text-sm leading-none mb-2 transition-all duration-300">
          {SHOWCASE_TITLES[active].name.toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          {SHOWCASE_TITLES[active].minXp.toLocaleString()} XP
        </span>
      </div>
      <div className="flex gap-2">
        {SHOWCASE_TITLES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-2 h-2 rounded-full transition-all duration-200 cursor-pointer ${
              i === active ? "bg-primary scale-125" : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="w-full max-w-xs h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${((active + 1) / SHOWCASE_TITLES.length) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        16 titles to unlock — from New Traveler to Shadow Monarch
      </p>
    </div>
  );
}

// --- Floating XP particle ---
function XpBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <span
      className="pointer-events-none fixed font-pixel text-primary text-xs z-50 animate-bounce"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
    >
      +1 XP
    </span>
  );
}

// --- Main Landing Page ---
export default function Landing() {
  const navigate = useNavigate();
  const { continueAsGuest } = useAuth();
  const [xpBursts, setXpBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const burstId = useRef(0);

  const spawnBurst = useCallback((e: React.MouseEvent) => {
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
    <div className="min-h-screen bg-background text-foreground" onClick={spawnBurst}>
      {/* XP burst particles */}
      {xpBursts.map((b) => (
        <XpBurst key={b.id} x={b.x} y={b.y} onDone={() => removeBurst(b.id)} />
      ))}

      {/* Nav */}
      <nav className="fixed top-4 left-4 right-4 z-30 flex items-center justify-between px-6 py-3 rounded-xl border border-border bg-card/80 backdrop-blur-md">
        <span className="font-pixel text-primary text-xs leading-none">HABIT QUEST</span>
        <div className="flex items-center gap-3">
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
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-4 flex flex-col items-center text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 mb-8">
          <Flame className="w-3 h-3 text-primary" />
          <span className="text-xs font-mono text-primary">Track habits. Earn XP. Rank up.</span>
        </div>

        <h1 className="font-pixel text-primary text-lg sm:text-2xl leading-relaxed mb-6 max-w-2xl">
          LEVEL UP<br />YOUR LIFE
        </h1>

        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-xl mb-10">
          Habit Quest turns your daily routines into an RPG. Complete your habits,
          earn experience points, unlock titles, and watch your character grow —
          one streak at a time.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer text-base"
          >
            Start Your Journey
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleGuest}
            className="flex items-center gap-2 border border-border text-foreground px-8 py-3.5 rounded-xl hover:border-primary/50 hover:bg-card transition-all cursor-pointer text-base"
          >
            Try as Guest
          </button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Free to play · Guest data saved locally
        </p>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 max-w-5xl mx-auto">
        <h2 className="text-center font-pixel text-primary text-xs mb-12 tracking-widest">
          HOW IT WORKS
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Target,
              step: "01",
              title: "Build Your Stats",
              desc: "Create custom habits mapped to stats — Strength, Intelligence, Endurance, or whatever suits your goals.",
            },
            {
              icon: Zap,
              step: "02",
              title: "Complete & Earn XP",
              desc: "Check off habits daily. Each completion awards XP that feeds directly into your character's growth.",
            },
            {
              icon: Trophy,
              step: "03",
              title: "Unlock Titles & Ranks",
              desc: "Rise through 16 ranks — from New Traveler to the legendary Shadow Monarch. Your dedication is permanent.",
            },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div
              key={step}
              className="group relative rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors cursor-default"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-mono text-xs text-muted-foreground/50 mt-1">{step}</span>
              </div>
              <h3 className="text-foreground font-semibold text-base mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive typing demo */}
      <section className="py-20 px-4 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-border bg-card/50 p-8 sm:p-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-accent/20 border border-accent/30">
              <Keyboard className="w-4 h-4 text-accent" />
            </div>
            <span className="font-pixel text-accent text-xs">MINIGAME: TYPING TEST</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
            Skills that level you up
          </h2>
          <p className="text-muted-foreground text-sm mb-8 max-w-md">
            Play mini-games to earn bonus XP on top of your habits. The typing test
            challenges your speed and accuracy — more games coming soon.
          </p>
          <TypingDemo />
          <div className="mt-6 flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Brain className="w-3.5 h-3.5" />
              <span>Tracks WPM & accuracy</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="w-3.5 h-3.5" />
              <span>Awards XP on completion</span>
            </div>
          </div>
        </div>
      </section>

      {/* Rank showcase */}
      <section className="py-20 px-4 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-pixel text-primary text-xs mb-4 tracking-widest">
              YOUR RANK AWAITS
            </h2>
            <h3 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 leading-snug">
              Every habit streak pushes you closer to legend
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              XP accumulates permanently. Miss a day — you won't lose your rank.
              Stay consistent and the titles come naturally as a reflection of the
              work you've already done.
            </p>
            <div className="flex flex-col gap-3">
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
          </div>
          <div className="rounded-xl border border-border bg-card p-8">
            <RankShowcase />
          </div>
        </div>
      </section>

      {/* Coming soon games */}
      <section className="py-20 px-4 max-w-5xl mx-auto">
        <h2 className="text-center font-pixel text-primary text-xs mb-3 tracking-widest">
          THE ARENA
        </h2>
        <p className="text-center text-muted-foreground text-sm mb-10">
          More ways to earn XP are on the way
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-primary/30 bg-card p-5 hover:border-primary/60 transition-colors cursor-pointer" onClick={() => navigate("/auth")}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Keyboard className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary">LIVE</span>
            </div>
            <h4 className="font-semibold text-foreground mb-1">Typing Test</h4>
            <p className="text-xs text-muted-foreground">Race through words. Earn XP for speed and accuracy.</p>
          </div>
          {[
            { icon: Brain, label: "Memory Match", desc: "Train your recall. Pattern recognition mini-game." },
            { icon: Sword, label: "Focus Sprint", desc: "Deep work timer with XP rewards for staying locked in." },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-xl border border-border bg-card/50 p-5 opacity-60">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">SOON</span>
              </div>
              <h4 className="font-semibold text-muted-foreground mb-1">{label}</h4>
              <p className="text-xs text-muted-foreground/70">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 flex flex-col items-center text-center">
        <h2 className="font-pixel text-primary text-sm sm:text-base leading-relaxed mb-4">
          READY TO BEGIN?
        </h2>
        <p className="text-muted-foreground text-base max-w-sm mb-10">
          Your character is waiting. Your first XP is one habit away.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer text-base"
          >
            Create Your Character
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleGuest}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-4"
          >
            Continue as guest instead
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 text-center">
        <span className="font-pixel text-primary text-xs">HABIT QUEST</span>
        <p className="text-xs text-muted-foreground mt-2">
          Build better habits. Earn your title.
        </p>
      </footer>
    </div>
  );
}
