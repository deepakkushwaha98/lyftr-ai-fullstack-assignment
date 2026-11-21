from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_chat_response():
    mock_result = {
        "reply": "Hello! I am Gemini.",
        "model": "gemini-test",
        "resolution_source": "LIVE_INFERENCE",
        "latency_ms": 100,
        "input_tokens": 10,
        "output_tokens": 8,
        "key_id": "key_1",
        "fallback_attempts": 0,
    }

    with patch("main.generate_response", return_value=mock_result):
        response = client.post(
            "/chat",
            json={
                "session_id": "pytest-chat-response",
                "message": "Hello",
            },
        )

    assert response.status_code == 200
    assert response.json()["reply"] == "Hello! I am Gemini."


def test_conversation_memory():
    response = client.get(
        "/sessions/pytest-chat-response/messages"
    )

    assert response.status_code == 200
    assert len(response.json()["messages"]) >= 2