import { type Request, type Response } from 'express';
import { APIGatewayService } from '../services/apiGatewayService';
import { z } from 'zod';
import multer from 'multer';

interface AuthRequest extends Request {
  userId?: number;
}

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only certain file types
    if (file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and PPTX files are allowed.'));
    }
  }
});

// Zod schema for request validation
const createQuizWithAISchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  document: z.object({
    title: z.string(),
    content: z.string(),
  }),
  numQuestions: z.number().int().positive().optional().default(5),
});

export const createQuizWithAI = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, document, numQuestions } = createQuizWithAISchema.parse(req.body);
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Create quiz with AI-generated questions
    const quiz = await APIGatewayService.createQuizWithAI(
      title,
      description || '',
      userId,
      document,
      numQuestions
    );

    res.status(201).json({
      message: 'Quiz created successfully with AI-generated questions',
      quiz,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.issues });
    }
    
    console.error('Error creating quiz with AI:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const startMultiplayerSessionSchema = z.object({
  quizId: z.number().int().positive(),
  maxPlayers: z.number().int().positive().optional(),
});

export const startMultiplayerQuizSession = async (req: AuthRequest, res: Response) => {
  try {
    const { quizId, maxPlayers } = startMultiplayerSessionSchema.parse(req.body);
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Start multiplayer quiz session
    const sessionId = await APIGatewayService.startMultiplayerQuizSession(
      quizId,
      userId.toString(),
      maxPlayers
    );

    res.status(200).json({
      message: 'Multiplayer quiz session started successfully',
      sessionId,
      quizId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.issues });
    }
    
    console.error('Error starting multiplayer session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// New endpoints for document processing
export const processDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { document } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Process the document using AI worker
    await APIGatewayService.processDocument(document);

    res.status(200).json({
      message: 'Document processed successfully',
    });
  } catch (error) {
    console.error('Error processing document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadDocument = (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Use multer to handle the file upload
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Process the uploaded file using AI worker
    const document = {
      title: req.file.originalname,
      content: req.file.path // Path to the uploaded file
    };

    try {
      await APIGatewayService.processDocument(document);

      res.status(200).json({
        message: 'Document uploaded and processed successfully',
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });
    } catch (error) {
      console.error('Error processing document:', error);
      res.status(500).json({ error: 'Error processing document' });
    }
  });
};