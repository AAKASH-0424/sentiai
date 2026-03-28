/**
 * AI Review Analyzer --- Frontend Logic
 * Handles: engine switching, API calls, result rendering, Chart.js donut,
 *          toasts, localStorage history, URL scraping, recommendation, trust score
 */

(function () {
  "use strict";

  // =========================================================
  //  State
  // =========================================================
  let currentEngine = "textblob";
  let chartInstance = null;
  let orCooldownTimer = null;   // OpenRouter cooldown countdown
  const OR_COOLDOWN_MS = 90000; // 90 seconds between free-tier calls

  // ----
  //  DOM References
  // ----
  const reviewsTextarea = document.getElementById("reviews-input");
  const analyzeBtn = document.getElementById("analyze-btn");
  const clearBtn = document.getElementById("clear-btn");
  const btnSpinner = document.getElementById("btn-spinner");
  const btnText = document.getElementById("btn-text");
  const reviewCount = document.getElementById("review-count");
  const skeleton = document.getElementById("loading-skeleton");
  const resultsSection = document.getElementById("results-section");
  const reviewsList = document.getElementById("reviews-list");
  const summaryStatement = document.getElementById("summary-statement");
  const statPositive = document.getElementById("stat-positive");
  const statNegative = document.getElementById("stat-negative");
  const statNeutral = document.getElementById("stat-neutral");
  const chartCanvas = document.getElementById("sentiment-chart");
  const engineNote = document.getElementById("engine-note");
  const toastContainer = document.getElementById("toast-container");

  // Product Search DOM
  const productSearchGroup = document.getElementById("product-search-group");
  const productInput = document.getElementById("product-input");
  const productBtn = document.getElementById("product-btn");
  const productSpinner = document.getElementById("product-spinner");
  const productBtnText = document.getElementById("product-btn-text");

  // Product Info DOM
  const productInfoCard = document.getElementById("product-info-card");
  const productTitle = document.getElementById("product-title");
  const productDescription = document.getElementById("product-description");
  const productRating = document.getElementById("product-rating");
  const productStars = document.getElementById("product-stars");
  const priceTbody = document.getElementById("price-tbody");

  // History DOM
  const historyTotal = document.getElementById("history-total");
  const historyPositive = document.getElementById("history-positive");
  const historyNegative = document.getElementById("history-negative");
  const historyNeutral = document.getElementById("history-neutral");
  const historyBarPos = document.getElementById("history-bar-pos");
  const historyBarNeg = document.getElementById("history-bar-neg");
  const historyBarNeu = document.getElementById("history-bar-neu");
  const historyMeta = document.getElementById("history-meta");
  const clearHistoryBtn = document.getElementById("clear-history-btn");

  // Recommendation DOM
  const recommendationCard = document.getElementById("recommendation-card");
  const recVerdictBadge = document.getElementById("rec-verdict-badge");
  const recConfidence = document.getElementById("rec-confidence");
  const recExplanation = document.getElementById("rec-explanation");

  // Trust Score DOM
  const trustCard = document.getElementById("trust-card");
  const trustProgress = document.getElementById("trust-progress");
  const trustValue = document.getElementById("trust-value");
  const trustNotes = document.getElementById("trust-notes");

  // ----
  //  Chart Colors
  // ----
  const CHART_COLORS = {
    positive: "#34D399",
    negative: "#F87171",
    neutral: "#94A3B8",
  };

  // ----
  //  History Manager (localStorage)
  // ----
  const HISTORY_KEY = "reviewAnalyzerHistory";

  const HistoryManager = {
    _defaults() {
      return {
        totalPositive: 0,
        totalNegative: 0,
        totalNeutral: 0,
        totalReviews: 0,
        sessionCount: 0,
        lastAnalyzedAt: null,
      };
    },

    load() {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : this._defaults();
      } catch {
        return this._defaults();
      }
    },

    save(summary) {
      const h = this.load();
      h.totalPositive += summary.positive || 0;
      h.totalNegative += summary.negative || 0;
      h.totalNeutral += summary.neutral || 0;
      h.totalReviews += summary.total || 0;
      h.sessionCount += 1;
      h.lastAnalyzedAt = new Date().toISOString();
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
      return h;
    },

    clear() {
      localStorage.removeItem(HISTORY_KEY);
      return this._defaults();
    },
  };

  function renderHistory(h) {
    if (!historyTotal) return; // guard: HTML not loaded yet
    if (!h) h = HistoryManager.load();
    historyTotal.textContent = h.totalReviews;
    historyPositive.textContent = h.totalPositive;
    historyNegative.textContent = h.totalNegative;
    historyNeutral.textContent = h.totalNeutral;

    const t = h.totalReviews || 1;
    if (historyBarPos) historyBarPos.style.width = `${((h.totalPositive / t) * 100).toFixed(1)}%`;
    if (historyBarNeg) historyBarNeg.style.width = `${((h.totalNegative / t) * 100).toFixed(1)}%`;
    if (historyBarNeu) historyBarNeu.style.width = `${((h.totalNeutral / t) * 100).toFixed(1)}%`;

    if (h.sessionCount > 0 && h.lastAnalyzedAt) {
      const ago = timeAgo(new Date(h.lastAnalyzedAt));
      if (historyMeta) historyMeta.textContent = `${h.sessionCount} session${h.sessionCount > 1 ? "s" : ""} ... Last: ${ago}`;
    } else {
      if (historyMeta) historyMeta.textContent = "No analysis sessions yet";
    }
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      const h = HistoryManager.clear();
      renderHistory(h);
      showToast("History cleared.", "success");
    });
  }

  // ----
  //  Engine Switcher
  // ----
  // Support both old CSS class (.engine-selector__btn) and new (.engine-toggle__btn)
  document.querySelectorAll(".engine-selector__btn, .engine-toggle__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".engine-selector__btn, .engine-toggle__btn").forEach((b) => {
        b.classList.remove("engine-selector__btn--active", "engine-toggle__btn--active");
      });
      btn.classList.add("engine-selector__btn--active", "engine-toggle__btn--active");
      currentEngine = btn.dataset.engine;

      // Show/hide product search
      if (productSearchGroup) {
        productSearchGroup.style.display =
          currentEngine === "openrouter" ? "block" : "none";
      }
    });
  });

  // ----
  //  Product Search (OpenRouter)
  // ----
  if (productBtn) productBtn.addEventListener("click", analyzeProduct);

  async function analyzeProduct() {
    const name = productInput ? productInput.value.trim() : "";
    if (!name) {
      showToast("Please enter a product name.", "error");
      return;
    }

    setProductLoading(true, "AI thinking... ~30s");
    hideRateLimitBanner();
    resultsSection.classList.remove("results-section--visible");
    if (recommendationCard) recommendationCard.style.display = "none";
    if (trustCard) trustCard.style.display = "none";
    if (productInfoCard) productInfoCard.style.display = "none";

    try {
      const response = await fetch("/analyze-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_name: name }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const errMsg = data.error || "Analysis failed.";
        // Only show rate-limit banner when backend explicitly says so
        if (data.rate_limited) {
          showRateLimitBanner(OR_COOLDOWN_MS);
        } else {
          showToast(errMsg, "error");
        }
        setProductLoading(false);
        return;
      }

      if (data.results && data.results.length > 0) {
        const textArray = data.results.map((r) => r.text);
        reviewsTextarea.value = textArray.join("\n");
        updateReviewCount();

        renderProductInfo(data.summary);
        renderResults(data);
        renderSummary(data.summary);
        renderRecommendation(data.summary.recommendation);
        renderTrustScore(data.summary.trust);

        HistoryManager.save(data.summary);
        renderHistory();

        showToast("Product analysis complete!", "success");
        resultsSection.classList.add("results-section--visible");
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

        // Start cooldown so user knows when they can try again
        startOrCooldown(OR_COOLDOWN_MS);
      } else {
        showToast("Could not analyze this product. Try a different name.", "error");
      }
    } catch (err) {
      showToast("Network error. Is the server running?", "error");
    } finally {
      setProductLoading(false);
    }
  }

  function setProductLoading(isLoading, loadingLabel) {
    if (productBtn) productBtn.disabled = isLoading;
    if (productSpinner) productSpinner.classList.toggle("spinner--visible", isLoading);
    if (productBtnText) {
      productBtnText.textContent = isLoading
        ? (loadingLabel || "Analyzing...")
        : "Analyze Product";
    }
  }

  /* ... Rate-limit banner ... */
  function showRateLimitBanner(durationMs) {
    let banner = document.getElementById("rate-limit-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "rate-limit-banner";
      banner.style.cssText = [
        "background:rgba(245,158,11,.1)",
        "border:1px solid rgba(245,158,11,.3)",
        "border-radius:10px",
        "padding:14px 18px",
        "display:flex",
        "align-items:center",
        "gap:12px",
        "font-size:.85rem",
        "color:#FCD34D",
        "margin-bottom:12px",
        "animation:fadeUp .3s ease",
      ].join(";");
      if (productSearchGroup) {
        productSearchGroup.parentNode.insertBefore(banner, productSearchGroup.nextSibling);
      }
    }

    let remaining = Math.ceil(durationMs / 1000);
    const render = () => {
      banner.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#F59E0B"
             stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
          <circle cx="8" cy="8" r="7"/><path d="M8 5v3l2 2"/>
        </svg>
        <span>
          <strong>AI engine is busy.</strong>
          Free AI analysis allows 1 request per minute. Next request available in
          <strong id="rl-countdown">${remaining}s</strong>.
        </span>`;
    };
    render();
    banner.style.display = "flex";

    if (orCooldownTimer) clearInterval(orCooldownTimer);
    orCooldownTimer = setInterval(() => {
      remaining -= 1;
      const el = document.getElementById("rl-countdown");
      if (el) el.textContent = `${remaining}s`;
      if (remaining <= 0) {
        hideRateLimitBanner();
        if (productBtn) productBtn.disabled = false;
      }
    }, 1000);

    // Disable the product button during cooldown
    if (productBtn) productBtn.disabled = true;
    if (productBtnText) productBtnText.textContent = `Wait ${remaining}s...`;
  }

  function hideRateLimitBanner() {
    if (orCooldownTimer) { clearInterval(orCooldownTimer); orCooldownTimer = null; }
    const banner = document.getElementById("rate-limit-banner");
    if (banner) banner.style.display = "none";
  }

  function startOrCooldown(durationMs) {
    // After a successful call, disable the button briefly
    let remaining = Math.ceil(durationMs / 1000);
    if (productBtn) productBtn.disabled = true;
    if (productBtnText) productBtnText.textContent = `Ready in ${remaining}s`;
    if (orCooldownTimer) clearInterval(orCooldownTimer);
    orCooldownTimer = setInterval(() => {
      remaining -= 1;
      if (productBtnText && productBtn.disabled) {
        productBtnText.textContent = remaining > 0 ? `Ready in ${remaining}s` : "Analyze Product";
      }
      if (remaining <= 0) {
        clearInterval(orCooldownTimer);
        orCooldownTimer = null;
        if (productBtn) productBtn.disabled = false;
        if (productBtnText) productBtnText.textContent = "Analyze Product";
      }
    }, 1000);
  }

  function renderProductInfo(summary) {
    if (!productInfoCard) return;

    productInfoCard.style.display = "block";
    if (productTitle) productTitle.textContent = summary.product_name || "Product Details";
    if (productDescription) productDescription.textContent = summary.description || "";

    // Rating
    const rating = summary.overall_rating || 0;
    if (productRating) productRating.textContent = rating.toFixed(1);

    // Stars
    if (productStars) {
      productStars.innerHTML = "";
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement("span");
        star.className = "star";
        if (i <= Math.floor(rating)) {
          star.classList.add("star--full");
          star.textContent = "\u2605";
        } else if (i - rating < 1 && i - rating > 0) {
          star.classList.add("star--half");
          star.textContent = "\u2605";
        } else {
          star.classList.add("star--empty");
          star.textContent = "\u2606";
        }
        productStars.appendChild(star);
      }
    }

    // Price table
    if (priceTbody) {
      priceTbody.innerHTML = "";
      const prices = summary.prices || [];
      prices.forEach((p) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${p.source || ""}</td><td class="price-cell">${p.price || ""}</td><td>${p.note || ""}</td>`;
        priceTbody.appendChild(row);
      });
    }
  }

  // ----
  //  Live Review Count
  // ----
  reviewsTextarea.addEventListener("input", updateReviewCount);

  function updateReviewCount() {
    const lines = reviewsTextarea.value
      .split("\n")
      .filter((l) => l.trim().length > 0);
    const count = lines.length;
    if (reviewCount) reviewCount.textContent = `${count} / 20 reviews`;
    // Also update the badge in the new card header
    const badge = document.getElementById("review-count-badge");
    if (badge) badge.textContent = `${count} / 20`;
  }

  // ----
  //  Analyze
  // ----
  analyzeBtn.addEventListener("click", analyzeReviews);

  reviewsTextarea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      analyzeReviews();
    }
  });

  async function analyzeReviews() {
    const raw = reviewsTextarea.value.trim();
    if (!raw) {
      showToast("Please enter at least one review.", "error");
      return;
    }

    const reviews = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (reviews.length === 0) {
      showToast("Please enter at least one review.", "error");
      return;
    }

    if (reviews.length > 20) {
      showToast("Maximum 20 reviews allowed.", "error");
      return;
    }

    setLoading(true);
    resultsSection.classList.remove("results-section--visible");
    if (recommendationCard) recommendationCard.style.display = "none";
    if (trustCard) trustCard.style.display = "none";

    try {
      const response = await fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews, engine: currentEngine }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Something went wrong.", "error");
        setLoading(false);
        return;
      }

      renderResults(data);
      renderSummary(data.summary);
      resultsSection.classList.add("results-section--visible");

      if (data.summary.engine_note) {
        engineNote.textContent = data.summary.engine_note;
        engineNote.style.display = "flex";
      } else {
        engineNote.style.display = "none";
      }

      // Render recommendation + trust if present (OpenRouter)
      if (data.summary.recommendation) {
        renderRecommendation(data.summary.recommendation);
      }
      if (data.summary.trust) {
        renderTrustScore(data.summary.trust);
      }

      // Update history
      const updated = HistoryManager.save(data.summary);
      renderHistory(updated);

      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showToast("Network error. Is the server running?", "error");
    } finally {
      setLoading(false);
    }
  }

  // ----
  //  Render Individual Results
  // ----
  function renderResults(data) {
    reviewsList.innerHTML = "";

    data.results.forEach((r, i) => {
      const card = document.createElement("div");
      card.className = "review-card";
      card.style.animationDelay = `${i * 80}ms`;

      const labelClass = `badge--${r.label.toLowerCase()}`;
      const confidenceLevel =
        r.confidence >= 0.7 ? "high" : r.confidence >= 0.4 ? "medium" : "low";
      const confidencePct = Math.round(r.confidence * 100);

      card.innerHTML = `
        <div class="review-card__header">
          <span class="badge ${labelClass}">${r.label}</span>
          <span class="review-card__score">${r.score.toFixed(3)}</span>
        </div>
        <p class="review-card__text">${escapeHtml(r.text)}</p>
        <div class="review-card__meta">
          <span>${confidencePct}%</span>
          <div class="confidence-bar">
            <div class="confidence-bar__fill confidence-bar__fill--${confidenceLevel}"
                 style="width: ${confidencePct}%"></div>
          </div>
          ${r.fallback ? '<span class="engine-note">&#9888; Fallback</span>' : ""}
        </div>
      `;
      reviewsList.appendChild(card);
    });
  }

  // ----
  //  Render Summary
  // ----
  function renderSummary(summary) {
    summaryStatement.textContent = summary.statement;
    statPositive.textContent = summary.positive;
    statNegative.textContent = summary.negative;
    statNeutral.textContent = summary.neutral;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const ctx = chartCanvas.getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Positive", "Negative", "Neutral"],
        datasets: [
          {
            data: [summary.positive, summary.negative, summary.neutral],
            backgroundColor: [
              CHART_COLORS.positive,
              CHART_COLORS.negative,
              CHART_COLORS.neutral,
            ],
            borderColor: "rgba(5, 5, 8, 0.8)",
            borderWidth: 3,
            hoverOffset: 8,
            hoverBorderColor: "rgba(255,255,255,0.2)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#94A3B8",
              font: {
                family: "'Inter', sans-serif",
                size: 12,
                weight: 500,
              },
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: "rgba(22, 24, 32, 0.95)",
            titleColor: "#F1F5F9",
            bodyColor: "#94A3B8",
            borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            bodyFont: {
              family: "'JetBrains Mono', monospace",
              size: 12,
            },
            callbacks: {
              label: function (ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct =
                  total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              },
            },
          },
        },
        animation: {
          animateRotate: true,
          duration: 900,
          easing: "easeOutQuart",
        },
      },
    });
  }

  // ----
  //  Render Recommendation
  // ----
  function renderRecommendation(rec) {
    if (!rec || !rec.verdict || !recommendationCard) return;

    recommendationCard.style.display = "block";

    const verdictMap = {
      BUY: { text: "BUY", cssClass: "rec-badge--buy" },
      "DON'T BUY": { text: "DON'T BUY", cssClass: "rec-badge--dont-buy" },
      MIXED: { text: "MIXED", cssClass: "rec-badge--mixed" },
    };

    const v = verdictMap[rec.verdict] || verdictMap["MIXED"];
    recVerdictBadge.textContent = v.text;
    recVerdictBadge.className = `rec-badge ${v.cssClass}`;
    recConfidence.textContent = `${Math.round((rec.confidence || 0) * 100)}% confidence`;
    recExplanation.textContent = rec.explanation || "";
  }

  // ----
  //  Render Trust Score
  // ----
  function renderTrustScore(trust) {
    if (!trust || trust.trust_score === undefined || !trustCard) return;

    trustCard.style.display = "block";

    const pct = Math.round(trust.trust_score * 100);
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (trust.trust_score * circumference);

    trustValue.textContent = `${pct}%`;
    trustProgress.style.strokeDasharray = `${circumference}`;
    trustProgress.style.strokeDashoffset = `${offset}`;

    // Color based on score
    if (trust.trust_score >= 0.7) {
      trustProgress.style.stroke = "#34D399";
    } else if (trust.trust_score >= 0.4) {
      trustProgress.style.stroke = "#F97316";
    } else {
      trustProgress.style.stroke = "#F87171";
    }

    trustNotes.textContent = trust.trust_notes || "";
  }

  // ----
  //  Clear
  // ----
  clearBtn.addEventListener("click", () => {
    reviewsTextarea.value = "";
    if (productInput) productInput.value = "";
    resultsSection.classList.remove("results-section--visible");
    reviewsList.innerHTML = "";
    engineNote.style.display = "none";
    if (recommendationCard) recommendationCard.style.display = "none";
    if (trustCard) trustCard.style.display = "none";
    if (productInfoCard) productInfoCard.style.display = "none";
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    updateReviewCount();
    reviewsTextarea.focus();
  });

  // ----
  //  Helpers
  // ----
  function setLoading(isLoading) {
    analyzeBtn.disabled = isLoading;
    btnSpinner.classList.toggle("spinner--visible", isLoading);
    btnText.textContent = isLoading ? "Analyzing..." : "Analyze Reviews";
    skeleton.classList.toggle("skeleton--visible", isLoading);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message, type = "error") {
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(40px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // ----
  //  Init
  // ----
  updateReviewCount();
  renderHistory();
})();


