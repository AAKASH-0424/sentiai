import sys
import json
sys.path.append(r"d:\sentiai-main\sentiai-main")
from app import app

def run_test():
    client = app.test_client()
    print("Testing /analyze endpoint with openrouter...")
    res = client.post('/analyze', json={
        "reviews": ["This is great", "This is bad"],
        "engine": "openrouter"
    })
    print("Analyze Status:", res.status_code)
    try:
        print("Analyze Data:", json.dumps(res.get_json(), indent=2))
    except Exception:
        print("Analyze Data:", res.get_data(as_text=True))

    print("\nTesting /analyze-product endpoint...")
    res = client.post('/analyze-product', json={
        "product_name": "iPhone 15"
    })
    print("Product Status:", res.status_code)
    try:
        print("Product Data:", json.dumps(res.get_json(), indent=2))
    except Exception:
        print("Product Data:", res.get_data(as_text=True))

if __name__ == "__main__":
    run_test()
