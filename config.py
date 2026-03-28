"""Application configuration for AI Review Analyzer."""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Central configuration class."""

    # --- Engine Settings ---
    DEFAULT_ENGINE = "textblob"  # "textblob" or "openrouter"

    # --- Sentiment Thresholds (from PRD) ---
    POLARITY_POSITIVE_THRESHOLD = 0.1   # score > 0.1  → Positive
    POLARITY_NEGATIVE_THRESHOLD = -0.1  # score < -0.1 → Negative

    # --- Input Limits ---
    MAX_REVIEWS = 20
    MAX_WORDS_PER_REVIEW = 500
    MIN_WORDS_PER_REVIEW = 3

    # --- OpenRouter API ---
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
    OPENROUTER_TIMEOUT = 60  # seconds (product analysis needs more time)

    # --- Flask ---
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
