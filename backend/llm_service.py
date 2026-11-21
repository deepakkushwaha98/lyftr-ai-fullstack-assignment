
import os
import litellm
from dotenv import load_dotenv
from litellm.caching.caching import Cache

load_dotenv()

# -------------------------------
# Configuration
# -------------------------------

MODEL = os.getenv(
    "LLM_MODEL",
    "gemini/gemini-3.1-flash-lite"
)

API_KEYS = [
    key.strip()
    for key in os.getenv("LLM_API_KEYS", "").split(",")
    if key.strip()
]

DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant."

# -------------------------------
# Enable LiteLLM caching
# -------------------------------

litellm.cache = Cache(type="local")
litellm.enable_cache()

# Avoid logging sensitive API request details
litellm.suppress_debug_info = True


# -------------------------------
# Generate AI response
# -------------------------------

def generate_response(messages, simulated_failures=None):

    simulated_failures = simulated_failures or {}

    if not API_KEYS:
        raise RuntimeError("No LLM API keys configured")

    # Try each configured API key
    for index, api_key in enumerate(API_KEYS):

        key_id = f"key_{index + 1}"

        try:

            # -------------------------------
            # Simulate provider failure
            # -------------------------------

            simulated_status = simulated_failures.get(
                key_id,
                simulated_failures.get("*")
            )

            if simulated_status is not None:
                print(
                    f"{key_id}: simulated failure "
                    f"{simulated_status}",
                    flush=True
                )
                continue

            # -------------------------------
            # Call Gemini using LiteLLM
            # -------------------------------

            response = litellm.completion(
                model=MODEL,
                messages=messages,
                api_key=api_key,
                timeout=30,
                num_retries=0
            )

            # -------------------------------
            # Detect cache hit
            # -------------------------------

            hidden = (
                getattr(response, "_hidden_params", {})
                or {}
            )

            cache_hit = hidden.get("cache_hit") is True

            usage = getattr(response, "usage", None)

            # -------------------------------
            # Return response metadata
            # -------------------------------

            return {
                "reply": response.choices[0].message.content,
                "model": MODEL,
                "input_tokens": (
                    getattr(usage, "prompt_tokens", 0) or 0
                ),
                "output_tokens": (
                    getattr(usage, "completion_tokens", 0) or 0
                ),
                "resolution_source": (
                    "LLM_CACHE"
                    if cache_hit
                    else "LIVE_INFERENCE"
                ),
                "key_id": (
                    None if cache_hit else key_id
                ),
                "fallback_attempts": (
                    0 if cache_hit else index
                )
            }

        # -------------------------------
        # Handle provider errors
        # -------------------------------

        except (
            litellm.RateLimitError,
            litellm.ServiceUnavailableError,
            litellm.InternalServerError,
            litellm.APIConnectionError,
            litellm.Timeout
        ) as error:

            print(
                f"{key_id} failed: "
                f"{type(error).__name__}: "
                f"{str(error)[:500]}",
                flush=True
            )

            continue

    # -------------------------------
    # All API keys failed
    # -------------------------------

    raise RuntimeError("all providers unavailable")
