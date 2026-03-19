// services/api/quiz/quizService.ts
import { makeRequest } from '../utils/requestHandler';
import { Quiz, Question } from '../../../types';

export interface CreateQuizData {
  title: string;
  description?: string;
  questions: Partial<Question>[];
}

export interface QuizFilterOptions {
  limit?: number;
  offset?: number;
  isActive?: boolean;
}

class QuizService {
  async createQuiz(quizData: CreateQuizData): Promise<Quiz> {
    return makeRequest<Quiz>('/quizzes', {
      method: 'POST',
      body: quizData,
    });
  }

  async getAllQuizzes(options?: QuizFilterOptions): Promise<Quiz[]> {
    const params = new URLSearchParams();
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.isActive !== undefined) params.append('isActive', options.isActive.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `/quizzes?${queryString}` : '/quizzes';
    
    const response = await makeRequest<{ quizzes: Quiz[] }>(endpoint);
    return response.quizzes;
  }

  async getQuizById(id: number): Promise<Quiz> {
    return makeRequest<Quiz>(`/quizzes/${id}`);
  }

  async getParticipatedQuizzes(): Promise<any[]> {
    const response = await makeRequest<{ quizzes: any[] }>('/quizzes/participated');
    return response.quizzes;
  }

  async getQuizResults(quizId: number): Promise<any[]> {
    const response = await makeRequest<{ results: any[] }>(`/quizzes/${quizId}/results`);
    return response.results;
  }

  async syncQuizResults(quizId: number, sheetId: string): Promise<{ message: string }> {
    return makeRequest<{ message: string }>(`/quizzes/${quizId}/sync-results`, {
      method: 'POST',
      body: { sheetId },
    });
  }

  async syncGoogleSheets(sessionId: string, sheetId: string): Promise<{ message: string }> {
    return makeRequest<{ message: string }>(`/quizzes/${sessionId}/sync-sheets`, {
      method: 'POST',
      body: { sheetId },
    });
  }

  async updateQuiz(id: number, quizData: Partial<CreateQuizData>): Promise<Quiz> {
    return makeRequest<Quiz>(`/quizzes/${id}`, {
      method: 'PUT',
      body: quizData,
    });
  }

  async deleteQuiz(id: number): Promise<{ message: string }> {
    return makeRequest<{ message: string }>(`/quizzes/${id}`, {
      method: 'DELETE',
    });
  }

  async createQuizWithAI(
    title: string,
    content: string,
    numQuestions: number,
    difficulty: string,
    description?: string
  ): Promise<Quiz> {
    return makeRequest<Quiz>('/gateway/create-quiz-with-ai', {
      method: 'POST',
      body: {
        title,
        description: description || '',
        document: {
          title,
          content
        },
        numQuestions,
        difficulty
      },
    });
  }

  async startMultiplayerSession(quizId: number, maxPlayers: number): Promise<{ sessionId: string }> {
    return makeRequest<{ sessionId: string }>('/gateway/start-multiplayer-session', {
      method: 'POST',
      body: {
        quizId,
        maxPlayers
      },
    });
  }

  async getDashboardStats(): Promise<{
    totalQuizzes: number;
    activeQuizzes: number;
    totalStudents: number;
    averageScore: number;
    completionRate: number;
  }> {
    return makeRequest('/stats/dashboard');
  }

  async getReports(): Promise<any> {
    return makeRequest('/stats/reports');
  }

  async getCalendarEvents(): Promise<any> {
    return makeRequest('/stats/calendar');
  }
}

export const quizService = new QuizService();