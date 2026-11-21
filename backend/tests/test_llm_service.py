
from unittest.mock import patch, MagicMock
from litellm.exceptions import RateLimitError

import llm_service


def test_api_key_failover(monkeypatch):
    # Use fake keys, never real API keys
    monkeypatch.setattr(
        llm_service,
        "API_KEYS",
        ["fake_key_1", "fake_key_2"]
    )

    calls = []

    def mock_completion(**kwargs):
        calls.append(kwargs["api_key"])

        if kwargs["api_key"] == "fake_key_1":
            raise RateLimitError(
                message="Rate limit exceeded",
                llm_provider="gemini",
                model="gemini/gemini-3.1-flash-lite"
            )

        response = MagicMock()
        response.choices[0].message.content = "Fallback successful"
        response.usage.prompt_tokens = 10
        response.usage.completion_tokens = 5
        response._hidden_params = {}
        return response

    with patch(
        "llm_service.litellm.completion",
        side_effect=mock_completion
    ):
        result = llm_service.generate_response(
            [{"role": "user", "content": "Hello"}]
        )

    assert result["reply"] == "Fallback successful"
    assert calls == ["fake_key_1", "fake_key_2"]
    assert result["fallback_attempts"] == 1






def test_llm_caching(monkeypatch):
    monkeypatch.setattr(
        llm_service,
        "API_KEYS",
        ["fake_key_1", "fake_key_2"]
    )

    messages = [
        {"role": "user", "content": "Explain Python caching"}
    ]

    # Simulate LiteLLM's cache: first request is live,
    # second identical request is cached.
    call_count = 0

    def mock_completion(**kwargs):
        nonlocal call_count
        call_count += 1

        response = MagicMock()
        response.choices[0].message.content = "Caching saves time"
        response.usage.prompt_tokens = 10
        response.usage.completion_tokens = 4
        response._hidden_params = {
            "cache_hit": call_count > 1
        }
        return response

    with patch(
        "llm_service.litellm.completion",
        side_effect=mock_completion
    ):
        first = llm_service.generate_response(messages)
        second = llm_service.generate_response(messages)

    assert first["reply"] == second["reply"]
    assert first["resolution_source"] == "LIVE_INFERENCE"
    assert second["resolution_source"] == "LLM_CACHE"

