import { type Request, type Response } from 'express';
import { db } from '../db';
import { quizzes, quizAttempts, users } from '../db/schema';
import { eq, count, sql } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth';

interface AuthRequest extends Request {
  userId?: number;
}

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 1. Total Quizzes created by user
    const totalQuizzesResult = await db
        .select({ value: count() })
        .from(quizzes)
        .where(eq(quizzes.userId, userId));
    const totalQuizzesCount = Number(totalQuizzesResult?.[0]?.value || 0);

    // 2. Active Quizzes (published)
    const activeQuizzesResult = await db
        .select({ value: count() })
        .from(quizzes)
        .where(sql`${quizzes.userId} = ${userId} AND ${quizzes.isActive} = true`);
    const activeQuizzesCount = Number(activeQuizzesResult?.[0]?.value || 0);

    // 3. Total Students / Attempts across all user's quizzes
    // We get attempts that belong to quizzes owned by this user
    const [totalAttemptsResult] = await db
        .select({ count: count() })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .where(eq(quizzes.userId, userId));
    const totalStudentsCount = totalAttemptsResult?.count;

    // 4. Average score
    const [avgScoreResult] = await db
        .select({ 
            avgScore: sql<number>`AVG(CAST(${quizAttempts.score} AS FLOAT) / NULLIF(${quizAttempts.totalScore}, 0)) * 100` 
        })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .where(eq(quizzes.userId, userId));
    
    let avgScore = 0;
    if (avgScoreResult && avgScoreResult.avgScore !== null) {
        avgScore = Math.round(avgScoreResult.avgScore);
    }

    res.status(200).json({
        totalQuizzes: totalQuizzesCount,
        activeQuizzes: activeQuizzesCount,
        totalStudents: totalStudentsCount,
        averageScore: avgScore,
        completionRate: 85 // Mocking completion rate since attempt finish is ill-defined in current schema
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReports = async (req: AuthRequest, res: Response) => {
    // Stub for performance reports
    res.status(200).json({
        message: "Reports feature coming soon. Currently under development.",
        data: []
    });
};

export const getCalendarEvents = async (req: AuthRequest, res: Response) => {
    // Stub for calendar events
    res.status(200).json({
        message: "Calendar events coming soon. Currently under development.",
        data: []
    });
};
