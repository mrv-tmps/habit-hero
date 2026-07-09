import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Settings from "./pages/Settings";
import GamesHub from "./pages/GamesHub";
import TypingTest from "./pages/TypingTest";
import TypingHistory from "./pages/TypingHistory";
import MathChallenge from "./pages/MathChallenge";
import BlastArena from "./pages/BlastArena";
import ErrorPage from "./pages/Error";
import CreateRoom from "./pages/CreateRoom";
import RoomLobby from "./pages/RoomLobby";
import MultiplayerGame from "./pages/MultiplayerGame";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isGuest, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <div className="text-primary animate-pulse font-pixel">Loading...</div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to="/landing" replace />;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <div className="text-primary animate-pulse font-pixel">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/landing" element={<AuthRoute><Landing /></AuthRoute>} />
      <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/games" element={<GamesHub />} />
      <Route path="/games/typing" element={<TypingTest />} />
      <Route path="/games/typing/history" element={<ProtectedRoute><TypingHistory /></ProtectedRoute>} />
      <Route path="/games/math" element={<MathChallenge />} />
      <Route path="/games/blast-arena" element={<BlastArena />} />
      <Route path="/games/room/new" element={<CreateRoom />} />
      <Route path="/games/room/:code" element={<RoomLobby />} />
      <Route path="/games/room/:code/play" element={<MultiplayerGame />} />
      <Route path="/error" element={<ErrorPage />} />
      <Route path="*" element={<ErrorPage />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
