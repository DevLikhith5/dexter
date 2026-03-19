import React, { useState, useEffect } from "react";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "../components/ui/sidebar";
import { Link, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import Button from "../components/Button";
import { Logo } from "../components/Logo";
import { useTheme } from "../components/ThemeContext";
import CreateQuizPage from "./CreateQuizPage";
import CalendarPage from "./CalendarPage";
import { useAuth } from "../contexts/AuthContext";
import { quizService } from "../services/api/quiz/quizService";
import { authService } from "../services/api/auth/authService";
import { Quiz } from "../types";
import {
    HomeIcon,
    UserIcon,
    CogIcon,
    LogoutIcon,
    DocumentTextIcon,
    ChartPieIcon,
    PlusIcon,
    TableCellsIcon,
    CheckIcon,
    TrophyIcon,
    Bars3Icon,
    MagnifyingGlassIcon,
    EllipsisHorizontalIcon,
    TrashIcon,
    PencilIcon,
    ArrowRightIcon,
    FilterIcon,
    CalendarIcon,
    ArrowsRightLeftIcon,
    CreditCardIcon
} from "../components/Icons";

export const DashboardPage = () => {
    const { logout } = useAuth();
    const links = [
        {
            label: "Dashboard",
            href: "/dashboard",
            icon: <HomeIcon className="h-5 w-5 flex-shrink-0" />,
        },
        {
            label: "Calendar",
            href: "/dashboard/calendar",
            icon: <CalendarIcon className="h-5 w-5 flex-shrink-0" />,
        },
        {
            label: "My Quizzes",
            href: "/dashboard/quizzes",
            icon: <DocumentTextIcon className="h-5 w-5 flex-shrink-0" />,
        },
        {
            label: "Reports",
            href: "/dashboard/reports",
            icon: <ChartPieIcon className="h-5 w-5 flex-shrink-0" />,
        },
        {
            label: "Profile",
            href: "/dashboard/profile",
            icon: <UserIcon className="h-5 w-5 flex-shrink-0" />,
        },
        {
            label: "Settings",
            href: "/dashboard/settings",
            icon: <CogIcon className="h-5 w-5 flex-shrink-0" />,
        },
        {
            label: "Logout",
            href: "/",
            icon: <LogoutIcon className="h-5 w-5 flex-shrink-0" />,
            onClick: logout
        },
    ];
    const [open, setOpen] = useState(false);

    return (

        <div className="flex flex-col md:flex-row h-screen w-full bg-[#f4f5f7] dark:bg-black overflow-hidden transition-colors duration-300">

            {/* Sidebar Container: Square, flush left */}
            <div className={cn(
                "hidden md:flex flex-col flex-shrink-0 h-full",
                "bg-[#f4f5f7] dark:bg-black rounded-none",
                "overflow-hidden relative z-20",
                "transition-all duration-300 ease-in-out"
            )}>
                <Sidebar open={open} setOpen={setOpen}>
                    <SidebarBody className="justify-between gap-10 py-6 h-full px-4">
                        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
                            <div className="mb-8 px-2">
                                {open ? <LogoHeader /> : <LogoIcon />}
                            </div>
                            <div className="flex flex-col gap-2">
                                {links.map((link, idx) => (
                                    <SidebarLink key={idx} link={link} onClick={link.onClick} />
                                ))}
                            </div>
                        </div>
                        <div>
                            <UsageCard />
                            <UserAccount />
                        </div>
                    </SidebarBody>
                </Sidebar>
            </div>

            {/* Mobile Sidebar Header */}
            <div className="md:hidden flex items-center justify-between px-4 py-2 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-white/5">
                <LogoIcon />
                <button onClick={() => setOpen(!open)}>
                    <Bars3Icon className="w-6 h-6 text-foreground" />
                </button>
            </div>

            {/* Mobile Sidebar Modal */}
            {open && (
                <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
                    <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-[#0A0A0A] p-4 flex flex-col" onClick={e => e.stopPropagation()}>
                        <Sidebar open={true} setOpen={setOpen}>
                            <SidebarBody className="justify-between gap-10 h-full">
                                <div className="flex flex-col flex-1">
                                    <div className="mb-8 px-2 flex justify-between items-center">
                                        <LogoHeader />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {links.map((link, idx) => (
                                            <SidebarLink key={idx} link={link} onClick={link.onClick} />
                                        ))}
                                    </div>
                                </div>
                            </SidebarBody>
                        </Sidebar>
                    </div>
                </div>
            )}

            {/* Main Content: Rounded Top Left only, White background */}
            <div className={cn(
                "flex flex-1 flex-col overflow-y-auto h-full relative z-10",
                "bg-white dark:bg-[#0A0A0A] md:rounded-tl-[40px] rounded-none",
                "border-l border-t border-gray-200/50 dark:border-white/5",
                "shadow-2xl shadow-black/5 dark:shadow-black/50"
            )}>
                <div className="relative z-10 h-full overflow-y-auto">
                    <Routes>
                        <Route path="/" element={<DashboardHome />} />
                        <Route path="/create" element={<CreateQuizPage />} />
                        <Route path="/calendar" element={<CalendarPage />} />
                        <Route path="/quizzes" element={<MyQuizzes />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/settings" element={<Settings />} />
                    </Routes>
                </div>
            </div>
        </div>
    );
};

const LogoHeader = () => {
    return (
        <Link to="/dashboard" className="flex space-x-3 items-center relative z-20">
            <Logo className="h-8 w-8 flex-shrink-0" />
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-bold text-xl text-foreground font-heading tracking-tight"
            >
                Dexter
            </motion.span>
        </Link>
    );
};

const LogoIcon = () => {
    return (
        <Link to="/dashboard" className="flex space-x-2 items-center relative z-20 justify-center">
            <Logo className="h-8 w-8 flex-shrink-0" />
        </Link>
    );
};


const DashboardHome = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalQuizzes: 0,
        activeQuizzes: 0,
        totalStudents: 0,
        averageScore: 0,
        completionRate: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const data = await quizService.getDashboardStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to load dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, []);

    return (
        <div className="p-6 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground font-heading">Dashboard</h1>
                    <p className="text-muted-foreground">Overview of your activity and performance.</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="gap-2 hidden sm:flex"
                        onClick={() => navigate('/join')}
                    >
                        Join a Quiz
                    </Button>
                    <Button
                        variant="secondary"
                        className="gap-2 hidden sm:flex"
                        onClick={() => navigate('/dashboard/host')}
                    >
                        Host a Quiz
                    </Button>
                    <Button
                        variant="primary"
                        className="gap-2 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-105 active:scale-95"
                        onClick={() => navigate('/dashboard/create')}
                    >
                        <PlusIcon className="w-4 h-4" />
                        Create New Quiz
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard 
                    title="Active Quizzes" 
                    value={loading ? "..." : stats.activeQuizzes.toString()} 
                    icon={<DocumentTextIcon className="w-5 h-5" />} 
                    trend={loading ? "..." : `${stats.totalQuizzes} total`} 
                />
                <StatCard 
                    title="Total Students" 
                    value={loading ? "..." : stats.totalStudents.toString()} 
                    icon={<UserIcon className="w-5 h-5" />} 
                    trend={loading ? "..." : "from your quizzes"} 
                />
                <StatCard 
                    title="Completion Rate" 
                    value={loading ? "..." : `${stats.completionRate}%`} 
                    icon={<CheckIcon className="w-5 h-5" />} 
                    trend={loading ? "..." : "estimate"} 
                />
                <StatCard 
                    title="Avg. Score" 
                    value={loading ? "..." : `${stats.averageScore}%`} 
                    icon={<TrophyIcon className="w-5 h-5" />} 
                    trend={loading ? "..." : "overall"} 
                />
            </div>

            {/* Recent Activity */}
            <div className="flex flex-col gap-5 flex-1">
                <div className="flex justify-between items-end">
                    <h2 className="text-xl font-bold text-foreground font-heading">Recent Quizzes</h2>
                    <Link to="/dashboard/quizzes" className="text-sm font-medium text-primary hover:underline flex items-center gap-1 group">
                        View all <ArrowRightIcon className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                <div className="flex flex-col gap-3">
                    <p className="text-muted-foreground text-sm">Real recent quizzes fetched via API (coming soon). Check the 'My Quizzes' tab for comprehensive lists.</p>
                </div>
            </div>
        </div>
    );
};

const QuizResultsModal = ({ 
    isOpen, 
    onClose, 
    quiz 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    quiz: any 
}) => {
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sheetId, setSheetId] = useState("");
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (isOpen && quiz) {
            setSheetId(quiz?.settings?.googleSheetId || "");
            fetchResults();
        }
    }, [isOpen, quiz]);

    const fetchResults = async () => {
        setIsLoading(true);
        try {
            const data = await quizService.getQuizResults(quiz.id);
            setResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        if (!sheetId) return;
        setSyncStatus('syncing');
        setErrorMsg('');
        try {
            await quizService.syncQuizResults(quiz.id, sheetId);
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } catch (error: any) {
            console.error(error);
            setErrorMsg(error.message || 'Sync failed.');
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 6000);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#15171a] border border-gray-200 dark:border-white/10 rounded-3xl p-8 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl relative flex flex-col">
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors bg-gray-100 dark:bg-white/5 p-2 rounded-full">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <div className="flex-shrink-0 mb-6 pr-10">
                    <h2 className="text-2xl font-bold font-heading mb-1 text-foreground">Results: {quiz.title}</h2>
                    <p className="text-muted-foreground text-sm">Historical leaderboard of all participants who completed this quiz.</p>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-6 space-y-6">
                    <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 border border-gray-100 dark:border-white/5">
                        <h3 className="font-bold mb-3 flex items-center gap-2 text-foreground">
                            <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                            Google Sheets Sync
                        </h3>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                placeholder="Enter Google Sheet ID"
                                value={sheetId}
                                onChange={(e) => setSheetId(e.target.value)}
                                className="flex-1 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono transition-all"
                            />
                            <Button 
                                onClick={handleSync} 
                                disabled={!sheetId || syncStatus === 'syncing' || results.length === 0}
                                className="bg-[#0f9d58] hover:bg-[#0b8043] text-white whitespace-nowrap shadow-sm sm:w-auto w-full"
                            >
                                {syncStatus === 'syncing' ? 'Syncing...' : 
                                 syncStatus === 'success' ? 'Synced Successfully!' : 'Export to Sheets'}
                            </Button>
                        </div>
                        {syncStatus === 'error' && <p className="text-red-500 text-xs mt-3 font-medium">{errorMsg}</p>}
                    </div>

                    <div>
                        <h3 className="font-bold text-lg mb-4 text-foreground">Leaderboard <span className="text-sm font-normal text-muted-foreground bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full ml-2">{results.length} attempts</span></h3>
                        <div className="space-y-3">
                            {isLoading ? (
                                <div className="text-center text-muted-foreground py-12 animate-pulse">Loading results...</div>
                            ) : results.length > 0 ? (
                                results.map((entry, idx) => (
                                    <div key={`${entry.userId}-${idx}`} className="flex justify-between items-center bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-4 rounded-xl hover:border-gray-200 dark:hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm",
                                                idx === 0 ? "bg-yellow-400 text-white" :
                                                idx === 1 ? "bg-gray-300 text-gray-700" :
                                                idx === 2 ? "bg-amber-600 text-white" :
                                                "bg-white dark:bg-white/10 text-muted-foreground border border-gray-100 dark:border-white/5"
                                            )}>
                                                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground text-base">{entry.userName}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{new Date(entry.completedAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <span className="font-black text-2xl font-mono text-primary">{entry.score}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                    <div className="text-4xl mb-3">📭</div>
                                    <p className="text-muted-foreground font-medium">No attempts recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MyQuizzes = () => {
    const [activeTab, setActiveTab] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedQuizForResults, setSelectedQuizForResults] = useState<any | null>(null);
    const navigate = useNavigate();

    const fetchQuizzes = async () => {
        setIsLoading(true);
        try {
            if (activeTab === "Participated") {
                const fetchedQuizzes = await quizService.getParticipatedQuizzes();
                const filtered = searchQuery ? fetchedQuizzes.filter((q: any) => q.title.toLowerCase().includes(searchQuery.toLowerCase())) : fetchedQuizzes;
                setQuizzes(filtered);
            } else {
                const options: any = {};
                if (searchQuery) options.search = searchQuery;
                if (activeTab === "Published") options.isActive = true;
                if (activeTab === "Drafts") options.isActive = false;
                
                let fetchedQuizzes = await quizService.getAllQuizzes(options);
                if (activeTab === "Completed") {
                    fetchedQuizzes = fetchedQuizzes.filter((q: any) => q.attemptCount > 0);
                }
                setQuizzes(fetchedQuizzes);
            }
        } catch(e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        const timeout = setTimeout(() => fetchQuizzes(), 300);
        return () => clearTimeout(timeout);
    }, [activeTab, searchQuery]);

    const handleDelete = async (id: number) => {
        if(!confirm("Are you sure you want to delete this quiz?")) return;
        try {
            await quizService.deleteQuiz(id);
            fetchQuizzes();
        } catch(error) {
            console.error('Failed to delete', error);
        }
    }

    return (
        <div className="p-6 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">My Quizzes</h1>
                    <p className="text-muted-foreground mt-1">Manage and edit your library.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search quizzes..."
                            value={searchQuery}
                            onChange={(e: any) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground transition-all focus:bg-white dark:focus:bg-black"
                        />
                    </div>
                    <Button variant="outline" className="px-3 rounded-full border-gray-200 dark:border-white/10">
                        <FilterIcon className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="primary"
                        className="rounded-full gap-2 px-4"
                        onClick={() => navigate('/dashboard/create')}
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">New Quiz</span>
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-gray-200 dark:border-white/5 overflow-x-auto scrollbar-hide">
                {["All", "Published", "Drafts", "Completed", "Participated", "Archived"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "pb-3 text-sm font-medium transition-all relative",
                            activeTab === tab ? "text-primary dark:text-white" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab}
                        {activeTab === tab && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary dark:bg-white rounded-full"
                            />
                        )}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-1 md:col-span-2 xl:col-span-3 text-center py-12 text-muted-foreground">Loading...</div>
                ) : quizzes.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 xl:col-span-3 text-center py-12 border border-dashed border-gray-200 dark:border-white/10 p-6 rounded-2xl">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <DocumentTextIcon className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-medium text-foreground mb-2">No quizzes found</h3>
                        <p className="text-muted-foreground">We couldn't find any quizzes matching your filters.</p>
                    </div>
                ) : quizzes.map((quiz: any) => (
                    <div key={quiz.id + (activeTab === 'Participated' ? `-${quiz.attempt?.id}` : '')} className="group relative bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-6 hover:shadow-xl transition-all hover:border-primary/20 dark:hover:border-primary/20 dark:shadow-none hover:bg-gray-50 dark:hover:bg-white/10 hover:-translate-y-1 duration-300">
                        {activeTab !== 'Participated' && (
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button onClick={() => handleDelete(quiz.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full text-red-500 transition-colors">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                                <button className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-colors">
                                    <EllipsisHorizontalIcon className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-500/20 group-hover:scale-110 transition-transform">
                            <DocumentTextIcon className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{quiz.title}</h3>
                        <p className="text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed h-[40px]">
                            {quiz.description || "No description provided."}
                        </p>
                        <div className="flex items-center justify-between mt-auto mb-6">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-white/10 text-muted-foreground">
                                    {quiz.maxParticipants} max
                                </span>
                                <span className={cn(
                                    "text-xs font-medium px-2 py-1 rounded",
                                    quiz.isActive ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400"
                                )}>
                                    {quiz.isActive ? "Published" : "Draft"}
                                </span>
                            </div>
                            <span className="text-xs text-muted-foreground">{new Date(quiz.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex gap-2">
                            {activeTab === 'Participated' ? (
                                <div className="flex w-full items-center justify-between px-3 bg-gray-50 dark:bg-white/5 rounded-lg py-2 border border-gray-100 dark:border-white/5">
                                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Score</div>
                                    <div className="text-lg font-black text-primary font-mono">{quiz.attempt?.score ?? '-'}/{quiz.attempt?.totalScore}</div>
                                </div>
                            ) : (
                                <>
                                    <Button variant="outline" size="sm" fullWidth className="rounded-lg text-xs h-9 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 group-hover:border-gray-300 dark:group-hover:border-white/20" onClick={() => navigate(`/dashboard/quiz/${quiz.id}`)}>
                                        <PencilIcon className="w-3 h-3 " /> Edit
                                    </Button>
                                    {quiz.attemptCount > 0 && (
                                        <Button variant="secondary" size="sm" fullWidth className="rounded-lg text-xs h-9 hover:bg-gray-200 dark:hover:bg-white/10 gap-1 bg-gray-100 dark:bg-white/5" onClick={() => setSelectedQuizForResults(quiz)}>
                                            <TrophyIcon className="w-3 h-3 " /> Results
                                        </Button>
                                    )}
                                    <Button variant="primary" size="sm" fullWidth className="rounded-lg text-xs h-9 shadow-md" onClick={async () => {
                                        try {
                                            const { sessionId } = await quizService.startMultiplayerSession(quiz.id, quiz.maxParticipants || 50);
                                            navigate(`/dashboard/quiz/${sessionId}`);
                                        } catch(e) {
                                            console.error(e);
                                        }
                                    }}>
                                        Host Live
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            <QuizResultsModal 
                isOpen={!!selectedQuizForResults} 
                onClose={() => setSelectedQuizForResults(null)} 
                quiz={selectedQuizForResults} 
            />
        </div>
    )
}

const Reports = () => {
    const [msg, setMsg] = useState("");
    
    useEffect(() => {
        const fetchReports = async () => {
            try {
                const res = await quizService.getReports();
                setMsg(res.message);
            } catch (e) {
                console.error(e);
            }
        };
        fetchReports();
    }, []);

    return (
        <div className="p-6 md:p-10 flex flex-col gap-8 w-full max-w-7xl mx-auto">
            {msg && (
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-4 rounded-xl text-sm border border-blue-200 dark:border-blue-800">
                    {msg}
                </div>
            )}
            <div>
                <h1 className="text-3xl font-bold text-foreground font-heading">Performance Reports</h1>
                <p className="text-muted-foreground mt-1">Analyze student engagement and results.</p>
            </div>

            <div className="bg-gray-900 dark:bg-neutral-900 text-white rounded-[24px] p-8 shadow-2xl relative overflow-hidden border border-gray-800 dark:border-white/10 group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-primary/30 transition-colors duration-1000"></div>
                <div className="relative z-10">
                    <h3 className="text-lg font-medium text-gray-300 mb-2">Total Participation</h3>
                    <p className="text-4xl font-bold mb-8">24,592 <span className="text-sm font-normal text-green-400 bg-green-400/10 px-2 py-1 rounded-md ml-2 border border-green-400/20">+12% vs last month</span></p>

                    <div className="h-64 flex items-end gap-2 sm:gap-4">
                        {[40, 65, 45, 80, 55, 90, 75, 60, 85, 95, 70, 80].map((h, i) => (
                            <div key={i} className="flex-1 bg-gray-800 dark:bg-white/5 rounded-t-lg relative group/bar h-full flex items-end overflow-visible">
                                {/* Tooltip */}
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-xs font-bold py-1 px-2 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl mb-2">
                                    {h * 10} Students
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45"></div>
                                </div>

                                <div
                                    className="w-full bg-primary/80 rounded-t-lg transition-all duration-500 group-hover/bar:bg-primary group-hover/bar:h-[105%]"
                                    style={{ height: `${h}%` }}
                                >
                                    <div className="w-full h-full bg-gradient-to-t from-black/20 to-transparent"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-gray-200 dark:border-white/5 rounded-2xl p-6 bg-white dark:bg-white/5 shadow-sm dark:shadow-none hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-foreground">Top Performing Students</h3>
                        <button className="text-xs font-medium text-primary hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-foreground border border-gray-200 dark:border-white/10 group-hover:border-primary/50 transition-colors">
                                        {i}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Student Name</p>
                                        <p className="text-xs text-muted-foreground">Class {String.fromCharCode(65 + i)}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-md border border-green-100 dark:border-green-500/20">98%</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="border border-gray-200 dark:border-white/5 rounded-2xl p-6 bg-white dark:bg-white/5 shadow-sm dark:shadow-none hover:shadow-md transition-shadow">
                    <h3 className="font-bold text-foreground mb-6">Recent Quiz Averages</h3>
                    <div className="space-y-5">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                <span className="text-sm font-medium text-foreground min-w-[120px]">Physics Unit {i}</span>
                                <div className="flex items-center gap-3 flex-1 ml-4">
                                    <div className="h-2.5 w-full bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full relative overflow-hidden group-hover:bg-indigo-500 transition-colors"
                                            style={{ width: `${70 + i * 4}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-foreground w-8 text-right">{70 + i * 4}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

const Profile = () => {
    const { user, updateUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        username: user?.username || '',
        bio: user?.bio || ''
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await authService.updateProfile({ 
                username: formData.username, 
                bio: formData.bio 
            });
            updateUser(response.user);
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update profile', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return <div>Loading...</div>;

    const initials = user.username ? user.username.substring(0, 2).toUpperCase() : 'U';
    const avatarSrc = user.avatarUrl?.replace('=s96-c', '=s200-c') || user.avatarUrl;

    return (
        <div className="p-6 md:p-10 flex flex-col gap-8 w-full max-w-4xl mx-auto">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Profile Settings</h1>
                    <p className="text-muted-foreground mt-1">Manage your account information.</p>
                </div>
                {!isEditing && (
                    <Button variant="outline" className="gap-2" onClick={() => setIsEditing(true)}>
                        <PencilIcon className="w-4 h-4" /> Edit Profile
                    </Button>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex flex-col items-center gap-4 p-6 border border-gray-200 dark:border-white/5 rounded-2xl w-full md:w-72 bg-white dark:bg-white/5 shadow-sm dark:shadow-none">
                    <div className="relative group cursor-pointer">
                        {user.avatarUrl && (
                            <img
                                src={avatarSrc}
                                alt={user.username}
                                className="w-32 h-32 rounded-full bg-gray-100 dark:bg-white/5 object-cover border-2 border-gray-200 dark:border-white/10 overflow-hidden"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                        )}
                        <div className={cn(
                            "w-32 h-32 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-4xl text-muted-foreground border-2 border-dashed border-gray-200 dark:border-white/10 overflow-hidden",
                            user.avatarUrl ? "hidden" : ""
                        )}>
                            {initials}
                        </div>
                        {isEditing && (
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <PencilIcon className="w-6 h-6 text-white" />
                            </div>
                        )}
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-foreground">{user.username}</h3>
                        <p className="text-xs text-muted-foreground">Premium Member</p>
                    </div>
                    {isEditing && (
                        <Button variant="outline" size="sm" fullWidth className="mt-2">Change Avatar</Button>
                    )}
                </div>

                <div className="flex-1 w-full space-y-6 bg-white dark:bg-white/5 p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-foreground">Username</label>
                            {isEditing ? (
                                <input 
                                    type="text" 
                                    value={formData.username} 
                                    onChange={(e) => setFormData(p => ({ ...p, username: e.target.value }))}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all focus:bg-white dark:focus:bg-black focus:border-primary/50" 
                                />
                            ) : (
                                <p className="text-foreground text-sm font-medium py-1">{user.username}</p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-foreground">Email Address</label>
                        {isEditing ? (
                            <div className="relative">
                                <input type="email" defaultValue={user.email} className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all focus:bg-white dark:focus:bg-black focus:border-primary/50" readOnly />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500 font-medium flex items-center gap-1">
                                    <CheckIcon className="w-3 h-3" /> Verified
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 py-1">
                                <p className="text-foreground text-sm font-medium">{user.email}</p>
                                <div className="text-xs text-green-500 font-medium flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                    <CheckIcon className="w-3 h-3" /> Verified
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-foreground">Bio</label>
                        {isEditing ? (
                            <textarea 
                                rows={4} 
                                value={formData.bio} 
                                onChange={(e) => setFormData(p => ({ ...p, bio: e.target.value }))}
                                placeholder="Tell us about yourself..."
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all focus:bg-white dark:focus:bg-black focus:border-primary/50" 
                            />
                        ) : (
                            <p className="text-muted-foreground text-sm py-1 leading-relaxed">
                                {user.bio || "No bio added yet."}
                            </p>
                        )}
                    </div>
                    {isEditing && (
                        <div className="pt-6 mt-6 flex justify-end gap-3 border-t border-gray-100 dark:border-white/5">
                            <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const Settings = () => {
    const [emailNotif, setEmailNotif] = useState(true);
    const [marketing, setMarketing] = useState(false);
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="p-6 md:p-10 flex flex-col gap-8 w-full max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-foreground font-heading">Application Settings</h1>
                <p className="text-muted-foreground mt-1">Customize your Dexter experience.</p>
            </div>

            <div className="space-y-6">
                <Section title="Notifications">
                    <Toggle label="Email Notifications" description="Receive updates about your quizzes and student performance." checked={emailNotif} onChange={() => setEmailNotif(!emailNotif)} />
                    <div className="h-px bg-gray-100 dark:bg-white/5 my-2"></div>
                    <Toggle label="Marketing Emails" description="Receive news and special offers from Dexter." checked={marketing} onChange={() => setMarketing(!marketing)} />
                </Section>

                <Section title="Billing & Plans">
                    <div className="flex items-center justify-between py-4">
                        <div>
                            <p className="font-medium text-foreground">Current Plan</p>
                            <p className="text-sm text-muted-foreground">You are currently on the <span className="font-bold text-foreground">Free Plan</span>.</p>
                        </div>
                        <Button variant="primary" className="gap-2">
                            <CreditCardIcon className="w-4 h-4" /> Upgrade to Pro
                        </Button>
                    </div>
                </Section>

                <Section title="Appearance">
                    <div className="flex items-center justify-between py-4">
                        <div>
                            <p className="font-medium text-foreground">Theme</p>
                            <p className="text-sm text-muted-foreground">Select your preferred interface theme.</p>
                        </div>
                        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5">
                            <button
                                className={cn(
                                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                                    theme === 'light' ? "bg-white dark:bg-white/10 text-foreground shadow-sm" : "hover:bg-white/50 dark:hover:bg-white/5 text-muted-foreground"
                                )}
                                onClick={() => theme !== 'light' && toggleTheme()}
                            >
                                Light
                            </button>
                            <button
                                className={cn(
                                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                                    theme === 'dark' ? "bg-white dark:bg-white/10 text-foreground shadow-sm" : "hover:bg-white/50 dark:hover:bg-white/5 text-muted-foreground"
                                )}
                                onClick={() => theme !== 'dark' && toggleTheme()}
                            >
                                Dark
                            </button>
                        </div>
                    </div>
                </Section>

                <Section title="Danger Zone" className="border-red-200 dark:border-red-900/20">
                    <div className="flex items-center justify-between py-4">
                        <div>
                            <p className="font-medium text-red-600 dark:text-red-400">Delete Account</p>
                            <p className="text-sm text-muted-foreground">Permanently remove your account and all data.</p>
                        </div>
                        <Button variant="danger" className="gap-2">
                            <TrashIcon className="w-4 h-4" /> Delete Account
                        </Button>
                    </div>
                </Section>
            </div>
        </div>
    )
}

const Section: React.FC<{ title: string, children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <div className={cn("border border-gray-200 dark:border-white/5 rounded-2xl bg-white dark:bg-white/5 overflow-hidden shadow-sm dark:shadow-none transition-all hover:shadow-md", className)}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
            <h3 className="font-bold text-foreground">{title}</h3>
        </div>
        <div className="p-6">
            {children}
        </div>
    </div>
)

const Toggle = ({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: () => void }) => (
    <div className="flex items-center justify-between py-2 cursor-pointer group" onClick={onChange}>
        <div>
            <p className="font-medium text-foreground group-hover:text-primary transition-colors">{label}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <button
            className={cn(
                "w-12 h-7 rounded-full transition-colors relative border-2 focus:outline-none focus:ring-2 focus:ring-primary/20",
                checked ? "bg-primary border-primary" : "bg-gray-200 dark:bg-white/10 border-transparent"
            )}
        >
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all transform",
                checked ? "translate-x-5" : "translate-x-0.5"
            )} />
        </button>
    </div>
)

const StatCard = ({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend?: string }) => (
    <div className="p-6 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col gap-4 shadow-sm hover:shadow-lg transition-all dark:shadow-none hover:-translate-y-1 duration-300">
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            <div className="text-muted-foreground opacity-50 p-2 bg-gray-100 dark:bg-white/5 rounded-lg">{icon}</div>
        </div>
        <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold text-foreground font-heading">{value}</span>
            {trend && <span className="text-xs font-medium text-green-500 flex items-center gap-1">
                {trend}
            </span>}
        </div>
    </div>
);

export default DashboardPage;

const UsageCard = () => {
    const { open, animate } = useSidebar();

    // Only show if open
    if (!open) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 px-2"
        >
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-white dark:bg-white/10 text-primary shadow-sm border border-gray-100 dark:border-white/5">
                    <CreditCardIcon className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-sm font-bold text-foreground font-heading">Monthly Usage</h4>
            </div>

            <div className="space-y-1 mb-3">
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                    <span>Quizzes</span>
                    <span>12 / 20</span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[60%] rounded-full"></div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-bold">8 quizzes</span> remaining in your Basic Plan.
            </p>

            <Link to="/dashboard/settings" className="mt-3 w-full text-xs font-bold text-primary hover:text-primary/80 transition-colors text-left flex items-center gap-1">
                Upgrade Plan <ArrowRightIcon className="w-3 h-3" />
            </Link>
        </motion.div>
    )
}

const UserAccount = () => {
    const { open, animate } = useSidebar();
    const { user } = useAuth();
    console.log("User: ",user)
    if (!user) return null;

    const initials = user.username ? user.username.substring(0, 2).toUpperCase() : 'U';
    const avatarSrc = user.avatarUrl?.replace('=s96-c', '=s200-c');

    return (
        <div className={cn(
            "flex items-center gap-3 p-2 rounded-xl transition-all duration-200 group cursor-pointer",
            open ? "hover:bg-white dark:hover:bg-white/5 hover:shadow-sm hover:border-gray-100 dark:hover:border-white/5 border border-transparent" : "justify-center"
        )}>
            {user.avatarUrl ? (
                <img
                    src={avatarSrc}
                    alt={user.username}
                    className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-200 dark:bg-white/10 border border-black/5 dark:border-white/10 object-cover"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                />
            ) : null}
            {(!user.avatarUrl) && (
                <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-200 dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center text-foreground font-bold text-xs">
                    {initials}
                </div>
            )}

            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex items-center justify-between overflow-hidden"
                >
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground truncate">{user.username}</span>
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>

                    <button className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors" title="Switch Account">
                        <ArrowsRightLeftIcon className="w-4 h-4" />
                    </button>
                </motion.div>
            )}
        </div>
    )
}