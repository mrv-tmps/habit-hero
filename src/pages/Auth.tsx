import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome back, Hero!');
          navigate('/');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Try logging in.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created! Welcome to Habit Quest!');
          navigate('/');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    continueAsGuest();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-levelBadge/10 pointer-events-none" />

      <div className="relative w-full max-w-sm space-y-8">
        {/* Logo/Title */}
        <div className="text-center space-y-4">
          <div className="text-6xl animate-pulse-glow">🎮</div>
          <h1 className="font-pixel text-2xl text-primary text-glow">
            HABIT QUEST
          </h1>
          <p className="text-muted-foreground">
            {isLogin ? 'Welcome back, Hero!' : 'Begin your journey'}
          </p>
        </div>

        {/* Auth Form */}
        <div className="rounded-xl bg-card border border-border p-6 card-glow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="hero@quest.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-background/50"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full font-semibold"
              disabled={loading}
            >
              {loading ? '...' : isLogin ? 'Enter the Quest' : 'Create Hero'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>
          </div>
        </div>

        {/* Guest Mode */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={handleGuestMode}
            className="text-muted-foreground hover:text-foreground"
          >
            Continue as Guest →
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Guest progress is saved locally only
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
