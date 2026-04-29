import { QuizService, type Quiz } from '../services/quizService';
import { RedisQuizService } from '../services/redisQuizService';
import { GraphRagService } from '../services/graphRagService';

export interface Document {
  title: string;
  content: string;
}

export interface GeneratedQuestion {
  content: string;
  type: 'mcq' | 'tf' | 'short_answer';
  correctAnswer: string;
  options?: string[];
  points?: number;
}

export class APIGatewayService {
  /**
   * Process a document
   */
  static async processDocument(document: Document): Promise<void> {
    throw new Error('AI Service is currently disabled.');
  }

  /**
   * Generate questions from a document
   */
  static async generateQuestionsFromDocument(
    document: Document,
    numQuestions: number = 5
  ): Promise<GeneratedQuestion[]> {
    throw new Error('AI Service is currently disabled.');
  }

  /**
   * Evaluate an answer
   */
  static async evaluateAnswer(
    question: string,
    correctAnswer: string,
    userAnswer: string
  ): Promise<{ isCorrect: boolean; explanation?: string }> {
    // Normalization logic: lower case, trim, remove non-alphanumeric at ends if possible, etc.
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s\s+/g, ' ');
    
    const normUser = normalize(userAnswer);
    const normCorrect = normalize(correctAnswer);

    const isCorrect = normUser === normCorrect;
    
    return {
      isCorrect,
      explanation: isCorrect ? "Correct answer!" : `The correct answer was: ${correctAnswer}`
    };
  }

  /**
   * Create a quiz with AI-generated questions
   */
  static async createQuizWithAI(
    title: string,
    description: string,
    userId: number,
    document: Document,
    numQuestions: number = 5
  ): Promise<Quiz> {
    try {
      // 1. Ingest document
      const ingestRes = await GraphRagService.ingestData('text', document.content);
      
      // 2. Generate questions from graph
      const genRes = await GraphRagService.generateQuestions(ingestRes.graph_id, numQuestions);

      // 3. Format into CreateQuizInput
      const questions = genRes.mcqs.map((mcq) => ({
        content: mcq.question,
        type: 'mcq' as const,
        correctAnswer: mcq.answer,
        options: mcq.options,
        points: 1
      }));

      // 4. Save to db
      const newQuiz = await QuizService.createQuiz({
        title,
        description,
        userId,
        questions
      });

      return newQuiz;
    } catch (e) {
      console.error("AI Gateway generation failed", e);
      throw new Error("Failed to generate quiz using AI");
    }
  }

  /**
   * Start a multiplayer quiz session with real-time capabilities
   */
  static async startMultiplayerQuizSession(
    quizId: number,
    hostUserId: string,
    maxPlayers?: number
  ): Promise<string> {
    // Generate a unique session ID
    const sessionId = `quiz_${quizId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch quiz to get settings and maxParticipants
    const quiz = await QuizService.getQuizById(quizId);
    const effectiveMaxPlayers = maxPlayers 
      ?? quiz?.maxParticipants 
      ?? quiz?.settings?.participantLimit 
      ?? 50;

    // Initialize the quiz session in Redis with settings
    await RedisQuizService.createQuizSession(sessionId, quizId, hostUserId, effectiveMaxPlayers, quiz?.settings || {});

    return sessionId;
  }
}