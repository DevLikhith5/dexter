import { type Request, type Response } from 'express';
import { QuizAttemptService } from '../services/quizAttemptService';
import { QuizService } from '../services/quizService';
import { submitAnswerSchema } from '../types';
import { db } from '../db';
import { questions } from '../db/schema';
import { eq } from 'drizzle-orm';

interface AuthRequest extends Request {
  userId?: number;
}

export const submitAnswer = async (req: AuthRequest, res: Response) => {
  try {
    const { attemptId, questionId, content } = submitAnswerSchema.parse(req.body);
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify that the attempt belongs to the user
    const attempt = await QuizAttemptService.getAttemptById(attemptId);
    if (!attempt || attempt.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get the question to verify it belongs to the same quiz as the attempt
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));

    if (!question || question.quizId !== attempt.quizId) {
      return res.status(400).json({ error: 'Invalid question for this quiz attempt' });
    }

    // Evaluate answer before submission
    const { APIGatewayService } = await import('../services/apiGatewayService');
    const evaluationResult = await APIGatewayService.evaluateAnswer(
      question.content,
      question.correctAnswer,
      content
    );
    const isCorrect = evaluationResult.isCorrect;

    // Submit the answer
    const answer = await QuizAttemptService.submitAnswer(
      { attemptId, questionId, content },
      isCorrect,
      isCorrect ? (question.points || 10) : 0
    );

    res.status(200).json({
      message: 'Answer submitted successfully',
      answer,
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};