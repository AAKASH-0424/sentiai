import os
import sys

# Add the directory to the path so we can import modules
sys.path.append(r"d:\sentiai-main\sentiai-main")

from config import Config
from engines.openrouter_engine import OpenRouterEngine

def test():
    print("API Key loaded:", bool(Config.OPENROUTER_API_KEY))
    print("API Key value (first 10 chars):", Config.OPENROUTER_API_KEY[:10])
    
    engine = OpenRouterEngine()
    print("Is available?", engine._is_available())
    
    print("Testing analyze...")
    try:
        res = engine.analyze("This is a fantastic product, I really love it!")
        print(res)
    except Exception as e:
        print("Error during analyze:", e)

    print("Testing analyze_batch...")
    try:
        res = engine.analyze_batch(["Good", "Bad"])
        print(res)
    except Exception as e:
        print("Error during analyze_batch:", e)

if __name__ == "__main__":
    test()
