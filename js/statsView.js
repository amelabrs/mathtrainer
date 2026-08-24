// Renders the Stats & history screen. Not pure (touches storage + DOM) —
// kept out of app.js purely to keep that file focused on the session flow.

import { OPERATIONS, LEVELS, LEVEL_LABELS } from './problemGenerator.js';
import { getRecentAttempts, getSessionsFor } from './storage.js';
import { rollingStats, ROLLING_WINDOW } from './adaptive.js';

const PLATEAU_WINDOW = 6; // look at the last N drill/mixed sessions for a level

function sparkline(values, width = 120, height = 28) {
  if (values.length < 2) {
    return `<svg width="${width}" height="${height}" class="sparkline sparkline-empty"></svg>`;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `<svg width="${width}" height="${height}" class="sparkline" viewBox="0 0 ${width} ${height}">
    <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

function detectPlateau(avgTimes) {
  if (avgTimes.length < 4) return false;
  const recent = avgTimes.slice(-PLATEAU_WINDOW);
  const mid = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, mid);
  const secondHalf = recent.slice(mid);
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const improvement = 1 - avg(secondHalf) / avg(firstHalf);
  return improvement < 0.05; // less than 5% faster than earlier sessions
}

function fmtMs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function renderStats(container, levels) {
  container.innerHTML = '';

  for (const operation of OPERATIONS) {
    const opSection = document.createElement('div');
    opSection.className = 'stats-operation';

    const unlocked = levels[operation] || 1;
    const heading = document.createElement('h3');
    heading.textContent = operation[0].toUpperCase() + operation.slice(1);
    opSection.appendChild(heading);

    const table = document.createElement('table');
    table.className = 'stats-table';
    table.innerHTML = `<thead><tr>
      <th>Level</th><th>Accuracy</th><th>Avg time</th><th>Trend</th><th></th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const level of LEVELS) {
      const recent = getRecentAttempts(operation, level, ROLLING_WINDOW);
      const stats = rollingStats(recent);
      const sessions = getSessionsFor(operation, level);
      const avgTimes = sessions.map((s) => s.avgTimeMs);
      const plateau = detectPlateau(avgTimes);

      const row = document.createElement('tr');
      if (level === unlocked) row.classList.add('stats-row-current');
      if (level > unlocked) row.classList.add('stats-row-locked');

      const accuracyText = stats.n > 0 ? `${Math.round(stats.accuracy * 100)}% (${stats.correct}/${stats.n})` : '—';
      const timeText = stats.n > 0 ? fmtMs(stats.avgTimeMs) : '—';

      row.innerHTML = `
        <td>L${level} — ${LEVEL_LABELS[operation][level - 1]}${level === unlocked ? ' <span class="badge">current</span>' : ''}</td>
        <td>${accuracyText}</td>
        <td>${timeText}</td>
        <td>${sparkline(avgTimes)}</td>
        <td>${plateau ? '<span class="plateau-flag" title="No meaningful improvement in avg time over recent sessions">⏸ plateau</span>' : ''}</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    opSection.appendChild(table);
    container.appendChild(opSection);
  }
}
