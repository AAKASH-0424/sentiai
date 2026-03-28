"""Abstract base class for sentiment analysis engines."""

from abc import ABC, abstractmethod


class SentimentEngine(ABC):
    """Base interface that all sentiment engines must implement."""

    @abstractmethod
    def analyze(self, text: str) -> dict:
        """Analyze a single review text and return sentiment data.

        Returns:
            dict with keys:
                - label: "POSITIVE" | "NEGATIVE" | "NEUTRAL"
                - score: float (-1.0 to 1.0) polarity score
                - confidence: float (0.0 to 1.0) confidence level
        """
        pass

    def analyze_batch(self, reviews: list[str]) -> dict:
        """Analyze a list of reviews and return individual + aggregate results.

        Returns:
            dict with keys:
                - results: list of per-review dicts (label, score, confidence, text)
                - summary: dict with counts, percentages, avg_score, statement
        """
        results = []
        for text in reviews:
            result = self.analyze(text)
            result["text"] = text
            results.append(result)

        summary = self._build_summary(results)
        return {"results": results, "summary": summary}

    @staticmethod
    def _build_summary(results: list[dict]) -> dict:
        """Build aggregate summary statistics from individual results."""
        total = len(results)
        if total == 0:
            return {
                "total": 0,
                "positive": 0,
                "negative": 0,
                "neutral": 0,
                "positive_pct": 0,
                "negative_pct": 0,
                "neutral_pct": 0,
                "avg_score": 0,
                "statement": "No reviews to analyze.",
            }

        counts = {"POSITIVE": 0, "NEGATIVE": 0, "NEUTRAL": 0}
        total_score = 0.0

        for r in results:
            counts[r["label"]] += 1
            total_score += r["score"]

        pos_pct = round((counts["POSITIVE"] / total) * 100)
        neg_pct = round((counts["NEGATIVE"] / total) * 100)
        neu_pct = round((counts["NEUTRAL"] / total) * 100)
        avg_score = round(total_score / total, 3)

        # Build human-readable statement
        if pos_pct >= 60:
            statement = f"{pos_pct}% of users liked this product."
        elif neg_pct >= 60:
            statement = f"{neg_pct}% of users disliked this product."
        elif pos_pct > neg_pct:
            statement = f"Mixed reviews — {pos_pct}% positive, {neg_pct}% negative."
        elif neg_pct > pos_pct:
            statement = f"Mixed reviews — {neg_pct}% negative, {pos_pct}% positive."
        else:
            statement = "Reviews are evenly split across sentiments."

        return {
            "total": total,
            "positive": counts["POSITIVE"],
            "negative": counts["NEGATIVE"],
            "neutral": counts["NEUTRAL"],
            "positive_pct": pos_pct,
            "negative_pct": neg_pct,
            "neutral_pct": neu_pct,
            "avg_score": avg_score,
            "statement": statement,
        }
