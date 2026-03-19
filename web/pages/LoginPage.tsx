import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { GoogleLogo } from '../components/Icons';
import { Logo } from '../components/Logo';
import vectorArt from '../assets/login_page_vector_art.jpg';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';

import { useEffect } from 'react';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { googleLogin, login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const googleLoginHandler = useGoogleLogin({
    flow: 'auth-code',
    // @ts-ignore - Required to force a new refresh token with the new Sheets scope
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar openid email profile',
    onSuccess: async (codeResponse) => {
      console.log('Google Login Success:', codeResponse);
      try {
        console.log('Sending code to backend...');
        const response = await googleLogin(codeResponse.code);
        console.log('Backend response:', response);
        console.log('Navigating to dashboard...');
        navigate('/dashboard');
      } catch (err) {
        console.error('Login Failed Detailed:', err);
        setError('Google login failed. Please try again.');
      }
    },
    onError: errorResponse => {
      console.log('Login Error', errorResponse);
      setError('Google login failed. Please try again.');
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50 dark:bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white dark:bg-background w-full">
      {/* Left side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 py-12 relative z-10 transition-colors">
        <div className="w-full max-w-[440px] mx-auto space-y-8">
          <div className="flex flex-col items-start mb-2">
            <Logo className="w-12 h-12 mb-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-800" />
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Welcome back</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">We've missed you! Please enter your details.</p>
          </div>

          <div className="space-y-5">
            <button onClick={() => googleLoginHandler()} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-card border border-gray-200 dark:border-gray-800 shadow-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 h-11 px-4 rounded-lg transition-all font-medium text-sm">
              <GoogleLogo className="w-5 h-5" />
              Sign in with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200 dark:border-gray-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-background px-3 text-gray-400 dark:text-gray-500 font-medium">Or continue with</span>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center font-medium">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-gray-700 dark:text-gray-300" htmlFor="email">
                  Email
                </label>
                <input
                  className="flex h-11 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  id="email"
                  placeholder="m@example.com"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium leading-none text-gray-700 dark:text-gray-300" htmlFor="password">
                    Password
                  </label>
                  <a href="#" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Forgot password?</a>
                </div>
                <input
                  className="flex h-11 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button fullWidth type="submit" className="h-11 rounded-lg dark:bg-white dark:text-black dark:hover:bg-gray-100 shadow-sm transition-all" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-primary hover:text-primary/80 transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </div>

      {/* Right side: Vector Art Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary/5 dark:bg-gray-900 items-center justify-center overflow-hidden border-l border-gray-100 dark:border-gray-800">
        {/* Decorative elements behind image */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-3xl"></div>
        
        <div className="relative w-full h-full flex items-center justify-center p-12 z-10 transition-transform duration-700 ease-out hover:scale-[1.02]">
          <div className="relative w-full max-w-2xl aspect-square flex items-center justify-center">
            <img 
              src={vectorArt} 
              alt="Authentication Vector Art" 
              className="w-full h-full object-contain drop-shadow-2xl mix-blend-multiply dark:mix-blend-normal rounded-3xl"
              style={{ filter: 'brightness(0.95) contrast(1.05)' }}
            />
          </div>
        </div>
        
        {/* Glassmorphism overlay */}
        <div className="absolute bottom-12 left-12 right-12 z-20">
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 p-6 rounded-2xl shadow-2xl">
            <p className="text-gray-800 dark:text-gray-200 font-medium text-lg leading-relaxed">
              "Transform your lecture slides into engaging quizzes instantly. Join educators who are making learning interactive with AI-powered assessments."
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-blue-500 shadow-lg flex items-center justify-center text-white font-bold text-sm">
                DX
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Dexter Platform</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">AI-Powered Quiz Builder</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;