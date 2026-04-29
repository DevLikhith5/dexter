import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { quizService } from '../services/api/quiz/quizService';
import Button from '../components/Button';
import { Quiz } from '../types';

const HostQuizPage = () => {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startingQuizId, setStartingQuizId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const data: any = await quizService.getAllQuizzes();
                // getAllQuizzes returns an array directly (quizService extracts .quizzes from response)
                setQuizzes(Array.isArray(data) ? data : (data.quizzes || []));
            } catch (err) {
                console.error('Failed to fetch quizzes:', err);
                setError('Failed to load quizzes.');
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchQuizzes();
        }
    }, [user]);

    const handleStartSession = async (quizId: number) => {
        setStartingQuizId(quizId);
        setError('');
        try {
            // Backend now reads maxPlayers from quiz settings automatically
            const response = await quizService.startMultiplayerSession(quizId);
            navigate(`/dashboard/quiz/${response.sessionId}`, { state: { isHost: true } });
        } catch (err: any) {
            console.error('Failed to start session:', err);
            setError(err.message || 'Failed to start quiz session.');
        } finally {
            setStartingQuizId(null);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center">Loading your quizzes...</div>;
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Host a Quiz</h1>
                    <p className="text-muted-foreground mt-1">Select a quiz to start a live multiplayer session.</p>
                </div>
                <Button onClick={() => navigate('/dashboard/create')} variant="outline">
                    + Create New Quiz
                </Button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6">
                    {error}
                </div>
            )}

            {quizzes.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/5">
                    <p className="text-xl text-muted-foreground mb-4">You haven't created any quizzes yet.</p>
                    <Button onClick={() => navigate('/dashboard/create')}>Create Your First Quiz</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map((quiz) => (
                        <div key={quiz.id} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-6 flex flex-col hover:shadow-lg transition-all duration-200">
                            <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-2">{quiz.title}</h3>
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow">{quiz.description || 'No description provided.'}</p>

                            <div className="pt-4 border-t border-gray-100 dark:border-white/5 mt-auto flex gap-3">
                                <Button
                                    fullWidth
                                    variant="primary"
                                    onClick={() => handleStartSession(quiz.id)}
                                    disabled={startingQuizId === quiz.id}
                                >
                                    {startingQuizId === quiz.id ? 'Starting...' : 'Start Session'}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HostQuizPage;
