
import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("LLM_API_KEYS").split(",")[0].strip()

url = "https://generativelanguage.googleapis.com/v1beta/models"

response = requests.get(
    url,
    headers={"x-goog-api-key": api_key},
    timeout=20
)

response.raise_for_status()

for model in response.json().get("models", []):
    if "generateContent" in model.get("supportedGenerationMethods", []):
        print(model["name"])
