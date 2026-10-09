from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app, get_db
from database import Base

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the GardenBuddy AI API"}

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    json_resp = response.json()
    assert json_resp["status"] == "healthy"
    assert json_resp["service"] == "GardenBuddy AI"
    assert "ai_model_status" in json_resp

def test_advisor_validation():
    # Test short question
    response = client.post("/api/advisor", json={"question": "Hi"})
    assert response.status_code == 422
