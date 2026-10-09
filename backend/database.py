import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Use environment variable, defaulting to local data dir
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/gardenbuddy.db")

# In tests, we might use sqlite:///:memory: so we need connect_args only if it's sqlite
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Plant(Base):
    __tablename__ = "plants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    species = Column(String)
    planting_date = Column(DateTime)
    sunlight_requirements = Column(String)
    watering_interval_days = Column(Integer)
    notes = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    tasks = relationship("Task", back_populates="plant")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(String)
    due_date = Column(DateTime)
    recurrence_days = Column(Integer)
    completed = Column(Boolean, default=False)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    plant = relationship("Plant", back_populates="tasks")
    history = relationship("TaskHistory", back_populates="task")

class TaskHistory(Base):
    __tablename__ = "task_history"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    completion_date = Column(DateTime, default=datetime.utcnow)
    notes = Column(String)
    
    task = relationship("Task", back_populates="history")

class PlantPreference(Base):
    __tablename__ = "preferences"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, default=1)
    sunlight = Column(String, default="")
    space = Column(String, default="")
    climateZone = Column(String, default="")
    gardenType = Column(String, default="")
    city = Column(String, default="")
    region = Column(String, default="")
    country = Column(String, default="")
    lat = Column(String, default="")
    lon = Column(String, default="")
    container = Column(String, default="")
    maintenance = Column(String, default="")

Base.metadata.create_all(bind=engine)
