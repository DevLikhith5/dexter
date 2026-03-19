import redisClient from "./src/config/redis";
import { WebSocket } from "ws";

async function test() {
  await redisClient.connect().catch(() => {});
  const sessionId = "quiz_test_1234";
  
  await redisClient.hSet(`quiz_session:${sessionId}`, {
      id: sessionId,
      quizId: "3",
      hostUserId: "1",
      currentQuestionIndex: "-1",
      participantCount: "0",
      isActive: "false",
      startTime: new Date().toISOString(),
  });

  console.log("Session created. Connecting WS...");

  const ws = new WebSocket("ws://localhost:3001");

  ws.on("open", () => {
    console.log("Connected to WS!");
    ws.send(JSON.stringify({
      type: "join_quiz",
      payload: {
        sessionId,
        userId: "2",
        userName: "test_user_2"
      }
    }));
  });

  ws.on("message", (data) => {
    console.log("Received:", data.toString());
    ws.close();
    process.exit(0);
  });

  ws.on("error", (err) => {
    console.error("WS Error:", err);
    process.exit(1);
  });
  
  setTimeout(() => {
    console.log("Timeout! No message received.");
    process.exit(1);
  }, 3000);
}

test();
