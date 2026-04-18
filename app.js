let chartInstance = null;
let desChartInstance = null;

/* ── Tab switching ────────────────────────────────────────── */
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');
}

/* ── Sync alpha slider ↔ number input ─────────────────────── */
function syncAlpha(val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v >= 0.01 && v <= 0.99) {
    document.getElementById('alphaSlider').value = v;
    document.getElementById('alphaVal').textContent = v.toFixed(2);
  }
}

/* ── Sync DES sliders ─────────────────────────────────────── */
function syncDesAlpha(val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v >= 0.01 && v <= 0.99) {
    document.getElementById('desAlphaSlider').value = v;
    document.getElementById('desAlphaVal').textContent = v.toFixed(2);
  }
}
function syncDesBeta(val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v >= 0.01 && v <= 0.99) {
    document.getElementById('desBetaSlider').value = v;
    document.getElementById('desBetaVal').textContent = v.toFixed(2);
  }
}

/* ── Error display helpers ────────────────────────────────── */
function showError(msg, prefix = '') {
  const id = prefix ? `${prefix}ErrorBox` : 'errorBox';
  const box = document.getElementById(id);
  box.textContent = msg;
  box.classList.add('show');
}
function clearError(prefix = '') {
  const id = prefix ? `${prefix}ErrorBox` : 'errorBox';
  document.getElementById(id).classList.remove('show');
}

/* ── Rounding helper ──────────────────────────────────────── */
function round(val, dp) {
  return parseFloat(val.toFixed(dp));
}

/* ── Build calculation breakdown HTML ─────────────────────── */
function buildCalcBreakdown(errors, n, dp) {
  const absErrors = errors.map(Math.abs);
  const sqErrors = errors.map(e => e * e);

  const sumAbs = absErrors.reduce((s, v) => s + v, 0);
  const sumSq = sqErrors.reduce((s, v) => s + v, 0);
  const mad = sumAbs / n;
  const mse = sumSq / n;
  const rmse = Math.sqrt(mse);

  // Build individual terms string (max 6 shown, then ellipsis)
  const showN = Math.min(n, 6);
  const ellipsis = n > 6 ? ' + …' : '';

  return {
    mad, mse, rmse, sqErrors, absErrors, sumAbs, sumSq,
    html: `
      <div class="calc-breakdown">
        <div class="calc-block">
          <div class="calc-title">MAD Calculation <span class="calc-tag">Mean Absolute Deviation</span></div>
          <div class="calc-step">|A−F| values: ${absErrors.slice(0, showN).map(v => `<span class="calc-num">${round(v, dp)}</span>`).join(' + ')}${ellipsis}</div>
          <div class="calc-step">Σ|A−F| = <span class="calc-num">${round(sumAbs, dp)}</span></div>
          <div class="calc-step">MAD = <span class="calc-num">${round(sumAbs, dp)}</span> ÷ <span class="calc-num">${n}</span> = <span class="calc-result">${round(mad, dp)}</span></div>
        </div>
        <div class="calc-block">
          <div class="calc-title">MSE &amp; RMSE Calculation <span class="calc-tag">Mean Squared Error · Root MSE</span></div>
          <div class="calc-step">(A−F)² values: ${sqErrors.slice(0, showN).map(v => `<span class="calc-num">${round(v, dp)}</span>`).join(' + ')}${ellipsis}</div>
          <div class="calc-step">Σ(A−F)² = <span class="calc-num">${round(sumSq, dp)}</span></div>
          <div class="calc-step">MSE = <span class="calc-num">${round(sumSq, dp)}</span> ÷ <span class="calc-num">${n}</span> = <span class="calc-result">${round(mse, dp)}</span></div>
          <div class="calc-step">RMSE = √<span class="calc-num">${round(mse, dp)}</span> = <span class="calc-result">${round(rmse, dp)}</span></div>
        </div>
      </div>
    `
  };
}

/* ══════════════════════════════════════════════════════════
   SES — SINGLE EXPONENTIAL SMOOTHING
══════════════════════════════════════════════════════════ */
function calculate() {
  clearError();

  const raw = document.getElementById('dataInput').value.trim();
  if (!raw) { showError('Please enter at least 2 data values.'); return; }

  const parts = raw.split(',').map(s => s.trim()).filter(s => s !== '');
  const data = parts.map(Number);

  if (data.some(isNaN)) { showError('All values must be numbers. Check your comma-separated input.'); return; }
  if (data.length < 2) { showError('Please enter at least 2 data values to compute a forecast.'); return; }

  const alpha = parseFloat(document.getElementById('alphaNum').value);
  if (isNaN(alpha) || alpha <= 0 || alpha >= 1) { showError('Alpha (α) must be strictly between 0 and 1.'); return; }

  const initRaw = document.getElementById('initForecast').value.trim();
  let F_init = (initRaw === '') ? data[0] : parseFloat(initRaw);
  if (isNaN(F_init)) { showError('Initial forecast must be a valid number.'); return; }

  const dp = Math.max(0, Math.min(6, parseInt(document.getElementById('decimals').value) || 2));

  const n = data.length;
  const forecasts = new Array(n);
  forecasts[0] = F_init;
  for (let t = 1; t < n; t++) {
    forecasts[t] = forecasts[t - 1] + alpha * (data[t - 1] - forecasts[t - 1]);
  }

  const lastError = data[n - 1] - forecasts[n - 1];
  const nextForecast = forecasts[n - 1] + alpha * lastError;

  const errors = data.map((a, i) => a - forecasts[i]);
  const { mad, mse, rmse, sqErrors, absErrors, sumAbs, sumSq, html: breakdownHtml } =
    buildCalcBreakdown(errors, n, dp);

  /* Metric cards */
  document.getElementById('metricRow').innerHTML = `
    <div class="metric-card green">
      <div class="metric-label">MAD/MAE</div>
      <div class="metric-value">${round(mad, dp)}</div>
      <div class="metric-sub">Mean Absolute Deviation</div>
    </div>
    <div class="metric-card blue">
      <div class="metric-label">RMSE</div>
      <div class="metric-value">${round(rmse, dp)}</div>
      <div class="metric-sub">Root Mean Squared Error</div>
    </div>
    <div class="metric-card pink">
      <div class="metric-label">MSE</div>
      <div class="metric-value">${round(mse, dp)}</div>
      <div class="metric-sub">Mean Squared Error</div>
    </div>
    <div class="metric-card yellow">
      <div class="metric-label">Next Forecast (F${n + 1})</div>
      <div class="metric-value">${round(nextForecast, dp)}</div>
      <div class="metric-sub">Period ${n + 1} prediction</div>
    </div>
  `;

  /* Calculation breakdown */
  document.getElementById('calcBreakdown').innerHTML = breakdownHtml;

  renderChart(data, forecasts, nextForecast, n, dp);

  document.getElementById('tableInfo').textContent = `n = ${n} periods · α = ${alpha.toFixed(2)}`;

  let rows = '';
  for (let i = 0; i < n; i++) {
    const err = errors[i];
    const errClass = err >= 0 ? 'err-pos' : 'err-neg';
    const errSign = err >= 0 ? '+' : '';
    rows += `<tr>
      <td>${i + 1}</td>
      <td>${round(data[i], dp)}</td>
      <td>${round(forecasts[i], dp)}</td>
      <td class="${errClass}">${errSign}${round(err, dp)}</td>
      <td class="abs-err">${round(absErrors[i], dp)}</td>
      <td class="sq-err">${round(sqErrors[i], dp)}</td>
    </tr>`;
  }
  rows += `<tr style="opacity:0.5;border-top:1px dashed var(--border2);">
    <td>${n + 1}</td>
    <td style="color:var(--muted);font-style:italic;">—</td>
    <td style="color:var(--accent);">${round(nextForecast, dp)}</td>
    <td>—</td><td>—</td><td>—</td>
  </tr>`;
  document.getElementById('tableBody').innerHTML = rows;

  document.getElementById('footnote').innerHTML = `
    <div class="fn-item">
      <span class="fn-label">Initial forecast F₁</span>
      <span class="fn-val">${round(F_init, dp)}</span>
      <span class="fn-eq">user-defined or first data point</span>
    </div>
    <div class="fn-item">
      <span class="fn-label">Smoothing constant α</span>
      <span class="fn-val accent">${alpha.toFixed(2)}</span>
      <span class="fn-eq">controls how fast we learn</span>
    </div>
    <div class="fn-item">
      <span class="fn-label">Σ|A−F| (sum absolute errors)</span>
      <span class="fn-val blue">${round(sumAbs, dp)}</span>
      <span class="fn-eq">MAD/MAE numerator</span>
    </div>
    <div class="fn-item">
      <span class="fn-label">Σ(A−F)² (sum squared errors)</span>
      <span class="fn-val accent">${round(sumSq, dp)}</span>
      <span class="fn-eq">MSE numerator</span>
    </div>
  `;

  document.getElementById('results').classList.add('show');
  setTimeout(() => {
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

/* ══════════════════════════════════════════════════════════
   DES — DOUBLE EXPONENTIAL SMOOTHING (Holt's Method)
══════════════════════════════════════════════════════════ */
function calculateDes() {
  clearError('des');

  const raw = document.getElementById('desDataInput').value.trim();
  if (!raw) { showError('Please enter at least 3 data values.', 'des'); return; }

  const parts = raw.split(',').map(s => s.trim()).filter(s => s !== '');
  const data = parts.map(Number);

  if (data.some(isNaN)) { showError('All values must be numbers.', 'des'); return; }
  if (data.length < 3) { showError('Please enter at least 3 data values for DES.', 'des'); return; }

  const alpha = parseFloat(document.getElementById('desAlphaNum').value);
  const beta = parseFloat(document.getElementById('desBetaNum').value);
  if (isNaN(alpha) || alpha <= 0 || alpha >= 1) { showError('Alpha (α) must be strictly between 0 and 1.', 'des'); return; }
  if (isNaN(beta) || beta <= 0 || beta >= 1) { showError('Beta (β) must be strictly between 0 and 1.', 'des'); return; }

  const periodsAhead = Math.max(1, Math.min(10, parseInt(document.getElementById('desPeriodsAhead').value) || 1));
  const dp = Math.max(0, Math.min(6, parseInt(document.getElementById('desDecimals').value) || 2));

  const n = data.length;

  /* Initialize level and trend */
  const L = new Array(n);
  const T = new Array(n);

  /* Init: L₁ = y₁, T₁ = y₂ − y₁ (simple linear estimate) */
  L[0] = data[0];
  T[0] = data[1] - data[0];

  /* Forecast array: Fₜ = Lₜ₋₁ + Tₜ₋₁  (one-step ahead) */
  const forecasts = new Array(n);
  forecasts[0] = L[0] + T[0]; /* F₁ = L₀ + T₀ → use init as F1 = data[0] */
  forecasts[0] = data[0];     /* standard: F₁ = A₁ (same as SES) */

  for (let t = 1; t < n; t++) {
    /* One-step-ahead forecast */
    forecasts[t] = L[t - 1] + T[t - 1];
    /* Update level */
    L[t] = alpha * data[t] + (1 - alpha) * (L[t - 1] + T[t - 1]);
    /* Update trend */
    T[t] = beta * (L[t] - L[t - 1]) + (1 - beta) * T[t - 1];
  }

  /* Future forecasts: F(n+m) = Lₙ + m·Tₙ */
  const futureForecasts = [];
  for (let m = 1; m <= periodsAhead; m++) {
    futureForecasts.push(L[n - 1] + m * T[n - 1]);
  }

  const errors = data.map((a, i) => a - forecasts[i]);
  const { mad, mse, rmse, sqErrors, absErrors, sumAbs, sumSq, html: breakdownHtml } =
    buildCalcBreakdown(errors, n, dp);

  /* Metric cards */
  document.getElementById('desMetricRow').innerHTML = `
    <div class="metric-card green">
      <div class="metric-label">MAD/MAE</div>
      <div class="metric-value">${round(mad, dp)}</div>
      <div class="metric-sub">Mean Absolute Deviation</div>
    </div>
    <div class="metric-card blue">
      <div class="metric-label">RMSE</div>
      <div class="metric-value">${round(rmse, dp)}</div>
      <div class="metric-sub">Root Mean Squared Error</div>
    </div>
    <div class="metric-card pink">
      <div class="metric-label">MSE</div>
      <div class="metric-value">${round(mse, dp)}</div>
      <div class="metric-sub">Mean Squared Error</div>
    </div>
    <div class="metric-card yellow">
      <div class="metric-label">F${n + 1} (next period)</div>
      <div class="metric-value">${round(futureForecasts[0], dp)}</div>
      <div class="metric-sub">Period ${n + 1} prediction</div>
    </div>
  `;

  /* Calculation breakdown */
  document.getElementById('desCalcBreakdown').innerHTML = breakdownHtml;

  renderDesChart(data, forecasts, futureForecasts, L, T, n, dp, periodsAhead);

  document.getElementById('desTableInfo').textContent =
    `n = ${n} periods · α = ${alpha.toFixed(2)} · β = ${beta.toFixed(2)}`;

  let rows = '';
  for (let i = 0; i < n; i++) {
    const err = errors[i];
    const errClass = err >= 0 ? 'err-pos' : 'err-neg';
    const errSign = err >= 0 ? '+' : '';
    rows += `<tr>
      <td>${i + 1}</td>
      <td>${round(data[i], dp)}</td>
      <td>${round(L[i], dp)}</td>
      <td>${round(T[i], dp)}</td>
      <td>${round(forecasts[i], dp)}</td>
      <td class="${errClass}">${errSign}${round(err, dp)}</td>
      <td class="abs-err">${round(absErrors[i], dp)}</td>
      <td class="sq-err">${round(sqErrors[i], dp)}</td>
    </tr>`;
  }
  /* Future rows */
  for (let m = 1; m <= periodsAhead; m++) {
    rows += `<tr style="opacity:0.55;border-top:${m === 1 ? '1px dashed var(--border2)' : 'none'};">
      <td>${n + m}</td>
      <td style="color:var(--muted);font-style:italic;">—</td>
      <td>${round(L[n - 1] + m * T[n - 1], dp)}</td>
      <td>${round(T[n - 1], dp)}</td>
      <td style="color:var(--accent);">${round(futureForecasts[m - 1], dp)}</td>
      <td>—</td><td>—</td><td>—</td>
    </tr>`;
  }
  document.getElementById('desTableBody').innerHTML = rows;

  document.getElementById('desFootnote').innerHTML = `
    <div class="fn-item">
      <span class="fn-label">Initial Level L₁</span>
      <span class="fn-val">${round(L[0], dp)}</span>
      <span class="fn-eq">= first data point</span>
    </div>
    <div class="fn-item">
      <span class="fn-label">Initial Trend T₁</span>
      <span class="fn-val">${round(T[0], dp)}</span>
      <span class="fn-eq">= A₂ − A₁</span>
    </div>
    <div class="fn-item">
      <span class="fn-label">Final Level Lₙ</span>
      <span class="fn-val accent">${round(L[n - 1], dp)}</span>
      <span class="fn-eq">at period ${n}</span>
    </div>
    <div class="fn-item">
      <span class="fn-label">Final Trend Tₙ</span>
      <span class="fn-val blue">${round(T[n - 1], dp)}</span>
      <span class="fn-eq">slope at period ${n}</span>
    </div>
    <div class="fn-item">
      <span class="fn-label">α (level smoothing)</span>
      <span class="fn-val accent">${alpha.toFixed(2)}</span>
      <span class="fn-eq">controls level adaptation</span>
    </div>
    <div class="fn-item">
      <span class="fn-label">β (trend smoothing)</span>
      <span class="fn-val blue">${beta.toFixed(2)}</span>
      <span class="fn-eq">controls trend adaptation</span>
    </div>
  `;

  document.getElementById('desResults').classList.add('show');
  setTimeout(() => {
    document.getElementById('desResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

/* ── SES Chart ────────────────────────────────────────────── */
function renderChart(data, forecasts, nextForecast, n, dp) {
  const labels = data.map((_, i) => `P${i + 1}`);
  labels.push(`P${n + 1}`);
  const actualSeries = [...data.map(v => round(v, dp)), null];
  const forecastSeries = [...forecasts.map(v => round(v, dp)), round(nextForecast, dp)];
  const nextSeries = new Array(n + 1).fill(null);
  nextSeries[n] = round(nextForecast, dp);

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const ctx = document.getElementById('sesChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Actual (Aₜ)', data: actualSeries, borderColor: '#7dd3fc', backgroundColor: 'rgba(125,211,252,0.08)', borderWidth: 3, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: '#7dd3fc', tension: 0.3, spanGaps: false },
        { label: 'Forecast (Fₜ)', data: forecastSeries, borderColor: '#f9a8d4', backgroundColor: 'rgba(249,168,212,0.06)', borderWidth: 3, borderDash: [6, 3], pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#f9a8d4', tension: 0.3, spanGaps: true },
        { label: `Next Forecast F${n + 1}`, data: nextSeries, borderColor: '#c8f55a', backgroundColor: '#c8f55a', borderWidth: 0, pointRadius: 10, pointHoverRadius: 13, pointStyle: 'star', pointBackgroundColor: '#c8f55a', showLine: false }
      ]
    },
    options: chartOptions()
  });
}

/* ── DES Chart ────────────────────────────────────────────── */
function renderDesChart(data, forecasts, futureForecasts, L, T, n, dp, periodsAhead) {
  const labels = data.map((_, i) => `P${i + 1}`);
  for (let m = 1; m <= periodsAhead; m++) labels.push(`P${n + m}`);

  const totalLen = n + periodsAhead;
  const actualSeries = [...data.map(v => round(v, dp)), ...new Array(periodsAhead).fill(null)];
  const forecastSeries = [...forecasts.map(v => round(v, dp)), ...futureForecasts.map(v => round(v, dp))];
  const levelSeries = [...L.map(v => round(v, dp)), ...new Array(periodsAhead).fill(null)];

  /* Highlight future forecast points */
  const futureSeries = new Array(totalLen).fill(null);
  for (let m = 0; m < periodsAhead; m++) futureSeries[n + m] = round(futureForecasts[m], dp);

  if (desChartInstance) { desChartInstance.destroy(); desChartInstance = null; }
  const ctx = document.getElementById('desChart').getContext('2d');
  desChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Actual (Aₜ)', data: actualSeries, borderColor: '#7dd3fc', backgroundColor: 'rgba(125,211,252,0.08)', borderWidth: 3, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: '#7dd3fc', tension: 0.3, spanGaps: false },
        { label: 'Forecast (Fₜ)', data: forecastSeries, borderColor: '#f9a8d4', backgroundColor: 'rgba(249,168,212,0.06)', borderWidth: 3, borderDash: [6, 3], pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#f9a8d4', tension: 0.3, spanGaps: true },
        { label: 'Level (Lₜ)', data: levelSeries, borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.05)', borderWidth: 2, borderDash: [3, 3], pointRadius: 3, pointBackgroundColor: '#a78bfa', tension: 0.3, spanGaps: false },
        { label: 'Future Forecast', data: futureSeries, borderColor: '#c8f55a', backgroundColor: '#c8f55a', borderWidth: 0, pointRadius: 9, pointHoverRadius: 12, pointStyle: 'star', pointBackgroundColor: '#c8f55a', showLine: false }
      ]
    },
    options: chartOptions()
  });
}

/* ── Shared chart options ─────────────────────────────────── */
function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a1a', borderColor: '#3a3a3a', borderWidth: 1,
        titleColor: '#f0f0f0', bodyColor: '#aaa',
        titleFont: { family: 'IBM Plex Mono', size: 13 },
        bodyFont: { family: 'IBM Plex Mono', size: 12 },
        padding: 12,
        callbacks: { label(ctx) { if (ctx.parsed.y === null) return null; return ` ${ctx.dataset.label}: ${ctx.parsed.y}`; } }
      }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { family: 'IBM Plex Mono', size: 12 } }, border: { color: '#2e2e2e' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { family: 'IBM Plex Mono', size: 12 } }, border: { color: '#2e2e2e' } }
    }
  };
}

/* ── Reset SES ────────────────────────────────────────────── */
function resetAll() {
  document.getElementById('dataInput').value = '';
  document.getElementById('alphaNum').value = '0.30';
  document.getElementById('alphaSlider').value = '0.30';
  document.getElementById('alphaVal').textContent = '0.30';
  document.getElementById('initForecast').value = '';
  document.getElementById('decimals').value = '2';
  document.getElementById('results').classList.remove('show');
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  clearError();
}

/* ── Reset DES ────────────────────────────────────────────── */
function resetDes() {
  document.getElementById('desDataInput').value = '';
  document.getElementById('desAlphaNum').value = '0.30';
  document.getElementById('desAlphaSlider').value = '0.30';
  document.getElementById('desAlphaVal').textContent = '0.30';
  document.getElementById('desBetaNum').value = '0.20';
  document.getElementById('desBetaSlider').value = '0.20';
  document.getElementById('desBetaVal').textContent = '0.20';
  document.getElementById('desPeriodsAhead').value = '1';
  document.getElementById('desDecimals').value = '2';
  document.getElementById('desResults').classList.remove('show');
  if (desChartInstance) { desChartInstance.destroy(); desChartInstance = null; }
  clearError('des');
}

/* ── Enter key shortcut ───────────────────────────────────── */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
    const panel = e.target.closest('.tab-panel');
    if (panel && panel.id === 'panel-des') calculateDes();
    else calculate();
  }
});