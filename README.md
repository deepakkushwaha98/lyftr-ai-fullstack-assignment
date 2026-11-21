# Lyftr AI — Full-Stack AI Chatbot

A full-stack AI chatbot built using **React, FastAPI, LiteLLM, Google Gemini, and SQLite**.

The application supports multi-turn conversations, session-based message history, LLM response caching, automatic API-key failover, and detailed response metadata.

The goal is to build a reliable AI chatbot that maintains conversation context, handles API failures gracefully, and reduces unnecessary model calls through caching.

## Features

- Multi-turn AI conversations with session-based history.
- Google Gemini integration using LiteLLM.
- Automatic failover between multiple API keys.
- LLM response caching to reduce latency and API usage.
- SQLite database for storing conversations.
- Configurable system prompts.
- Per-message input and output token tracking.
- Response metadata including model, latency, and resolution source.
- Responsive React chatbot interface.
- REST API built with FastAPI.
- Docker Compose support for local deployment.
- API documentation using Swagger UI.
- Error handling for invalid requests and unavailable LLM providers.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Python, FastAPI, Pydantic |
| LLM Integration | LiteLLM |
| AI Model | Google Gemini |
| Database | SQLite |
| Containerization | Docker, Docker Compose |
| Web Server | Nginx, Uvicorn |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |
| Version Control | Git, GitHub |

## Project Architecture

The React frontend communicates with the FastAPI backend through REST APIs.

The backend manages conversation sessions, stores messages in SQLite, and sends requests to Gemini through LiteLLM.

LiteLLM handles response caching, while the backend manages API-key fallback and returns metadata with each assistant response.

**Request flow:**

```text
User
  |
  v
React Frontend
  |
  v
FastAPI Backend
  |
  +----> SQLite Database
  |        |
  |        +----> Session History
  |
  v
LiteLLM Gateway
  |
  +----> Response Cache
  |
  +----> Gemini API (key_1)
  |          |
  |          +----> Failure
  |                   |
  +----> Gemini API (key_2)
  |
  v
AI Response + Metadata
  |
  v
React Frontend
```

## Project Structure

```text
lyftr-ai-fullstack-assignment/
|
|-- backend/
|   |-- main.py
|   |-- llm_service.py
|   |-- database.py
|   |-- requirements.txt
|   |-- Dockerfile
|   |-- tests/
|
|-- frontend/
|   |-- src/
|   |-- Dockerfile
|   |-- nginx.conf
|
|-- docker-compose.yml
|-- Makefile
|-- .env.example
|-- README.md
```

---

## 1. Live URLs

The application is publicly deployed and accessible without authentication.

| Service | URL |
|---|---|
| Frontend | https://lyftr-ai-fullstack-assignment.vercel.app |
| Backend | https://lyftr-ai-fullstack-assignment.onrender.com |
| Swagger API Docs | https://lyftr-ai-fullstack-assignment.onrender.com/docs |
| Health Endpoint | https://lyftr-ai-fullstack-assignment.onrender.com/health |
| GitHub Repository | https://github.com/deepakkushwaha98/lyftr-ai-fullstack-assignment |

**Deployment details:**

- The frontend is hosted on Vercel.
- The FastAPI backend is hosted on Render.
- The frontend connects to the deployed backend through the `VITE_API_URL` environment variable.
- API keys are stored securely as backend environment variables.
- CORS is configured to allow communication between the deployed frontend and backend.

**Storage note:** The free Render deployment uses an ephemeral filesystem. SQLite data may be lost after service restarts or redeployments. Local Docker storage uses a named volume for persistence.

---

## 2. Run Locally: With Docker and Without

### Prerequisites

Install the following:

- Git
- Docker and Docker Compose
- Python
- Node.js and npm
- At least two Gemini API keys

### Clone the Repository

```bash
git clone https://github.com/deepakkushwaha98/lyftr-ai-fullstack-assignment.git

cd lyftr-ai-fullstack-assignment
```

### Configure Environment Variables

Create a `.env` file inside the `backend` directory.

Example:

```env
LLM_API_KEYS=your_first_gemini_key,your_second_gemini_key
LLM_MODEL=gemini/gemini-3.1-flash-lite
DATABASE_URL=sqlite:////data/app.db
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
ENABLE_FAILURE_SIMULATION=true
```

Replace the placeholder keys with valid Gemini API keys.

Never commit actual API keys to GitHub.

### Option A: Run With Docker

From the project root, run:

```bash
docker compose up -d --build
```

Alternatively, use the Makefile:

```bash
make up
```

The services will be available at:

| Service | Local URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |

If port 3000 is occupied, configure `FRONTEND_PORT=3001` for Docker Compose.

To stop the application:

```bash
docker compose down
```

Or:

```bash
make down
```

The Docker Compose configuration uses a named volume to store the SQLite database under `/data`.

### Option B: Run Without Docker

**Step 1: Start the backend**

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

For local execution, configure the database URL to point to a writable local SQLite file, for example:

```env
DATABASE_URL=sqlite:///./app.db
```

Start FastAPI:

```bash
uvicorn main:app --reload --port 8000
```

Backend URL:

http://localhost:8000

Swagger documentation:

http://localhost:8000/docs

**Step 2: Start the frontend**

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Configure the frontend environment:

```env
VITE_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed by Vite.

---

## 3. Design Decisions: Key Fallback, Caching, SQLite Session Storage

### API-Key Failover

The backend supports multiple Gemini API keys.

Keys are loaded from the `LLM_API_KEYS` environment variable.

Example:

```env
LLM_API_KEYS=key_one,key_two
```

The keys are assigned identifiers based on their order:

- `key_1` — Primary API key
- `key_2` — Secondary API key

When the primary key fails due to rate limiting, quota errors, or supported server/network errors, the backend attempts the next configured key.

This improves reliability and prevents a single API-key failure from immediately interrupting the chatbot.

If all configured keys fail, the backend returns:

```json
{
  "detail": "all providers unavailable"
}
```

HTTP status: `503 Service Unavailable`.

### LLM Response Caching

The application uses LiteLLM's built-in local in-memory caching.

When the same model request is repeated, the cached response can be reused instead of making another Gemini API call.

The backend reports the resolution source using:

`LIVE_INFERENCE` — Response generated through a new model request.

`LLM_CACHE` — Response retrieved from the cache.

**Benefits:**

- Lower response latency.
- Reduced repeated API calls.
- Lower token consumption for repeated requests.
- Improved chatbot responsiveness.

The cache is in-memory and may be cleared when the backend process restarts.

### SQLite Session Storage

SQLite stores conversation history for each session.

Each message is associated with a unique `session_id`.

The database stores:

- Session ID
- Message role (`user` or `assistant`)
- Message content
- Response metadata
- Creation timestamp

When a user sends a new message, the backend retrieves the existing session history and includes the relevant conversation context in the LLM request.

This enables multi-turn conversations.

SQLite was selected because it is lightweight, requires no external database server, and is suitable for a small chatbot application.

### Response Metadata

Every assistant response includes metadata such as:

```json
{
  "resolution_source": "LIVE_INFERENCE",
  "model": "gemini/gemini-3.1-flash-lite",
  "latency_ms": 499,
  "input_tokens": 65,
  "output_tokens": 30,
  "key_id": "key_2",
  "fallback_attempts": 1
}
```

This helps users understand whether the response was cached, which model was used, how long the request took, and how many tokens were consumed.

---

## 4. Verification: Failover, Cache Hits and Per-Message Token Usage

The backend provides three API endpoints.

### GET /health

Checks whether the backend is running and its dependencies are configured.

Example response:

```json
{
  "status": "ok",
  "keys_configured": 2,
  "cache_enabled": true,
  "database": "connected"
}
```

### POST /chat

Sends a user message to the AI chatbot.

Example request:

```json
{
  "session_id": "example-session",
  "message": "Explain REST APIs in simple words."
}
```

The response includes the assistant's reply and metadata.

### GET /sessions/{session_id}/messages

Retrieves stored conversation messages for a session in chronological order.

Example:

```text
GET /sessions/example-session/messages
```

### Verify API-Key Failover

Open the Swagger documentation:

https://lyftr-ai-fullstack-assignment.onrender.com/docs

Select `POST /chat`.

Set the request header:

```text
X-Simulate-Failure: key_1=429
```

Example request body:

```json
{
  "session_id": "failover-test",
  "message": "Explain Redis in one sentence."
}
```

Expected successful response metadata:

```json
{
  "key_id": "key_2",
  "fallback_attempts": 1
}
```

This verifies that the backend switches to the secondary API key when the primary key is simulated as unavailable.

### Verify All Providers Unavailable

Set:

```text
X-Simulate-Failure: *=429
```

Send a new chat request.

Expected response:

HTTP `503 Service Unavailable`

```json
{
  "detail": "all providers unavailable"
}
```

### Verify Response Caching

Send an identical model request twice using the same conversation context.

The first request should use:

```text
resolution_source: LIVE_INFERENCE
```

The repeated request should use:

```text
resolution_source: LLM_CACHE
```

A cache hit normally has lower latency than a new model request.

To avoid changing the model input through conversation history, use separate fresh sessions with identical initial messages and system prompts.

### Verify Conversation History

Send messages using a session ID.

Then call:

```text
GET /sessions/{session_id}/messages
```

The endpoint should return the stored user and assistant messages, including assistant metadata.

### Verify Token Usage

Each assistant response includes:

- `input_tokens`
- `output_tokens`
- `latency_ms`
- `model`
- `resolution_source`

These values describe the individual request rather than the total conversation.

The React frontend displays this metadata alongside assistant responses.

### Verify Error Handling

| Scenario | Expected HTTP Status |
|---|---|
| Successful request | 200 |
| Empty or whitespace-only message | 422 |
| Nonexistent session | 404 |
| All API keys unavailable | 503 |

### Run Backend Tests

With Docker:

```bash
docker compose exec backend python -m pytest tests -v
```

The backend test suite covers core API functionality and error-handling behavior.

---

## 5. Setup Used: Editor and AI Tools

### Development Environment

- **Code Editor:** Visual Studio Code
- **Version Control:** Git and GitHub
- **API Testing:** FastAPI Swagger UI
- **Containerization:** Docker and Docker Compose
- **Frontend Deployment:** Vercel
- **Backend Deployment:** Render

### AI Tools

**ChatGPT (OpenAI)** was used as a development assistant for understanding requirements, discussing implementation approaches, debugging errors, reviewing API behavior, and preparing documentation.

The application uses Google Gemini through LiteLLM for chatbot inference.

---

## 6. Bonus Features (If Any)

The chatbot includes additional functionality to improve usability and observability.

### Configurable System Prompt

Users can customize the assistant's behavior by supplying a system prompt.

This allows different chatbot personalities or task-specific instructions.

### Response Metadata

The frontend displays detailed metadata for assistant messages, including latency, token usage, model information, and response source.

### Session-Based Conversation History

Users can view messages belonging to individual conversation sessions.

### API-Key Tracking

The backend returns the identifier of the API key used for live inference and the number of fallback attempts.

This makes failover behavior easier to verify.

### Responsive User Interface

The React interface is designed to provide a clean chat experience across different screen sizes.

---

## Security

- Gemini API keys are stored in backend environment variables.
- Real credentials are excluded from Git using `.gitignore`.
- API keys are never included in frontend source code.
- CORS restricts browser access to configured origins.
- Request validation is handled using Pydantic.
- Provider failures are handled through controlled API responses.
- Failure simulation is controlled by the `ENABLE_FAILURE_SIMULATION` environment variable.

---

## Conclusion

Lyftr AI is a full-stack chatbot application designed to demonstrate reliable LLM integration, automatic API-key failover, response caching, conversation persistence, and transparent response metadata.

The project combines React, FastAPI, LiteLLM, Gemini, SQLite, and Docker into a deployable AI application.

**Built for the Lyftr AI Full-Stack Assignment.**