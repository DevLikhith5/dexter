// types/index.ts

export interface User {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Quiz {
  id: number;
  title: string;
  description?: string;
  userId: number;
  isActive: boolean;
  maxParticipants: number;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: number;
  quizId: number;
  content: string;
  type: 'mcq' | 'tf' | 'short_answer';
  correctAnswer: string;
  options?: string[];
  points: number;
  createdAt: string;
}

export interface QuizAttempt {
  id: number;
  quizId: number;
  userId: number;
  score: number;
  totalScore: number;
  completedAt?: string;
  createdAt: string;
}

export interface Answer {
  id: number;
  attemptId: number;
  questionId: number;
  content: string;
  isCorrect: boolean;
  pointsAwarded: number;
  answeredAt: string;
}