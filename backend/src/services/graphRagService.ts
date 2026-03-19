import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GRAPH_RAG_API_URL = process.env.GRAPH_RAG_API_URL || 'http://localhost:8000';

interface IngestResponse {
    status: string;
    chunks: number;
    graph_id: string;
}

interface GenerateResponse {
    mcqs: Array<{
        question: string;
        options: string[];
        answer: string;
        explanation?: string;
    }>;
}

export class GraphRagService {
    /**
     * Ingest data into the Graph RAG system
     */
    static async ingestData(inputType: 'text' | 'url' | 'pdf' | 'topic', value: string): Promise<IngestResponse> {
        try {
            const response = await axios.post<IngestResponse>(`${GRAPH_RAG_API_URL}/api/ingest`, {
                input_type: inputType,
                value,
            });
            return response.data;
        } catch (error: any) {
            console.error('Error ingesting data into Graph RAG:', error.response?.data || error.message);
            throw new Error(`Failed to ingest data: ${JSON.stringify(error.response?.data || error.message)}`);
        }
    }

    /**
     * Generate MCQs from a specific graph ID
     */
    static async generateQuestions(graphId: string, count: number = 5, difficulty: string = 'medium', type: string = 'mcq'): Promise<GenerateResponse> {
        try {
            const response = await axios.get<GenerateResponse>(`${GRAPH_RAG_API_URL}/api/generate/${graphId}/${count}`, {
                params: { difficulty, type }
            });
            return response.data;
        } catch (error) {
            console.error('Error generating questions from Graph RAG:', error);
            throw new Error('Failed to generate questions');
        }
    }

    /**
     * Proxies batch refinement requests to the AI Service
     */
    static async refineBatch(questions: any[], instruction: string): Promise<any> {
        try {
            const response = await axios.post(`${GRAPH_RAG_API_URL}/api/refine-batch`, {
                questions,
                instruction
            });
            return response.data;
        } catch (error) {
            console.error('Error in batch refine:', error);
            throw new Error('Failed to refine questions');
        }
    }
}
