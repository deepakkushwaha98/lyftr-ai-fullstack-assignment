from llm_service import generate_response

messages = [
    {"role": "user", "content": "What is the capital of India?"}
]

result = generate_response(
    messages,
    simulated_failures={"key_1": 429}
)

print(result)