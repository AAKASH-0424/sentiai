"""Unit tests for sentiment analysis engines."""

import pytest
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engines.textblob_engine import TextBlobEngine


@pytest.fixture
def engine():
    return TextBlobEngine()


class TestTextBlobEngine:
    """Tests for the TextBlob/VADER engine."""

    def test_positive_review(self, engine):
        result = engine.analyze("This product is amazing! Works perfectly.")
        assert result["label"] == "POSITIVE"
        assert result["score"] > 0
        assert 0 <= result["confidence"] <= 1

    def test_negative_review(self, engine):
        result = engine.analyze("Terrible quality. Broke after 2 days.")
        assert result["label"] == "NEGATIVE"
        assert result["score"] < 0
        assert 0 <= result["confidence"] <= 1

    def test_neutral_review(self, engine):
        result = engine.analyze("The package arrived on Tuesday.")
        assert result["label"] == "NEUTRAL"
        assert 0 <= result["confidence"] <= 1

    def test_prd_neutral_review(self, engine):
        """PRD sample: 'It is okay, nothing special.' should be NEUTRAL."""
        result = engine.analyze("It is okay, nothing special.")
        assert result["label"] == "NEUTRAL"

    def test_result_structure(self, engine):
        result = engine.analyze("Some test review text here.")
        assert "label" in result
        assert "score" in result
        assert "confidence" in result
        assert result["label"] in ("POSITIVE", "NEGATIVE", "NEUTRAL")

    def test_score_range(self, engine):
        result = engine.analyze("Absolutely love this product!")
        assert -1.0 <= result["score"] <= 1.0

    def test_batch_analysis(self, engine):
        reviews = [
            "This product is amazing! Works perfectly.",
            "Terrible quality. Broke after 2 days.",
            "It is okay, nothing special.",
        ]
        data = engine.analyze_batch(reviews)

        assert "results" in data
        assert "summary" in data
        assert len(data["results"]) == 3

        summary = data["summary"]
        assert summary["total"] == 3
        assert summary["positive"] + summary["negative"] + summary["neutral"] == 3
        assert "statement" in summary

    def test_batch_percentages(self, engine):
        reviews = [
            "Amazing product! I love it!",
            "Great quality and fast shipping!",
            "Wonderful experience overall.",
            "Not bad, average quality.",
            "Terrible, worst purchase ever.",
        ]
        data = engine.analyze_batch(reviews)
        summary = data["summary"]

        # Percentages should add up to roughly 100
        total_pct = summary["positive_pct"] + summary["negative_pct"] + summary["neutral_pct"]
        assert 98 <= total_pct <= 102  # allow rounding

    def test_empty_batch(self, engine):
        data = engine.analyze_batch([])
        assert data["summary"]["total"] == 0
        assert data["summary"]["statement"] == "No reviews to analyze."

    def test_strongly_positive(self, engine):
        result = engine.analyze("Outstanding! Best purchase I ever made. Highly recommend!")
        assert result["label"] == "POSITIVE"
        assert result["score"] > 0.3

    def test_strongly_negative(self, engine):
        result = engine.analyze("Awful! Complete waste of money. Do not buy this horrible product!")
        assert result["label"] == "NEGATIVE"
        assert result["score"] < -0.3
