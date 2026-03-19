import { Router } from 'express';
import { ingestData, generateQuestions, refineBatch, getStoredGraphs } from '../controllers/graphRagController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Ingest data
router.post('/ingest', authenticateToken, ingestData);

// Generate questions
router.get('/generate/:graphId', authenticateToken, generateQuestions);

// Refine batch
router.post('/refine-batch', authenticateToken, refineBatch);

// Get stored knowledge graphs for this user
router.get('/stored', authenticateToken, getStoredGraphs);

export const graphRagRoutes = router;
