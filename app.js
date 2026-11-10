import { TOURNAMENT_INFO, BRACKET_MATCHES, MATCH_BY_ID, ROUNDS_ORDER } from './bracket-data.js';
import { TEAMS_DATA } from './teams-data.js';
import { TOURNAMENT_RULES } from './rules-data.js';

// Application State
const state = {
  results: {},
  zoom: 1.0,
  activeTab: 'tab-bracket',
  activeScheduleDay: 1,
  theme: localStorage.getItem('uajm_theme') || 'dark',
  searchQuery: '',
  teamFilter: 'all',
  rulesSearch: ''
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
    const parentResult = currentResults[slotDef.w];
    if (parentResult && parentResult.winner) {
      return parentResult.winner;
    }
    return `Winner ${slotDef.w}`;
  }
  if (slotDef.l) {
    const parentResult = currentResults[slotDef.l];
    if (parentResult && parentResult.loser) {
      return parentResult.loser;
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

// Data Synchronization
async function loadStoredResults() {
  const localCache = localStorage.getItem('uajm_tournament_results_v1');
  if (localCache) {
    try {
      state.results = JSON.parse(localCache);
    } catch {
      state.results = {};
    }
  }

  try {
    updateSyncStatus('connecting', 'Sinkronisasi...');
    const response = await fetch(`${TOURNAMENT_INFO.firebaseDatabaseUrl}/results.json`, {
      headers: { 'Accept': 'application/json' }
    });
    if (response.ok) {
      const remoteData = await response.json();
      if (remoteData && typeof remoteData === 'object') {
        state.results = remoteData;
        localStorage.setItem('uajm_tournament_results_v1', JSON.stringify(remoteData));
      }
      updateSyncStatus('online', 'Tersinkronisasi');
    } else {
      updateSyncStatus('offline', 'Lokal Aktif');
    }
  } catch {
    updateSyncStatus('offline', 'Lokal Aktif');
  }

  initFirebaseLiveStream();
  renderAllViews();
}

function updateSyncStatus(mode, text) {
  const indicator = document.getElementById('live-sync-indicator');
  if (!indicator) return;
  const textElement = indicator.querySelector('.status-text');
  if (textElement) {
    textElement.textContent = text;
  }
  indicator.className = `status-indicator status-${mode}`;
}

function initFirebaseLiveStream() {
  try {
    const streamSource = new EventSource(`${TOURNAMENT_INFO.firebaseDatabaseUrl}/results.json`);
    streamSource.addEventListener('put', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.path === '/') {
          if (payload.data && typeof payload.data === 'object') {
            state.results = payload.data;
            localStorage.setItem('uajm_tournament_results_v1', JSON.stringify(payload.data));
            renderAllViews();
            showToast('Hasil pertandingan diperbarui secara real-time');
          }
        } else if (payload && payload.path && payload.path.length > 1) {
          const matchKey = payload.path.replace(/^\//, '');
          state.results[matchKey] = payload.data;
          localStorage.setItem('uajm_tournament_results_v1', JSON.stringify(state.results));
          renderAllViews();
        }
      } catch {
        // Safe ignore on malformed stream frame
      }
    });

    streamSource.onerror = () => {
      updateSyncStatus('offline', 'Lokal Aktif');
    };
  } catch {
    updateSyncStatus('offline', 'Lokal Aktif');
  }
}

// Core Render Logic
function renderAllViews() {
  const computedMatches = computeAllMatches(BRACKET_MATCHES, state.results);
  const matchMap = new Map(computedMatches.map(item => [item.id, item]));

  renderBracketTree(computedMatches);
  renderSchedule(computedMatches);
  renderTeamsDirectory(computedMatches);
  renderRules();
  renderStreamHub(computedMatches);
  updateTournamentStats(computedMatches);
}

function updateTournamentStats(computedMatches) {
  const completedCount = computedMatches.filter(item => item.isCompleted).length;
  const counterElement = document.getElementById('stat-completed-counter');
  if (counterElement) {
    counterElement.textContent = `${completedCount} / ${computedMatches.length} Selesai`;
  }
}

// Challonge Bracket Tree View
function renderBracketTree(computedMatches) {
  const canvas = document.getElementById('bracket-canvas');
  if (!canvas) return;

  const roundsConfig = [
    { title: 'Round 1', sub: '26 Laga &bull; Day 1', matchIds: BRACKET_MATCHES.filter(item => item.round === 'Round 1').map(item => item.id) },
    { title: 'Round of 32', sub: '16 Laga &bull; Day 1', matchIds: BRACKET_MATCHES.filter(item => item.round === 'Round of 32').map(item => item.id) },
    { title: 'Round of 16', sub: '8 Laga &bull; Day 1', matchIds: BRACKET_MATCHES.filter(item => item.round === 'Round of 16').map(item => item.id) },
    { title: 'Quarterfinals', sub: '4 Laga &bull; Day 1', matchIds: BRACKET_MATCHES.filter(item => item.round === 'Quarterfinals').map(item => item.id) },
    { title: 'Semifinals', sub: '2 Laga &bull; Day 2 (BO3)', matchIds: BRACKET_MATCHES.filter(item => item.round === 'Semifinals').map(item => item.id) },
    { title: 'Finals', sub: '3rd Place & Grand Final &bull; Day 3', matchIds: ['M57', 'M58'] }
  ];

  const matchLookup = new Map(computedMatches.map(item => [item.id, item]));

  let html = '';
  for (const round of roundsConfig) {
    html += `
      <div class="bracket-column">
        <div class="round-header-banner">
          <div class="round-header-title">${round.title}</div>
          <div class="round-header-sub">${round.sub}</div>
        </div>
        <div class="matches-column-flow">
    `;

    for (const matchId of round.matchIds) {
      const match = matchLookup.get(matchId);
      if (!match) continue;

      const isWin0 = match.winner && match.winner === match.resolvedTeam0;
      const isWin1 = match.winner && match.winner === match.resolvedTeam1;
      const isLose0 = match.winner && !isWin0 && match.resolvedTeam0 !== 'TBD';
      const isLose1 = match.winner && !isWin1 && match.resolvedTeam1 !== 'TBD';

      const slot0Class = `challonge-slot ${isWin0 ? 'winner-slot' : ''} ${isLose0 ? 'loser-slot' : ''} ${match.resolvedTeam0 === 'TBD' || match.resolvedTeam0.startsWith('Winner ') || match.resolvedTeam0.startsWith('Loser ') ? 'tbd-slot' : ''}`;
      const slot1Class = `challonge-slot ${isWin1 ? 'winner-slot' : ''} ${isLose1 ? 'loser-slot' : ''} ${match.resolvedTeam1 === 'TBD' || match.resolvedTeam1.startsWith('Winner ') || match.resolvedTeam1.startsWith('Loser ') ? 'tbd-slot' : ''}`;

      const cardModifiers = `${match.stream ? 'stream-match-card' : ''}`;

      html += `
        <div class="challonge-match-card ${cardModifiers}" data-match-id="${match.id}" data-team0="${escapeHtml(match.resolvedTeam0)}" data-team1="${escapeHtml(match.resolvedTeam1)}">
          <div class="card-quick-meta">
            <span class="match-id-tag">${match.id}</span>
            <span>${match.format} &bull; ${match.time} WIB</span>
            ${match.bye ? '<span class="bye-badge">BYE</span>' : ''}
            ${match.stream ? '<span class="stream-badge">LIVE</span>' : ''}
          </div>
          <div class="match-slots-stack">
            <div class="${slot0Class}" data-team="${escapeHtml(match.resolvedTeam0)}">
              <span class="seed-box">${match.seed0}</span>
              <span class="participant-name" title="${escapeHtml(match.resolvedTeam0)}">${escapeHtml(match.resolvedTeam0)}</span>
              <span class="slot-score-tag">${match.isCompleted ? (isWin0 ? '[✓]' : '-') : ''}</span>
            </div>
            <div class="${slot1Class}" data-team="${escapeHtml(match.resolvedTeam1)}">
              <span class="seed-box">${match.seed1}</span>
              <span class="participant-name" title="${escapeHtml(match.resolvedTeam1)}">${escapeHtml(match.resolvedTeam1)}</span>
              <span class="slot-score-tag">${match.isCompleted ? (isWin1 ? '[✓]' : '-') : ''}</span>
            </div>
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  canvas.innerHTML = html;
  attachBracketCardEvents(computedMatches);
}

// Attach hover path highlighting & popover click
function attachBracketCardEvents(computedMatches) {
  const matchMap = new Map(computedMatches.map(item => [item.id, item]));
  const slots = document.querySelectorAll('.challonge-slot');
  const cards = document.querySelectorAll('.challonge-match-card');

  slots.forEach(slot => {
    slot.addEventListener('mouseenter', () => {
      const teamName = slot.getAttribute('data-team');
      if (!teamName || teamName === 'TBD' || teamName.startsWith('Winner ') || teamName.startsWith('Loser ')) {
        return;
      }
      highlightTeamPath(teamName);
    });

    slot.addEventListener('mouseleave', () => {
      clearTeamPathHighlight();
    });
  });

  cards.forEach(card => {
    card.addEventListener('click', (event) => {
      event.stopPropagation();
      const matchId = card.getAttribute('data-match-id');
      const match = matchMap.get(matchId);
      if (match) {
        openMatchPopover(match);
      }
    });
  });
}

function highlightTeamPath(teamName) {
  const normalized = teamName.toLowerCase().trim();
  const allCards = document.querySelectorAll('.challonge-match-card');
  const allSlots = document.querySelectorAll('.challonge-slot');

  allCards.forEach(card => {
    const t0 = (card.getAttribute('data-team0') || '').toLowerCase().trim();
    const t1 = (card.getAttribute('data-team1') || '').toLowerCase().trim();
    if (t0 === normalized || t1 === normalized) {
      card.classList.add('highlighted-path');
    } else {
      card.classList.remove('highlighted-path');
    }
  });

  allSlots.forEach(slot => {
    const candidate = (slot.getAttribute('data-team') || '').toLowerCase().trim();
    if (candidate === normalized) {
      slot.classList.add('hover-team-match');
    } else {
      slot.classList.remove('hover-team-match');
    }
  });
}

function clearTeamPathHighlight() {
  const highlightedCards = document.querySelectorAll('.challonge-match-card.highlighted-path');
  highlightedCards.forEach(card => card.classList.remove('highlighted-path'));

  const highlightedSlots = document.querySelectorAll('.challonge-slot.hover-team-match');
  highlightedSlots.forEach(slot => slot.classList.remove('hover-team-match'));
}

// Match Detail Modal Popover
function openMatchPopover(match) {
  const modal = document.getElementById('match-popover-modal');
  const title = document.getElementById('popover-title');
  const eyebrow = document.getElementById('popover-eyebrow');
  const content = document.getElementById('popover-content');

  if (!modal || !title || !content) return;

  eyebrow.textContent = `${match.round} • Day ${match.day} (${match.date})`;
  title.textContent = `Match ${match.id} (${match.format})`;

  const statusLabel = match.isCompleted ? 'Pertandingan Selesai' : 'Belum Dimainkan';
  const winnerText = match.winner ? match.winner : 'Belum ditentukan';

  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px;">
        <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase; margin-bottom: 6px;">Jadwal & Status</div>
        <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">
          Pukul ${match.time} WIB ${match.kloter ? `(Kloter ${match.kloter})` : ''}
        </div>
        <div style="font-size: 0.78rem; color: ${match.isCompleted ? 'var(--color-win)' : 'var(--text-muted)'}; font-weight: 600;">
          Status: ${statusLabel}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Peserta & Seed</div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: ${match.winner === match.resolvedTeam0 ? 'var(--color-win-subtle)' : 'var(--bg-surface)'}; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="seed-box">${match.seed0}</span>
            <span style="font-weight: 700; color: var(--text-main);">${escapeHtml(match.resolvedTeam0)}</span>
          </div>
          <span style="font-family: var(--font-mono); font-weight: 700; color: ${match.winner === match.resolvedTeam0 ? 'var(--color-win)' : 'var(--text-dim)'};">
            ${match.winner === match.resolvedTeam0 ? 'Pemenang [✓]' : ''}
          </span>
        </div>

        <div style="text-align: center; font-size: 0.72rem; color: var(--text-dim); font-weight: 700;">VS</div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: ${match.winner === match.resolvedTeam1 ? 'var(--color-win-subtle)' : 'var(--bg-surface)'}; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="seed-box">${match.seed1}</span>
            <span style="font-weight: 700; color: var(--text-main);">${escapeHtml(match.resolvedTeam1)}</span>
          </div>
          <span style="font-family: var(--font-mono); font-weight: 700; color: ${match.winner === match.resolvedTeam1 ? 'var(--color-win)' : 'var(--text-dim)'};">
            ${match.winner === match.resolvedTeam1 ? 'Pemenang [✓]' : ''}
          </span>
        </div>
      </div>

      <div style="font-size: 0.78rem; color: var(--text-muted); background: var(--bg-surface-elevated); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
        <div><strong>Pemenang:</strong> ${escapeHtml(winnerText)}</div>
        ${match.next ? `<div style="margin-top: 4px;"><strong>Lolos ke:</strong> Match ${match.next.m} (Slot ${match.next.slot + 1})</div>` : ''}
        ${match.nextLoser ? `<div style="margin-top: 2px;"><strong>Ke Perebutan Juara 3:</strong> Match ${match.nextLoser.m}</div>` : ''}
        <div style="margin-top: 4px;"><strong>Regulasi:</strong> Standar Custom Lobby Draft Pick (Tournament Mode).</div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

window.closeMatchPopover = function() {
  const modal = document.getElementById('match-popover-modal');
  if (modal) {
    modal.classList.remove('active');
  }
};

// TAB 2: Schedule Rundown View
function renderSchedule(computedMatches) {
  const day1Container = document.getElementById('schedule-day-1');
  const day2Container = document.getElementById('schedule-day-2');
  const day3Container = document.getElementById('schedule-day-3');

  if (day1Container) {
    day1Container.innerHTML = buildDayScheduleHtml(computedMatches.filter(item => item.day === 1));
  }
  if (day2Container) {
    day2Container.innerHTML = buildDayScheduleHtml(computedMatches.filter(item => item.day === 2));
  }
  if (day3Container) {
    day3Container.innerHTML = buildDayScheduleHtml(computedMatches.filter(item => item.day === 3));
  }

  attachAccordionToggles();
}

function buildDayScheduleHtml(dayMatches) {
  if (dayMatches.length === 0) {
    return '<div style="padding: 24px; text-align: center; color: var(--text-dim);">Tidak ada pertandingan pada hari ini.</div>';
  }

  const groupedByRound = new Map();
  for (const match of dayMatches) {
    const key = match.round;
    if (!groupedByRound.has(key)) {
      groupedByRound.set(key, []);
    }
    groupedByRound.get(key).push(match);
  }

  let html = '';
  for (const [roundName, matches] of groupedByRound.entries()) {
    const firstMatch = matches[0];
    const totalInRound = matches.length;
    const completedCount = matches.filter(item => item.isCompleted).length;

    html += `
      <div class="schedule-stage-card open">
        <div class="stage-card-header">
          <div>
            <div class="stage-header-title">${roundName}</div>
            <div class="stage-header-meta">
              <span class="stage-time-chip">${firstMatch.time} WIB</span>
              <span>&bull;</span>
              <span>${firstMatch.format}</span>
              <span>&bull;</span>
              <span>${totalInRound} Pertandingan (${completedCount} Selesai)</span>
            </div>
          </div>
          <span class="stage-toggle-arrow">▼</span>
        </div>
        <div class="stage-card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">
    `;

    for (const match of matches) {
      const isWin0 = match.winner && match.winner === match.resolvedTeam0;
      const isWin1 = match.winner && match.winner === match.resolvedTeam1;

      html += `
        <div class="challonge-match-card" data-match-id="${match.id}" style="cursor: pointer;">
          <div class="card-quick-meta">
            <span class="match-id-tag">${match.id}</span>
            <span>${match.time} WIB ${match.kloter ? `(K${match.kloter})` : ''}</span>
            ${match.stream ? '<span class="stream-badge">LIVE STREAM</span>' : ''}
          </div>
          <div class="match-slots-stack">
            <div class="challonge-slot ${isWin0 ? 'winner-slot' : ''}">
              <span class="seed-box">${match.seed0}</span>
              <span class="participant-name">${escapeHtml(match.resolvedTeam0)}</span>
              <span class="slot-score-tag">${match.isCompleted ? (isWin0 ? '[✓]' : '-') : ''}</span>
            </div>
            <div class="challonge-slot ${isWin1 ? 'winner-slot' : ''}">
              <span class="seed-box">${match.seed1}</span>
              <span class="participant-name">${escapeHtml(match.resolvedTeam1)}</span>
              <span class="slot-score-tag">${match.isCompleted ? (isWin1 ? '[✓]' : '-') : ''}</span>
            </div>
          </div>
        </div>
      `;
    }

    html += `
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

function attachAccordionToggles() {
  const headers = document.querySelectorAll('.stage-card-header');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const parentCard = header.closest('.schedule-stage-card');
      if (parentCard) {
        parentCard.classList.toggle('open');
      }
    });
  });
}

// TAB 3: Teams Directory
function renderTeamsDirectory(computedMatches) {
  const container = document.getElementById('teams-grid-box');
  if (!container) return;

  const eliminatedSet = new Set();
  for (const match of computedMatches) {
    if (match.loser && match.loser !== 'TBD') {
      eliminatedSet.add(match.loser.toLowerCase().trim());
    }
  }

  let filtered = TEAMS_DATA;
  if (state.teamFilter === 'bye') {
    filtered = TEAMS_DATA.filter(team => team.hasBye);
  } else if (state.teamFilter === 'active') {
    filtered = TEAMS_DATA.filter(team => !eliminatedSet.has(team.name.toLowerCase().trim()));
  } else if (state.teamFilter === 'eliminated') {
    filtered = TEAMS_DATA.filter(team => eliminatedSet.has(team.name.toLowerCase().trim()));
  }

  let html = '';
  for (const team of filtered) {
    const isEliminated = eliminatedSet.has(team.name.toLowerCase().trim());
    const statusLabel = isEliminated ? 'Tereliminasi' : (team.hasBye ? 'BYE (Lolos R32)' : 'Aktif Bertanding');
    const badgeColor = isEliminated ? 'var(--text-dim)' : (team.hasBye ? 'var(--color-bye)' : 'var(--color-win)');
    const badgeBg = isEliminated ? 'rgba(100,116,139,0.15)' : (team.hasBye ? 'var(--color-bye-subtle)' : 'var(--color-win-subtle)');

    html += `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <span style="font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; color: var(--color-primary); background: var(--color-primary-subtle); padding: 2px 6px; border-radius: 2px;">
              Seed #${team.seed}
            </span>
            <span style="font-size: 0.68rem; font-weight: 700; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 6px; border-radius: 2px;">
              ${statusLabel}
            </span>
          </div>
          <div style="font-family: var(--font-display); font-size: 0.92rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">
            ${escapeHtml(team.name)}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-dim);">
            Mulai: ${team.initialRound} (${team.entryMatch}) &bull; ${team.initialTime} WIB
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// TAB 4: Rules Accordion View
function renderRules() {
  const container = document.getElementById('rules-chapters-box');
  if (!container) return;

  const query = state.rulesSearch.toLowerCase().trim();
  let chapters = TOURNAMENT_RULES;

  if (query) {
    chapters = TOURNAMENT_RULES.filter(chapter => {
      const matchTitle = chapter.title.toLowerCase().includes(query);
      const matchSummary = chapter.summary.toLowerCase().includes(query);
      const matchItem = chapter.items.some(item =>
        item.title.toLowerCase().includes(query) || item.text.toLowerCase().includes(query)
      );
      return matchTitle || matchSummary || matchItem;
    });
  }

  let html = '';
  for (const chapter of chapters) {
    html += `
      <div class="schedule-stage-card open">
        <div class="stage-card-header">
          <div>
            <div class="stage-header-title">${chapter.chapter}: ${chapter.title}</div>
            <div class="stage-header-meta">
              <span>${chapter.summary}</span>
            </div>
          </div>
          <span class="stage-toggle-arrow">▼</span>
        </div>
        <div class="stage-card-body" style="background: var(--bg-surface);">
          <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    for (const item of chapter.items) {
      html += `
        <div style="padding-bottom: 8px; border-bottom: 1px solid var(--border-subtle);">
          <div style="font-weight: 700; font-size: 0.82rem; color: var(--color-primary); margin-bottom: 4px;">
            ${item.number} ${item.title}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; white-space: pre-line;">
            ${escapeHtml(item.text)}
          </div>
        </div>
      `;
    }

    html += `
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  attachAccordionToggles();
}

// TAB 5: Live Stream Hub
function renderStreamHub(computedMatches) {
  const container = document.getElementById('stream-matches-list');
  if (!container) return;

  const streamMatches = computedMatches.filter(item => item.stream);

  let html = '';
  for (const match of streamMatches) {
    const isWin0 = match.winner && match.winner === match.resolvedTeam0;
    const isWin1 = match.winner && match.winner === match.resolvedTeam1;

    html += `
      <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; margin-bottom: 6px;">
          <span style="font-weight: 700; color: var(--color-stream);">${match.round} (${match.id})</span>
          <span style="color: var(--text-dim); font-family: var(--font-mono);">${match.date} &bull; ${match.time} WIB &bull; ${match.format}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 600; color: ${isWin0 ? 'var(--color-win)' : 'var(--text-main)'};">
            <span>${escapeHtml(match.resolvedTeam0)}</span>
            <span>${isWin0 ? '[Pemenang]' : ''}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 600; color: ${isWin1 ? 'var(--color-win)' : 'var(--text-main)'};">
            <span>${escapeHtml(match.resolvedTeam1)}</span>
            <span>${isWin1 ? '[Pemenang]' : ''}</span>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// Global UI Switchers & Event Handlers
function setupUIListeners() {
  // View Switcher Tabs
  const tabs = document.querySelectorAll('.view-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');
      switchViewTab(targetId);
    });
  });

  // Schedule Day Switcher
  const dayButtons = document.querySelectorAll('.day-tab-btn');
  dayButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      dayButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const dayNum = btn.getAttribute('data-day');
      document.querySelectorAll('.day-schedule-panel').forEach(panel => panel.classList.remove('active'));
      const activePanel = document.getElementById(`schedule-day-${dayNum}`);
      if (activePanel) activePanel.classList.add('active');
    });
  });

  // Zoom Controls
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomResetBtn = document.getElementById('zoom-reset-btn');
  const canvas = document.getElementById('bracket-canvas');

  if (zoomInBtn && canvas) {
    zoomInBtn.addEventListener('click', () => {
      state.zoom = Math.min(state.zoom + 0.15, 1.8);
      applyZoom(canvas);
    });
  }

  if (zoomOutBtn && canvas) {
    zoomOutBtn.addEventListener('click', () => {
      state.zoom = Math.max(state.zoom - 0.15, 0.6);
      applyZoom(canvas);
    });
  }

  if (zoomResetBtn && canvas) {
    zoomResetBtn.addEventListener('click', () => {
      state.zoom = 1.0;
      applyZoom(canvas);
    });
  }

  // Search participant in bracket
  const searchInput = document.getElementById('participant-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      const query = event.target.value.toLowerCase().trim();
      const allCards = document.querySelectorAll('.challonge-match-card');
      if (!query) {
        allCards.forEach(c => {
          c.style.opacity = '1';
          c.classList.remove('highlighted-path');
        });
        return;
      }

      allCards.forEach(card => {
        const t0 = (card.getAttribute('data-team0') || '').toLowerCase();
        const t1 = (card.getAttribute('data-team1') || '').toLowerCase();
        if (t0.includes(query) || t1.includes(query)) {
          card.style.opacity = '1';
          card.classList.add('highlighted-path');
        } else {
          card.style.opacity = '0.3';
          card.classList.remove('highlighted-path');
        }
      });
    });
  }

  // Team Filter Select in Tab 3
  const teamFilterSelect = document.getElementById('team-filter-select');
  if (teamFilterSelect) {
    teamFilterSelect.addEventListener('change', (event) => {
      state.teamFilter = event.target.value;
      const computedMatches = computeAllMatches(BRACKET_MATCHES, state.results);
      renderTeamsDirectory(computedMatches);
    });
  }

  // Rules search input
  const rulesInput = document.getElementById('rules-filter-input');
  if (rulesInput) {
    rulesInput.addEventListener('input', (event) => {
      state.rulesSearch = event.target.value;
      renderRules();
    });
  }

  // Theme switcher
  const themeBtn = document.getElementById('theme-switcher-btn');
  if (themeBtn) {
    applyTheme(state.theme);
    themeBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('uajm_theme', state.theme);
      applyTheme(state.theme);
    });
  }

  // Floating copy url
  const copyBtn = document.getElementById('floating-copy-url-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('Tautan bagan berhasil disalin');
      }).catch(() => {
        showToast('Gagal menyalin tautan');
      });
    });
  }

  // Modal backdrop click
  const modal = document.getElementById('match-popover-modal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        window.closeMatchPopover();
      }
    });
  }
}

function applyZoom(canvas) {
  canvas.style.transform = `scale(${state.zoom})`;
  canvas.style.transformOrigin = 'top left';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const sunIcon = document.getElementById('theme-sun-icon');
  const moonIcon = document.getElementById('theme-moon-icon');
  if (sunIcon && moonIcon) {
    if (theme === 'dark') {
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
    } else {
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
    }
  }
}

export function switchViewTab(targetId) {
  state.activeTab = targetId;
  document.querySelectorAll('.view-tab').forEach(t => {
    if (t.getAttribute('data-target') === targetId) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-pane').forEach(p => {
    if (p.id === targetId) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}
window.switchViewTab = switchViewTab;

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

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  setupUIListeners();
  loadStoredResults();
});
