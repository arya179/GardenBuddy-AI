# GardenBuddy AI 🌿

GardenBuddy AI is a personal, privacy-first gardening companion designed to get you off your screens and into the dirt. Powered entirely by a local **Gemma 2B** open-weights AI model, GardenBuddy helps you choose the right plants, tracks your gardening tasks, and answers your horticultural questions without sending a single byte of your personal data to the cloud.

## The Problem
Many gardening apps are overloaded with ads, gamification, and push notifications designed to keep you scrolling. Our goal is the opposite: we want to provide immediate, actionable advice and task tracking so you can spend less time swiping and more time nurturing your physical garden.

## Key Features
- **Deterministic Plant Finder:** Input your sunlight and space constraints to receive accurate, localized plant recommendations powered by a documented botanical dataset.
- **Contextual AI Advisor:** When you find a plant you like, the local Gemma AI reads the botanical metadata and provides tailored advice.
- **Local SQLite Persistence:** Tasks, plant selections, and history are stored safely on your machine using an isolated SQLite database.
- **Robust Daily Task Management:** Track watering, pruning, and harvesting. Check off tasks to see your daily progress bar grow!

## Architecture & Technology Stack
- **Frontend:** React + Vite (HTML/CSS/JS)
- **Backend:** FastAPI (Python)
- **Database:** SQLite (managed via SQLAlchemy)
- **AI Integration:** Local Ollama running `gemma:2b`
- **Markdown:** `react-markdown` for safe LLM rendering

## Setup Instructions (Ubuntu 24.04)

### 1. Prerequisites
- Python 3.12+
- Node.js 24+
- [Ollama](https://ollama.ai/) installed locally and running.
- Pull the model: `ollama run gemma:2b`

### 2. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```
*(The SQLite database `data/gardenbuddy.db` will initialize automatically).*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Running Tests & Troubleshooting
In the `backend` directory, verify the isolated in-memory test suite:
```bash
pytest
```
If the AI Advisor hangs, verify your local Ollama daemon is running (`systemctl status ollama` or `ollama list`).

## Known Limitations & Future Work
- **Routing:** The UI is currently a dense monolith. Future updates will split the UI using `react-router-dom`.
- **Streaks:** The backend `TaskHistory` table is active, but the frontend requires updates to visualize the weekly historical graphs.

## License
MIT License
