import { TOURNAMENT_INFO, BRACKET_MATCHES } from '../bracket-data.js';
import { TEAMS_DATA } from '../teams-data.js';

const state = {
  isAuthenticated: false,
  results: {},
  filterRound: 'all'
};

const TEAMS_MAP = new Map(TEAMS_DATA.map(team => [team.name.toLowerCase().trim(), team]));

function getTeamSeed(teamName) {
  if (!teamName || teamName === 'TBD' || teamName.startsWith('Winner ') || teamName.startsWith('Loser ')) {
    return '-';
  }
  const clean = teamName.toLowerCase().trim();
  const found = TEAMS_MAP.get(clean);
  if (found) {
    return found.seed;
  }
  return '-';
}

function resolveMatchSlot(slotDef, currentResults) {
  if (typeof slotDef === 'string') {
    return slotDef;
  }
  if (!slotDef || typeof slotDef !== 'object') {
    return 'TBD';
  }
  if (slotDef.w) {
    const parent = currentResults[slotDef.w];
    if (parent && parent.winner) {
      return parent.winner;
    }
    return `Winner ${slotDef.w}`;
  }
  if (slotDef.l) {
    const parent = currentResults[slotDef.l];
    if (parent && parent.loser) {
      return parent.loser;
    }
    return `Loser ${slotDef.l}`;
  }
  return 'TBD';
}

function computeAllMatches(rawMatches, currentResults) {
  const resolved = [];
  for (const match of rawMatches) {
    const team0 = resolveMatchSlot(match.s0, currentResults);
    const team1 = resolveMatchSlot(match.s1, currentResults);
    const result = currentResults[match.id] || null;
    const winner = result ? result.winner : null;
    const loser = result ? result.loser : null;
    const score0 = result && typeof result.score0 === 'number' ? result.score0 : (winner === team0 ? 1 : 0);
    const score1 = result && typeof result.score1 === 'number' ? result.score1 : (winner === team1 ? 1 : 0);
    const isCompleted = Boolean(winner);

    resolved.push({
      ...match,
      resolvedTeam0: team0,
      resolvedTeam1: team1,
      seed0: getTeamSeed(team0),
      seed1: getTeamSeed(team1),
      winner,
      loser,
      score0,
      score1,
      isCompleted
    });
  }
  return resolved;
}

// Authentication Handlers
function checkExistingSession() {
  const token = sessionStorage.getItem('uajm_admin_authenticated');
  if (token === 'valid_session_token') {
    state.isAuthenticated = true;
    showDasborView();
  } else {
    showAuthView();
  }
}

function setupAuth() {
  const form = document.getElementById('admin-login-form');
  const errorBox = document.getElementById('auth-error-alert');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('admin-username-input').value.trim();
      const passwordInput = document.getElementById('admin-password-input').value.trim();

      if (usernameInput === TOURNAMENT_INFO.adminAuthUsername && passwordInput === TOURNAMENT_INFO.adminAuthPassword) {
        state.isAuthenticated = true;
        sessionStorage.setItem('uajm_admin_authenticated', 'valid_session_token');
        if (errorBox) errorBox.style.display = 'none';
        showDasborView();
        showToast('Login berhasil sebagai Panitia');
      } else {
        if (errorBox) {
          errorBox.textContent = 'Kombinasi nama pengguna dan kata sandi salah.';
          errorBox.style.display = 'block';
        }
      }
    });
  }

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('uajm_admin_authenticated');
      state.isAuthenticated = false;
      showAuthView();
      showToast('Berhasil keluar dari sesi admin');
    });
  }
}

function showAuthView() {
  const authPanel = document.getElementById('auth-panel');
  const dasborPanel = document.getElementById('dasbor-panel');
  if (authPanel) authPanel.style.display = 'block';
  if (dasborPanel) dasborPanel.style.display = 'none';
}

function showDasborView() {
  const authPanel = document.getElementById('auth-panel');
  const dasborPanel = document.getElementById('dasbor-panel');
  if (authPanel) authPanel.style.display = 'none';
  if (dasborPanel) dasborPanel.style.display = 'block';
  loadResults();
}

// Data synchronization with Firebase RTDB
async function loadResults() {
  const local = localStorage.getItem('uajm_tournament_results_v1');
  if (local) {
    try {
      state.results = JSON.parse(local);
    } catch {
      state.results = {};
    }
  }

  try {
    const response = await fetch(`${TOURNAMENT_INFO.firebaseDatabaseUrl}/results.json`);
    if (response.ok) {
      const data = await response.json();
      if (data && typeof data === 'object') {
        state.results = data;
        localStorage.setItem('uajm_tournament_results_v1', JSON.stringify(data));
      }
      setFirebaseStatus(true);
    } else {
      setFirebaseStatus(false);
    }
  } catch {
    setFirebaseStatus(false);
  }

  renderAdminMatches();
}

function setFirebaseStatus(isOnline) {
  const el = document.getElementById('admin-db-status');
  if (!el) return;
  if (isOnline) {
    el.textContent = 'Terhubung (Online)';
    el.style.color = 'var(--color-win)';
  } else {
    el.textContent = 'Lokal Saja (Offline)';
    el.style.color = '#ef4444';
  }
}

async function saveMatchResult(matchId, winnerTeam, loserTeam, score0, score1) {
  const payload = {
    matchId,
    winner: winnerTeam,
    loser: loserTeam,
    score0,
    score1,
    updatedAt: new Date().toISOString()
  };

  state.results[matchId] = payload;
  localStorage.setItem('uajm_tournament_results_v1', JSON.stringify(state.results));
  renderAdminMatches();

  try {
    const res = await fetch(`${TOURNAMENT_INFO.firebaseDatabaseUrl}/results/${matchId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast(`Hasil Match ${matchId} disimpan dan disiarkan`);
    } else {
      showToast(`Hasil Match ${matchId} disimpan di cache lokal`);
    }
  } catch {
    showToast(`Tersimpan di penyimpanan lokal`);
  }
}

async function resetMatchResult(matchId) {
  delete state.results[matchId];
  localStorage.setItem('uajm_tournament_results_v1', JSON.stringify(state.results));
  renderAdminMatches();

  try {
    await fetch(`${TOURNAMENT_INFO.firebaseDatabaseUrl}/results/${matchId}.json`, {
      method: 'DELETE'
    });
    showToast(`Match ${matchId} berhasil direset`);
  } catch {
    showToast(`Match ${matchId} direset secara lokal`);
  }
}

// Render Admin Matches Management UI
function renderAdminMatches() {
  const container = document.getElementById('admin-matches-list');
  const counterEl = document.getElementById('admin-matches-counter');
  if (!container) return;

  const computedMatches = computeAllMatches(BRACKET_MATCHES, state.results);
  const completedCount = computedMatches.filter(item => item.isCompleted).length;
  if (counterEl) {
    counterEl.textContent = `${completedCount} / ${computedMatches.length} Laga Selesai`;
  }

  let list = computedMatches;
  if (state.filterRound !== 'all') {
    list = computedMatches.filter(item => item.round === state.filterRound);
  }

  let html = '';
  for (const match of list) {
    const isCompleted = match.isCompleted;
    const isWin0 = match.winner === match.resolvedTeam0;
    const isWin1 = match.winner === match.resolvedTeam1;
    const hasTbd = match.resolvedTeam0 === 'TBD' || match.resolvedTeam1 === 'TBD' ||
      match.resolvedTeam0.startsWith('Winner ') || match.resolvedTeam1.startsWith('Winner ') ||
      match.resolvedTeam0.startsWith('Loser ') || match.resolvedTeam1.startsWith('Loser ');

    html += `
      <div class="match-admin-item">
        <div>
          <div style="font-family: var(--font-mono); font-weight: 700; color: var(--color-primary); font-size: 0.85rem;">
            ${match.id} &bull; ${match.round}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">
            ${match.time} WIB &bull; ${match.format}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: var(--bg-surface-elevated); border-radius: var(--radius-xs);">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="seed-box">${match.seed0}</span>
              <span style="font-weight: 600; font-size: 0.82rem; color: ${isWin0 ? 'var(--color-win)' : 'var(--text-main)'};">
                ${escapeHtml(match.resolvedTeam0)}
              </span>
            </div>
            <button class="btn-win-action ${isWin0 ? 'active-winner' : ''}" data-action="set-winner" data-match="${match.id}" data-team="${escapeHtml(match.resolvedTeam0)}" data-loser="${escapeHtml(match.resolvedTeam1)}" ${hasTbd ? 'disabled' : ''}>
              ${isWin0 ? 'Pemenang [✓]' : 'Pilih Menang'}
            </button>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: var(--bg-surface-elevated); border-radius: var(--radius-xs);">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="seed-box">${match.seed1}</span>
              <span style="font-weight: 600; font-size: 0.82rem; color: ${isWin1 ? 'var(--color-win)' : 'var(--text-main)'};">
                ${escapeHtml(match.resolvedTeam1)}
              </span>
            </div>
            <button class="btn-win-action ${isWin1 ? 'active-winner' : ''}" data-action="set-winner" data-match="${match.id}" data-team="${escapeHtml(match.resolvedTeam1)}" data-loser="${escapeHtml(match.resolvedTeam0)}" ${hasTbd ? 'disabled' : ''}>
              ${isWin1 ? 'Pemenang [✓]' : 'Pilih Menang'}
            </button>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end;">
          ${isCompleted ? `
            <button class="btn-reset-match" data-action="reset-match" data-match="${match.id}">
              Reset Laga
            </button>
          ` : `
            <span style="font-size: 0.72rem; color: var(--text-dim);">Menunggu</span>
          `}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  attachAdminActionListeners();
}

function attachAdminActionListeners() {
  const winButtons = document.querySelectorAll('button[data-action="set-winner"]');
  winButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const matchId = btn.getAttribute('data-match');
      const winner = btn.getAttribute('data-team');
      const loser = btn.getAttribute('data-loser');
      if (matchId && winner && loser) {
        saveMatchResult(matchId, winner, loser, 1, 0);
      }
    });
  });

  const resetButtons = document.querySelectorAll('button[data-action="reset-match"]');
  resetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const matchId = btn.getAttribute('data-match');
      if (matchId) {
        resetMatchResult(matchId);
      }
    });
  });
}

function showToast(message) {
  const toast = document.getElementById('toast-element');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 2800);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  checkExistingSession();

  const roundFilter = document.getElementById('admin-round-filter');
  if (roundFilter) {
    roundFilter.addEventListener('change', (e) => {
      state.filterRound = e.target.value;
      renderAdminMatches();
    });
  }

  const refreshBtn = document.getElementById('admin-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadResults();
      showToast('Data berhasil dimuat ulang');
    });
  }
});
