from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_invalid_session():
    response = client.get("/sessions/nonexistent-test-session/messages")
    assert response.status_code == 404


def test_chat_validation():
    response = client.post("/chat", json={})
    assert response.status_code == 422