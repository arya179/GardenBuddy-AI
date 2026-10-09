# 🌿 GardenBuddy AI

**A privacy-first, AI-powered gardening companion that helps you spend less time on screens and more time in your garden.**

GardenBuddy AI combines local open-weight AI, practical plant recommendations, and daily gardening tasks in one self-hosted application. Ask gardening questions, explore suitable plants, and organize watering, pruning, and harvesting without relying on a hosted AI API.

Built for the **Hacktoberfest 2026 Open-Source AI Challenge — Week 1: Touch Grass**.

[Source Code](https://github.com/arya179/GardenBuddy-AI) · [Week 1 Challenge](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)

## 🌱 Why GardenBuddy AI?

Gardening should happen outdoors, not inside an endless stream of apps.

GardenBuddy AI is designed to make gardening decisions easier, provide useful advice, and help people build consistent gardening habits. Its local AI approach gives users more control over their data and reduces dependence on external AI services.

## ✨ Features

- **Plant Finder:** Explore plant recommendations using sunlight and available-space constraints.
- **Local AI Gardening Advisor:** Get contextual gardening guidance using the Gemma 2B model through Ollama.
- **Daily Task Management:** Organize watering, pruning, harvesting, and other gardening activities.
- **Persistent Local Storage:** Save tasks, plant selections, and history in SQLite.
- **Location and Weather Integration:** Use the configured geocoding and weather services to support location-aware gardening workflows.
- **Privacy-First AI:** Run AI inference locally without sending prompts to a hosted AI inference provider.
- **Responsive Web Interface:** Use the React dashboard to access gardening tools and track daily progress.

*Note: Geocoding and weather lookups require internet access when configured to use external services. Local AI inference does not require a hosted AI API, but the Ollama model must be installed locally.*

## 🧠 Open-Source AI and Local Inference

GardenBuddy AI uses **Gemma 2B through Ollama** for its gardening advisor.

The application combines plant-related context with the user's question so the model can generate more relevant gardening guidance.

Why local inference matters:

- **Privacy:** AI prompts can remain on the user's machine rather than being sent to a hosted AI inference service.
- **Control:** Users can manage their local model and inference environment.
- **Reduced API dependency:** No third-party hosted AI API key is needed for the local AI workflow.
- **Cost control:** Local inference avoids per-request hosted AI charges, although hardware and electricity still have costs.
- **Open innovation:** Developers can inspect, modify, and extend the application and experiment with compatible models.

AI-generated gardening advice can be inaccurate. Verify important recommendations against reliable horticultural sources and local growing conditions.

## 🏗️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Python, FastAPI |
| Database | SQLite, SQLAlchemy |
| AI inference | Ollama, Gemma 2B |
| Weather | Open-Meteo integration |
| Geocoding | Location-search integration |
| Testing | Pytest |

## 🧩 Architecture

```text
React + Vite Frontend
        |
        v
FastAPI Backend
        |
        +---- SQLite / SQLAlchemy
        |
        +---- Ollama / Gemma 2B
        |
        +---- Geocoding Service
        |
        +---- Open-Meteo Weather API
```

The frontend communicates with the backend. The backend manages application data, validates requests, and coordinates local AI inference and configured external location/weather services.

## 🚀 Getting Started

### Prerequisites

Install the following:

- Python 3.12 or a compatible version supported by the backend dependencies
- Node.js and npm versions compatible with the frontend
- Ollama
- Git

### 1. Clone the repository

```bash
git clone https://github.com/arya179/GardenBuddy-AI.git
cd GardenBuddy-AI
```

### 2. Set up the backend

```bash
cd backend
python3 -m venv venv
```

Activate the environment.

**Linux/macOS:**

```bash
source venv/bin/activate
```

**Windows PowerShell:**

```powershell
.\venv\Scripts\Activate.ps1
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Configure environment variables using the provided example file, if available:

```bash
cp .env.example .env
```

On Windows, copy the example file manually if `cp` is unavailable.

Start the backend:

```bash
uvicorn main:app --reload
```

The backend's SQLite database is initialized automatically according to the application configuration.

### 3. Set up the local AI model

Install and start Ollama, then download the model:

```bash
ollama pull gemma:2b
ollama list
```

Keep the Ollama service running while using the AI advisor.

### 4. Start the frontend

Open a second terminal:

```bash
cd GardenBuddy-AI/frontend
npm install
npm run dev
```

Open the local URL printed by Vite in your browser.

**Configuration:** Check the frontend and backend environment settings to ensure the API base URL and external service configuration match your local setup.

## 🧪 Testing

Run the backend tests from the backend directory:

```bash
cd backend
pytest
```

Confirm that the backend starts, the frontend loads, gardening tasks persist, plant recommendations work, and the AI advisor responds when Ollama and Gemma are available.

Test location search and weather functionality separately because those features depend on their external services and network availability.

## 🔒 Privacy and Security

- Gardening records are stored in a local SQLite database.
- The AI advisor uses local Ollama inference.
- External geocoding and weather requests may send the location query or coordinates required by those services.
- Keep API credentials and private configuration in environment variables rather than committing them to Git.
- Review the privacy policies of any external services you enable.

## 🛠️ Current Limitations

- AI responses depend on the locally installed model and available hardware.
- Location and weather features depend on network access and the availability of their configured services.
- Plant recommendations are only as accurate as their underlying data and constraints.
- Some historical-progress visualizations and interface refinements may require further development.

## 🗺️ Future Improvements

- Expand the plant knowledge base and localized growing recommendations.
- Improve seasonal planting guidance.
- Add richer gardening history and progress visualizations.
- Improve accessibility and mobile usability.
- Expand automated testing and error handling.

## 🤝 Contributing

Contributions that improve gardening accuracy, accessibility, privacy, reliability, and usability are welcome.

1. Fork the repository.
2. Create a focused feature branch.
3. Make and test your changes.
4. Open a pull request describing the problem and solution.

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🌍 Built for Touch Grass

GardenBuddy AI uses open-weight AI to make gardening more accessible while keeping local inference under the user's control.

**Less scrolling. More growing.** 🌱
