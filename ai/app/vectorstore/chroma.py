import chromadb
from app.config import VECTOR_DB_PATH, COLLECTION_NAME

# Connect to Dockerized Chroma (exposed on localhost:8001)
client = chromadb.HttpClient(host='localhost', port=8001)

collection = client.get_or_create_collection(COLLECTION_NAME)
