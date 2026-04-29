import redisClient from '../config/redis';

export class RedisQuizService {
  // Quiz session management
  static async createQuizSession(sessionId: string, quizId: number, hostUserId: string, maxPlayers: number = 50, settings: any = {}): Promise<void> {
    await redisClient.hSet(`quiz_session:${sessionId}`, {
      id: sessionId,
      quizId: quizId.toString(),
      hostUserId,
      currentQuestionIndex: '-1',
      participantCount: '0',
      isActive: 'false',
      startTime: new Date().toISOString(),
      maxPlayers: maxPlayers.toString(),
      settings: JSON.stringify(settings),
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
  static async getSessionSettings(sessionId: string): Promise<any | null> {
    const settingsStr = await redisClient.hGet(`quiz_session:${sessionId}`, 'settings');
    if (!settingsStr) return null;
    try {
      return JSON.parse(settingsStr);
    } catch {
      return null;
    }
  }

  static async getMaxPlayers(sessionId: string): Promise<number> {
    const maxPlayers = await redisClient.hGet(`quiz_session:${sessionId}`, 'maxPlayers');
    return maxPlayers ? parseInt(maxPlayers) : 50;
  }

  static async getPlayerCount(sessionId: string): Promise<number> {
    const players = await redisClient.sCard(`quiz_players:${sessionId}`);
    return players;
  }

  // Team management
  static async setPlayerTeam(sessionId: string, userId: string, teamName: string): Promise<void> {
    await redisClient.hSet(`quiz_teams:${sessionId}`, userId, teamName);
  }

  static async getPlayerTeam(sessionId: string, userId: string): Promise<string | null> {
    return await redisClient.hGet(`quiz_teams:${sessionId}`, userId);
  }

  static async getAllTeams(sessionId: string): Promise<Record<string, string>> {
    return await redisClient.hGetAll(`quiz_teams:${sessionId}`);
  }

  static async getTeamScores(sessionId: string): Promise<{ teamName: string; totalScore: number; members: string[] }[]> {
    const teams = await redisClient.hGetAll(`quiz_teams:${sessionId}`);
    const scores = await redisClient.hGetAll(`quiz_scores:${sessionId}`);
    const names = await redisClient.hGetAll(`quiz_names:${sessionId}`);

    const teamMap: Record<string, { totalScore: number; members: string[] }> = {};

    for (const [userId, teamName] of Object.entries(teams)) {
      if (!teamMap[teamName]) {
        teamMap[teamName] = { totalScore: 0, members: [] };
      }
      const userScore = parseInt(scores[userId] || '0');
      teamMap[teamName].totalScore += userScore;
      teamMap[teamName].members.push(names[userId] || userId);
    }

    return Object.entries(teamMap)
      .map(([teamName, data]) => ({
        teamName,
        totalScore: data.totalScore,
        members: data.members
      }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  static async getNextTeam(sessionId: string): Promise<string> {
    const teams = await redisClient.hGetAll(`quiz_teams:${sessionId}`);
    const teamACount = Object.values(teams).filter(t => t === 'Team A').length;
    const teamBCount = Object.values(teams).filter(t => t === 'Team B').length;
    return teamACount <= teamBCount ? 'Team A' : 'Team B';
  }

  static async cleanupSession(sessionId: string): Promise<void> {
    await redisClient.del(`quiz_session:${sessionId}`);
    await redisClient.del(`quiz_scores:${sessionId}`);
    await redisClient.del(`quiz_players:${sessionId}`);
    await redisClient.del(`quiz_names:${sessionId}`);
    await redisClient.del(`quiz_teams:${sessionId}`);
  }
}
