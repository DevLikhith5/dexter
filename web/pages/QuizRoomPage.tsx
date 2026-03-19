import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { quizService } from '../services/api/quiz/quizService';

interface Question {
    id: number;
    content: string;
    options: string[];
    points: number;
}

const QuizRoomPage = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { sendMessage, isConnected, subscribe } = useWebSocket();
    const { user } = useAuth();

    const [status, setStatus] = useState<'waiting' | 'playing' | 'feedback' | 'finished'>('waiting');
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string; explanation?: string } | null>(null);
    const [participantCount, setParticipantCount] = useState(0);

    const [leaderboard, setLeaderboard] = useState<{ userId: string; score: number; userName?: string }[]>([]);

    const location = useLocation();
    const [isHost, setIsHost] = useState(location.state?.isHost || false);
    const [sheetId, setSheetId] = useState("");
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

    const startQuiz = () => {
        sendMessage('start_quiz', { sessionId });
    };

    const nextQuestion = () => {
        sendMessage('next_question', { sessionId });
    };

    useEffect(() => {
        if (isConnected && sessionId && user) {
            // Check if we need to join (e.g. if we are Host coming from creation, or refresh)
            // Just always send join_quiz to be safe, backend handles idempotency? 
            // Better: only if not joined? But how to track?
            // Simple approach: Send join on connect.
            sendMessage('join_quiz', { sessionId, userId: user.id.toString(), userName: user.username });
        }
    }, [isConnected, sessionId, user]);

    useEffect(() => {
        const unsubscribe = subscribe((message: any) => {
            if (message.type === 'joined_quiz') {
                setParticipantCount(message.payload.participantCount);
                if (message.payload.isHost !== undefined) {
                    setIsHost(message.payload.isHost);
                }

                if (message.payload.currentQuestion) {
                    setStatus('playing');
                    setCurrentQuestion(message.payload.currentQuestion);
                    if (message.payload.currentQuestionIndex !== undefined) {
                        setQuestionIndex(message.payload.currentQuestionIndex);
                    }
                    setTimeLeft(30); // Default to 30 for late joiners for now
                } else {
                    setStatus('waiting');
                }
            }
            else if (message.type === 'participant_joined') {
                setParticipantCount(message.payload.participantCount);
            }
            else if (message.type === 'participant_left') {
                setParticipantCount(message.payload.participantCount);
            }
            else if (message.type === 'quiz_started') {
                setStatus('playing');
                setTotalQuestions(message.payload.totalQuestions);
            }
            else if (message.type === 'next_question') {
                setStatus('playing');
                setCurrentQuestion(message.payload.question);
                setQuestionIndex(message.payload.currentQuestionIndex);
                setSelectedOption(null);
                setFeedback(null);
                setTimeLeft(30); // Reset timer. Optionally, backend sends timer
            }
            else if (message.type === 'answer_submitted') {
                setStatus('feedback');
                setFeedback({
                    isCorrect: message.payload.isCorrect,
                    message: message.payload.message,
                    explanation: message.payload.explanation
                });
                setScore(message.payload.newScore);
            }
            else if (message.type === 'quiz_finished') {
                setStatus('finished');
            }
            else if (message.type === 'scores_update') {
                setLeaderboard(message.payload.scores);
            }
        });

        return () => unsubscribe();
    }, [subscribe]);

    useEffect(() => {
        let timerId: NodeJS.Timeout;
        if (status === 'playing' && timeLeft !== null && timeLeft > 0) {
            timerId = setTimeout(() => setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0)), 1000);
        } else if (timeLeft === 0 && status === 'playing' && !isHost && !selectedOption) {
            // Auto-submit empty or wrong answer if time runs out? 
            // Left to backend timer enforcement for now.
        }
        return () => {
            if (timerId) clearTimeout(timerId);
        }
    }, [timeLeft, status, isHost, selectedOption]);

    const submitAnswer = () => {
        if (!selectedOption || !currentQuestion || !user) return;

        sendMessage('submit_answer', {
            sessionId,
            userId: user.id.toString(),
            questionId: currentQuestion.id,
            answer: selectedOption
        });
    };

    const handleSyncToSheets = async () => {
        if (!sessionId || !sheetId) return;
        setSyncStatus('syncing');
        try {
            await quizService.syncGoogleSheets(sessionId, sheetId);
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } catch (error) {
            console.error(error);
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
        }
    };

    if (!sessionId) return <div>Invalid Session</div>;

    return (
        <div className="h-screen bg-gray-50 dark:bg-[#0a0a0b] text-foreground flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-white/5 border-b border-gray-200 dark:border-white/10 px-6 py-4 flex justify-between items-center">
                <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Room Code</span>
                    <p className="text-lg font-bold font-mono text-primary">{sessionId}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs text-muted-foreground">Score</div>
                        <div className="font-bold text-xl">{score}</div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-medium">
                        {participantCount} Players
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 p-6 overflow-hidden">
                <div className={cn(
                    "h-full mx-auto flex flex-col",
                    (status === 'playing' || status === 'feedback') ? "max-w-[1400px]" : "max-w-4xl items-center justify-center text-center"
                )}>


                    {/* Waiting State */}
                    {status === 'waiting' && (
                        <div className="text-center py-20">
                            <div className="animate-bounce mb-8 text-6xl">⏳</div>
                            <h2 className="text-3xl font-bold mb-4 font-heading">{isHost ? "You are the Host!" : "Waiting for host to start..."}</h2>
                            <p className="text-muted-foreground text-lg mb-8">{isHost ? "Wait for players to join, then start the quiz." : "You are joined! Sit tight."}</p>

                            {isHost && (
                                <div className="flex flex-col items-center gap-8">
                                    <div className="bg-white p-4 rounded-2xl shadow-xl inline-block border border-gray-100">
                                        <QRCodeSVG 
                                            value={`${window.location.origin}/#/join?code=${sessionId}`}
                                            size={200}
                                            level="H"
                                            includeMargin={true}
                                        />
                                        <p className="mt-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Scan to Join</p>
                                    </div>

                                    <Button
                                        size="lg"
                                        className="px-8 py-4 text-lg rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                                        onClick={startQuiz}
                                    >
                                        Start Quiz Now 🚀
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Playing/Feedback State (70/30 Layout) */}
                    {(status === 'playing' || status === 'feedback') && currentQuestion && (
                        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 h-full">
                            {/* Left: Questions & Options (70%) */}
                            <div className="lg:col-span-7 space-y-6 overflow-y-auto pr-4 pb-12 custom-scrollbar">
                                <div className="bg-white dark:bg-[#1e2025] p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                                            Question {questionIndex + 1} of {totalQuestions || '...'}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold font-heading leading-tight">{currentQuestion.content}</h2>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {currentQuestion.options.map((option, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => !isHost && status === 'playing' && setSelectedOption(option)}
                                            disabled={isHost || status !== 'playing'}
                                            className={cn(
                                                "p-6 rounded-2xl border-2 text-left transition-all duration-300 relative overflow-hidden group flex items-center gap-4",
                                                selectedOption === option
                                                    ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]"
                                                    : "border-gray-200 dark:border-white/5 bg-white dark:bg-[#1e2025] hover:border-primary/30",
                                                status === 'feedback' && option === selectedOption
                                                    ? (feedback?.isCorrect ? "border-green-500 bg-green-500/5" : "border-red-500 bg-red-500/5")
                                                    : ""
                                            )}
                                        >
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors",
                                                selectedOption === option ? "bg-primary text-white" : "bg-gray-100 dark:bg-white/5 text-muted-foreground"
                                            )}>
                                                {String.fromCharCode(65 + idx)}
                                            </div>
                                            <span className="text-lg font-medium">{option}</span>
                                        </button>
                                    ))}
                                </div>

                                {status === 'playing' && !isHost && (
                                    <div className="flex justify-center pt-4">
                                        <Button
                                            size="lg"
                                            className="px-12 py-6 text-xl rounded-2xl shadow-xl shadow-primary/20"
                                            disabled={!selectedOption}
                                            onClick={submitAnswer}
                                        >
                                            Submit Answer
                                        </Button>
                                    </div>
                                )}

                                {status === 'feedback' && feedback && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn(
                                            "p-8 rounded-3xl border shadow-sm",
                                            feedback.isCorrect
                                                ? "bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-800/30"
                                                : "bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-800/30"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold",
                                                feedback.isCorrect ? "bg-green-500" : "bg-red-500"
                                            )}>
                                                {feedback.isCorrect ? "✓" : "✗"}
                                            </div>
                                            <h3 className={cn(
                                                "text-2xl font-bold",
                                                feedback.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                                            )}>
                                                {feedback.isCorrect ? "Brilliant!" : "Not quite!"}
                                            </h3>
                                        </div>
                                        <p className="text-foreground/80 text-lg mb-6">{feedback.message}</p>
                                        {feedback.explanation && (
                                            <div className="bg-white/40 dark:bg-black/20 p-6 rounded-2xl border border-black/5 dark:border-white/5">
                                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-2 opacity-50">Deep Dive</p>
                                                <p className="text-sm leading-relaxed">{feedback.explanation}</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            {/* Right Sidebar: Timer & Leaderboard (30%) */}
                            <div className="lg:col-span-3 space-y-6 flex flex-col h-full">
                                {/* Timer Card */}
                                <div className="bg-white dark:bg-[#1e2025] p-6 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm text-center">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 opacity-50">Time Remaining</p>
                                    <div className="relative inline-block">
                                        <div className={cn(
                                            "text-5xl font-black font-mono tracking-tighter transition-colors",
                                            (timeLeft || 0) > 10 ? "text-primary" : "text-red-500 animate-pulse"
                                        )}>
                                            {timeLeft}s
                                        </div>
                                        <div className="absolute -inset-4 bg-primary/5 rounded-full blur-2xl -z-10" />
                                    </div>
                                </div>

                                {/* Leaderboard Card */}
                                <div className="bg-white dark:bg-[#1e2025] p-6 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm flex-1 flex flex-col min-h-0">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground opacity-50">Scoreboard</h4>
                                        <div className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold">LIVE</div>
                                    </div>
                                    <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                                        {leaderboard.length > 0 ? (
                                            leaderboard
                                                .sort((a, b) => b.score - a.score)
                                                .map((entry, idx) => (
                                                    <div
                                                        key={entry.userId}
                                                        className={cn(
                                                            "flex justify-between items-center p-4 rounded-2xl transition-all duration-300",
                                                            entry.userId === user?.id.toString() 
                                                                ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                                                                : "bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold",
                                                                entry.userId === user?.id.toString() ? "bg-white text-primary" : "bg-gray-200 dark:bg-white/10 text-muted-foreground"
                                                            )}>
                                                                {idx + 1}
                                                            </div>
                                                            <span className="font-medium text-sm truncate max-w-[120px]">
                                                                {entry.userName || "Player"}
                                                            </span>
                                                        </div>
                                                        <span className="font-bold text-sm tracking-tight">{entry.score}</span>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="text-center py-10 text-muted-foreground text-sm italic">
                                                No scores yet...
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Persistent Controls */}
                                <div className="space-y-4">
                                    {isHost && (
                                        <Button
                                            onClick={nextQuestion}
                                            className="w-full py-4 rounded-2xl shadow-xl shadow-primary/20 bg-primary text-primary-foreground font-bold"
                                        >
                                            Next Question →
                                        </Button>
                                    )}
                                    {!isHost && status === 'feedback' && (
                                        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center">
                                            <p className="text-xs font-medium text-primary animate-pulse italic">
                                                Wait for host to proceed...
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Finished State */}
                    {status === 'finished' && (
                        <div className="w-full max-w-2xl mx-auto py-12">
                            <div className="text-center bg-white dark:bg-[#1e2025] rounded-3xl border border-gray-200 dark:border-white/10 p-10 shadow-xl mb-8">
                                <div className="text-6xl mb-6">🏆</div>
                                <h2 className="text-4xl font-bold mb-4 font-heading">Quiz Completed!</h2>
                                {!isHost && (
                                    <div className="bg-primary/5 rounded-2xl p-6 inline-block mb-8 border border-primary/20">
                                        <p className="text-sm font-bold text-primary uppercase tracking-widest mb-1">Your Final Score</p>
                                        <p className="text-5xl text-primary font-black font-mono">{score}</p>
                                    </div>
                                )}
                                
                                <div className="text-left mb-8">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">🎯</div>
                                        Final Leaderboard
                                    </h3>
                                    <div className="space-y-3">
                                        {leaderboard.length > 0 ? (
                                            leaderboard
                                                .sort((a, b) => b.score - a.score)
                                                .map((entry, idx) => (
                                                    <div
                                                        key={entry.userId}
                                                        className={cn(
                                                            "flex justify-between items-center p-4 rounded-2xl transition-all",
                                                            entry.userId === user?.id.toString() 
                                                                ? "bg-primary text-white shadow-lg" 
                                                                : "bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={cn(
                                                                "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                                                                idx === 0 ? "bg-yellow-400 text-white text-xl shadow-lg shadow-yellow-400/20" :
                                                                idx === 1 ? "bg-gray-300 text-gray-700 text-xl shadow-lg shadow-gray-400/20" :
                                                                idx === 2 ? "bg-amber-600 text-white text-xl shadow-lg shadow-amber-600/20" :
                                                                entry.userId === user?.id.toString() ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-white/10 text-muted-foreground"
                                                            )}>
                                                                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                                                            </div>
                                                            <span className="font-bold text-lg">{entry.userName || "Player"}</span>
                                                        </div>
                                                        <span className="font-black text-2xl font-mono">{entry.score}</span>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="text-center py-6 text-muted-foreground italic bg-gray-50 dark:bg-white/5 rounded-2xl">
                                                No scores recorded.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Button size="lg" className="w-full py-4 text-lg rounded-xl" onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
                            </div>
                            
                            {isHost && (
                                <div className="bg-white dark:bg-[#1e2025] rounded-3xl border border-gray-200 dark:border-white/10 p-8 shadow-sm">
                                    <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
                                        <svg className="w-6 h-6 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                                        Google Sheets Sync
                                    </h3>
                                    <p className="text-muted-foreground mb-6 text-sm">Export the final leaderboard directly to your Google Sheet. Make sure you entered a valid Sheet ID.</p>
                                    
                                    <div className="flex flex-col gap-4">
                                        <input
                                            type="text"
                                            placeholder="Enter Google Sheet ID"
                                            value={sheetId}
                                            onChange={(e) => setSheetId(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                                        />
                                        <Button 
                                            onClick={handleSyncToSheets} 
                                            disabled={!sheetId || syncStatus === 'syncing'}
                                            className="w-full py-4 rounded-xl bg-[#0f9d58] hover:bg-[#0b8043] text-white shadow-lg shadow-green-500/20 font-bold flex items-center justify-center gap-2"
                                        >
                                            {syncStatus === 'syncing' ? 'Syncing...' : 
                                             syncStatus === 'success' ? '✓ Synced Successfully!' : 
                                             syncStatus === 'error' ? '❌ Sync Failed' : 
                                             'Sync to Google Sheets'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default QuizRoomPage;
