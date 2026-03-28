# SentioAI - AI Review Analyzer

An intelligent product review analyzer powered by AI. Analyze customer reviews, get sentiment breakdowns, product recommendations, and trust scores.

## Features

- **Multi-Engine Sentiment Analysis** — TextBlob (instant) or OpenRouter AI (deep analysis)
- **Product Search** — Enter any product name for AI-generated analysis with pricing, reviews, and recommendations
- **Interactive Dashboard** — Charts, stats, recommendation badges, and trust scores
- **Review History** — Track all your analysis sessions with localStorage persistence
- **Premium UI** — Dark theme with fog animations, glassmorphism cards, and smooth micro-interactions

## Tech Stack

- **Backend:** Python / Flask
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **AI Engine:** OpenRouter API (Google Gemma 3 27B)
- **Charts:** Chart.js

## Quick Start

```bash
# Clone the repo
git clone https://github.com/AAKASH-0424/sentiai.git
cd sentiai

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
copy .env.example .env
# Edit .env and add your OpenRouter API key

# Run the app
python app.py
```

Then open [http://localhost:5000](http://localhost:5000)

## Environment Variables

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key (get one at [openrouter.ai](https://openrouter.ai)) |
| `OPENROUTER_MODEL` | LLM model to use (default: `google/gemma-3-27b-it:free`) |

## Demo Credentials

- **Email:** demo@ai.com
- **Password:** password123

## License

MIT
