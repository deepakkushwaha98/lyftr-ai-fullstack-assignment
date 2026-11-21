# Lyftr AI — Full-Stack AI Chatbot

A full-stack AI chatbot built with React, FastAPI, LiteLLM, Gemini, and SQLite. The application supports multi-turn conversations, LLM response caching, automatic API-key failover, and response metadata.

## 1. Features

- Multi-turn conversations with session-based history
- Gemini AI integration through LiteLLM
- Response caching to reduce latency and repeated API calls
- Automatic failover across multiple API keys
- Configurable system prompts
- SQLite database for conversation persistence
- Response metadata: source, model, latency, input tokens, and output tokens
- Responsive React interface
- Docker Compose support

## 2. Tech Stack

**Frontend:** React, Vite, JavaScript, CSS

**Backend:** Python, FastAPI, Pydantic, LiteLLM

**Database:** SQLite

**LLM Provider:** Google Gemini

**Containerization:** Docker, Docker Compose, Nginx

## 3. Project Structure

```text
lyftr-ai-fullstack-assignment/
├── backend/
│   ├── main.py
│   ├── llm_service.py
│   ├── database.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── Makefile
├── .env.example
└── README.md
```

## 4. Setup and Installation

### Prerequisites

- Docker and Docker Compose
- Gemini API keys (at least two)
- Git

### Environment Variables

Create `backend/.env` and configure the required variables.

```env
LLM_API_KEYS=your_first_key,your_second_key
LLM_MODEL=gemini/gemini-3.1-flash-lite
ENABLE_FAILURE_SIMULATION=true
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

See `.env.example` for the project's configuration template.

Never commit real API keys to GitHub.

### Start the Application

```bash
docker compose up -d --build
```

Default local URLs:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API documentation: http://localhost:8000/docs

If port 3000 is occupied, set `FRONTEND_PORT=3001` before starting Docker Compose.

To stop the application:

```bash
docker compose down
```

## 5. API Endpoints

### GET /health

Returns backend health, number of configured API keys, and cache status.

### POST /chat

Sends a message to the chatbot.

Example request:

```json
{
  "session_id": "example-session",
  "message": "Explain REST APIs",
  "system_prompt": "You are a helpful AI assistant."
}
```

The response includes the AI reply and metadata.

### GET /sessions/{session_id}/messages

Retrieves the conversation history for a session in chronological order.

### Error Handling

- `422` — Invalid request
- `404` — Session not found
- `503` — All LLM providers unavailable

## 6. Caching, Failover, and Testing

### LLM Caching

LiteLLM caching reuses responses for identical model inputs.

Verified local results:

| Request | Source | Latency |
|---|---|---|
| First request | LIVE_INFERENCE | 5113 ms |
| Second request | LLM_CACHE | 155 ms |

The cached response was approximately 33 times faster in this test.

### API-Key Failover

The backend attempts the configured API keys in order. When an eligible provider error occurs, it tries the next key.

Failure simulation examples:

```text
X-Simulate-Failure: key_1=429
X-Simulate-Failure: *=429
```

The first example simulates a primary-key rate-limit error. The second simulates all providers failing and returns HTTP 503.

### Backend Tests

Run the test suite using:

```bash
docker compose exec backend python -m pytest tests -v
```

Local testing has verified API-key failover, caching, request validation, and error handling.

## 7. Deployment

**Frontend URL:** To be added after deployment

**Backend URL:** To be added after deployment

**GitHub Repository:** To be added after pushing

The deployed backend must use persistent SQLite storage and securely configured environment variables. The frontend must be built with the public backend API URL.

## 8. Demo Video

**Demo URL:** To be added after recording

The 2–3 minute demonstration will cover:

- Deployed frontend and backend
- Health and chat endpoints
- Multi-turn conversations
- Cache hit
- API-key failover using `X-Simulate-Failure`
- Response metadata

## 9. Security

API keys are stored in environment variables and excluded from Git using `.gitignore`. Real credentials must never be committed or exposed in frontend code.

---

Built for the Lyftr AI Full-Stack Assignment.
