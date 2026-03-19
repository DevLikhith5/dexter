import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import JoinQuizPage from './pages/JoinQuizPage';
import QuizRoomPage from './pages/QuizRoomPage';
import HostQuizPage from './pages/HostQuizPage';
import { ThemeProvider } from './components/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { WebSocketProvider } from './contexts/WebSocketContext';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      {!isDashboard && !isAuthPage && <Navbar />}
      <main className={isDashboard ? "h-screen overflow-hidden" : "flex-grow"}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/join" element={<ProtectedRoute><JoinQuizPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/dashboard/host" element={<ProtectedRoute><HostQuizPage /></ProtectedRoute>} />
          <Route path="/dashboard/*" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/dashboard/quiz/:sessionId" element={<ProtectedRoute><QuizRoomPage /></ProtectedRoute>} />
        </Routes>
      </main>
      {!isDashboard && !isAuthPage && <Footer />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"}>
        <HashRouter>
          <AuthProvider>
            <WebSocketProvider>
              <ScrollToTop />
              <AppContent />
            </WebSocketProvider>
          </AuthProvider>
        </HashRouter>
      </GoogleOAuthProvider>
    </ThemeProvider>
  );
};

export default App;