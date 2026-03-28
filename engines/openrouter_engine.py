"""OpenRouter API sentiment analysis engine (Option 2 — Cloud LLM)."""

import json
import time
import requests

from .base import SentimentEngine
from config import Config


class OpenRouterEngine(SentimentEngine):
    """Sentiment analysis via OpenRouter API (any LLM model)."""

    SYSTEM_PROMPT = (
        "You are a sentiment analysis assistant. For each review provided, "
        "respond with a JSON object containing:\n"
        '  - "label": one of "POSITIVE", "NEGATIVE", or "NEUTRAL"\n'
        '  - "score": a polarity float from -1.0 (most negative) to 1.0 (most positive)\n'
        '  - "confidence": a float from 0.0 to 1.0 indicating your confidence\n'
        "Respond ONLY with valid JSON. No explanations, no markdown fences."
    )

    def __init__(self):
        self.api_key = Config.OPENROUTER_API_KEY
        self.model = Config.OPENROUTER_MODEL
        self.base_url = Config.OPENROUTER_BASE_URL
        self.timeout = Config.OPENROUTER_TIMEOUT

    def _is_available(self) -> bool:
        """Check if an API key is configured."""
        return bool(self.api_key and self.api_key != "your_openrouter_api_key_here")

    def analyze(self, text: str) -> dict:
        """Analyze a single review via the OpenRouter API."""
        if not self._is_available():
            return self._fallback_result(text, "No OpenRouter API key configured.")

        prompt = f'Analyze the sentiment of this review:\n\n"{text}"'

        try:
            response = requests.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://ai-review-analyzer.onrender.com",
                    "X-Title": "AI Review Analyzer",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "reasoning": {"enabled": True},
                    "temperature": 0.1,
                    "max_tokens": 1000,
                },
                timeout=self.timeout,
            )
            response.raise_for_status()

            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            # Extract JSON object from content to ignore reasoning tags
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                content = content[json_start:json_end]

            result = json.loads(content)

            # Validate and normalize
            label = result.get("label", "NEUTRAL").upper()
            if label not in ("POSITIVE", "NEGATIVE", "NEUTRAL"):
                label = "NEUTRAL"

            score = float(result.get("score", 0))
            score = max(-1.0, min(1.0, score))

            confidence = float(result.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))

            return {
                "label": label,
                "score": round(score, 3),
                "confidence": round(confidence, 3),
            }

        except requests.exceptions.Timeout:
            return self._fallback_result(text, "API request timed out.")
        except requests.exceptions.RequestException as e:
            return self._fallback_result(text, f"API error: {str(e)}")
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            return self._fallback_result(text, f"Failed to parse API response: {str(e)}")

    def _fallback_result(self, text: str, error: str) -> dict:
        """Fall back to TextBlob if OpenRouter fails."""
        from .textblob_engine import TextBlobEngine

        fallback = TextBlobEngine()
        result = fallback.analyze(text)
        result["fallback"] = True
        result["error"] = error
        return result

    def analyze_batch(self, reviews: list[str]) -> dict:
        """Analyze reviews — attempts batch for efficiency, falls back to individual."""
        if not self._is_available():
            # Fall back entirely to TextBlob for the whole batch
            from .textblob_engine import TextBlobEngine

            fallback = TextBlobEngine()
            data = fallback.analyze_batch(reviews)
            data["engine_note"] = "Quick Scan mode active (no AI key configured)."
            return data

        # Process individually for reliability
        results = []
        for text in reviews:
            result = self.analyze(text)
            result["text"] = text
            results.append(result)

        summary = self._build_summary(results)

        # Note if any fell back
        fallback_count = sum(1 for r in results if r.get("fallback"))
        if fallback_count:
            summary["engine_note"] = (
                f"{fallback_count}/{len(reviews)} reviews used Quick Scan fallback."
            )

        # --- Get recommendation + trust score via additional API call ---
        rec_data = self._get_recommendation(reviews, results)
        if rec_data:
            summary["recommendation"] = rec_data.get("recommendation", {})
            summary["trust"] = rec_data.get("trust", {})

        return {"results": results, "summary": summary}

    RECOMMENDATION_PROMPT = (
        "You are a product analyst. Based on the customer reviews and their sentiment analysis below, provide:\n\n"
        "1. A product recommendation:\n"
        '   - "verdict": one of "BUY", "DON\'T BUY", or "MIXED"\n'
        '   - "confidence": float 0.0-1.0\n'
        '   - "explanation": 2-3 sentence explanation\n\n'
        "2. A trust assessment of the reviews:\n"
        '   - "trust_score": float 0.0 (likely fake) to 1.0 (likely genuine)\n'
        '   - "trust_notes": 1-2 sentences noting any red flags like repetitive language, '
        "overly generic praise, or suspicious patterns\n\n"
        "Respond ONLY with valid JSON in this exact format:\n"
        "{\n"
        '  "recommendation": {"verdict": "BUY", "confidence": 0.85, "explanation": "..."},\n'
        '  "trust": {"trust_score": 0.82, "trust_notes": "..."}\n'
        "}\n"
        "No markdown fences. No extra text."
    )

    def _get_recommendation(self, reviews: list[str], results: list[dict]) -> dict | None:
        """Make an additional API call to get product recommendation + trust score."""
        if not self._is_available():
            return None

        # Build context from analyzed reviews
        review_summary = []
        for r in results:
            review_summary.append(f"- [{r['label']}] (score: {r['score']}) \"{r['text'][:200]}\"")

        user_content = (
            "Here are the customer reviews with their sentiment analysis:\n\n"
            + "\n".join(review_summary)
        )

        try:
            response = requests.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://ai-review-analyzer.onrender.com",
                    "X-Title": "AI Review Analyzer",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": self.RECOMMENDATION_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    "reasoning": {"enabled": True},
                    "temperature": 0.2,
                    "max_tokens": 1500,
                },
                timeout=self.timeout,
            )
            response.raise_for_status()

            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            # Extract JSON object from content to ignore reasoning tags
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                content = content[json_start:json_end]

            result = json.loads(content)

            # Validate recommendation
            rec = result.get("recommendation", {})
            verdict = rec.get("verdict", "MIXED").upper()
            if verdict not in ("BUY", "DON'T BUY", "MIXED"):
                verdict = "MIXED"
            rec["verdict"] = verdict
            rec["confidence"] = max(0.0, min(1.0, float(rec.get("confidence", 0.5))))
            rec["explanation"] = str(rec.get("explanation", ""))[:500]

            # Validate trust
            trust = result.get("trust", {})
            trust["trust_score"] = max(0.0, min(1.0, float(trust.get("trust_score", 0.5))))
            trust["trust_notes"] = str(trust.get("trust_notes", ""))[:500]

            return {"recommendation": rec, "trust": trust}

        except Exception:
            return None

    PRODUCT_ANALYSIS_PROMPT = (
        "You are a product analyst. Given a product name, use your knowledge to provide a comprehensive analysis.\n\n"
        "Return ONLY valid JSON (no markdown fences, no extra text) in this exact format:\n"
        "{\n"
        '  "product_name": "<Full official product name>",\n'
        '  "description": "<2-3 sentence product description>",\n'
        '  "overall_rating": <float, e.g., 4.2>,\n'
        '  "prices": [\n'
        '    {"source": "<e.g., Amazon>", "price": "<e.g., ₹75,000>", "note": "<e.g., Current price>"},\n'
        '    {"source": "<e.g., Flipkart>", "price": "<e.g., ₹74,500>", "note": "<e.g., Best deal>"}\n'
        "  ],\n"
        '  "reviews": [\n'
        '    {"text": "<Representative review 1 text...>", "label": "POSITIVE", "score": 0.9, "confidence": 0.95},\n'
        '    {"text": "<Representative review 2 text...>", "label": "NEGATIVE", "score": -0.7, "confidence": 0.85},\n'
        '    {"text": "<Representative review 3 text...>", "label": "NEUTRAL", "score": 0.0, "confidence": 0.80},\n'
        '    {"text": "<Representative review 4 text...>", "label": "POSITIVE", "score": 0.8, "confidence": 0.90},\n'
        '    {"text": "<Representative review 5 text...>", "label": "NEGATIVE", "score": -0.5, "confidence": 0.85}\n'
        "  ],\n"
        '  "recommendation": {"verdict": "<BUY/DON\'T BUY/MIXED>", "confidence": <float>, "explanation": "<2-3 sentence explanation>"},\n'
        '  "trust": {"trust_score": <float>, "trust_notes": "<Brief note about review authenticity>"}\n'
        "}\n\n"
        "Rules:\n"
        "- Provide ACCURATE, realistic prices based on the actual real-world cost of the product (e.g., a flagship smartphone like an S23 costs around ₹60,000-₹80,000, not ₹599).\n"
        "- Generate exactly 5 distinct, realistic representative reviews matching what real buyers typically say.\n"
        "- Include 2-3 price sources with accurate Indian Rupee prices (₹).\n"
        "- overall_rating is out of 5.0.\n"
        "- labels must be POSITIVE, NEGATIVE, or NEUTRAL.\n"
        "- score range: -1.0 to 1.0.\n"
        "- confidence range: 0.0 to 1.0.\n"
        "- verdict must be BUY, DON'T BUY, or MIXED."
    )

    def analyze_product(self, product_name: str) -> dict:
        """Analyze a product by name using the configured OpenRouter LLM."""
        if not self._is_available():
            raise ValueError(
                "No OpenRouter API key configured. "
                "Please set OPENROUTER_API_KEY in your .env file."
            )

        prompt = f"Analyze this product: {product_name}"

        try:
            # Retry up to 5 times on rate limits with exponential backoff
            response = None
            max_attempts = 5
            for attempt in range(max_attempts):
                response = requests.post(
                    self.base_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://ai-review-analyzer.onrender.com",
                        "X-Title": "AI Review Analyzer",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "user", "content": self.PRODUCT_ANALYSIS_PROMPT + "\n\n" + prompt},
                        ],
                        "reasoning": {"enabled": True},
                        "temperature": 0.3,
                        "max_tokens": 3000,
                    },
                    timeout=self.timeout,
                )
                if response.status_code == 429:
                    if attempt < max_attempts - 1:
                        wait_secs = 5 * (2 ** attempt)  # 5, 10, 20, 40 seconds
                        time.sleep(wait_secs)
                        continue
                    else:
                        # Exhausted all retries — return a clear user-facing error (400, not 500)
                        raise ValueError(
                            "The AI service is currently rate-limited (too many requests). "
                            "Please wait 1–2 minutes and try again, or switch to the "
                            "TextBlob engine for instant results."
                        )
                break
            
            assert response is not None
            response.raise_for_status()

            data = response.json()
            msg = data["choices"][0]["message"]
            content = msg.get("content") or msg.get("reasoning") or ""
            if not content:
                raise RuntimeError("LLM returned an empty response.")
            content = content.strip()

            # Strip markdown fences
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
                content = content.rsplit("```", 1)[0]
                content = content.strip()

            # Extract JSON object from content
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                content = content[json_start:json_end]

            result = json.loads(content)

            # --- Normalize reviews ---
            raw_reviews = result.get("reviews", [])
            results = []
            for r in raw_reviews:
                label = str(r.get("label", "NEUTRAL")).upper()
                if label not in ("POSITIVE", "NEGATIVE", "NEUTRAL"):
                    label = "NEUTRAL"
                score = max(-1.0, min(1.0, float(r.get("score", 0))))
                confidence = max(0.0, min(1.0, float(r.get("confidence", 0.5))))
                results.append({
                    "text": str(r.get("text", ""))[:1000],
                    "label": label,
                    "score": round(score, 3),
                    "confidence": round(confidence, 3),
                })

            summary = self._build_summary(results)

            # --- Product info ---
            summary["product_name"] = str(result.get("product_name", product_name))
            summary["description"] = str(result.get("description", ""))[:500]
            summary["overall_rating"] = max(0.0, min(5.0, float(result.get("overall_rating", 0))))
            summary["prices"] = result.get("prices", [])[:5]

            # --- Recommendation ---
            rec = result.get("recommendation", {})
            verdict = str(rec.get("verdict", "MIXED")).upper()
            if verdict not in ("BUY", "DON'T BUY", "MIXED"):
                verdict = "MIXED"
            rec["verdict"] = verdict
            rec["confidence"] = max(0.0, min(1.0, float(rec.get("confidence", 0.5))))
            rec["explanation"] = str(rec.get("explanation", ""))[:500]
            summary["recommendation"] = rec

            # --- Trust ---
            trust = result.get("trust", {})
            trust["trust_score"] = max(0.0, min(1.0, float(trust.get("trust_score", 0.5))))
            trust["trust_notes"] = str(trust.get("trust_notes", ""))[:500]
            summary["trust"] = trust

            summary["engine_note"] = "Analysis powered by AI Deep Analysis."

            return {"results": results, "summary": summary}

        except ValueError:
            # Re-raise user-facing errors (rate limit, validation) as-is → app.py sends 400
            raise
        except requests.exceptions.Timeout:
            raise ValueError("OpenRouter API timed out. Please try again in a moment.")
        except requests.exceptions.RequestException as e:
            # Check for embedded 429 in the exception message
            err_str = str(e)
            if "429" in err_str:
                raise ValueError(
                    "The AI service is currently rate-limited. "
                    "Please wait a minute and try again."
                )
            raise ValueError(f"API request failed: {err_str}")
        except (json.JSONDecodeError, KeyError) as e:
            raise ValueError(f"Failed to parse API response: {str(e)}")

