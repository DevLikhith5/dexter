import { z } from 'zod';

// User schemas
export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Quiz schemas
// Quiz schemas
export const createQuizSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  maxParticipants: z.number().int().positive().optional(),
  questions: z.array(z.object({
    content: z.string().min(1),
    type: z.enum(['mcq', 'tf', 'short_answer']), // Changed to enum to match Zod
    correctAnswer: z.string().min(1),
    options: z.array(z.string()).optional(),
    points: z.number().int().positive().optional(),
    explanation: z.string().optional(), // Added explanation
    source: z.string().optional()       // Added source
  })),
  settings: z.object({
    timer: z.number().int().positive(),
    participantLimit: z.number().int().positive(),
    showLeaderboard: z.boolean(),
    shuffleQuestions: z.boolean(),
    showTeacherNotes: z.boolean(),
    gameMode: z.enum(['classic', 'team', 'speed']),
    googleSheetId: z.string().optional()
  }).optional()
});

// Question schemas
export const createQuestionSchema = z.object({
  quizId: z.number().int().positive(),
  content: z.string().min(1),
  type: z.enum(['mcq', 'tf', 'short_answer']),
  correctAnswer: z.string().min(1),
  options: z.array(z.string()).optional(),
  points: z.number().int().positive().optional(),
});

// Answer schemas
export const submitAnswerSchema = z.object({
  attemptId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  content: z.string().min(1),
});

// QuizAttempt schemas
export const createQuizAttemptSchema = z.object({
  quizId: z.number().int().positive(),
  userId: z.number().int().positive(),
  totalScore: z.number().int().nonnegative(),
});

// Answer submission schemas
export const createAnswerSchema = z.object({
  attemptId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  content: z.string().min(1),
});