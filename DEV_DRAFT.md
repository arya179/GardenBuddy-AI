---
title: Building GardenBuddy AI — A Privacy-First, Local Gardening Companion
published: false
tags: devchallenge, hf26challenge, webdev, python, react
---

# Building GardenBuddy AI 🌱

Welcome to GardenBuddy AI, my submission for the Hacktoberfest 2026 Open-Source AI Challenge!

## What I Built
GardenBuddy AI is a fully localized gardening companion. It combines a React dashboard, a FastAPI backend, an SQLite database, and an open-weights LLM (`gemma:2b`) running via Ollama. 

## The Problem It Solves
Modern apps are obsessed with screen time. I wanted to build a tool that helps people step *away* from their computers. GardenBuddy gives you exactly what you need—your tasks for the day, plant recommendations for your specific sunlight conditions, and instant answers to your gardening questions—and then gets out of your way so you can go outside and play in the dirt.

## How It Uses Open-Weight AI
The heart of GardenBuddy is its AI Advisor. When you use the Plant Finder, the backend dynamically bundles the precise botanical metadata of your matched plants and feeds it directly into the `gemma:2b` system prompt. This ensures the model provides context-aware, highly relevant advice rather than hallucinating generic responses. 

## Why Local Inference Matters
Gardening is a deeply personal, offline activity. By using Ollama and an open-weights model, GardenBuddy requires zero API keys, incurs zero subscription costs, and operates completely off-grid. Your data, your tasks, and your AI conversations stay precisely where they belong: on your local machine.

## Architecture & Technologies
- **Frontend:** React + Vite, styled with custom CSS to maintain a calming, botanical aesthetic.
- **Backend:** FastAPI handles the routing and serves as the intermediary to Ollama.
- **Persistence:** SQLAlchemy driving an isolated SQLite database to track daily progress and `TaskHistory`.

## Challenges & Lessons Learned
Handling raw HTTP tracebacks from the AI layer was a significant hurdle. Early on, if the local Ollama server timed out or was missing the Gemma model, the UI would crash with a massive HTTP 500 error. I learned how to safely trap `httpx.HTTPStatusError` in FastAPI to pass clean, actionable `502` and `503` recovery states back to the React UI, allowing users to safely retry their prompts.

### Links
- **Source Code:** [Link to Repository]
- **Demo Video:** [Link to Demo]

*Get off the screen and get into the garden!* 🌿
