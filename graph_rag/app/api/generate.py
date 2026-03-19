from fastapi import APIRouter, Query
from app.services.mcq_pipeline import generate_mcqs, refine_questions
from pydantic import BaseModel
from typing import List

router = APIRouter()

@router.get("/generate/{graph_id}/{count}")
def generate(graph_id: str, count: int = 10, difficulty: str = Query("medium"), type: str = Query("mcq")):
    print("GENERATE graph_id:", graph_id, "difficulty:", difficulty, "type:", type)
    return {
        "mcqs": generate_mcqs(graph_id, count, difficulty, type)
    }

class RefineBatchRequest(BaseModel):
    questions: List[dict]
    instruction: str

@router.post("/refine-batch")
def refine_batch(request: RefineBatchRequest):
    print("REFINE BATCH instruction:", request.instruction)
    return {
        "questions": refine_questions(request.questions, request.instruction)
    }

