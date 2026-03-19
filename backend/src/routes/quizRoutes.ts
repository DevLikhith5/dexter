import { Router } from 'express';
import { createQuiz, getQuizById, getAllQuizzes, updateQuiz, deleteQuiz, getParticipatedQuizzes, syncToSheets, getQuizResults, syncQuizResults } from '../controllers/quizController';
import { authenticateToken } from '../middleware/auth';

export const quizRoutes = Router();

// Order matters: more specific routes should come before parameterized ones
quizRoutes.get('/participated', authenticateToken, getParticipatedQuizzes);
quizRoutes.post('/:sessionId/sync-sheets', authenticateToken, syncToSheets);
quizRoutes.post('/', authenticateToken, createQuiz);
quizRoutes.get('/', authenticateToken, getAllQuizzes);
quizRoutes.get('/:id/results', authenticateToken, getQuizResults);
quizRoutes.post('/:id/sync-results', authenticateToken, syncQuizResults);
quizRoutes.get('/:id', authenticateToken, getQuizById);
quizRoutes.put('/:id', authenticateToken, updateQuiz);
quizRoutes.delete('/:id', authenticateToken, deleteQuiz);