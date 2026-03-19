import { db } from '../db';
import { quizzes, questions, quizAttempts, answers, users } from '../db/schema';
import { eq, desc, and, gte, ilike, inArray, count } from 'drizzle-orm';
import { AIWorkerService } from './aiWorkerService';

export interface Quiz {
  id: number;
  title: string;
  description: string | null;
  userId: number;
  isActive: boolean | null;
  maxParticipants: number | null;
  settings: any | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: number;
  quizId: number;
  content: string;
  type: 'mcq' | 'tf' | 'short_answer';
  correctAnswer: string;
  options: string[] | null;
  explanation: string | null;
  source: string | null;
  points: number | null;
  createdAt: Date;
}

export interface CreateQuizInput {
  title: string;
  description?: string;
  userId: number;
  maxParticipants?: number;
  graphId?: string;
  questions: {
    content: string;
    type: 'mcq' | 'tf' | 'short_answer';
    correctAnswer: string;
    options?: string[];
    points?: number;
    explanation?: string;
    source?: string;
  }[];
  settings?: any;
}

export interface CreateQuestionInput {
  quizId: number;
  content: string;
  type: 'mcq' | 'tf' | 'short_answer';
  correctAnswer: string;
  options?: string[];
  points?: number;
}

export class QuizService {
  static async createQuiz(quizData: CreateQuizInput): Promise<Quiz> {
    return await db.transaction(async (tx) => {
      // 1. Create the Quiz
      const [newQuiz] = await tx
        .insert(quizzes)
        .values({
          title: quizData.title,
          description: quizData.description,
          userId: quizData.userId,
          maxParticipants: quizData.maxParticipants || 10,
          settings: quizData.settings,
          graphId: quizData.graphId
        })
        .returning();

      if (!newQuiz) {
        throw new Error('Failed to create quiz');
      }

      // 2. Add Questions
      if (quizData.questions && quizData.questions.length > 0) {
        for (const q of quizData.questions) {
          await tx.insert(questions).values({
            quizId: newQuiz.id,
            content: q.content,
            type: q.type,
            correctAnswer: q.correctAnswer,
            options: q.options,
            points: q.points || 1,
            explanation: q.explanation,
            source: q.source
          });
        }
      }

      return newQuiz;
    });
  }

  static async getQuizById(quizId: number): Promise<Quiz | null> {
    const [result] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId));

    if (!result) {
      return null;
    }

    // Ensure all required fields have proper values
    return {
      ...result,
      description: result.description ?? null,
      isActive: result.isActive ?? null,
      maxParticipants: result.maxParticipants ?? null,
      settings: result.settings ?? null,
    };
  }

  static async getUserQuizzes(
    userId: number,
    options?: { limit?: number; offset?: number; search?: string; isActive?: boolean }
  ): Promise<Quiz[]> {
    const conditions = [eq(quizzes.userId, userId)];
    
    if (options?.search) {
      conditions.push(ilike(quizzes.title, `%${options.search}%`));
    }
    
    if (options?.isActive !== undefined) {
      conditions.push(eq(quizzes.isActive, options.isActive));
    }

    let query = db
      .select()
      .from(quizzes)
      .where(and(...conditions))
      .orderBy(desc(quizzes.createdAt))
      .$dynamic();

    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);

    const results = await query;
    const quizIds = results.map(q => q.id);

    let attemptCounts: Record<number, number> = {};
    if (quizIds.length > 0) {
      const counts = await db
        .select({
          quizId: quizAttempts.quizId,
          count: count(quizAttempts.id)
        })
        .from(quizAttempts)
        .where(inArray(quizAttempts.quizId, quizIds))
        .groupBy(quizAttempts.quizId);

      for (const row of counts) {
        attemptCounts[row.quizId] = Number(row.count) || 0;
      }
    }

    // Ensure all required fields have proper values
    return results.map((quiz: any) => ({
      ...quiz,
      description: quiz.description ?? null,
      isActive: quiz.isActive ?? null,
      maxParticipants: quiz.maxParticipants ?? null,
      settings: quiz.settings ?? null,
      attemptCount: attemptCounts[quiz.id] || 0
    }));
  }

  static async getParticipatedQuizzes(userId: number): Promise<any[]> {
    const results = await db
      .select({
        quiz: quizzes,
        attemptId: quizAttempts.id,
        score: quizAttempts.score,
        totalScore: quizAttempts.totalScore,
        completedAt: quizAttempts.completedAt,
        attemptedAt: quizAttempts.createdAt
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.createdAt));

    return results.map(row => ({
      ...row.quiz,
      description: row.quiz.description ?? null,
      isActive: row.quiz.isActive ?? null,
      maxParticipants: row.quiz.maxParticipants ?? null,
      settings: row.quiz.settings ?? null,
      attempt: {
        id: row.attemptId,
        score: row.score,
        totalScore: row.totalScore,
        completedAt: row.completedAt,
        createdAt: row.attemptedAt
      }
    }));
  }

  static async getQuizResults(quizId: number): Promise<any[]> {
    const results = await db
      .select({
        userId: users.id,
        userName: users.username,
        score: quizAttempts.score,
        totalScore: quizAttempts.totalScore,
        completedAt: quizAttempts.completedAt,
      })
      .from(quizAttempts)
      .innerJoin(users, eq(quizAttempts.userId, users.id))
      .where(eq(quizAttempts.quizId, quizId))
      .orderBy(desc(quizAttempts.score), desc(quizAttempts.completedAt));

    return results;
  }

  static async updateQuiz(quizId: number, userId: number, updates: Partial<CreateQuizInput>): Promise<Quiz> {
    const [updatedQuiz] = await db
      .update(quizzes)
      .set({
        title: updates.title,
        description: updates.description,
        maxParticipants: updates.maxParticipants,
        settings: updates.settings,
        updatedAt: new Date()
      })
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .returning();
      
    if (!updatedQuiz) throw new Error("Quiz not found or unauthorized");

    return {
      ...updatedQuiz,
      description: updatedQuiz.description ?? null,
      isActive: updatedQuiz.isActive ?? null,
      maxParticipants: updatedQuiz.maxParticipants ?? null,
      settings: updatedQuiz.settings ?? null
    } as Quiz;
  }

  static async deleteQuiz(quizId: number, userId: number): Promise<void> {
    const [deletedQuiz] = await db
      .delete(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .returning();
      
    if (!deletedQuiz) throw new Error("Quiz not found or unauthorized");
  }

  static async addQuestionToQuiz(questionData: CreateQuestionInput): Promise<Question> {
    const [newQuestion] = await db
      .insert(questions)
      .values({
        quizId: questionData.quizId,
        content: questionData.content,
        type: questionData.type,
        correctAnswer: questionData.correctAnswer,
        options: questionData.options,
        points: questionData.points || 1,
      })
      .returning();

    if (!newQuestion) {
      throw new Error('Failed to add question to quiz');
    }

    return newQuestion;
  }

  static async getQuestionsForQuiz(quizId: number): Promise<Question[]> {
    const results = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId));

    // Ensure all required fields have proper values
    return results.map(question => ({
      ...question,
      options: question.options ?? null,
      explanation: question.explanation ?? null,
      source: question.source ?? null,
      points: question.points ?? null
    }));
  }

  static async generateQuestionsFromDocument(
    quizId: number,
    documentTitle: string,
    documentContent: string,
    numQuestions: number = 5
  ): Promise<Question[]> {
    // Process the document with AI worker
    await AIWorkerService.processDocument({
      title: documentTitle,
      content: documentContent
    });

    // Generate questions from the processed document
    const aiGeneratedQuestions = await AIWorkerService.generateQuestionsFromDocument({
      title: documentTitle,
      content: documentContent
    }, numQuestions);

    // Add the generated questions to the quiz
    const addedQuestions: Question[] = [];
    for (const q of aiGeneratedQuestions) {
      const question = await QuizService.addQuestionToQuiz({
        quizId,
        content: q.content,
        type: q.type,
        correctAnswer: q.correctAnswer,
        options: q.options,
        points: q.points
      });
      addedQuestions.push(question);
    }

    return addedQuestions;
  }

  static async startQuiz(quizId: number): Promise<void> {
    await db
      .update(quizzes)
      .set({ isActive: true })
      .where(eq(quizzes.id, quizId));
  }

  static async endQuiz(quizId: number): Promise<void> {
    // Keep the quiz as active/published even when a session ends
    // so it doesn't disappear from the Published tab.
    console.log(`[DEBUG] Session ended for quiz ${quizId}. Keeping it published.`);
  }
}