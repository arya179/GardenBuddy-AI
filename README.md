# GardenBuddy AI 🌿

GardenBuddy AI is a smart, beginner-friendly outdoor gardening dashboard built for the Hacktoberfest 2026 Challenge. It combines plant management with local, privacy-first AI advice to help you keep your plants thriving!

## Motivation
Gardening can be tough for beginners. From figuring out watering schedules to understanding sunlight needs and diagnosing brown tips, it's easy to get overwhelmed. GardenBuddy AI was created to provide a simple, clean, and interactive tool that gives you tailored plant recommendations, tracks your daily gardening tasks, and offers completely offline, privacy-friendly AI advice directly from your local machine.

## Features
- **Plant Finder:** Get instant, deterministic plant recommendations based on your available sunlight and space (container vs. garden bed).
- **Task Tracker:** Easily log your daily gardening chores. Tasks and preferences are persisted locally in your browser so you never lose track.
- **AI Plant Advisor:** Uses a lightweight Google `gemma:2b` model via Ollama to generate helpful and cautious gardening advice.
- **Privacy-First & Local:** The AI model runs entirely on your local machine. No data is sent to external clouds.

### Current Limitations
- The AI Advisor requires an installation of Ollama.
- The default plant database contains a very small dataset for demonstration purposes.
- There is no user authentication or cloud-syncing yet.

## Architecture & Technology Stack
- **Frontend:** React + Vite, styled with custom CSS variables (Botanical aesthetic).
- **Backend:** FastAPI (Python) for API endpoints and CORS management.
- **AI Engine:** Ollama running `gemma:2b` locally.

## Prerequisites
Before you begin, ensure you have the following installed:
1. [Node.js](https://nodejs.org/) and npm (for the frontend).
2. [Python 3.10+](https://www.python.org/) (for the backend).
3. [Ollama](https://ollama.com/) (optional, but required for the AI Advisor).

---

## Installation & Setup

### 1. Ollama & AI Model Setup
To enable the AI Plant Advisor, you must install Ollama and download the model.
```bash
# On Linux (or refer to https://ollama.com/download for Mac/Windows)
curl -fsSL https://ollama.com/install.sh | sh

# Pull and start the Gemma model
ollama run gemma:2b
```

### 2. Backend Setup (FastAPI)
The backend acts as a bridge between the frontend and the local AI.
```bash
cd backend

# Create a virtual environment and activate it
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload
```
The API will be available at `http://localhost:8000`.

### 3. Frontend Setup (React/Vite)
Open a new terminal window to set up the frontend.
```bash
cd frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Start the development server
npm run dev
```
The app will be available at `http://localhost:5173`.

---

## How to Test the Application
1. Open the application in your browser (`http://localhost:5173`).
2. Verify that the **Backend** indicator shows `✅ Connected`.
3. Try out the **Plant Finder** by selecting "Full Sun" and "Garden Bed".
4. Type a gardening question in the **AI Plant Advisor** box (e.g. *"Why is my Monstera drooping?"*) to test the Ollama integration.

### Running Automated Tests
**Backend Tests:**
We use `pytest` and `httpx` to test the API endpoints.
```bash
cd backend
source venv/bin/activate
pip install pytest httpx
pytest
```

**Frontend Build Test:**
Verify the frontend builds correctly for production:
```bash
cd frontend
npm run build
```

## Troubleshooting
- **API Disconnected Error:** Ensure your Python backend is running on port 8000.
- **AI Error / Connection Refused:** Ensure the Ollama service is active. On Linux, run `systemctl status ollama` to check.
- **Model Not Found Error:** Run `ollama pull gemma:2b` to download the specific model.

## License
Distributed under the MIT License. See `LICENSE` for more information.
