import redisClient from '../config/redis';

export class RedisQuizService {
  // Quiz session management
  static async createQuizSession(sessionId: string, quizId: number, hostUserId: string): Promise<void> {
    await redisClient.hSet(`quiz_session:${sessionId}`, {
      id: sessionId,
      quizId: quizId.toString(),
      hostUserId,
      currentQuestionIndex: '-1',
      participantCount: '0',
      isActive: 'false',
      startTime: new Date().toISOString(),
    });
  }

  static async getQuizSession(sessionId: string): Promise<Record<string, string> | null> {
    const session = await redisClient.hGetAll(`quiz_session:${sessionId}`);
    return Object.keys(session).length > 0 ? session : null;
  }

  static async updateParticipantCount(sessionId: string, count: number): Promise<void> {
    await redisClient.hSet(`quiz_session:${sessionId}`, 'participantCount', count.toString());
  }

  static async setQuizActive(sessionId: string, isActive: boolean): Promise<void> {
    await redisClient.hSet(`quiz_session:${sessionId}`, 'isActive', isActive.toString());
  }

  // Score management
  static async updatePlayerScore(sessionId: string, userId: string, score: number): Promise<void> {
    await redisClient.hSet(`quiz_scores:${sessionId}`, userId, score.toString());
  }

  static async getPlayerScore(sessionId: string, userId: string): Promise<number> {
    const score = await redisClient.hGet(`quiz_scores:${sessionId}`, userId);
    return score ? parseInt(score) : 0;
  }

  static async getAllScores(sessionId: string): Promise<{ userId: string; score: number; userName?: string }[]> {
    const scores = await redisClient.hGetAll(`quiz_scores:${sessionId}`);
    const names = await redisClient.hGetAll(`quiz_names:${sessionId}`);
    return Object.entries(scores).map(([userId, score]) => ({
      userId,
      score: parseInt(score),
      userName: names[userId]
    })).sort((a, b) => b.score - a.score); // Sort by score descending
  }

  static async incrementPlayerScore(sessionId: string, userId: string, points: number): Promise<number> {
    const newScore = await redisClient.hIncrBy(`quiz_scores:${sessionId}`, userId, points);
    return newScore;
  }

  // Question management
  static async setCurrentQuestion(sessionId: string, questionIndex: number): Promise<void> {
    await redisClient.hSet(`quiz_session:${sessionId}`, 'currentQuestionIndex', questionIndex.toString());
  }

  static async getCurrentQuestion(sessionId: string): Promise<number> {
    const index = await redisClient.hGet(`quiz_session:${sessionId}`, 'currentQuestionIndex');
    return index ? parseInt(index) : 0;
  }

  // Player management
  static async setPlayerName(sessionId: string, userId: string, userName: string): Promise<void> {
    await redisClient.hSet(`quiz_names:${sessionId}`, userId, userName);
  }

  // Player management
  static async addPlayerToSession(sessionId: string, userId: string): Promise<void> {
    await redisClient.sAdd(`quiz_players:${sessionId}`, userId);
  }

  static async removePlayerFromSession(sessionId: string, userId: string): Promise<void> {
    await redisClient.sRem(`quiz_players:${sessionId}`, userId);
  }

  static async getPlayersInSession(sessionId: string): Promise<string[]> {
    return await redisClient.sMembers(`quiz_players:${sessionId}`);
  }

  // Cleanup
  static async cleanupSession(sessionId: string): Promise<void> {
    await redisClient.del(`quiz_session:${sessionId}`);
    await redisClient.del(`quiz_scores:${sessionId}`);
    await redisClient.del(`quiz_players:${sessionId}`);
    await redisClient.del(`quiz_names:${sessionId}`);
  }
}