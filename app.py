"""Flask application entry point for AI Review Analyzer."""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

from config import Config
from engines import TextBlobEngine, OpenRouterEngine

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Engine registry
ENGINES = {
    "textblob": TextBlobEngine,
    "openrouter": OpenRouterEngine,
}


@app.route("/")
def index():
    """Serve the main page."""
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """Analyze submitted reviews and return sentiment results."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    reviews_raw = data.get("reviews", [])
    engine_name = data.get("engine", Config.DEFAULT_ENGINE)

    # --- Validation ---
    if not reviews_raw or not isinstance(reviews_raw, list):
        return jsonify({"error": "Please provide a list of reviews."}), 400

    # Filter and clean
    reviews = [r.strip() for r in reviews_raw if isinstance(r, str) and r.strip()]
    if not reviews:
        return jsonify({"error": "All reviews are empty. Please enter at least one review."}), 400

    if len(reviews) > Config.MAX_REVIEWS:
        return jsonify({
            "error": f"Too many reviews. Maximum is {Config.MAX_REVIEWS}."
        }), 400

    # Validate individual reviews
    errors = []
    for i, review in enumerate(reviews):
        word_count = len(review.split())
        if word_count < Config.MIN_WORDS_PER_REVIEW:
            errors.append(f"Review {i + 1} is too short (min {Config.MIN_WORDS_PER_REVIEW} words).")
        if word_count > Config.MAX_WORDS_PER_REVIEW:
            errors.append(f"Review {i + 1} is too long (max {Config.MAX_WORDS_PER_REVIEW} words).")

    if errors:
        return jsonify({"error": " ".join(errors)}), 400

    # --- Engine selection ---
    if engine_name not in ENGINES:
        return jsonify({"error": f"Unknown engine '{engine_name}'. Use 'textblob' or 'openrouter'."}), 400

    engine = ENGINES[engine_name]()

    try:
        result = engine.analyze_batch(reviews)
        result["engine"] = engine_name
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


@app.route("/analyze-product", methods=["POST"])
def analyze_product():
    """Analyze a product by name using OpenRouter LLM."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    product_name = data.get("product_name", "").strip()
    if not product_name:
        return jsonify({"error": "Please enter a product name."}), 400

    if len(product_name) < 2:
        return jsonify({"error": "Product name is too short."}), 400

    try:
        engine = OpenRouterEngine()
        result = engine.analyze_product(product_name)
        return jsonify(result), 200
    except ValueError as ve:
        err_str = str(ve)
        is_rate_limited = any(kw in err_str.lower() for kw in [
            "rate-limit", "rate limit", "too many", "429"
        ])
        return jsonify({
            "error": err_str,
            "rate_limited": is_rate_limited
        }), 429 if is_rate_limited else 400
    except Exception as e:
        return jsonify({"error": f"Product analysis failed: {str(e)}"}), 500



@app.route("/health")
def health():
    """Health check endpoint for deployment."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)

