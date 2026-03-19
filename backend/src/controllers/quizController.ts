import { type Request, type Response } from 'express';
import { z } from 'zod';
import { QuizService } from '../services/quizService';
import { GoogleSheetsService } from '../services/googleSheetsService';
import { RedisQuizService } from '../services/redisQuizService';
import { createQuizSchema } from '../types';

interface AuthRequest extends Request {
  userId?: number;
}

export const createQuiz = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, maxParticipants, questions, settings } = createQuizSchema.parse(req.body);
    const userId = req.userId; // User ID from authentication middleware

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const newQuiz = await QuizService.createQuiz({
      title,
      description,
      userId,
      maxParticipants: maxParticipants || 10,
      questions,
      settings
    });

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz: newQuiz,
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllQuizzes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit, offset, search, isActive } = req.query;
    
    const options: any = {};
    if (limit) options.limit = parseInt(limit as string, 10);
    if (offset) options.offset = parseInt(offset as string, 10);
    if (search) options.search = search as string;
    if (isActive !== undefined) options.isActive = isActive === 'true';

    const allQuizzes = await QuizService.getUserQuizzes(userId, options);

    res.status(200).json({ quizzes: allQuizzes });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getParticipatedQuizzes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const participatedQuizzes = await QuizService.getParticipatedQuizzes(userId);
    res.status(200).json({ quizzes: participatedQuizzes });
  } catch (error) {
    console.error('Error fetching participated quizzes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getQuizById = async (req: AuthRequest, res: Response) => {
  try {
    const quizIdParam = req.params.id;
    if (!quizIdParam) {
      return res.status(400).json({ error: 'Quiz ID is required' });
    }
    const quizIdStr = Array.isArray(quizIdParam) ? quizIdParam[0] : quizIdParam;
    if (!quizIdStr) {
      return res.status(400).json({ error: 'Quiz ID is required' });
    }
    const quizId = parseInt(quizIdStr);
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const quiz = await QuizService.getQuizById(quizId);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Ensure the user owns this quiz
    if (quiz.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Also fetch questions for this quiz
    const questions = await QuizService.getQuestionsForQuiz(quizId);

    res.status(200).json({
      quiz,
      questions,
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateQuiz = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const quizId = parseInt(req.params.id as string, 10);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(quizId)) {
      return res.status(400).json({ error: 'Invalid quiz ID' });
    }

    const updatedQuiz = await QuizService.updateQuiz(quizId, userId, req.body);
    res.status(200).json(updatedQuiz);
  } catch (error: any) {
    if (error.message.includes('not found or unauthorized')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error updating quiz:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteQuiz = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const quizId = parseInt(req.params.id as string, 10);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(quizId)) {
      return res.status(400).json({ error: 'Invalid quiz ID' });
    }

    await QuizService.deleteQuiz(quizId, userId);
    res.status(200).json({ message: 'Quiz deleted successfully' });
  } catch (error: any) {
    if (error.message.includes('not found or unauthorized')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error deleting quiz:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const syncToSheets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const sessionId = req.params.sessionId as string;
    const { sheetId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!sessionId || !sheetId) {
      return res.status(400).json({ error: 'Session ID and Sheet ID are required' });
    }


    const sessionData = await RedisQuizService.getQuizSession(sessionId);
    if (!sessionData || !sessionData.quizId) {
      return res.status(404).json({ error: 'Quiz session not found or expired' });
    }

    if (parseInt(sessionData.hostUserId as string) !== userId) {
      return res.status(403).json({ error: 'Only the host can sync scores to Google Sheets' });
    }

    const scores = await RedisQuizService.getAllScores(sessionId);
    if (!scores || scores.length === 0) {
      return res.status(400).json({ error: 'No scores found to sync' });
    }

    const quiz = await QuizService.getQuizById(parseInt(sessionData.quizId));
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const success = await GoogleSheetsService.syncQuizScores(
      parseInt(sessionData.quizId),
      quiz.title,
      sessionId,
      userId,
      sheetId,
      scores
    );

    if (success) {
      res.status(200).json({ message: 'Scores synced successfully' });
    } else {
      res.status(500).json({ error: 'Failed to sync scores. Please ensure you have authenticated with Google and provided a valid Sheet ID with edit access.' });
    }
  } catch (error: any) {
    console.error('Error syncing scores to sheets:', error);
    // Return the specific error message from GoogleSheetsService
    res.status(400).json({ error: error.message || 'Failed to sync scores to Google Sheets' });
  }
};

export const getQuizResults = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const quizId = parseInt(req.params.id as string, 10);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(quizId)) {
      return res.status(400).json({ error: 'Invalid quiz ID' });
    }

    const quiz = await QuizService.getQuizById(quizId);
    if (!quiz || quiz.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const results = await QuizService.getQuizResults(quizId);
    res.status(200).json({ results });
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const syncQuizResults = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const quizId = parseInt(req.params.id as string, 10);
    const { sheetId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (isNaN(quizId) || !sheetId) {
      return res.status(400).json({ error: 'Invalid quiz ID or missing Sheet ID' });
    }

    const quiz = await QuizService.getQuizById(quizId);
    if (!quiz || quiz.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const results = await QuizService.getQuizResults(quizId);
    if (!results || results.length === 0) {
      return res.status(400).json({ error: 'No scores found to sync' });
    }

    const formattedScores = results.map((r: any) => ({
      userId: r.userId.toString(),
      userName: r.userName || "Player",
      score: r.score || 0,
    }));

    const success = await GoogleSheetsService.syncQuizScores(
      quizId,
      quiz.title,
      'Historical Export',
      userId,
      sheetId,
      formattedScores
    );

    if (success) {
      res.status(200).json({ message: 'Scores synced successfully' });
    } else {
      res.status(500).json({ error: 'Failed to sync scores. Please ensure you have authenticated with Google and provided a valid Sheet ID with edit access.' });
    }
  } catch (error: any) {
    console.error('Error syncing quiz results to sheets:', error);
    // Return the specific error message from GoogleSheetsService
    res.status(400).json({ error: error.message || 'Failed to sync scores to Google Sheets' });
  }
};