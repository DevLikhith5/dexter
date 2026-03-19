import { pgTable, serial, text, integer, timestamp, boolean, varchar, jsonb } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  password: text('password'), // Made nullable for Google Auth users
  googleId: varchar('google_id', { length: 255 }).unique(),
  avatarUrl: varchar('avatar_url', { length: 255 }), // Google profile picture
  refreshToken: varchar('refresh_token', { length: 255 }),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Documents / Knowledge Store table
// Tracks every file/link/topic that a user ingests into the Graph RAG service
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),        // Human-readable label
  sourceValue: text('source_value').notNull(),              // Original URL, filename, or topic text
  type: varchar('type', { length: 20 }).notNull().default('url'), // 'url' | 'pdf' | 'topic'
  graphId: varchar('graph_id', { length: 255 }).notNull(),  // Graph RAG graph ID
  userId: integer('user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Quizzes table
export const quizzes = pgTable('quizzes', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'), // Can be null
  userId: integer('user_id').references(() => users.id).notNull(),
  graphId: varchar('graph_id', { length: 255 }), // Graph RAG ID
  isActive: boolean('is_active').default(false), // Can be null in some contexts
  maxParticipants: integer('max_participants').default(10), // Can be null in some contexts
  settings: jsonb('settings'), // Store quiz settings (timer, gameMode, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Questions table
export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  quizId: integer('quiz_id').references(() => quizzes.id).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 20 }).$type<'mcq' | 'tf' | 'short_answer'>().notNull(), // 'mcq', 'tf', 'short_answer'
  correctAnswer: text('correct_answer').notNull(),
  options: text('options').array(), // For MCQ options
  explanation: text('explanation'), // AI explanation
  source: text('source'), // Source material reference
  points: integer('points').default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Quiz Attempts table
export const quizAttempts = pgTable('quiz_attempts', {
  id: serial('id').primaryKey(),
  quizId: integer('quiz_id').references(() => quizzes.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  score: integer('score'), // Allow null initially
  totalScore: integer('total_score').notNull(),
  completedAt: timestamp('completed_at'), // Allow null until completed
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Answers table
export const answers = pgTable('answers', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').references(() => quizAttempts.id).notNull(),
  questionId: integer('question_id').references(() => questions.id).notNull(),
  content: text('content').notNull(),
  isCorrect: boolean('is_correct'), // Allow null until evaluated
  pointsAwarded: integer('points_awarded'), // Allow null until evaluated
  answeredAt: timestamp('answered_at').defaultNow(),
});