
import os
import time
import sqlite3

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from database import init_db, get_db, get_messages, save_message
from llm_service import (
    generate_response,
    DEFAULT_SYSTEM_PROMPT,
    API_KEYS,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="LLM Chatbot API",
    version="0.1.0",
    lifespan=lifespan,
)


# Read CORS origins from environment
DEFAULT_ORIGINS = (
    "http://localhost:5173,"
    "http://localhost:3000,"
    "http://localhost:3001"
)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS", DEFAULT_ORIGINS
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=4000)
    system_prompt: Optional[str] = None

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("session_id cannot be empty")

        return value

    @field_validator("message")
    @classmethod
    def validate_message(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("message cannot be empty")

        return value


def parse_simulated_failures(value):
    failures = {}

    if not value:
        return failures

    for part in value.split(","):
        part = part.strip()

        if "=" not in part:
            raise HTTPException(
                status_code=400,
                detail="Invalid failure format. Use key_1=429",
            )

        key, status = part.split("=", 1)
        key = key.strip()
        status = status.strip()

        valid_keys = {
            f"key_{i + 1}" for i in range(len(API_KEYS))
        }
        valid_keys.add("*")

        if key not in valid_keys:
            raise HTTPException(
                status_code=400,
                detail="Invalid key identifier",
            )

        if status not in ("429", "500"):
            raise HTTPException(
                status_code=400,
                detail="Failure status must be 429 or 500",
            )

        failures[key] = int(status)

    return failures


@app.get("/health")
def health():
    try:
        with get_db() as connection:
            connection.execute("SELECT 1")

        return {
            "status": "ok",
            "keys_configured": len(API_KEYS),
            "cache_enabled": True,
            "database": "connected",
        }

    except sqlite3.Error:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        )


@app.get("/sessions/{session_id}/messages")
def session_messages(session_id: str):
    if not 1 <= len(session_id) <= 128:
        raise HTTPException(
            status_code=422,
            detail="Invalid session_id length",
        )

    messages = get_messages(session_id)

    if not messages:
        raise HTTPException(
            status_code=404,
            detail="session not found",
        )

    return {
        "session_id": session_id,
        "messages": messages,
    }


@app.post("/chat")
def chat(
    request: ChatRequest,
    x_simulate_failure: Optional[str] = Header(default=None),
):
    failures = {}

    if (
        os.getenv(
            "ENABLE_FAILURE_SIMULATION", "false"
        ).lower() == "true"
    ):
        failures = parse_simulated_failures(
            x_simulate_failure
        )

    history = get_messages(request.session_id)

    messages = [
        {
            "role": "system",
            "content": (
                request.system_prompt
                or DEFAULT_SYSTEM_PROMPT
            ),
        }
    ]

    for item in history:
        messages.append({
            "role": item["role"],
            "content": item["content"],
        })

    messages.append({
        "role": "user",
        "content": request.message,
    })

    start_time = time.perf_counter()

    try:
        result = generate_response(
            messages,
            simulated_failures=failures,
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        )

    latency_ms = round(
        (time.perf_counter() - start_time) * 1000
    )

    metadata = {
        "resolution_source": result["resolution_source"],
        "model": result["model"],
        "latency_ms": latency_ms,
        "input_tokens": result["input_tokens"],
        "output_tokens": result["output_tokens"],
        "key_id": result["key_id"],
        "fallback_attempts": result["fallback_attempts"],
    }

    save_message(
        request.session_id,
        "user",
        request.message,
    )

    save_message(
        request.session_id,
        "assistant",
        result["reply"],
        metadata,
    )

    return {
        "session_id": request.session_id,
        "reply": result["reply"],
        "metadata": metadata,
    }
