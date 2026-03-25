let chartInstance = null; // holds the Chart.js instance so we can destroy/recreate

/* ── Sync alpha slider ↔ number input ─────────────────────── */
function syncAlpha(val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v >= 0.01 && v <= 0.99) {
    document.getElementById('alphaSlider').value = v;
    document.getElementById('alphaVal').textContent = v.toFixed(2);
  }
}

/* ── Error display helpers ────────────────────────────────── */
function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.classList.add('show');
}
function clearError() {
  document.getElementById('errorBox').classList.remove('show');
}

/* ── Rounding helper ──────────────────────────────────────── */
function round(val, dp) {
  return parseFloat(val.toFixed(dp));
}

/* ── Main calculation ─────────────────────────────────────── */
function calculate() {
  clearError();

  /* 1. Parse actual data */
  const raw = document.getElementById('dataInput').value.trim();
  if (!raw) { showError('Please enter at least 2 data values.'); return; }

  const parts = raw.split(',').map(s => s.trim()).filter(s => s !== '');
  const data  = parts.map(Number);

  if (data.some(isNaN)) {
    showError('All values must be numbers. Check your comma-separated input.');
    return;
  }
  if (data.length < 2) {
    showError('Please enter at least 2 data values to compute a forecast.');
    return;
  }

  /* 2. Parse alpha */
  const alpha = parseFloat(document.getElementById('alphaNum').value);
  if (isNaN(alpha) || alpha <= 0 || alpha >= 1) {
    showError('Alpha (α) must be a number strictly between 0 and 1.');
    return;
  }

  /* 3. Parse initial forecast */
  const initRaw = document.getElementById('initForecast').value.trim();
  let F_init = (initRaw === '') ? data[0] : parseFloat(initRaw);
  if (isNaN(F_init)) {
    showError('Initial forecast must be a valid number (or leave blank to use the first data point).');
    return;
  }

  /* 4. Decimal places */
  const dp = Math.max(0, Math.min(6, parseInt(document.getElementById('decimals').value) || 2));

  const n = data.length;
  const forecasts = new Array(n);
  forecasts[0] = F_init;

  for (let t = 1; t < n; t++) {
    const prevError = data[t - 1] - forecasts[t - 1];
    forecasts[t]    = forecasts[t - 1] + alpha * prevError;
  }

  /* Next-period forecast (period n+1) */
  const lastError   = data[n - 1] - forecasts[n - 1];
  const nextForecast = forecasts[n - 1] + alpha * lastError;

  /* ── Error metrics ──────────────────────────────────────── */
  const errors   = data.map((a, i) => a - forecasts[i]);
  const sqErrors = errors.map(e => e * e);
  const sumSq    = sqErrors.reduce((s, v) => s + v, 0);
  const mse      = sumSq / n;
  const rmse     = Math.sqrt(mse);
  const mae      = errors.map(Math.abs).reduce((s, v) => s + v, 0) / n;

  /* ── Render metric cards ────────────────────────────────── */
  document.getElementById('metricRow').innerHTML = `
    <div class="metric-card green">
      <div class="metric-label">MSE</div>
      <div class="metric-value">${round(mse, dp)}</div>
      <div class="metric-sub">Mean Squared Error</div>
    </div>
    <div class="metric-card blue">
      <div class="metric-label">RMSE</div>
      <div class="metric-value">${round(rmse, dp)}</div>
      <div class="metric-sub">Root MSE</div>
    </div>
    <div class="metric-card pink">
      <div class="metric-label">MAE</div>
      <div class="metric-value">${round(mae, dp)}</div>
      <div class="metric-sub">Mean Absolute Error</div>
    </div>
    <div class="metric-card green">
      <div class="metric-label">Next Forecast (F${n + 1})</div>
      <div class="metric-value">${round(nextForecast, dp)}</div>
      <div class="metric-sub">Period ${n + 1} prediction</div>
    </div>
  `;

  /* ── Render chart ───────────────────────────────────────── */
  renderChart(data, forecasts, nextForecast, n, dp);

  /* ── Render table ───────────────────────────────────────── */
  document.getElementById('tableInfo').textContent =
    `n = ${n} periods · α = ${alpha.toFixed(2)}`;

  let rows = '';
  for (let i = 0; i < n; i++) {
    const err      = errors[i];
    const errClass = err >= 0 ? 'err-pos' : 'err-neg';
    const errSign  = err >= 0 ? '+' : '';
    rows += `<tr>
      <td>${i + 1}</td>
      <td>${round(data[i], dp)}</td>
      <td>${round(forecasts[i], dp)}</td>
      <td class="${errClass}">${errSign}${round(err, dp)}</td>
      <td class="sq-err">${round(sqErrors[i], dp)}</td>
    </tr>`;
  }
  /* Next period row — dimmed */
  rows += `<tr style="opacity:0.5;border-top:1px dashed var(--border2);">
    <td>${n + 1}</td>
    <td style="color:var(--muted);font-style:italic;">—</td>
    <td style="color:var(--accent);">${round(nextForecast, dp)}</td>
    <td>—</td>
    <td>—</td>
  </tr>`;
  document.getElementById('tableBody').innerHTML = rows;

  /* ── Render footer summary ──────────────────────────────── */
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
      <span class="fn-label">Sum of squared errors Σ(A−F)²</span>
      <span class="fn-val blue">${round(sumSq, dp)}</span>
      <span class="fn-eq">total squared error across ${n} periods</span>
    </div>
    <div class="fn-item">
      <span class="fn-label">MSE = Σ(A−F)² ÷ n</span>
      <span class="fn-val accent">${round(sumSq, dp)} ÷ ${n} = ${round(mse, dp)}</span>
      <span class="fn-eq">mean squared error</span>
    </div>
  `;

  /* Show results and scroll */
  document.getElementById('results').classList.add('show');
  setTimeout(() => {
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

/* ── Chart rendering (Chart.js) ───────────────────────────── */
function renderChart(data, forecasts, nextForecast, n, dp) {
  /* Build period labels: 1, 2, … n, n+1 */
  const labels = data.map((_, i) => `P${i + 1}`);
  labels.push(`P${n + 1}`);

  /* Actual data — add null for the next period (unknown) */
  const actualSeries = [...data.map(v => round(v, dp)), null];

  /* Forecast series — includes the next-period forecast */
  const forecastSeries = [...forecasts.map(v => round(v, dp)), round(nextForecast, dp)];

  /* Next-forecast point highlight: null for all except last */
  const nextSeries = new Array(n + 1).fill(null);
  nextSeries[n] = round(nextForecast, dp);

  /* Destroy previous chart if it exists */
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const ctx = document.getElementById('sesChart').getContext('2d');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual (Aₜ)',
          data: actualSeries,
          borderColor: '#7dd3fc',
          backgroundColor: 'rgba(125,211,252,0.08)',
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#7dd3fc',
          tension: 0.3,
          spanGaps: false,
        },
        {
          label: 'Forecast (Fₜ)',
          data: forecastSeries,
          borderColor: '#f9a8d4',
          backgroundColor: 'rgba(249,168,212,0.06)',
          borderWidth: 3,
          borderDash: [6, 3],
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#f9a8d4',
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: `Next Forecast F${n + 1}`,
          data: nextSeries,
          borderColor: '#c8f55a',
          backgroundColor: '#c8f55a',
          borderWidth: 0,
          pointRadius: 10,
          pointHoverRadius: 13,
          pointStyle: 'star',
          pointBackgroundColor: '#c8f55a',
          showLine: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },   /* we use our custom legend */
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#3a3a3a',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#aaa',
          titleFont: { family: 'IBM Plex Mono', size: 11 },
          bodyFont:  { family: 'IBM Plex Mono', size: 10 },
          padding: 12,
          callbacks: {
            label(ctx) {
              if (ctx.parsed.y === null) return null;
              return ` ${ctx.dataset.label}: ${ctx.parsed.y}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#aaa', font: { family: 'IBM Plex Mono', size: 10 } },
          border:{ color: '#333333' }
        },
        y: {
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#aaa', font: { family: 'IBM Plex Mono', size: 10 } },
          border:{ color: '#2e2e2e' }
        }
      }
    }
  });
}

/* ── Reset ────────────────────────────────────────────────── */
function resetAll() {
  document.getElementById('dataInput').value     = '';
  document.getElementById('alphaNum').value      = '0.30';
  document.getElementById('alphaSlider').value   = '0.30';
  document.getElementById('alphaVal').textContent = '0.30';
  document.getElementById('initForecast').value  = '';
  document.getElementById('decimals').value      = '2';
  document.getElementById('results').classList.remove('show');
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  clearError();
}

/* ── Enter key shortcut ───────────────────────────────────── */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') calculate();
});
