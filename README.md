Lyftr AI — Full-Stack AI Chatbot
A full-stack, session-aware AI chatbot built with React, FastAPI, LiteLLM, Google Gemini, and SQLite. It supports multi-turn conversations, response caching, automatic API-key failover, and per-message inference metadata.
Features
- Multi-turn conversations with session-based history
- Google Gemini integration through LiteLLM
- LiteLLM response caching for repeated model inputs
- Automatic fallback across a pool of API keys
- Configurable system prompts
- SQLite conversation storage
- Per-response metadata: source, model, latency, input/output tokens, key ID, and fallback attempts
- Responsive React interface and Docker Compose setup
Technology Stack
Layer	Technology
Frontend	React, Vite, JavaScript, CSS
Backend	Python, FastAPI, Pydantic, LiteLLM
LLM	Google Gemini (gemini/gemini-3.1-flash-lite)
Database	SQLite
Containerization	Docker, Docker Compose, Nginx
Hosting	Vercel (frontend), Render (backend)


Project Structure
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
1. Live URLs
Resource	URL
Frontend	https://lyftr-ai-fullstack-assignment.vercel.app
Backend	https://lyftr-ai-fullstack-assignment.onrender.com
API documentation	https://lyftr-ai-fullstack-assignment.onrender.com/docs
Health check	https://lyftr-ai-fullstack-assignment.onrender.com/health
Source code	https://github.com/deepakkushwaha98/lyftr-ai-fullstack-assignment


Note: The backend's root URL (/) is not an application endpoint and may return 404 Not Found. Use /health or /docs to verify the service.
2. Run locally: with Docker and without
Prerequisites
- Git
- Two or more Google Gemini API keys
- Docker with Docker Compose (for containerized setup)
- Python and Node.js (for non-Docker setup)
Environment configuration
Create backend/.env and configure the application. Use .env.example as the reference for all supported variables.
LLM_API_KEYS=your_first_gemini_key,your_second_gemini_key
LLM_MODEL=gemini/gemini-3.1-flash-lite
DATABASE_URL=sqlite:////data/app.db
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
ENABLE_FAILURE_SIMULATION=true
Do not commit real API keys or .env files.
With Docker (recommended)
From the repository root:
docker compose up -d --build
Or, where make is available:
make up
Local endpoints:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
If port 3000 is occupied, set FRONTEND_PORT=3001 in the Compose environment and use http://localhost:3001.

Stop the services with:
docker compose down
# or
make down
The Docker configuration uses a named volume mounted at /data to retain SQLite conversation history across container restarts.
Without Docker (development)
In a terminal, from the repository root:
cd backend
python -m venv .venv
Activate the environment (.venv\Scripts\activate on Windows PowerShell, or source .venv/bin/activate on macOS/Linux), then:
pip install -r requirements.txt
For non-Docker execution, set DATABASE_URL to a writable local SQLite path, such as sqlite:///./app.db, and set ALLOWED_ORIGINS to the frontend development origin. Start the API:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
In a second terminal:
cd frontend
npm install
Set VITE_API_URL=http://localhost:8000 in the frontend environment, then run:
npm run dev
Open the local URL displayed by Vite. The development server port may differ from the Docker frontend port.
3. Design decisions: key fallback, caching, SQLite session storage
Request flow
React frontend
    |
    v
FastAPI /chat endpoint
    |
    +--> Load conversation history from SQLite
    |
    +--> LiteLLM + Gemini
    |       |-- Check response cache
    |       |-- Try key_1
    |       `-- Fall back to key_2 on eligible errors
    |
    +--> Store user and assistant messages in SQLite
    |
    `--> Return reply + per-request metadata
Key fallback
LLM_API_KEYS is a comma-separated list. The backend attempts keys in order (key_1, key_2, etc.). On supported rate-limit, quota, connectivity, or service errors, it attempts the next key. If every key fails, it returns HTTP 503 with a readable error rather than an unhandled exception.

The optional X-Simulate-Failure header allows deterministic testing when ENABLE_FAILURE_SIMULATION=true.
Response caching
LiteLLM's local cache can reuse a response when the model input is identical. Responses indicate whether they came from LLM_CACHE or LIVE_INFERENCE. Cache hits reduce repeated model calls and typically improve latency. The in-memory cache is process-local and is not guaranteed to survive server restarts.
SQLite session storage
The backend stores user and assistant messages by session_id, including assistant metadata. This allows conversations to retain context across requests and makes chat history retrievable through a dedicated endpoint.

Persistence: The local Docker configuration uses a named volume for SQLite. The free Render deployment uses ephemeral storage, so deployed history may reset after a restart or redeployment; it is not durable production storage.
API endpoints
Method	Endpoint	Description
GET	/health	Health, configured key count, cache and database status
POST	/chat	Send a message and receive a reply with metadata
GET	/sessions/{session_id}/messages	Retrieve chronological conversation history


Example POST /chat request:
{
  "session_id": "example-session",
  "message": "Explain REST APIs in simple terms.",
  "system_prompt": "You are a helpful AI assistant."
}
4. Verification: how to see failover, cache hits and per-message token usage
Open the Swagger API documentation and use Try it out.
Health and chat history
- GET /health should return HTTP 200 with healthy database and configured key information.
- POST /chat with a valid message should return HTTP 200 and an assistant reply.
- GET /sessions/{session_id}/messages should return the session's saved user and assistant messages in order.
Cache hit
Send the same model input again under equivalent conversation context. Inspect metadata.resolution_source:
- LIVE_INFERENCE: response generated by Gemini
- LLM_CACHE: response reused from LiteLLM cache
Identical user text alone does not guarantee a hit if the accumulated conversation history changes the model input. The cache was verified with matching model inputs across separate sessions.
Failover
Set this request header on POST /chat:
X-Simulate-Failure: key_1=429
A successful fallback response should have HTTP 200 and metadata similar to:
{
  "resolution_source": "LIVE_INFERENCE",
  "model": "gemini/gemini-3.1-flash-lite",
  "latency_ms": 499,
  "input_tokens": 65,
  "output_tokens": 30,
  "key_id": "key_2",
  "fallback_attempts": 1
}
To simulate all keys failing, use:
X-Simulate-Failure: *=429
Expected status: HTTP 503.
{
  "detail": "all providers unavailable"
}
Per-message token usage
Each assistant response includes its own input_tokens and output_tokens in metadata, along with the model, resolution source, and latency. These values describe that request rather than a session-wide total.
Validation and error handling
Scenario	Expected HTTP status
Valid chat request	200
Empty or whitespace-only message	422
Unknown session history	404
All providers unavailable	503


Backend tests
Run tests inside the Docker backend container:
docker compose exec backend python -m pytest tests -v
Local backend tests have passed for caching, failover, request validation, and error handling.
5. Setup Used: your editor and AI tools
- Development environment: Visual Studio Code, terminal, Git and GitHub
- API exploration and verification: FastAPI Swagger UI
- Local container testing: Docker and Docker Compose
- Deployment: Vercel and Render
- AI-assisted development: AI tools were used to assist with implementation guidance, debugging, and documentation; functionality was validated through local tests and live endpoint checks.
6. Bonus features (if any): what you added beyond the requirements and why
The application includes useful interface and debugging conveniences:
- Conversation history sidebar: Helps users revisit conversations within the available stored sessions.
- API-key and fallback metadata: Makes failover behavior easier to inspect and verify.
- System prompt support: Allows users to customize the assistant's behavior for a conversation.
- Detailed error responses: Makes validation and provider outages easier to diagnose.
Security notes
- Keep Gemini API keys in backend environment variables only.
- Do not commit secrets, .env files, or credentials.
- Configure ALLOWED_ORIGINS for the intended frontend origins.
- Use ENABLE_FAILURE_SIMULATION only in environments where failure testing is intended.
Built for the Lyftr AI Full-Stack Assignment.