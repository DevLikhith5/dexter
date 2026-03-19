import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Button from './Button';
import { SunIcon, MoonIcon } from './Icons';
import { Logo } from './Logo';
import { useTheme } from './ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Menu, MenuItem, HoveredLink, ProductItem } from './ui/navbar-menu';
import { cn } from '../lib/utils';

const Navbar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
  const { theme, toggleTheme } = useTheme();
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b border-transparent",
        scrolled 
          ? "bg-white/80 dark:bg-black/80 backdrop-blur-md shadow-sm border-gray-200/50 dark:border-white/5" 
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 font-bold text-xl text-foreground dark:text-white hover:opacity-90 transition-opacity z-50">
          <Logo className="w-9 h-9" />
          <span className="font-heading text-2xl tracking-tight">Dexter</span>
        </Link>

        {!isAuthPage && !user && (
          <div className="hidden md:flex items-center justify-center absolute left-0 right-0 top-0 h-16 pointer-events-none">
             <div className="pointer-events-auto mt-2">
               <Menu setActive={setActive}>
                 <MenuItem setActive={setActive} active={active} item="Features">
                   <div className="grid grid-cols-2 gap-6 p-4 w-[500px]">
                     <ProductItem
                       title="AI Generation"
                       href="#features"
                       src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=300&h=150"
                       description="Turn PDFs into quizzes instantly with advanced AI."
                     />
                     <ProductItem
                       title="Live Analytics"
                       href="#features"
                       src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=300&h=150"
                       description="Real-time performance tracking for every student."
                     />
                     <ProductItem
                       title="Sheet Sync"
                       href="#features"
                       src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=300&h=150"
                       description="Auto-export grades to your Google Sheets."
                     />
                     <ProductItem
                       title="Gamification"
                       href="#features"
                       src="https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=300&h=150"
                       description="Leaderboards and streaks to boost engagement."
                     />
                   </div>
                 </MenuItem>
                 <MenuItem setActive={setActive} active={active} item="Resources">
                   <div className="flex flex-col space-y-4 text-sm w-[200px] p-2">
                     <HoveredLink href="#how-it-works">How it Works</HoveredLink>
                     <HoveredLink href="#">Documentation</HoveredLink>
                     <HoveredLink href="#">Blog</HoveredLink>
                     <HoveredLink href="#">Educator Community</HoveredLink>
                   </div>
                 </MenuItem>
                 <MenuItem setActive={setActive} active={active} item="Pricing">
                   <div className="flex flex-col space-y-4 text-sm w-[200px] p-2">
                     <HoveredLink href="#pricing">Basic Plan</HoveredLink>
                     <HoveredLink href="#pricing">Pro Plan</HoveredLink>
                     <HoveredLink href="#pricing">Institution</HoveredLink>
                     <HoveredLink href="#contact">Contact Sales</HoveredLink>
                   </div>
                 </MenuItem>
               </Menu>
             </div>
          </div>
        )}

        <div className="flex items-center gap-3 z-50">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/10 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Toggle Dark Mode"
          >
            {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
          </button>
          
          {isAuthPage ? (
            <Link to="/">
               <Button variant="ghost" size="sm">Back to Home</Button>
            </Link>
          ) : user ? (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-foreground font-medium">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-foreground font-medium">Log in</Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm" className="shadow-none">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;