import { create } from 'zustand';
import { API_BASE_URL } from '../services/api/config';

export type Question = {
    id: number;
    text: string;
    options: { id: number; text: string; isCorrect: boolean }[];
    answer?: string;
    explanation?: string;
    source?: string;
    context_quote?: string;
};

export type FormData = {
    title: string;
    description: string;
    files: { name: string; size: string; type: string }[];
    links: string[];
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
    questionType: 'mcq' | 'true_false' | 'mixed';
    questions: Question[];
    settings: {
        timer: number;
        participantLimit: number;
        showLeaderboard: boolean;
        shuffleQuestions: boolean;
        showTeacherNotes: boolean;
        gameMode: 'classic' | 'team' | 'speed';
        googleSheetId?: string;
    }
};

interface QuizState {
    step: number;
    sessionId: string;
    fileGraphIds: string[];
    linkGraphIds: string[];
    formData: FormData;
    ingestionStatus: 'idle' | 'loading' | 'success' | 'error';
    isGenerating: boolean;

    // Actions
    setStep: (step: number) => void;
    updateFormData: (field: keyof FormData, value: any) => void;
    addLink: (url: string) => Promise<void>;
    addFile: (file: File) => Promise<void>;
    addStoredGraph: (graphId: string, label: string) => void;
    removeLink: (idx: number) => void;
    removeFile: (idx: number) => void;
    generateQuestions: () => Promise<void>;
    updateQuestions: (questions: Question[]) => void;
    saveQuiz: () => Promise<any>;
    reset: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
    step: 1,
    sessionId: crypto.randomUUID(),
    fileGraphIds: [],
    linkGraphIds: [],
    ingestionStatus: 'idle',
    isGenerating: false,
    formData: {
        title: '',
        description: '',
        files: [],
        links: [],
        topic: '',
        difficulty: 'medium',
        questionCount: 10,
        questionType: 'mcq',
        questions: [],
        settings: {
            timer: 30,
            participantLimit: 50,
            showLeaderboard: true,
            shuffleQuestions: true,
            showTeacherNotes: true,
            gameMode: 'classic',
            googleSheetId: ''
        }
    },

    setStep: (step) => set({ step }),

    updateFormData: (field, value) =>
        set((state) => {
            const newState = { ...state.formData, [field]: value };
            // Clear questions if dependencies change
            if (['title', 'topic', 'difficulty', 'files', 'links', 'questionCount', 'questionType'].includes(field)) {
                newState.questions = [];
            }
            return { formData: newState };
        }),

    addStoredGraph: (graphId: string, label: string) => {
        set((state) => ({
            formData: { 
                ...state.formData,
                // Add a virtual entry so users can see it selected
                links: [...state.formData.links, `[Library] ${label}`]
            },
            linkGraphIds: [...state.linkGraphIds, graphId]
        }));
    },

    addLink: async (url) => {
        set({ ingestionStatus: 'loading' });
        try {
            const { authService } = await import('../services/api/auth/authService');
            const token = await authService.getValidToken();

            if (!token) throw new Error("Authentication required");

            const res = await fetch(`${API_BASE_URL}/graph-rag/ingest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ inputType: 'url', value: url })
            });

            if (!res.ok) throw new Error("Ingestion failed");
            const data = await res.json();

            // Store the graph_id
            const newGraphId = data.data.graph_id;

            set((state) => ({
                formData: { ...state.formData, links: [...state.formData.links, url] },
                linkGraphIds: [...state.linkGraphIds, newGraphId],
                ingestionStatus: 'success'
            }));

            setTimeout(() => set({ ingestionStatus: 'idle' }), 2000);

        } catch (e) {
            console.error(e);
            set({ ingestionStatus: 'error' });
            alert("Failed to process this link. Please try again.");
        }
    },

    addFile: async (file) => {
        set({ ingestionStatus: 'loading' });
        try {
            const { authService } = await import('../services/api/auth/authService');
            const token = await authService.getValidToken();

            if (!token) throw new Error("Authentication required");

            // 1. Upload to Cloudinary
            const { uploadToCloudinary } = await import('../utils/cloudinary');
            const cloudinaryUrl = await uploadToCloudinary(file);
            console.log('Cloudinary URL:', cloudinaryUrl);

            // 2. Ingest into Graph RAG (treat as PDF/URL)
            // Note: The API supports 'pdf' which expects a URL to a PDF
            const res = await fetch(`${API_BASE_URL}/graph-rag/ingest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ inputType: 'pdf', value: cloudinaryUrl, title: file.name })
            });

            if (!res.ok) throw new Error("File ingestion failed");
            const data = await res.json();
            const newGraphId = data.data.graph_id;

            const fileData = {
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(2) + " MB",
                type: file.name.split('.').pop() || 'file'
            };

            set((state) => ({
                formData: { ...state.formData, files: [...state.formData.files, fileData] },
                fileGraphIds: [...state.fileGraphIds, newGraphId],
                ingestionStatus: 'success'
            }));
            setTimeout(() => set({ ingestionStatus: 'idle' }), 2000);

        } catch (e) {
            console.error('Upload/Ingest error:', e);
            set({ ingestionStatus: 'error' });
            alert(e instanceof Error ? e.message : 'Failed to process file');
        }
    },

    removeLink: (idx) =>
        set((state) => {
            const newLinks = state.formData.links.filter((_, i) => i !== idx);
            const newLinkGraphIds = state.linkGraphIds.filter((_, i) => i !== idx);
            return {
                formData: { ...state.formData, links: newLinks },
                linkGraphIds: newLinkGraphIds
            };
        }),

    removeFile: (idx) =>
        set((state) => {
            const newFiles = state.formData.files.filter((_, i) => i !== idx);
            const newFileGraphIds = state.fileGraphIds.filter((_, i) => i !== idx);
            return {
                formData: { ...state.formData, files: newFiles },
                fileGraphIds: newFileGraphIds
            };
        }),

    generateQuestions: async () => {
        set({ isGenerating: true });
        const { linkGraphIds, fileGraphIds, formData } = get();
        let targetGraphIds = [...(linkGraphIds || []), ...(fileGraphIds || [])];

        try {
            const { authService } = await import('../services/api/auth/authService');
            const token = await authService.getValidToken();
            if (!token) throw new Error("Authentication required");

            // If text topic is provided, ingest it first (if no other content)
            if (formData.topic && targetGraphIds.length === 0) {
                const res = await fetch(`${API_BASE_URL}/graph-rag/ingest`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ inputType: 'topic', value: formData.topic })
                });
                if (res.ok) {
                    const data = await res.json();
                    // No need to persist topic graph id permanently as topic is not removable via a list, 
                    // but we can append it to targetGraphIds for this generation.
                    targetGraphIds.push(data.data.graph_id);
                }
            }

            if (targetGraphIds.length === 0) {
                throw new Error("Please add a file, link, or topic first!");
            }

            const mcqsPromises = targetGraphIds.map(async (graphId) => {
                const countPerGraph = Math.ceil(formData.questionCount / targetGraphIds.length);
                const res = await fetch(`${API_BASE_URL}/graph-rag/generate/${graphId}?count=${countPerGraph}&difficulty=${formData.difficulty}&type=${formData.questionType}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Generation failed for graph " + graphId);
                const resData = await res.json();
                return resData.data.mcqs;
            });

            const allMcqsArrays = await Promise.all(mcqsPromises);
            // Mix questions from different sources
            const allMcqs = allMcqsArrays.flat()
                .sort(() => Math.random() - 0.5)
                .slice(0, formData.questionCount);

            const questions: Question[] = allMcqs.map((q: any, i: number) => {
                const options = q.options.map((opt: string, oid: number) => ({
                    id: oid + 1,
                    text: opt,
                    isCorrect: opt === q.answer
                })).sort(() => Math.random() - 0.5); // Shuffle options
                
                return {
                    id: i + 1,
                    text: q.question,
                    options,
                    answer: q.answer,
                    explanation: q.explanation || "Generated via Graph RAG",
                    source: "Graph Knowledge Base"
                };
            });

            set((state) => ({
                formData: { ...state.formData, questions },
                isGenerating: false,
                step: 3
            }));

        } catch (e: any) {
            console.error(e);
            set({ isGenerating: false });
            alert(e.message || "Failed to generate questions. Ensure you have added content.");
        }
    },

    updateQuestions: (questions) =>
        set((state) => ({ formData: { ...state.formData, questions } })),

    saveQuiz: async () => {
        set({ ingestionStatus: 'loading' });
        const { formData } = get();
        try {
            const { authService } = await import('../services/api/auth/authService');
            const token = await authService.getValidToken();

            if (!token) throw new Error("Authentication required");

            // Transform data to match backend schema
            const payload = {
                title: formData.title,
                description: formData.description,
                maxParticipants: formData.settings.participantLimit,
                settings: formData.settings,
                questions: formData.questions.map(q => ({
                    content: q.text,
                    type: 'mcq', // Default to 'mcq' as per current frontend logic
                    correctAnswer: q.answer || "",
                    options: q.options.map(o => o.text),
                    points: 10, // Default points
                    explanation: q.explanation,
                    source: q.source
                }))
            };

            const res = await fetch(`${API_BASE_URL}/quizzes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.error("Quiz save error details:", errorData);
                throw new Error(errorData.error || "Failed to save quiz");
            }

            set({ ingestionStatus: 'success' });
            // Optional: You might want to return the saved quiz ID here
            return await res.json();
        } catch (e: any) {
            console.error("Save quiz error:", e);
            set({ ingestionStatus: 'error' });
            throw e;
        } finally {
            setTimeout(() => set({ ingestionStatus: 'idle' }), 2000);
        }
    },

    reset: () => set({
        step: 1,
        sessionId: crypto.randomUUID(),
        fileGraphIds: [],
        linkGraphIds: [],
        ingestionStatus: 'idle',
        isGenerating: false,
        formData: {
            title: '',
            description: '',
            files: [],
            links: [],
            topic: '',
            difficulty: 'medium',
            questionCount: 10,
            questionType: 'mcq',
            questions: [],
            settings: {
                timer: 30,
                participantLimit: 50,
                showLeaderboard: true,
                shuffleQuestions: true,
                showTeacherNotes: true,
                gameMode: 'classic',
                googleSheetId: ''
            }
        }
    })
}));
