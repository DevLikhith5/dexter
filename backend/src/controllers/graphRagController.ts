import { type Request, type Response } from 'express';
import { GraphRagService } from '../services/graphRagService';
import { z } from 'zod';
import { db } from '../db/index';
import { documents } from '../db/schema';
import { eq } from 'drizzle-orm';

interface AuthRequest extends Request {
  userId?: number;
}

const ingestSchema = z.object({
    inputType: z.enum(['text', 'url', 'pdf', 'topic']),
    value: z.string().min(1),
    title: z.string().optional(),
});

const generateSchema = z.object({
    graphId: z.string().uuid().or(z.string().min(1)),
    count: z.number().int().positive().optional().default(5),
    difficulty: z.string().optional().default('medium'),
    type: z.string().optional().default('mcq'),
});

export const ingestData = async (req: AuthRequest, res: Response) => {
    try {
        const { inputType, value, title } = ingestSchema.parse(req.body);

        const result = await GraphRagService.ingestData(inputType, value);

        // Auto-save to the user's knowledge library
        if (req.userId) {
            const label = title || (inputType === 'url'
                ? new URL(value).hostname
                : value.length > 50 ? value.substring(0, 50) + '...' : value);

            try {
                await db.insert(documents).values({
                    title: label,
                    sourceValue: value,
                    type: inputType,
                    graphId: result.graph_id,
                    userId: req.userId,
                });
            } catch (dbErr) {
                // Non-fatal: log but don't fail the ingestion
                console.warn('[Knowledge Store] Failed to save document record:', dbErr);
            }
        }

        res.status(200).json({
            message: 'Data ingested successfully',
            data: result,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.issues });
        }
        console.error('Error in ingestData controller:', error);
        
        if (error instanceof Error && error.message.includes('Failed to ingest data')) {
            return res.status(400).json({ error: 'AI Ingestion Failed', details: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const generateQuestions = async (req: Request, res: Response) => {
    try {
        const { graphId, count, difficulty, type } = generateSchema.parse({
            graphId: req.params.graphId,
            count: req.query.count ? parseInt(req.query.count as string) : undefined,
            difficulty: req.query.difficulty,
            type: req.query.type,
        });

        const result = await GraphRagService.generateQuestions(graphId, count, difficulty, type);

        res.status(200).json({
            message: 'Questions generated successfully',
            data: result,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.issues });
        }
        console.error('Error in generateQuestions controller:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getStoredGraphs = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const stored = await db.select().from(documents).where(eq(documents.userId, req.userId));
        res.status(200).json({ data: stored });
    } catch (error) {
        console.error('Error fetching stored graphs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const refineBatchSchema = z.object({
    questions: z.array(z.any()),
    instruction: z.string().min(1)
});

export const refineBatch = async (req: Request, res: Response) => {
    try {
        const { questions, instruction } = refineBatchSchema.parse(req.body);
        const result = await GraphRagService.refineBatch(questions, instruction);
        res.status(200).json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.issues });
        }
        console.error('Error in refineBatch controller:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
