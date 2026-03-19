import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { userRoutes } from './routes/userRoutes';
import { quizRoutes } from './routes/quizRoutes';
import { answerRoutes } from './routes/answerRoutes';
import { apiGatewayRoutes } from './routes/apiGatewayRoutes';
import { documentRoutes } from './routes/documentRoutes';

import { WebSocketServer } from 'ws';
import http from 'http';
import { setupWebSocket } from './websocket/server';

dotenv.config();

const app = express();
const server = http.createServer(app);


app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
  exposedHeaders: ['Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


import authRoutes from './routes/authRoutes';
import { graphRagRoutes } from './routes/graphRagRoutes';
import { statsRoutes } from './routes/statsRoutes';



app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/answers', answerRoutes);
app.use('/api/gateway', apiGatewayRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/graph-rag', graphRagRoutes);
app.use('/api/stats', statsRoutes);


const wss = new WebSocketServer({ server });
setupWebSocket(wss);

const PORT = process.env.PORT || 3000;

// Initialize RabbitMQ connection
// RabbitMQService.connect()
//   .then(() => {
//     console.log('RabbitMQ service initialized');
//     // The RabbitMQ service is now ready to publish tasks
//   })
//   .catch(err => {
//     console.error('Failed to connect to RabbitMQ:', err);
//   });

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on port ${PORT}`);
});


process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  // await RabbitMQService.close();
  process.exit(0);
});