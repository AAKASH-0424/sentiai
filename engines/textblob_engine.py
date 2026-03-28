"""TextBlob + VADER sentiment analysis engine (Option 1 — Python Libraries)."""

from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from .base import SentimentEngine
from config import Config


class TextBlobEngine(SentimentEngine):
    """Combines TextBlob polarity with VADER compound score for robust analysis."""

    def __init__(self):
        self.vader = SentimentIntensityAnalyzer()

    def analyze(self, text: str) -> dict:
        """Analyze sentiment using averaged TextBlob + VADER scores."""
        # TextBlob polarity: -1.0 (negative) to 1.0 (positive)
        blob = TextBlob(text)
        tb_polarity = blob.sentiment.polarity

        # VADER compound score: -1.0 to 1.0
        vader_scores = self.vader.polarity_scores(text)
        compound = vader_scores["compound"]

        # Weighted average: VADER (65%) is better calibrated for short reviews,
        # TextBlob (35%) adds literary polarity context
        polarity = tb_polarity * 0.35 + compound * 0.65

        # Classify using PRD thresholds on the averaged score
        if polarity > Config.POLARITY_POSITIVE_THRESHOLD:
            label = "POSITIVE"
        elif polarity < Config.POLARITY_NEGATIVE_THRESHOLD:
            label = "NEGATIVE"
        else:
            label = "NEUTRAL"

        # Confidence: use absolute VADER compound as a proxy (0.0 to 1.0)
        confidence = round(min(abs(compound), 1.0), 3)

        return {
            "label": label,
            "score": round(polarity, 3),
            "confidence": confidence,
        }
