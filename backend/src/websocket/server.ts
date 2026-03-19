import { WebSocketServer, WebSocket } from 'ws';
import redisClient from '../config/redis';
import { RedisQuizService } from '../services/redisQuizService';
import { db } from '../db';
import { questions, quizzes } from '../db/schema';
import { eq } from 'drizzle-orm';
import { APIGatewayService } from '../services/apiGatewayService';
import { GoogleSheetsService } from '../services/googleSheetsService';

interface QuizSession {
  id: string;
  hostUserId?: string;
  hostWs?: WebSocket;
  participants: WebSocket[];
  currentQuestionIndex: number;
  scores: Map<string, number>;
  startTime?: Date;
  submittedAnswers: Set<string>;
  timerTimeout?: NodeJS.Timeout;
}


const activeConnections = new Map<WebSocket, string>();
const activeSessions = new Map<string, QuizSession>();

export const setupWebSocket = (wss: WebSocketServer) => {
  wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected');

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        console.error('Error parsing message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      // Handle disconnection logic
      handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
};

const handleMessage = async (ws: WebSocket, message: any) => {
  switch (message.type) {
    case 'join_quiz':
      await joinQuizSession(ws, message.payload);
      break;
    case 'submit_answer':
      await handleAnswerSubmission(ws, message.payload);
      break;
    case 'start_quiz':
      await startQuiz(message.payload.sessionId);
      break;
    case 'next_question':
      await nextQuestion(message.payload.sessionId);
      break;
    case 'leave_quiz':
      await handleLeaveQuiz(ws, message.payload);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
};

const joinQuizSession = async (ws: WebSocket, payload: { sessionId: string; userId: string; userName?: string }) => {
  const { sessionId, userId, userName } = payload;

  try {
    // Validate session ID format
    if (!sessionId || typeof sessionId !== 'string') {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Invalid session ID format' }
      }));
      return;
    }

    // Add to active connections map
    activeConnections.set(ws, sessionId);

    // Check if session exists in memory
    let session = activeSessions.get(sessionId);

    if (!session) {
      // Check if session exists in Redis
      const sessionData = await RedisQuizService.getQuizSession(sessionId);

      if (sessionData) {
        // Session exists in Redis, load it to memory
        session = {
          id: sessionId,
          hostUserId: sessionData.hostUserId,
          participants: [ws], // Will be updated as other participants connect
          currentQuestionIndex: parseInt(sessionData.currentQuestionIndex ?? '-1'),
          scores: new Map<string, number>(),
          startTime: sessionData.startTime ? new Date(sessionData.startTime) : undefined,
          submittedAnswers: new Set<string>(),
        };

        // Load scores from Redis
        const scores = await RedisQuizService.getAllScores(sessionId);
        scores.forEach(({ userId, score }) => {
          session!.scores.set(userId, score);
        });
      } else {
        // Session doesn't exist in Redis, this shouldn't happen in a real scenario
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Session not found' }
        }));
        return;
      }

      activeSessions.set(sessionId, session);
    } else {
      // Add to existing session in memory
      session.participants.push(ws);
    }

    // Check if user is host
    let isHost = false;
    if (session.hostUserId === userId) {
      isHost = true;
      session.hostWs = ws;
    }

    if (!isHost) {
      // Add player to session in Redis only if not host
      await RedisQuizService.addPlayerToSession(sessionId, userId);
      if (userName) {
        await RedisQuizService.setPlayerName(sessionId, userId, userName);
      }

      // Initialize user score in memory and Redis if not exists
      if (!session.scores.has(userId)) {
        session.scores.set(userId, 0);
        await RedisQuizService.updatePlayerScore(sessionId, userId, 0);
      }
    }
    
    // Update participant count in Redis (players only)
    const players = await RedisQuizService.getPlayersInSession(sessionId);
    const participantCount = players.length;
    await RedisQuizService.updateParticipantCount(sessionId, participantCount);

    let currentQuestionPayload = null;
    if (session.currentQuestionIndex >= 0) {
      // Quiz is active, fetch current question
      const questionsStr = await redisClient.get(`quiz_questions:${sessionId}`);
      if (questionsStr) {
        const questions = JSON.parse(questionsStr);
        console.log(`[DEBUG] Session ${sessionId} active. Index: ${session.currentQuestionIndex}. Questions count: ${questions.length}`);
        const currentQuestion = questions[session.currentQuestionIndex];
        if (currentQuestion) {
          currentQuestionPayload = {
            id: currentQuestion.id,
            content: currentQuestion.content,
            type: currentQuestion.type,
            options: currentQuestion.options,
            points: currentQuestion.points
          };
        }
      } else {
        console.log(`[DEBUG] Session ${sessionId} active but NO questions in Redis!`);
      }
    } else {
      console.log(`[DEBUG] Session ${sessionId} join. Index is ${session.currentQuestionIndex} (waiting state)`);
    }

    // Send success response with initial quiz data
    const payload = {
      sessionId,
      message: 'Successfully joined quiz session',
      participantCount,
      currentQuestionIndex: session.currentQuestionIndex,
      isHost,
      currentQuestion: currentQuestionPayload
    };
    // console.log('[DEBUG] Sending joined_quiz payload:', JSON.stringify(payload, null, 2));

    ws.send(JSON.stringify({
      type: 'joined_quiz',
      payload
    }));

    // Notify other participants
    broadcastToOthers(ws, session, {
      type: 'participant_joined',
      payload: {
        userId,
        participantCount,
      }
    });
  } catch (error) {
    console.error('Error in joinQuizSession:', error);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Failed to join quiz session' }
    }));
  }
};

const handleAnswerSubmission = async (ws: WebSocket, payload: { sessionId: string; userId: string; questionId: number; answer: string }) => {
  const { sessionId, userId, questionId, answer } = payload;

  try {
    // Get the question from the database to validate the answer
    const [questionResult] = await db.select().from(questions).where(eq(questions.id, questionId));
    if (!questionResult) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Question not found' }
      }));
      return;
    }

    // Deduplicate answers
    const session = activeSessions.get(sessionId);
    if (!session) return;
    const answerKey = `${userId}:${questionId}`;
    if (session.submittedAnswers.has(answerKey)) {
      return;
    }
    session.submittedAnswers.add(answerKey);

    const question = questionResult;

    // Evaluate the answer using the AI worker
    const evaluationResult = await APIGatewayService.evaluateAnswer(
      question.content,
      question.correctAnswer,
      answer
    );

    const isCorrect = evaluationResult.isCorrect;

    // Update the score in memory and Redis
    let newScore = 0;
    if (isCorrect) {
      // Award points based on the question's point value
      newScore = await RedisQuizService.incrementPlayerScore(sessionId, userId, question.points || 10);
    } else {
      // Get current score if incorrect
      newScore = await RedisQuizService.getPlayerScore(sessionId, userId);
    }

    // Update in memory
    if (session) {
      session.scores.set(userId, newScore);
    }

    // Get the attempt ID for this user in this session
    // For simplicity, we'll create a new attempt if one doesn't exist
    // In a real implementation, this would be handled differently
    const quizAttemptService = await import('../services/quizAttemptService');

    // First, check if the user has an active attempt for this quiz
    // This would require getting the quiz ID from the sessionok 
    const sessionData = await RedisQuizService.getQuizSession(sessionId);
    if (!sessionData) {
      throw new Error('Session data not found');
    }

    const quizId = parseInt(sessionData.quizId || '0');


    const userAttempts = await quizAttemptService.QuizAttemptService.getUserAttemptsForQuiz(parseInt(userId), quizId);
    let attemptId: number;

    if (userAttempts.length > 0) {

      attemptId = userAttempts[0]!.id;
    } else {
      // Create a new quiz attempt
      const questionsStr = await redisClient.get(`quiz_questions:${sessionId}`);
      const totalQuestions = questionsStr ? JSON.parse(questionsStr).length : 0;
      const newAttempt = await quizAttemptService.QuizAttemptService.createQuizAttempt(quizId, parseInt(userId), totalQuestions * 10);
      attemptId = newAttempt.id;
    }

    await quizAttemptService.QuizAttemptService.submitAnswer(
      { attemptId, questionId, content: answer },
      isCorrect,
      isCorrect ? (question.points || 10) : 0
    );

    // Send acknowledgment back to the user who submitted the answer
    ws.send(JSON.stringify({
      type: 'answer_submitted',
      payload: {
        questionId,
        isCorrect,
        message: isCorrect ? 'Correct answer!' : 'Incorrect answer',
        newScore,
        explanation: evaluationResult.explanation
      }
    }));

    // Broadcast updated scores to all participants
    broadcastScoresUpdate(sessionId);
  } catch (error) {
    console.error('Error handling answer submission:', error);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Error processing answer' }
    }));
  }
};

const startQuiz = async (sessionId: string) => {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.error('Session not found:', sessionId);
    return;
  }

  try {
    session.startTime = new Date();


    await RedisQuizService.setQuizActive(sessionId, true);


    const sessionData = await RedisQuizService.getQuizSession(sessionId);
    if (!sessionData) {
      console.error('Session data not found in Redis:', sessionId);

      session.participants.forEach(ws => {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Session data not found' }
        }));
      });
      return; 
    }

    const quizId = parseInt(sessionData.quizId || '0');


    const quizService = await import('../services/quizService');
    let questions = await quizService.QuizService.getQuestionsForQuiz(quizId);

    const quiz = await quizService.QuizService.getQuizById(quizId);
    if (quiz?.settings?.shuffleQuestions) {
      questions = questions.sort(() => Math.random() - 0.5);
    }

    if (questions.length === 0) {
      console.error('No questions found for quiz:', quizId);

      session.participants.forEach(ws => {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'No questions available for this quiz' }
        }));
      });
      return;
    }


    await redisClient.set(`quiz_questions:${sessionId}`, JSON.stringify(questions));


    session.participants.forEach(ws => {
      ws.send(JSON.stringify({
        type: 'quiz_started',
        payload: {
          sessionId,
          message: 'Quiz has started!',
          startTime: session!.startTime,
          totalQuestions: questions.length
        }
      }));
    });


    await nextQuestion(sessionId);
  } catch (error) {
    console.error('Error in startQuiz:', error);

    session.participants.forEach(ws => {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Failed to start quiz' }
      }));
    });
  }
};

const nextQuestion = async (sessionId: string) => {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.error('Session not found:', sessionId);
    return;
  }

  try {
    session.currentQuestionIndex++;


    await RedisQuizService.setCurrentQuestion(sessionId, session.currentQuestionIndex);

    if (session.timerTimeout) {
      clearTimeout(session.timerTimeout);
    }

    const questionsStr = await redisClient.get(`quiz_questions:${sessionId}`);
    if (!questionsStr) {
      console.error('Questions not found in Redis for session:', sessionId);
      session.participants.forEach(ws => {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Questions not available' }
        }));
      });
      return;
    }

    const questions = JSON.parse(questionsStr);
    const currentQuestion = questions[session.currentQuestionIndex];
    if (!currentQuestion) {

      session.participants.forEach(ws => {
        ws.send(JSON.stringify({
          type: 'quiz_finished',
          payload: {
            sessionId,
            message: 'Quiz finished!'
          }
        }));
      });

      const sessionData = await RedisQuizService.getQuizSession(sessionId);
      if (sessionData && sessionData.quizId) {
        const quizService = await import('../services/quizService');
        await quizService.QuizService.endQuiz(parseInt(sessionData.quizId));

        const quiz = await quizService.QuizService.getQuizById(parseInt(sessionData.quizId));
        const googleSheetId = quiz?.settings?.googleSheetId;

        if (googleSheetId && session.hostUserId) {
          const scores = await RedisQuizService.getAllScores(sessionId);

          GoogleSheetsService.syncQuizScores(
            parseInt(sessionData.quizId),
            quiz?.title || 'Unknown Quiz',
            sessionId,
            parseInt(session.hostUserId),
            googleSheetId,
            scores
          ).catch(e => {
            console.error('Failed background Google Sheets sync:', e.message);
            console.error('Sheet ID:', googleSheetId);
            console.error('Error details:', e);
          });
        }
      }
      return;
    }


    session.participants.forEach(ws => {
      ws.send(JSON.stringify({
        type: 'next_question',
        payload: {
          sessionId,
          currentQuestionIndex: session.currentQuestionIndex,
          question: {
            id: currentQuestion.id,
            content: currentQuestion.content,
            type: currentQuestion.type,
            options: currentQuestion.options,
            points: currentQuestion.points
          },
          message: 'Next question loaded'
        }
      }));
    });

    
    const sessionData = await RedisQuizService.getQuizSession(sessionId);
    if (sessionData && sessionData.quizId) {
      const quizService = await import('../services/quizService');
      const quiz = await quizService.QuizService.getQuizById(parseInt(sessionData.quizId));
      const timerBase = quiz?.settings?.timerPerQuestion || 30; 
      session.timerTimeout = setTimeout(() => {
        nextQuestion(sessionId);
      }, (timerBase + 5) * 1000); 
    }
  } catch (error) {
    console.error('Error in nextQuestion:', error);
    session.participants.forEach(ws => {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Failed to load next question' }
      }));
    });
  }
};

const broadcastScoresUpdate = async (sessionId: string) => {
  const session = activeSessions.get(sessionId);
  if (!session) return;


  const scores = await RedisQuizService.getAllScores(sessionId);


  session.participants.forEach(ws => {
    ws.send(JSON.stringify({
      type: 'scores_update',
      payload: {
        sessionId,
        scores,
        message: 'Scores updated'
      }
    }));
  });
};

const handleDisconnection = async (ws: WebSocket) => {

  const sessionId = activeConnections.get(ws);
  if (!sessionId) {
    return; 
  }


  activeConnections.delete(ws);


  const session = activeSessions.get(sessionId);
  if (session) {
    const index = session.participants.indexOf(ws);
    if (index !== -1) {
      session.participants.splice(index, 1);

      const players = await RedisQuizService.getPlayersInSession(sessionId);
      const participantCount = players.length;
      await RedisQuizService.updateParticipantCount(sessionId, participantCount);

      if (session.participants.length === 0) {
        activeSessions.delete(sessionId);
      } else {

        broadcastToOthers(ws, session, {
          type: 'participant_left',
          payload: {
            participantCount,
          }
        });
      }
    }
  }
};


const handleLeaveQuiz = async (ws: WebSocket, payload: { sessionId: string; userId: string }) => {
  const { sessionId, userId } = payload;


  await RedisQuizService.removePlayerFromSession(sessionId, userId);


  const players = await RedisQuizService.getPlayersInSession(sessionId);
  const participantCount = players.length;
  await RedisQuizService.updateParticipantCount(sessionId, participantCount);

  const session = activeSessions.get(sessionId);
  if (session) {
    broadcastToOthers(ws, session, {
      type: 'participant_left',
      payload: {
        participantCount,
        userId
      }
    });
  }


  activeConnections.delete(ws);


  ws.close();
};

const broadcastToOthers = (sender: WebSocket, session: QuizSession, message: any) => {
  session.participants
    .filter(client => client !== sender && client.readyState === WebSocket.OPEN)
    .forEach(client => {
      client.send(JSON.stringify(message));
    });
};