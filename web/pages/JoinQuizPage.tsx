import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import { Logo } from '../components/Logo';
import { ElegantShape } from '../components/ui/shape-landing-hero';
import { cn } from '../lib/utils';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { XIcon, CameraIcon } from 'lucide-react';

const JoinQuizPage = () => {
    const [sessionId, setSessionId] = useState('');
    const [error, setError] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { sendMessage, isConnected, subscribe } = useWebSocket();
    const { user } = useAuth();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        if (code) {
            setSessionId(code);
        }
    }, [location.search]);

    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        if (showScanner) {
            scanner = new Html5QrcodeScanner('reader', { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            }, false);

            scanner.render((decodedText: string) => {
                // Handle scanned link or raw code
                try {
                    const url = new URL(decodedText);
                    const code = url.searchParams.get('code');
                    if (code) {
                        setSessionId(code);
                        setShowScanner(false);
                        scanner?.clear();
                    }
                } catch (e) {
                    // Not a URL, try as raw code
                    setSessionId(decodedText);
                    setShowScanner(false);
                    scanner?.clear();
                }
            }, (err: any) => {
                // Silently ignore scan errors
            });
        }
        return () => {
            if (scanner) {
                scanner.clear().catch(e => console.error("Scanner cleanup error", e));
            }
        };
    }, [showScanner]);

    useEffect(() => {
        const unsubscribe = subscribe((message: any) => {
            if (message.type === 'joined_quiz') {
                setIsJoining(false);
                navigate(`/dashboard/quiz/${message.payload.sessionId}`);
            } else if (message.type === 'error') {
                setIsJoining(false);
                setError(message.payload.message || 'Failed to join quiz');
            }
        });
        return unsubscribe;
    }, [subscribe, navigate]);

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!sessionId.trim()) {
            setError('Please enter a valid Room Code');
            return;
        }

        if (!isConnected) {
            setError('Connection lost. Reconnecting...');
            return;
        }

        if (!user) {
            setError('You must be logged in to join a quiz.');
            return;
        }

        setIsJoining(true);
        sendMessage('join_quiz', {
            sessionId: sessionId.trim(),
            userId: user.id.toString(),
            userName: user.username,
        });
    };

    const fadeUpVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.8,
                delay: 0.2 + i * 0.1,
                ease: [0.25, 0.4, 0.25, 1],
            },
        }),
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-black transition-colors duration-300">
            {/* Premium Background Shapes */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.05] via-transparent to-rose-500/[0.05] blur-3xl" />
            
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <ElegantShape
                    delay={0.3}
                    width={600}
                    height={140}
                    rotate={12}
                    gradient="from-indigo-500/[0.08]"
                    className="left-[-10%] top-[15%]"
                />
                <ElegantShape
                    delay={0.5}
                    width={500}
                    height={120}
                    rotate={-15}
                    gradient="from-rose-500/[0.08]"
                    className="right-[-5%] top-[70%]"
                />
                <ElegantShape
                        delay={0.4}
                        width={300}
                        height={80}
                        rotate={-8}
                        gradient="from-violet-500/[0.08]"
                        className="left-[5%] bottom-[5%]"
                    />
            </div>

            <div className="relative z-10 w-full max-w-md px-4">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeUpVariants}
                    custom={0}
                    className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] border border-black/[0.05] dark:border-white/10"
                >
                    <div className="flex flex-col items-center mb-10">
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="p-3 bg-primary/10 rounded-2xl mb-6"
                        >
                            <Logo className="w-10 h-10 text-primary" />
                        </motion.div>
                        <h1 className="text-3xl font-bold text-foreground font-heading tracking-tight">Join a Quiz</h1>
                        <p className="text-muted-foreground mt-3 text-center font-light">
                            Ready to show what you know? <br />
                            Enter your <span className="text-primary font-medium">Room Code</span> below.
                        </p>
                    </div>

                    <form onSubmit={handleJoin} className="space-y-8">
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm text-center"
                            >
                                {error}
                            </motion.div>
                        )}

                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                                Room Code
                            </label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={sessionId}
                                    onChange={(e) => setSessionId(e.target.value)}
                                    placeholder="abcd-1234"
                                    autoFocus
                                    className="w-full text-center text-2xl font-mono tracking-[0.2em] bg-gray-50/50 dark:bg-black/40 border-2 border-transparent group-hover:border-primary/20 focus:border-primary/50 focus:bg-white dark:focus:bg-black rounded-2xl px-4 py-5 text-foreground outline-none transition-all duration-300 shadow-inner"
                                />
                                <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
                            </div>
                        </div>

                        <Button
                            fullWidth
                            size="lg"
                            type="submit"
                            disabled={isJoining || !isConnected}
                            className="rounded-2xl py-7 text-xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 active:scale-[0.98]"
                        >
                            {isJoining ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Joining...</span>
                                </div>
                            ) : 'Enter Arena'}
                        </Button>

                        <div className="flex flex-col items-center gap-4 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowScanner(true)}
                                className="flex items-center gap-2 text-primary font-medium hover:opacity-80 transition-opacity"
                            >
                                <CameraIcon className="w-4 h-4" />
                                <span>Scan QR Code</span>
                            </button>
                             <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </form>
                </motion.div>

                {/* QR Scanner Modal */}
                <AnimatePresence>
                    {showScanner && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
                        >
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden relative shadow-2xl border border-white/10">
                                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                                    <h3 className="text-xl font-bold">Scan QR Code</h3>
                                    <button 
                                        onClick={() => setShowScanner(false)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                                    >
                                        <XIcon className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="p-4">
                                    <div id="reader" className="w-full rounded-2xl overflow-hidden border-2 border-dashed border-primary/20" />
                                </div>
                                <div className="p-6 text-center text-sm text-muted-foreground">
                                    Point your camera at the host's screen QR code
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-center text-xs text-muted-foreground/60 mt-8 font-light"
                >
                    Dexter Real-time Quiz System v2.0
                </motion.p> */}
            </div>

            {/* Bottom Glow */}
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-30 pointer-events-none" />
        </div>
    );
};

export default JoinQuizPage;
