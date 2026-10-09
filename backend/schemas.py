from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    recurrence_days: Optional[int] = None
    plant_id: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(TaskBase):
    completed: Optional[bool] = None

class TaskResponse(TaskBase):
    id: int
    completed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
