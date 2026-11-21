import os
import litellm
from dotenv import load_dotenv
from litellm.caching.caching import Cache

load_dotenv()

MODEL = os.getenv("LLM_MODEL", "gemini/gemini-3.1-flash-lite")

API_KEYS = [
    key.strip()
    for key in os.getenv("LLM_API_KEYS", "").split(",")
    if key.strip()
]

DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant."

# Enable LiteLLM in-memory caching
litellm.cache = Cache(type="local")
litellm.enable_cache()


def generate_response(messages, simulated_failures=None):
    simulated_failures = simulated_failures or {}

    if not API_KEYS:
        raise RuntimeError("No LLM API keys configured")

    for index, api_key in enumerate(API_KEYS):
        key_id = f"key_{index + 1}"

        try:
            simulated_status = simulated_failures.get(
                key_id,
                simulated_failures.get("*")
            )

            if simulated_status is not None:
                print(f"{key_id}: simulated failure {simulated_status}")
                continue

            response = litellm.completion(
                model=MODEL,
                messages=messages,
                api_key=api_key,
                timeout=30,
                num_retries=0
            )

            hidden = getattr(response, "_hidden_params", {}) or {}

            # Diagnostic logging to verify cache metadata
            print("CACHE DEBUG:", hidden)

            cache_hit = hidden.get("cache_hit") is True

            usage = getattr(response, "usage", None)

            return {
                "reply": response.choices[0].message.content,
                "model": MODEL,
                "input_tokens": getattr(usage, "prompt_tokens", 0) or 0,
                "output_tokens": getattr(usage, "completion_tokens", 0) or 0,
                "resolution_source": (
                    "LLM_CACHE" if cache_hit else "LIVE_INFERENCE"
                ),
                "key_id": None if cache_hit else key_id,
                "fallback_attempts": 0 if cache_hit else index
            }

        except (
            litellm.RateLimitError,
            litellm.ServiceUnavailableError,
            litellm.InternalServerError,
            litellm.APIConnectionError,
            litellm.Timeout
        ) as error:
            print(f"{key_id} failed: {type(error).__name__}")
            continue

    raise RuntimeError("all providers unavailable")