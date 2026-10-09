from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AdvisorRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500, description="The gardening question")

@app.get("/")
def read_root():
    return {"message": "Welcome to the GardenBuddy AI API"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "GardenBuddy AI"}

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma:2b"

@app.post("/api/advisor")
async def ask_advisor(req: AdvisorRequest):
    system_instruction = (
        "You are GardenBuddy, a practical and cautious gardening AI assistant. "
        "Provide helpful advice, but do not invent certainty when identifying plant diseases or pests. "
        "Keep your answers concise and beginner-friendly."
    )
    
    payload = {
        "model": MODEL_NAME,
        "prompt": req.question,
        "system": system_instruction,
        "stream": False
    }
    
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(OLLAMA_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {"answer": data.get("response", "")}
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama service is unavailable. Please ensure Ollama is installed and running locally.")
    except httpx.ReadTimeout:
        raise HTTPException(status_code=504, detail="The AI model took too long to respond.")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
             raise HTTPException(status_code=404, detail=f"Model '{MODEL_NAME}' not found. Please pull it using 'ollama pull {MODEL_NAME}'.")
        raise HTTPException(status_code=502, detail="Error communicating with the AI model.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
