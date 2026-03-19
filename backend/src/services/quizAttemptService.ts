import { db } from '../db';
import { quizAttempts, answers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
// removed AIWorkerService

export interface QuizAttempt {
  id: number;
  quizId: number;
  userId: number;
  score: number | null;
  totalScore: number;
  completedAt: Date | null;
  createdAt: Date;
}

export interface Answer {
  id: number;
  attemptId: number;
  questionId: number;
  content: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  answeredAt: Date | null;
}

export interface SubmitAnswerInput {
  attemptId: number;
  questionId: number;
  content: string;
}

export class QuizAttemptService {
  static async createQuizAttempt(quizId: number, userId: number, totalScore: number): Promise<QuizAttempt> {
    const [newAttempt] = await db
      .insert(quizAttempts)
      .values({
        quizId,
        userId,
        totalScore,
      })
      .returning();

    if (!newAttempt) {
      throw new Error('Failed to create quiz attempt');
    }

    // Ensure all required fields have proper values
    return {
      ...newAttempt,
      score: newAttempt.score ?? 0,
      completedAt: newAttempt.completedAt ?? null
    };
  }

  static async submitAnswer(answerData: SubmitAnswerInput, isCorrect: boolean, pointsAwarded: number): Promise<Answer> {

    const [newAnswer] = await db
      .insert(answers)
      .values({
        attemptId: answerData.attemptId,
        questionId: answerData.questionId,
        content: answerData.content,
        isCorrect,
        pointsAwarded,
      })
      .returning();

    if (!newAnswer) {
      throw new Error('Failed to submit answer');
    }

    // Update the attempt score
    await QuizAttemptService.updateAttemptScore(answerData.attemptId);

    return newAnswer;
  }

  static async updateAttemptScore(attemptId: number): Promise<void> {
    // Calculate the total score for this attempt based on correct answers
    const attemptAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.attemptId, attemptId));

    const totalPoints = attemptAnswers.reduce((sum, ans) => {
      // Only add points that are not null
      return sum + (ans.pointsAwarded || 0);
    }, 0);

    await db
      .update(quizAttempts)
      .set({ score: totalPoints })
      .where(eq(quizAttempts.id, attemptId));
  }

  static async getAttemptById(attemptId: number): Promise<QuizAttempt | null> {
    const [result] = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, attemptId));

    if (!result) {
      return null;
    }

    // Ensure all required fields have proper values
    return {
      ...result,
      score: result.score ?? null,
      completedAt: result.completedAt ?? null
    };
  }

  static async getUserAttemptsForQuiz(userId: number, quizId: number): Promise<QuizAttempt[]> {
    const results = await db
      .select()
      .from(quizAttempts)
      .where(and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.quizId, quizId)
      ));

    // Ensure all required fields have proper values
    return results.map(attempt => ({
      ...attempt,
      score: attempt.score ?? 0,
      completedAt: attempt.completedAt ?? null
    }));
  }

  static async getAnswersForAttempt(attemptId: number): Promise<Answer[]> {
    const results = await db
      .select()
      .from(answers)
      .where(eq(answers.attemptId, attemptId));

    // Ensure all required fields have proper values
    return results.map(answer => ({
      ...answer,
      isCorrect: answer.isCorrect ?? null,
      pointsAwarded: answer.pointsAwarded ?? null,
      answeredAt: answer.answeredAt ?? null
    }));
  }
}