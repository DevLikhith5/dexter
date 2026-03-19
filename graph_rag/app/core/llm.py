from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
import os

load_dotenv() 

OPENAI_API_KEY=os.getenv("OPENAI_API_KEY")
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.3,
    openai_api_key=OPENAI_API_KEY
)
