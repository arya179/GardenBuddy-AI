from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from database import SessionLocal, Task, PlantPreference, TaskHistory, Plant
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx
from datetime import datetime, timedelta
from typing import Optional, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma:2b"

class AdvisorRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500, description="The gardening question")
    context: Optional[str] = Field(None, description="Optional plant context to inform the AI")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    recurrence_days: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(TaskBase):
    completed: Optional[bool] = None

class TaskResponse(TaskBase):
    id: int
    completed: bool
    plant_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class PlantBase(BaseModel):
    name: str
    species: Optional[str] = None
    planting_date: Optional[datetime] = None
    sunlight_requirements: Optional[str] = None
    watering_interval_days: Optional[int] = None
    notes: Optional[str] = None

class PlantCreate(PlantBase):
    pass

class PlantUpdate(PlantBase):
    name: Optional[str] = None

class PlantResponse(PlantBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

@app.get("/api/plants", response_model=List[PlantResponse])
def read_plants(db: Session = Depends(get_db)):
    return db.query(Plant).all()

@app.post("/api/plants", response_model=PlantResponse)
def create_plant(plant: PlantCreate, db: Session = Depends(get_db)):
    db_plant = Plant(**plant.dict())
    db.add(db_plant)
    db.commit()
    db.refresh(db_plant)
    return db_plant

@app.put("/api/plants/{plant_id}", response_model=PlantResponse)
def update_plant(plant_id: int, plant_update: PlantUpdate, db: Session = Depends(get_db)):
    db_plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not db_plant:
        raise HTTPException(status_code=404, detail="Plant not found")
        
    for key, value in plant_update.dict(exclude_unset=True).items():
        setattr(db_plant, key, value)
        
    db.commit()
    db.refresh(db_plant)
    return db_plant

@app.delete("/api/plants/{plant_id}")
def delete_plant(plant_id: int, db: Session = Depends(get_db)):
    db_plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not db_plant:
        raise HTTPException(status_code=404, detail="Plant not found")
        
    # Unlink tasks instead of deleting them to preserve history safely
    tasks = db.query(Task).filter(Task.plant_id == plant_id).all()
    for t in tasks:
        t.plant_id = None
        
    db.delete(db_plant)
    db.commit()
    return {"success": True}

@app.get("/api/tasks", response_model=List[TaskResponse])
def read_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Task).all()
    return tasks

@app.post("/api/tasks", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    db_task = Task(
        title=task.title,
        description=task.description,
        due_date=task.due_date,
        recurrence_days=task.recurrence_days,
        completed=False
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    old_completed = db_task.completed
    
    # Update fields
    if task_update.title is not None: db_task.title = task_update.title
    if task_update.description is not None: db_task.description = task_update.description
    if task_update.due_date is not None: db_task.due_date = task_update.due_date
    if task_update.recurrence_days is not None: db_task.recurrence_days = task_update.recurrence_days
    
    # Handle completion logic
    if task_update.completed is not None and task_update.completed != old_completed:
        db_task.completed = task_update.completed
        if task_update.completed:
            # Mark complete and save history
            history = TaskHistory(task_id=db_task.id, completion_date=datetime.utcnow())
            db.add(history)
            
            # Recurrence logic (duplicate task for next date)
            if db_task.recurrence_days and db_task.due_date:
                next_date = db_task.due_date + timedelta(days=db_task.recurrence_days)
                # Ensure we don't duplicate if already exists
                existing_next = db.query(Task).filter(Task.title == db_task.title, Task.due_date == next_date).first()
                if not existing_next:
                    new_recurring_task = Task(
                        title=db_task.title,
                        description=db_task.description,
                        due_date=next_date,
                        recurrence_days=db_task.recurrence_days,
                        completed=False
                    )
                    db.add(new_recurring_task)

    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Cascade delete history manually if relationships don't
    db.query(TaskHistory).filter(TaskHistory.task_id == task_id).delete()
    db.delete(db_task)
    db.commit()
    return {"success": True}

class PrefsCreate(BaseModel):
    sunlight: str
    space: str

@app.get("/api/preferences")
def read_prefs(db: Session = Depends(get_db)):
    prefs = db.query(PlantPreference).filter(PlantPreference.user_id == 1).first()
    if not prefs:
        prefs = PlantPreference(user_id=1, sunlight="", space="")
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs

@app.post("/api/preferences")
def update_prefs(prefs_in: PrefsCreate, db: Session = Depends(get_db)):
    prefs = db.query(PlantPreference).filter(PlantPreference.user_id == 1).first()
    if not prefs:
        prefs = PlantPreference(user_id=1)
        db.add(prefs)
    prefs.sunlight = prefs_in.sunlight
    prefs.space = prefs_in.space
    db.commit()
    db.refresh(prefs)
    return prefs

@app.get("/")
def read_root():
    return {"message": "Welcome to the GardenBuddy AI API"}

@app.get("/api/health")
async def health_check():
    ai_status = "unavailable"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get("http://localhost:11434/")
            if resp.status_code == 200:
                ai_status = "available"
    except Exception:
        pass
    return {"status": "healthy", "service": "GardenBuddy AI", "ai_model_status": ai_status}

@app.post("/api/advisor")
async def ask_advisor(request: AdvisorRequest):
    system_prompt = (
        "You are GardenBuddy AI, a helpful, brief, and beginner-friendly gardening assistant. "
        "You can answer general gardening questions as well as questions about specific plants. "
        "CRITICAL HEALTH AND SAFETY RULES: "
        "1. Clearly distinguish traditional Ayurvedic uses from scientifically established clinical benefits. "
        "2. Do not claim that a plant cures, prevents, or treats a disease without reliable evidence. "
        "3. Do not present gardening information as medical advice. "
        "4. Explain that natural plants and herbal preparations can still cause adverse effects, allergies, toxicity, or medication interactions. "
        "5. Do not recommend consuming plants, preparing medicinal doses, or applying homemade remedies without appropriate safety guidance. "
        "6. For health conditions, pregnancy, medication use, or treatment decisions, advise users to consult a qualified healthcare professional. "
        "7. Do not invent certainty or claim external verification. "
        "8. If identifying pests/diseases, be cautious and suggest they verify visually."
    )
    if request.context:
        system_prompt += f"\n\nContext regarding the user's plant:\n{request.context}\nUse this actual catalogue data to inform your advice."
        
    try:
        # Increased timeout to 120 seconds to allow slow CPU-bound local model inference
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(OLLAMA_URL, json={
                "model": MODEL_NAME,
                "prompt": request.question,
                "system": system_prompt,
                "stream": False
            })
            resp.raise_for_status()
            data = resp.json()
            return {"answer": data.get("response", "I could not generate an answer.")}
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Local AI service is offline. Please check Ollama.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail="AI service returned an unexpected error. Ensure the gemma model is pulled.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI service timed out.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An internal server error occurred while contacting the AI.")
