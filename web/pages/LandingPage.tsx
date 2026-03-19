import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import { DocumentTextIcon, QrCodeIcon, TrophyIcon, TableCellsIcon, CheckIcon, ChartBarIcon, CloudArrowUpIcon, PencilIcon, ClockIcon, ArrowsRightLeftIcon } from '../components/Icons';
import { ShaderAnimation } from '../components/ui/shader-animation';
import { HeroGeometric } from '../components/ui/shape-landing-hero';
import Testimonials from '../components/Testimonials';
import { SquishyCard } from '../components/ui/squishy-card-component';
import { ContainerScroll } from '../components/ui/container-scroll-animation';
import { FeatureSteps } from '../components/ui/feature-steps';
import { cn } from '../lib/utils';
import macbookScroll from '../assets/macbook_scroll.png';
import ChatBot from '../components/ChatBot';

// GSAP is loaded via CDN in index.html
declare const gsap: any;
declare const ScrollTrigger: any;

const LandingPage: React.FC = () => {
  const featuresRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  // Removed GSAP animations to prevent content from being hidden (blank) if scripts fail to load or triggers misfire.
  // Content will now be statically visible by default.

  const features = [
    {
      step: "01",
      title: "Upload Resources",
      content: "Drag and drop your lecture slides (PDF, PPT) or reading materials directly. Our engine parses complex documents in seconds.",
      image: (
        <img
          src="https://images.unsplash.com/photo-1664575602276-acd073f104c1?q=80&w=2070&auto=format&fit=crop"
          alt="Upload resources to cloud"
          className="w-full h-full object-cover rounded-xl border border-gray-200 dark:border-white/10 shadow-lg"
        />
      )
    },
    {
      step: "02",
      title: "Review & Customize",
      content: "AI generates the questions, but you're in control. Edit text, adjust timers, or add your own flavor before launching.",
      image: (
        <div className="w-full h-full bg-[#F8F9FC] dark:bg-[#0A0A0A] p-6 rounded-xl border border-gray-200 dark:border-white/10 flex flex-col relative overflow-hidden shadow-lg select-none">
          {/* Mock Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-white dark:bg-black rounded-sm"></div>
              </div>
              <span className="font-bold text-lg text-gray-900 dark:text-white font-heading">Dexter</span>
            </div>

            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px] shadow-sm">
                AR
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900 dark:text-white leading-none">Aditi Rao</span>
                <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium leading-tight">Free Plan</span>
              </div>
              <ArrowsRightLeftIcon className="w-3 h-3 text-gray-400" />
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Card 1 */}
            <div className="bg-white dark:bg-[#1e2025] p-5 rounded-xl border border-gray-200 dark:border-white/5 relative shadow-sm flex flex-col">
              <div className="h-4 w-3/4 bg-gray-100 dark:bg-white/10 rounded mb-3"></div>
              <div className="h-4 w-1/2 bg-gray-100 dark:bg-white/10 rounded mb-6"></div>
              <div className="space-y-3 mt-auto">
                <div className="flex items-center gap-3 p-2 rounded border border-transparent hover:border-black/5 dark:hover:border-white/10 transition-colors">
                  <div className="w-5 h-5 rounded border border-gray-200 dark:border-white/20 flex items-center justify-center text-[10px] text-gray-400">A</div>
                  <div className="h-2 w-20 bg-gray-100 dark:bg-white/10 rounded"></div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded border border-green-500/20 bg-green-500/5">
                  <div className="w-5 h-5 rounded border border-green-500 bg-green-500 flex items-center justify-center">
                    <CheckIcon className="w-3 h-3 text-white" />
                  </div>
                  <div className="h-2 w-16 bg-gray-100 dark:bg-white/10 rounded"></div>
                </div>
              </div>
            </div>
            {/* Card 2 */}
            <div className="bg-white dark:bg-[#1e2025] p-5 rounded-xl border border-gray-200 dark:border-white/5 relative shadow-sm flex flex-col border-primary/50 dark:border-primary/50 ring-2 ring-primary/20">
              <div className="h-4 w-2/3 bg-gray-100 dark:bg-white/10 rounded mb-3"></div>
              <div className="h-4 w-1/2 bg-gray-100 dark:bg-white/10 rounded mb-6"></div>
              <div className="space-y-3 mt-auto">
                <div className="flex items-center gap-3 p-2 rounded border border-transparent hover:border-black/5 dark:hover:border-white/10 transition-colors">
                  <div className="w-5 h-5 rounded border border-gray-200 dark:border-white/20 flex items-center justify-center text-[10px] text-gray-400">A</div>
                  <div className="h-2 w-24 bg-gray-100 dark:bg-white/10 rounded"></div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded border border-transparent hover:border-black/5 dark:hover:border-white/10 transition-colors">
                  <div className="w-5 h-5 rounded border border-gray-200 dark:border-white/20 flex items-center justify-center text-[10px] text-gray-400">B</div>
                  <div className="h-2 w-12 bg-gray-100 dark:bg-white/10 rounded"></div>
                </div>
              </div>
              {/* Cursor */}
              <div className="absolute bottom-10 right-10 w-8 h-8 z-20">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-foreground drop-shadow-xl" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" fill="currentColor" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Footer Mock */}
          <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-100 dark:border-white/5">
            <div className="flex gap-2 items-center">
              <ClockIcon className="w-4 h-4 text-muted-foreground" />
              <div className="h-2 w-16 bg-gray-200 dark:bg-white/10 rounded"></div>
            </div>
            <div className="h-9 w-32 bg-primary rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-foreground uppercase tracking-wider">Launch Quiz</span>
            </div>
          </div>
        </div>
      )
    },
    {
      step: "03",
      title: "Host Live",
      content: "Project the session on the big screen. Students join via QR code—no app download needed. Watch engagement soar.",
      image: (
        <div className="w-full h-full bg-[#121212] dark:bg-[#000000] p-4 sm:p-6 rounded-xl border border-gray-800 flex flex-col relative overflow-hidden shadow-2xl select-none justify-center items-center">
          {/* Tablet/Browser Chrome */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-[#1e1e1e] flex items-center px-3 gap-2 border-b border-white/5 z-20">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]"></div>
            <div className="ml-4 flex-1 h-5 bg-black/40 rounded text-[10px] flex items-center justify-center px-2 text-gray-500 font-medium font-sans">app.dexter.com/host</div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-6 z-10 w-full relative">
            <h3 className="text-xl sm:text-2xl font-bold text-white font-heading text-center tracking-tight">Host Live Quiz Session</h3>

            {/* QR Code Mock */}
            <div className="bg-white p-3 rounded-2xl shadow-xl relative group cursor-pointer hover:scale-105 transition-transform duration-300">
              <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white relative">
                {/* QR Pattern Simulation */}
                <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-0.5 p-1">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div key={i} className={cn("rounded-[1px]",
                      // Make corners empty for the big squares
                      (i < 13 && i % 6 < 2) || (i < 2 && i % 6 > 3) || (i > 29 && i % 6 < 2)
                        ? "bg-transparent"
                        : Math.random() > 0.4 ? "bg-black" : "bg-transparent"
                    )}></div>
                  ))}
                </div>

                {/* 3 Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-[3.5px] border-black flex items-center justify-center rounded-md"><div className="w-3.5 h-3.5 bg-black rounded-[1px]"></div></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-[3.5px] border-black flex items-center justify-center rounded-md"><div className="w-3.5 h-3.5 bg-black rounded-[1px]"></div></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-[3.5px] border-black flex items-center justify-center rounded-md"><div className="w-3.5 h-3.5 bg-black rounded-[1px]"></div></div>

                {/* Center Logo */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1 shadow-sm">
                    <div className="w-full h-full bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      <div className="w-3 h-3 border-2 border-white rounded-[2px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] font-medium">Scan to Join</p>
              <div className="text-3xl sm:text-4xl font-bold text-white font-mono tracking-wider">884 - 291 - 557</div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-[#2C2C2E] rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              <span className="text-xs text-gray-300 font-medium">24 Participants Joined</span>
            </div>

            <button className="bg-[#3A3A3C] hover:bg-[#48484A] text-gray-200 text-xs font-medium px-6 py-2.5 rounded-lg transition-colors border border-gray-600/50 shadow-lg">
              End Session
            </button>
          </div>

          {/* Phone Overlay */}
          <div className="absolute bottom-4 right-4 w-[110px] sm:w-[130px] bg-[#F2F2F7] rounded-[1.75rem] border-4 border-gray-900 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden z-30 aspect-[9/18] flex flex-col items-center justify-center p-3 transform rotate-[-2deg] hover:rotate-0 transition-all duration-500 ease-out hover:scale-105 hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.6)]">
            {/* Dynamic Island */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-black rounded-full z-40"></div>

            <div className="flex flex-col items-center text-center w-full h-full justify-center">
              <div className="w-12 h-12 bg-[#34C759] rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/20">
                <CheckIcon className="w-6 h-6 text-white stroke-[3px]" />
              </div>
              <h4 className="font-bold text-gray-900 text-sm mb-1">You're In!</h4>
              <p className="text-[8px] text-gray-500 leading-tight px-1 font-medium">Waiting for the host to start the quiz...</p>
            </div>
          </div>
        </div>
      )
    },
    {
      step: "04",
      title: "Auto-Grade",
      content: "Instant results. Leaderboards update in real-time, and a full report is synced to your Google Sheet automatically.",
      image: (
        <div className="w-full h-full bg-[#121212] dark:bg-[#000000] p-4 sm:p-6 rounded-xl border border-gray-800 flex flex-col relative overflow-hidden shadow-2xl select-none">
          {/* Tablet/Browser Chrome */}
          <div className="h-8 bg-[#1e1e1e] rounded-t-lg flex items-center px-3 gap-2 mb-4 border-b border-white/5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
            <div className="ml-4 flex-1 h-5 bg-black/20 rounded text-[10px] flex items-center px-2 text-gray-500 truncate font-mono">app.dexter.com/results</div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-4 relative z-0">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-xl font-bold text-white font-heading">Quiz Results</h3>
                <p className="text-xs text-gray-400 mt-1">Automated Grading Complete!</p>
              </div>
              <div className="inline-flex items-center px-3 py-1.5 bg-blue-600/20 text-blue-400 text-xs rounded-md font-medium border border-blue-600/20 hover:bg-blue-600/30 transition-colors cursor-pointer">
                View Report
              </div>
            </div>

            {/* Sheet Card */}
            <div className="bg-white rounded-lg p-4 shadow-lg flex-1 overflow-hidden flex flex-col relative">
              {/* Floating Glow for effect */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-400/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center text-green-600">
                    <TableCellsIcon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-gray-800 text-sm">Google Sheet Integration</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center">
                  <div className="w-3 h-0.5 bg-gray-400 rounded-full"></div>
                </div>
              </div>

              {/* Table Header */}
              <div className="flex text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-2 px-1">
                <div className="w-1/3">Student</div>
                <div className="w-1/6 text-right">Score</div>
                <div className="w-1/6 text-right">Raw</div>
                <div className="w-1/6 text-right">Grade</div>
              </div>

              {/* Rows */}
              <div className="space-y-1">
                {[
                  { name: "Arjun Mehta", score: "96", pct: "480", grade: "A" },
                  { name: "Priya Sharma", score: "88", pct: "440", grade: "B+" },
                  { name: "Rohan Gupta", score: "92", pct: "460", grade: "A-" },
                  { name: "Ananya Reddy", score: "100", pct: "500", grade: "A+" },
                  { name: "Vikram Singh", score: "78", pct: "390", grade: "C+" },
                ].map((row, i) => (
                  <div key={i} className="flex text-[10px] text-gray-700 items-center py-2 border-b border-gray-50 last:border-0 px-1 hover:bg-gray-50 transition-colors rounded">
                    <div className="w-1/3 font-medium text-gray-900">{row.name}</div>
                    <div className="w-1/6 text-right font-mono">{row.score}%</div>
                    <div className="w-1/6 text-right text-gray-400">{row.pct}</div>
                    <div className={cn(
                      "w-1/6 text-right font-bold",
                      row.grade.startsWith('A') ? 'text-green-600' :
                        row.grade.startsWith('B') ? 'text-blue-600' : 'text-orange-500'
                    )}>{row.grade}</div>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-green-50 border border-green-100 rounded text-[8px] text-green-700 font-medium flex items-center gap-1">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div> Synced
                  </div>
                </div>
                <span className="text-[8px] text-gray-400">Last updated: Just now</span>
              </div>
            </div>
          </div>

          {/* Floating Phone Notification */}
          <div className="absolute bottom-6 right-6 w-32 sm:w-40 bg-white rounded-[1.5rem] border-4 border-gray-800 shadow-2xl overflow-hidden z-20 aspect-[9/18] flex flex-col items-center justify-center p-4 transform rotate-[-5deg] hover:rotate-0 transition-transform duration-300">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-3 bg-gray-800 rounded-b-lg"></div>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="mb-3 relative">
                <TrophyIcon className="w-8 h-8 text-yellow-500 drop-shadow-sm" />
                <div className="absolute -top-1 -right-1">
                  <div className="w-2 h-2 bg-yellow-300 rounded-full animate-ping"></div>
                </div>
              </div>
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mb-3 shadow-lg shadow-green-500/30">
                <CheckIcon className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-bold text-gray-900 text-[10px] mb-1 leading-tight">Results are in!</h4>
              <p className="text-[8px] text-gray-500 leading-tight">You placed 3rd!</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-white from-30% via-indigo-50/30 via-60% to-white dark:from-black dark:from-30% dark:via-[#08080a] dark:via-60% dark:to-black transition-colors duration-300">
      {/* Hero Section */}
      <HeroGeometric
        title1="Turn content into"
        title2="Interactive Quizzes"
        description="Upload PDFs, PPTs, or web links. We generate the questions. You host the live session. Instant grading, real-time leaderboards, and seamless sync."
      >
        <Link to="/signup">
          <Button variant="primary" size="lg" className="min-w-[180px] shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
            Start for free
          </Button>
        </Link>
        <Link to="/login">
          <Button variant="outline" size="lg" className="min-w-[180px] border-black/10 dark:border-white/20 text-foreground hover:bg-black/5 dark:hover:bg-white/10 bg-transparent">
            View Demo
          </Button>
        </Link>
      </HeroGeometric>

      {/* Visual Section - Replaced with ContainerScroll */}
      <section className="bg-transparent -mt-1 relative z-20 overflow-hidden">
        <div className="w-full">
          <ContainerScroll
            titleComponent={
              <div className="flex flex-col items-center gap-4 mb-10">
                <h2 className="text-4xl md:text-7xl font-bold font-heading text-black dark:text-white leading-none">
                  Manage quizzes <br />
                  <span className="text-indigo-500">at warp speed</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                  Experience the dashboard that puts you in control.
                </p>
              </div>
            }
            children={
              <img
                src={macbookScroll}
                alt="Macbook Scroll"
                className="mx-auto rounded-2xl object-fit h-full object-left-top"
                draggable={false}
              />
            }
          />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-transparent transition-colors" ref={featuresRef}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight mb-4 font-heading text-foreground">Streamline your classroom workflow</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              From source material to gradebook in minutes. No more manual data entry.
            </p>
          </div>

          <div className="features-grid grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<DocumentTextIcon className="w-6 h-6" />}
              title="Instant Extraction"
              description="Upload any PDF, PPT, or paste a URL. Our AI extracts key concepts and generates relevant questions instantly."
            />
            <FeatureCard
              icon={<QrCodeIcon className="w-6 h-6" />}
              title="Frictionless Joining"
              description="No app download required. Students scan a QR code or click a link to join the session from any device."
            />
            <FeatureCard
              icon={<TrophyIcon className="w-6 h-6" />}
              title="Live Leaderboards"
              description="Gamify learning with real-time scoring. Keep engagement high with competitive streaks and instant feedback."
            />
            <FeatureCard
              icon={<TableCellsIcon className="w-6 h-6" />}
              title="Google Sheets Sync"
              description="Automatically export participation data and grades directly to your Google Sheets gradebook."
            />
          </div>
        </div>
      </section>

      {/* How it works - UPDATED */}
      <section id="how-it-works" className="relative bg-white/50 dark:bg-black/50 border-t border-b border-black/5 dark:border-white/5 backdrop-blur-sm" ref={howItWorksRef}>
        <div className="container mx-auto px-4 md:px-6">
          <FeatureSteps
            title="Designed for the modern educator"
            features={features}
          />
        </div>
      </section>

      {/* Testimonials Section */}
      <Testimonials />

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-transparent transition-colors" ref={pricingRef}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight font-heading text-foreground">Simple, transparent pricing</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
            <div className="squishy-card">
              <SquishyCard
                title="Basic"
                price="₹0"
                colorClass="bg-slate-900"
                features={['Up to 50 participants', 'PDF Uploads only', 'Basic Reporting', 'Email Support']}
              />
            </div>
            <div className="squishy-card">
              <SquishyCard
                title="Pro"
                price="₹1499"
                isPopular
                colorClass="bg-indigo-500"
                features={['Unlimited participants', 'Web & PPT Support', 'Google Sheets Sync', 'Priority Support', 'Custom Branding']}
              />
            </div>
            <div className="squishy-card">
              <SquishyCard
                title="Institution"
                price="Custom"
                colorClass="bg-rose-500"
                features={['SSO Integration', 'LMS Integration', 'Admin Dashboard', 'Dedicated Success Manager', 'District-wide Analytics']}
                buttonText="Contact Sales"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden h-[500px] flex items-center justify-center bg-black">
        <div className="absolute inset-0 z-0">
          <ShaderAnimation />
        </div>
        <div className="container mx-auto px-4 md:px-6 text-center relative z-10 pointer-events-none">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white tracking-tight drop-shadow-lg font-heading">
            Ready to transform your classroom?
          </h2>
          <p className="text-gray-200 max-w-xl mx-auto mb-10 text-lg drop-shadow">
            Join thousands of educators saving time and boosting engagement today.
          </p>
          <div className="pointer-events-auto">
            <Link to="/signup">
              <Button variant="glow" size="lg" className="transform transition-transform hover:scale-105">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <ChatBot />
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="feature-card group p-6 rounded-3xl bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-black/5 transition-all duration-300">
    <div className="w-12 h-12 rounded-xl bg-[#F4F4F5] dark:bg-white/10 flex items-center justify-center text-black dark:text-white mb-6 group-hover:scale-110 transition-transform duration-300">
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 stroke-[1.5]" })}
    </div>
    <h3 className="font-bold text-lg mb-3 font-heading text-gray-900 dark:text-white tracking-tight">{title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{description}</p>
  </div>
);

export default LandingPage;