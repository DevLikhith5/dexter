import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/Button';
import { cn } from '../lib/utils';
import {
    CloudArrowUpIcon,
    LinkIcon,
    DocumentTextIcon,
    TrashIcon,
    CheckIcon,
    PlusIcon,
    PencilIcon,
    ClockIcon,
    UsersIcon,
    ArrowRightIcon,
    BoltIcon,
    ChevronLeftIcon,
    ChevronRightIcon,

    MagnifyingGlassIcon,
    FilterIcon
} from '../components/Icons';
import { EyeIcon, EyeOffIcon, SparklesIcon } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useAuth } from '../contexts/AuthContext';

// --- Types ---
type Question = {
    id: number;
    text: string;
    options: { id: number; text: string; isCorrect: boolean }[];
    answer?: string;
    explanation?: string;
    source?: string;
};

type FormData = {
    title: string;
    description: string;
    files: { name: string; size: string; type: 'pdf' | 'ppt' }[];
    links: string[];
    topic: string; // New field for keywords
    questions: Question[];
    settings: {
        timer: number;
        participantLimit: number;
        showLeaderboard: boolean;
        shuffleQuestions: boolean;
        gameMode: 'classic' | 'team' | 'speed';
    }
};

const TOPIC_SUGGESTIONS = [
    "Intro to Thermodynamics",
    "European History 1900-1950",
    "Organic Chemistry Basics",
    "Javascript Event Loop",
    "Shakespeare's Macbeth"
];

// --- Sub-Components ---

const Step1Details: React.FC<{ data: FormData, update: any }> = ({ data, update }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-8"
    >
        <div>
            <h2 className="text-3xl font-bold font-heading mb-2">Let's start with the basics</h2>
            <p className="text-muted-foreground">What do you want to test your students on today?</p>
        </div>

        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium text-foreground ml-1">Quiz Title</label>
                <input
                    type="text"
                    value={data.title}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder="e.g. Introduction to Physics"
                    className="w-full bg-transparent border-b-2 border-gray-200 dark:border-white/10 px-4 py-4 text-3xl font-bold text-foreground placeholder:text-muted-foreground/30 focus:border-primary outline-none transition-all"
                    autoFocus
                />
            </div>

            {/* Smart Suggestions */}
            <div className="flex flex-wrap gap-2">
                {TOPIC_SUGGESTIONS.map((topic) => (
                    <button
                        key={topic}
                        onClick={() => update('title', topic)}
                        className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 border border-transparent hover:border-primary/50 hover:text-primary text-xs font-medium text-muted-foreground transition-all"
                    >
                        {topic}
                    </button>
                ))}
            </div>

            <div className="space-y-2 pt-4">
                <label className="text-sm font-medium text-foreground ml-1">Focus Keywords (Optional)</label>
                <input
                    type="text"
                    value={data.topic}
                    onChange={(e) => update('topic', e.target.value)}
                    placeholder="e.g. Thermodynamics laws, entropy, heat transfer"
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all focus:bg-white dark:focus:bg-black"
                />
                <p className="text-xs text-muted-foreground ml-1">Dexter will prioritize questions related to these topics.</p>
            </div>

            {/* Questions Configuration Row */}
            <div className="flex gap-4 pt-4">
                <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-foreground ml-1">Question Count</label>
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{data.questionCount}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={data.questionCount}
                        onChange={(e) => update('questionCount', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                </div>

                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium text-foreground ml-1">Question Type</label>
                    <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                        {(['mcq', 'true_false', 'mixed'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => update('questionType', type)}
                                className={cn(
                                    "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                                    data.questionType === type
                                        ? "bg-white dark:bg-[#1e2025] text-primary shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {type.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Difficulty Selector (Added) */}
            <div className="pt-4">
                <label className="text-sm font-medium text-foreground ml-1 block mb-2">Difficulty</label>
                <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                    {(['easy', 'medium', 'hard'] as const).map((level) => (
                        <button
                            key={level}
                            onClick={() => update('difficulty', level)}
                            className={cn(
                                "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                                data.difficulty === level
                                    ? "bg-white dark:bg-[#1e2025] text-primary shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-foreground ml-1">Description (Optional)</label>
                <textarea
                    rows={3}
                    value={data.description}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="Add learning objectives or instructions..."
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all focus:bg-white dark:focus:bg-black"
                />
            </div>
        </div>
    </motion.div>
);

const Step2Resources: React.FC<{
    data: FormData,
    update: any,
    addLink: (url: string) => Promise<void>,
    addFile: (file: File) => Promise<void>,
    addStoredGraph: (graphId: string, label: string) => void,
    removeLink: (idx: number) => void,
    removeFile: (idx: number) => void,
    ingestionStatus: string
}> = ({ data, update, addLink, addFile, addStoredGraph, removeLink, removeFile, ingestionStatus }) => {

    const [linkInput, setLinkInput] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [storedSources, setStoredSources] = useState<{ id: number; title: string; type: string; graphId: string; sourceValue: string; createdAt: string }[]>([]);
    const [loadingLibrary, setLoadingLibrary] = useState(false);

    const handleAddLink = async () => {
        if (linkInput) {
            await addLink(linkInput);
            setLinkInput('');
        }
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        await addFile(files[0]);
    };

    const isIngesting = ingestionStatus === 'loading';

    useEffect(() => {
        const fetchStored = async () => {
            setLoadingLibrary(true);
            try {
                const { authService } = await import('../services/api/auth/authService');
                const token = await authService.getValidToken();
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
                const res = await fetch(`${apiUrl}/graph-rag/stored`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const result = await res.json();
                    setStoredSources(result.data || []);
                }
            } catch (e) {
                console.warn('Could not load knowledge library:', e);
            } finally {
                setLoadingLibrary(false);
            }
        };
        fetchStored();
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
        >
            <div>
                <h2 className="text-3xl font-bold font-heading mb-2">Add Knowledge Source</h2>
                <p className="text-muted-foreground">Dexter will analyze these files to generate high-quality questions.</p>
            </div>

            {/* Drag & Drop Zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileUpload(e.dataTransfer.files);
                }}
                className={cn(
                    "relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group overflow-hidden",
                    isDragging
                        ? "border-primary bg-primary/5 scale-[1.02]"
                        : "border-gray-200 dark:border-white/10 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
            >
                <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    accept=".pdf,.pptx"
                />
                <div className="w-20 h-20 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <CloudArrowUpIcon className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Drop your files here</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Support for PDF, PowerPoint, and Word documents up to 50MB.
                </p>
                <Button variant="outline" size="sm" className="mt-6 pointer-events-none">Browse Files</Button>
            </div>

            {/* Resources List */}
            {(data.files.length > 0 || data.links.length > 0) && (
                <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Uploaded Resources</h4>
                    <div className="grid gap-3">
                        {data.files.map((file, idx) => (
                            <div key={idx} className="flex items-center p-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl group hover:border-primary/30 transition-colors">
                                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 mr-4">
                                    <DocumentTextIcon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-sm text-foreground">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{file.size}</p>
                                </div>
                                <button
                                    onClick={() => update('files', data.files.filter((_, i) => i !== idx))}
                                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {data.links.map((link, idx) => (
                            <div key={idx} className="flex items-center p-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl group hover:border-primary/30 transition-colors">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-4">
                                    <LinkIcon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-medium text-sm text-foreground truncate">{link}</p>
                                    <p className="text-xs text-muted-foreground">Website</p>
                                </div>
                                <button
                                    onClick={() => update('links', data.links.filter((_, i) => i !== idx))}
                                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Link Input */}
            <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                <label className="text-sm font-medium text-foreground mb-3 block">Or paste a URL</label>
                <div className="flex gap-2">
                    <input
                        type="url"
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                    />
                    <Button variant="secondary" onClick={handleAddLink} disabled={!linkInput}>
                        <PlusIcon className="w-4 h-4 mr-2" /> Add
                    </Button>
                </div>
            </div>

            {/* Knowledge Library Section */}
            <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-2 mb-4">
                    <h4 className="text-sm font-bold text-foreground">From My Library</h4>
                    <span className="text-xs text-muted-foreground">Re-use previously ingested content</span>
                </div>

                {loadingLibrary ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        Loading library...
                    </div>
                ) : storedSources.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No saved sources yet. Upload a file or link above to get started.</p>
                ) : (
                    <div className="grid gap-2">
                        {storedSources.map((source) => (
                            <div key={source.id} className="flex items-center p-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:border-primary/30 transition-colors group">
                                <div className={cn(
                                    "w-9 h-9 rounded-lg flex items-center justify-center mr-3 shrink-0",
                                    source.type === 'pdf' ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" :
                                    source.type === 'topic' ? "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400" :
                                    "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                )}>
                                    {source.type === 'pdf' ? <DocumentTextIcon className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-medium text-sm text-foreground truncate">{source.title}</p>
                                    <p className="text-xs text-muted-foreground">{source.type} · {new Date(source.createdAt).toLocaleDateString()}</p>
                                </div>
                                <button
                                    onClick={() => addStoredGraph(source.graphId, source.title)}
                                    className="ml-2 px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors shrink-0"
                                >
                                    + Use
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// --- AI Generation Screen (Simple Clean Loader) ---
const GeneratingState: React.FC = () => {
    const { sessionId, formData, updateQuestions, setStep } = useQuizStore();
    const [status, setStatus] = useState("Initializing...");

    useEffect(() => {
        const generate = async () => {
            try {
                setStatus("Reading your documents...");
                await new Promise(r => setTimeout(r, 800));

                setStatus("Identifying core concepts...");
                await new Promise(r => setTimeout(r, 800));

                setStatus("Drafting detailed questions...");
            } catch (e) {
                console.error(e);
            }
        };
        generate();
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-[500px]"
        >
            {/* Simple Clean Spinner */}
            <div className="relative mb-8">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <SparklesIcon className="w-6 h-6 text-primary animate-pulse" />
                </div>
            </div>

            <motion.h3
                key={status}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl font-medium font-heading text-center"
            >
                {status}
            </motion.h3>
            <p className="text-muted-foreground text-sm mt-2">Dexter is crafting your quiz...</p>
        </motion.div>
    );
};

const Step3Questions: React.FC<{
    data: FormData,
    update: any,
    onNext: () => void,
    onRegenerate: () => Promise<void>
}> = ({ data, update, onNext, onRegenerate }) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [globalRefineInput, setGlobalRefineInput] = useState("");
    const [isRefiningBatch, setIsRefiningBatch] = useState(false);
    const { token: getAuthToken } = useAuth();

    const handleSaveQuestion = (updatedQ: Question) => {
        const updatedQuestions = data.questions.map(q => q.id === updatedQ.id ? updatedQ : q);
        update('questions', updatedQuestions);
        setEditingQuestion(null);
    };

    const handleBatchRefine = async () => {
        if (!globalRefineInput) return;
        setIsRefiningBatch(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const authToken = await getAuthToken?.();
            const res = await fetch(`${apiUrl}/graph-rag/refine-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    questions: data.questions,
                    instruction: globalRefineInput
                }),
            });
            if (!res.ok) throw new Error("Batch refine failed");
            const resData = await res.json();
            update('questions', resData.questions);
            setGlobalRefineInput("");
        } catch (e) {
            console.error(e);
            alert("Failed to refine questions. Try again.");
        } finally {
            setIsRefiningBatch(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            {/* Header: Title, Settings Summary, and Batch Refine */}
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold font-heading">Review & Customize</h2>
                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                            {/* Topic Tags */}
                            {(data.topic || "General Knowledge").split(',').map((tag, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border border-primary/20">
                                    {tag.trim()}
                                </span>
                            ))}

                            {/* Difficulty Tag */}
                            <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border",
                                data.difficulty === 'hard' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                    data.difficulty === 'medium' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                                        "bg-green-500/10 text-green-400 border-green-500/20"
                            )}>
                                {data.difficulty}
                            </span>

                            {/* Hide Notes Toggle */}
                            <button
                                onClick={() => update('settings', { ...data.settings, showTeacherNotes: !data.settings.showTeacherNotes })}
                                className={cn(
                                    "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border transition-colors flex items-center gap-1",
                                    data.settings.showTeacherNotes
                                        ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20"
                                        : "bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700 hover:text-gray-300"
                                )}
                            >
                                {data.settings.showTeacherNotes ? <EyeIcon className="w-3 h-3" /> : <EyeOffIcon className="w-3 h-3" />}
                                {data.settings.showTeacherNotes ? "Notes On" : "Notes Off"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Global AI Refine Input (Cleaner, Flat Design) */}
                <div className="relative group">
                    <div className="relative bg-white dark:bg-[#1e2025] border border-gray-200 dark:border-white/10 hover:border-primary/20 transition-colors rounded-xl p-1 flex gap-2 items-center shadow-lg shadow-black/5 dark:shadow-black/20">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center shrink-0 ml-1">
                            {isRefiningBatch ? <BoltIcon className="w-4 h-4 text-primary animate-spin" /> : <SparklesIcon className="w-4 h-4 text-primary" />}
                        </div>
                        <input
                            type="text"
                            value={globalRefineInput}
                            onChange={(e) => setGlobalRefineInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleBatchRefine()}
                            placeholder="Magic Refine: e.g. 'Make all questions harder' or 'Focus on edge cases'..."
                            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/50 h-10 px-2"
                            disabled={isRefiningBatch}
                        />
                        <Button
                            size="sm"
                            onClick={handleBatchRefine}
                            disabled={!globalRefineInput || isRefiningBatch}
                            className="bg-primary/10 hover:bg-primary/20 text-primary border-transparent rounded-lg h-8 px-3 text-xs font-medium transition-all hover:scale-105 active:scale-95"
                        >
                            {isRefiningBatch ? "Refining..." : "Apply"}
                        </Button>
                    </div>
                </div>

                {/* Filter/Search Row */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search in questions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-[#1e2025] border border-gray-200 dark:border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Questions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.questions
                    .filter(q => q.text.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((q, qIdx) => (
                        <div key={q.id} className="bg-white dark:bg-[#1e2025] rounded-xl p-5 border border-gray-200 dark:border-white/5 relative group hover:border-primary/20 transition-all shadow-sm dark:shadow-none">

                            <p className="font-medium text-sm text-foreground mb-6 pr-4 leading-relaxed">
                                {q.text}
                            </p>

                            <div className="space-y-2 mb-4">
                                {q.options.map((opt, idx) => (
                                    <div key={opt.id} className="flex items-start gap-3">
                                        <span className="text-xs font-bold text-muted-foreground mt-0.5">{String.fromCharCode(65 + idx)}</span>
                                        <span className={cn("text-sm transition-colors", opt.isCorrect ? "text-primary font-bold" : "text-muted-foreground")}>
                                            {opt.text}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Explanation / Teacher's Note (CONDITIONAL) */}
                            {(q.explanation && data.settings.showTeacherNotes) && (
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-yellow-600 dark:text-yellow-500/80">Teacher's Note</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground dark:text-gray-400 italic leading-relaxed">
                                        "{q.explanation}"
                                    </p>
                                </div>
                            )}

                            {/* Source Badge with Deep Link */}
                            {q.source && (
                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between z-30 relative">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-blue-500/80">Source</span>
                                    </div>

                                    {(() => {
                                        // CLEAN THE SOURCE STRING: Remove brackets, parens, and trim.
                                        const cleanSource = q.source.replace(/[\[\]]/g, '').trim();
                                        const isUrl = cleanSource.startsWith("http");

                                        return isUrl ? (
                                            <a
                                                href={`${cleanSource}${q.context_quote ? `#:~:text=${encodeURIComponent(q.context_quote.trim())}` : ''}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] text-gray-500 hover:text-blue-400 truncate max-w-[200px] flex items-center gap-1 transition-colors relative z-50 cursor-pointer"
                                                title="Click to view source"
                                                onClick={(e) => e.stopPropagation()} // Prevent card click
                                            >
                                                <LinkIcon className="w-3 h-3" />
                                                {cleanSource.replace(/^https?:\/\/(www\.)?/, '')}
                                            </a>
                                        ) : (
                                            <span className="text-[10px] text-gray-500 truncate max-w-[200px]" title={cleanSource}>
                                                {cleanSource}
                                            </span>
                                        );
                                    })()}
                                </div>
                            )}



                            {/* Actions Overlay/Bottom */}
                            <div className="absolute bottom-4 right-4 flex gap-2">
                                <button className="w-7 h-7 rounded-md bg-gray-100 dark:bg-[#2a2c33] flex items-center justify-center text-muted-foreground hover:text-primary transition-colors border border-gray-200 dark:border-transparent">
                                    <CheckIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setEditingQuestion(q)}
                                    className="w-7 h-7 rounded-md bg-gray-100 dark:bg-[#2a2c33] flex items-center justify-center text-muted-foreground hover:text-primary transition-colors border border-gray-200 dark:border-transparent"
                                >
                                    <PencilIcon className="w-4 h-4 px-0.5" />
                                </button>
                            </div>
                        </div>
                    ))}
            </div>

            {/* Edit Modal (Inline Overlay) */}
            <AnimatePresence>
                {editingQuestion && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setEditingQuestion(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="w-full max-w-2xl bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white">Edit Question</h3>
                                <button onClick={() => setEditingQuestion(null)}>
                                    <CheckIcon className="w-5 h-5 text-gray-500 hover:text-white" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-gray-200 focus:border-white/20 outline-none resize-none"
                                    rows={3}
                                    value={editingQuestion.text}
                                    onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                                />

                                <div className="space-y-2">
                                    {editingQuestion.options.map((opt, idx) => (
                                        <div key={opt.id} className="flex items-center gap-2">
                                            <div
                                                className={cn(
                                                    "w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer transition-colors",
                                                    opt.isCorrect ? "bg-green-500/20 border-green-500 text-green-500" : "border-white/10 text-gray-500 hover:border-white/30"
                                                )}
                                                onClick={() => {
                                                    const newOptions = editingQuestion.options.map(o => ({ ...o, isCorrect: o.id === opt.id }));
                                                    setEditingQuestion({ ...editingQuestion, options: newOptions });
                                                }}
                                            >
                                                {opt.isCorrect && <CheckIcon className="w-3 h-3" />}
                                            </div>
                                            <input
                                                type="text"
                                                value={opt.text}
                                                onChange={(e) => {
                                                    const newOpts = [...editingQuestion.options];
                                                    newOpts[idx].text = e.target.value;
                                                    setEditingQuestion({ ...editingQuestion, options: newOpts });
                                                }}
                                                className={cn(
                                                    "w-full bg-[#1e2025] border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-primary/50",
                                                    opt.isCorrect && "border-green-500/30 bg-green-500/5"
                                                )}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-400 block mb-1">Teacher's Note (Explanation)</label>
                                    <textarea
                                        className="w-full bg-[#1e2025] border border-white/5 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-primary/50"
                                        rows={2}
                                        value={editingQuestion.explanation || ""}
                                        onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                                        placeholder="Explain why the answer is correct..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
                                <Button variant="ghost" onClick={() => setEditingQuestion(null)}>Cancel</Button>
                                <Button variant="primary" onClick={() => handleSaveQuestion(editingQuestion)}>Save Changes</Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


        </motion.div>
    );
};

const Step4Settings: React.FC<{ data: FormData, update: any }> = ({ data, update }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-8"
    >
        <div>
            <h2 className="text-3xl font-bold font-heading mb-2">Final Touches</h2>
            <p className="text-muted-foreground">Configure how your students will experience this quiz.</p>
        </div>

        {/* Game Mode Selection */}
        <div className="grid grid-cols-3 gap-4">
            {[
                { id: 'classic', label: 'Classic', desc: 'Standard quiz mode' },
                { id: 'team', label: 'Team', desc: 'Group vs Group' },
                { id: 'speed', label: 'Speed Run', desc: 'Points for speed' }
            ].map((mode) => (
                <div
                    key={mode.id}
                    onClick={() => update('settings', { ...data.settings, gameMode: mode.id })}
                    className={cn(
                        "cursor-pointer rounded-2xl border-2 p-4 transition-all hover:scale-[1.02]",
                        data.settings.gameMode === mode.id
                            ? "border-primary bg-primary/5 dark:bg-primary/10"
                            : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-primary/50"
                    )}
                >
                    <div className={cn(
                        "w-4 h-4 rounded-full border-2 mb-3",
                        data.settings.gameMode === mode.id ? "border-primary bg-primary" : "border-gray-300"
                    )} />
                    <h4 className="font-bold text-sm">{mode.label}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{mode.desc}</p>
                </div>
            ))}
        </div>

        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 space-y-6">
            {/* Timer */}
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-primary" /> Time per question
                    </label>
                    <span className="text-xl font-bold text-foreground font-heading">{data.settings.timer}s</span>
                </div>
                <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={data.settings.timer}
                    onChange={(e) => update('settings', { ...data.settings, timer: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
            </div>

            <div className="h-px bg-gray-100 dark:bg-white/5"></div>

            {/* Toggles */}
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-foreground">Show Leaderboard</p>
                        <p className="text-xs text-muted-foreground">Display scores after each question.</p>
                    </div>
                    <div
                        onClick={() => update('settings', { ...data.settings, showLeaderboard: !data.settings.showLeaderboard })}
                        className={cn(
                            "w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full relative cursor-pointer transition-colors",
                            data.settings.showLeaderboard && "bg-primary"
                        )}
                    >
                        <div className={cn(
                            "w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform",
                            data.settings.showLeaderboard && "translate-x-5"
                        )} />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-foreground">Shuffle Questions</p>
                        <p className="text-xs text-muted-foreground">Randomize order for each participant.</p>
                    </div>
                    <div
                        onClick={() => update('settings', { ...data.settings, shuffleQuestions: !data.settings.shuffleQuestions })}
                        className={cn(
                            "w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full relative cursor-pointer transition-colors",
                            data.settings.shuffleQuestions && "bg-primary"
                        )}
                    >
                        <div className={cn(
                            "w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform",
                            data.settings.shuffleQuestions && "translate-x-5"
                        )} />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-foreground">Show Teacher Notes</p>
                        <p className="text-xs text-muted-foreground">Display AI explanations to students.</p>
                    </div>
                    <div
                        onClick={() => update('settings', { ...data.settings, showTeacherNotes: !data.settings.showTeacherNotes })}
                        className={cn(
                            "w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full relative cursor-pointer transition-colors",
                            data.settings.showTeacherNotes && "bg-primary"
                        )}
                    >
                        <div className={cn(
                            "w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform",
                            data.settings.showTeacherNotes && "translate-x-5"
                        )} />
                    </div>
                </div>
                
                <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                    <div>
                        <p className="font-medium text-foreground">Google Sheet Sync</p>
                        <p className="text-xs text-muted-foreground mb-2">Provide a Google Sheet ID to explicitly sync scores.</p>
                        <input
                            type="text"
                            placeholder="Enter Google Sheet ID (Optional)"
                            value={data.settings.googleSheetId || ''}
                            onChange={(e) => update('settings', { ...data.settings, googleSheetId: e.target.value })}
                            className="w-full bg-gray-50 dark:bg-[#1a1c20] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                        />
                    </div>
                </div>
            </div>
        </div>
    </motion.div>
);

// --- Main Page Component ---
const CreateQuizPage = () => {
    const navigate = useNavigate();
    const {
        step, sessionId, formData, ingestionStatus, isGenerating,
        setStep, updateFormData, addLink, addFile, addStoredGraph, removeLink, removeFile, generateQuestions, updateQuestions, saveQuiz
    } = useQuizStore();

    const nextStep = () => {
        if (step === 2 && formData.questions.length === 0) {
            generateQuestions();
        } else {
            setStep(step + 1);
        }
    };

    const prevStep = () => setStep(step - 1);

    const finishQuiz = async () => {
        try {
            await saveQuiz();
            // Show success toast here if you like
            navigate('/dashboard');
        } catch (error) {
            alert("Failed to publish quiz. Please try again.");
        }
    };

    return (
        <div className="flex h-screen bg-[#F8F9FC] dark:bg-black overflow-hidden font-sans text-foreground transition-colors duration-300">

            {/* LEFT PANEL: Form / Editor */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => step === 1 ? navigate('/dashboard') : prevStep()}>
                            <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back
                        </Button>
                        <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />
                        <div>
                            <h1 className="text-lg font-bold font-heading">Create Quiz</h1>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span onClick={() => setStep(1)} className={cn("cursor-pointer hover:text-foreground transition-colors", step >= 1 ? "text-primary font-medium" : "")}>Details</span>
                                <span>/</span>
                                <span onClick={() => setStep(2)} className={cn("cursor-pointer hover:text-foreground transition-colors", step >= 2 ? "text-primary font-medium" : "")}>Source</span>
                                <span>/</span>
                                <span onClick={() => setStep(3)} className={cn("cursor-pointer hover:text-foreground transition-colors", step >= 3 ? "text-primary font-medium" : "")}>Questions</span>
                                <span>/</span>
                                <span onClick={() => setStep(4)} className={cn("cursor-pointer hover:text-foreground transition-colors", step >= 4 ? "text-primary font-medium" : "")}>Settings</span>
                            </div>
                        </div>
                    </div>

                    {/* Progress Circle or Step Counter */}
                    <div className="text-xs font-mono text-muted-foreground bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full border border-gray-200 dark:border-white/10">
                        Step {step} / 4
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    <div className={cn("mx-auto transition-all duration-300", step === 3 ? "w-full max-w-[1920px]" : "max-w-3xl")}>
                        <AnimatePresence mode="wait">
                            {isGenerating ? (
                                <GeneratingState key="generating" />
                            ) : (
                                <>
                                    {step === 1 && <Step1Details key="step1" data={formData} update={updateFormData} />}
                                    {step === 2 && <Step2Resources key="step2" data={formData} update={updateFormData} addLink={addLink} addFile={addFile} addStoredGraph={addStoredGraph} removeLink={removeLink} removeFile={removeFile} ingestionStatus={ingestionStatus} />}
                                    {step === 3 && <Step3Questions key="step3" data={formData} update={updateFormData} onNext={nextStep} onRegenerate={generateQuestions} />}
                                    {step === 4 && <Step4Settings key="step4" data={formData} update={updateFormData} />}
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Footer Actions (Standard Steps) */}
                {!isGenerating && step !== 3 && (
                    <div className="px-8 py-5 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] flex justify-end">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={step === 4 ? finishQuiz : nextStep}
                            disabled={(step === 1 && !formData.title) || ingestionStatus === 'loading'}
                            className="shadow-xl shadow-primary/20 min-w-[140px] rounded-full"
                        >
                            {ingestionStatus === 'loading' ? 'Ingesting...' : (step === 4 ? 'Publish Quiz' : 'Continue')}
                            {ingestionStatus !== 'loading' && step !== 4 && <ArrowRightIcon className="w-4 h-4 ml-2" />}
                        </Button>
                    </div>
                )}

                {/* Footer Actions (Step 3 - Review) */}
                {!isGenerating && step === 3 && (
                    <div className="px-8 py-4 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] flex justify-between items-center z-50 relative">
                        <div className="flex gap-3">
                            <Button variant="ghost" className="text-muted-foreground hover:text-white" onClick={() => {
                                updateFormData('questions', [...formData.questions, {
                                    id: Date.now(),
                                    text: "New Question",
                                    options: [{ id: 1, text: "Option A", isCorrect: true }],
                                    correct_answer: "Option A",
                                    type: "mcq"
                                }]);
                            }}>
                                + Add Question
                            </Button>
                            <Button variant="ghost" className="text-muted-foreground hover:text-white" onClick={() => {
                                const shuffled = [...formData.questions].sort(() => Math.random() - 0.5);
                                updateFormData('questions', shuffled);
                            }}>
                                <SparklesIcon className="w-4 h-4 mr-2" />
                                Shuffle
                            </Button>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={generateQuestions} className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
                                <SparklesIcon className="w-4 h-4 mr-2" />
                                AI Regenerate
                            </Button>
                            <Button variant="primary" size="lg" onClick={nextStep} className="shadow-lg shadow-blue-500/20 rounded-full px-8">
                                Launch Review
                                <ArrowRightIcon className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
};

export default CreateQuizPage;