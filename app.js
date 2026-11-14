import { TOURNAMENT_RULES } from './rules-data.js';
import { LANGUAGES, RTL_LANGUAGES, getDictionary } from './i18n.js';
import {
  readCache, writeCache, fetchRemote, subscribeRemote,
  resolveMatches, getActiveTeams, normalizeConfig, eliminatedTeams,
  teamName, teamMeta, escapeHtml
} from './core.js';

const ROUTES = ['home', 'bracket', 'schedule', 'teams', 'rules', 'stream'];
const CARD_WIDTH = 208;
const CARD_HEIGHT = 52;
const COLUMN_STEP = 280;
const TOP_OFFSET = 56;
const SLOT_HEIGHT = 128;

const ui = {
  data: readCache(),
  resolved: null,
  teamsList: [],
  cfg: null,
  lang: localStorage.getItem('uajm_lang') || detectLanguage(),
  t: null,
  day: 1,
  teamFilter: 'all',
  zoom: window.innerWidth < 640 ? 0.75 : 1,
  connectors: []
};

function detectLanguage() {
  const preferred = (navigator.language || 'id').slice(0, 2).toLowerCase();
  return LANGUAGES.some(item => item.code === preferred) ? preferred : 'id';
}

const $ = (selector) => document.querySelector(selector);

/* ---------- Localisation ---------- */
function applyLanguage() {
  ui.t = getDictionary(ui.lang);
  document.documentElement.lang = ui.lang;
  document.documentElement.dir = RTL_LANGUAGES.has(ui.lang) ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(node => {
    const val = ui.t[node.dataset.i18n];
    if (val !== undefined) node.textContent = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
    const val = ui.t[node.dataset.i18nPlaceholder];
    if (val !== undefined) node.placeholder = val;
  });
  $('#lang-select').setAttribute('aria-label', ui.t.language);
  $('#theme-btn').setAttribute('aria-label', ui.t.theme);
  document.querySelectorAll('[data-quick-lang]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.quickLang === ui.lang);
  });
}

/* ---------- Routing ---------- */
function currentRoute() {
  const hash = location.hash.replace('#', '');
  return ROUTES.includes(hash) ? hash : 'home';
}

function applyRoute() {
  const route = currentRoute();
  ROUTES.forEach(name => $(`#view-${name}`).classList.toggle('active', name === route));
  document.querySelectorAll('[data-route]').forEach(link => link.classList.toggle('active', link.dataset.route === route));
  window.scrollTo({ top: 0 });
}

/* ---------- Helpers ---------- */
function displayName(teamId) {
  return teamName(ui.data, teamId);
}

function seedOf(teamId) {
  const meta = teamMeta(teamId, ui.data);
  return meta ? meta.seed : '';
}

function renderAll() {
  ui.cfg = normalizeConfig(ui.data.config);
  ui.resolved = resolveMatches(ui.data);
  ui.teamsList = getActiveTeams(ui.data);
  if (!ui.cfg.days.some(d => d.day === ui.day)) {
    ui.day = ui.cfg.days[0]?.day || 1;
  }
  renderLanding();
  renderBracket();
  renderSchedule();
  renderTeams();
  renderRules();
  renderStream();
}

/* ---------- Landing ---------- */
function renderLanding() {
  const matches = [...ui.resolved.values()];
  const done = matches.filter(match => match.done).length;
  const datesBadge = $('#hero-dates-badge');
  if (datesBadge) datesBadge.textContent = ui.cfg.datesBanner.toUpperCase();
  const slotsBadge = $('#hero-slots-badge');
  if (slotsBadge) slotsBadge.textContent = `SINGLE ELIMINATION · ${ui.teamsList.length} SLOTS`;

  const statTeams = $('#stat-teams');
  if (statTeams) statTeams.textContent = ui.teamsList.length;
  const statMatches = $('#stat-matches');
  if (statMatches) statMatches.textContent = matches.length;
  const statDays = $('#stat-days');
  if (statDays) statDays.textContent = ui.cfg.days.length;
  $('#stat-done').textContent = done;

  // Update Hero Spotlight card
  const pct = matches.length ? Math.round((done / matches.length) * 100) : 0;
  const progText = $('#hero-progress-text');
  if (progText) progText.textContent = `${done} / ${matches.length} (${pct}%)`;
  const progFill = $('#hero-progress-fill');
  if (progFill) progFill.style.width = `${pct}%`;
  const spotFormat = $('#spot-format');
  if (spotFormat) spotFormat.textContent = `Single Elimination (${ui.teamsList.length} Tim)`;
  const spotDates = $('#spot-dates');
  if (spotDates) spotDates.textContent = ui.cfg.datesBanner;
  const sfMatch = matches.find(m => m.round === 'Semifinals');
  const gfMatch = matches.find(m => m.round === 'Grand Final');
  const spotFinals = $('#spot-finals');
  if (spotFinals) {
    spotFinals.textContent = `Semifinal ${sfMatch?.format || 'BO3'} · Grand Final ${gfMatch?.format || 'BO5'}`;
  }

  // Render Babak Puncak (Semifinals, 3rd Place, Grand Final) di Landing Page
  const finalsGrid = $('#home-finals-grid');
  if (finalsGrid) {
    const stageMatches = matches.filter(m =>
      m.round === 'Semifinals' || m.round === '3rd Place Match' || m.round === 'Grand Final'
    );
    let semiIdx = 1;
    finalsGrid.innerHTML = stageMatches.map(m => {
      const title = m.round === 'Semifinals' ? `Semifinal ${semiIdx++}` : m.round;
      const isGrand = m.round === 'Grand Final';
      const renderTeamSlot = (slot) => {
        const tId = m.teams[slot];
        const name = displayName(tId) || ui.t.tbd;
        const seed = seedOf(tId);
        const win = m.done && m.winnerSlot === slot;
        return `<div class="stage-team ${win ? 'win' : ''}">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${seed ? `<small style="font-family:var(--font-mono);color:var(--muted);margin-right:6px">#${seed}</small>` : ''}${escapeHtml(name)}</span>
          <strong>${win ? 'W' : ''}</strong>
        </div>`;
      };
      return `<article class="stage-card ${isGrand ? 'grand' : ''}" data-match="${m.id}">
        <div>
          <div class="stage-top">
            <span>${escapeHtml(m.id)} &middot; ${escapeHtml(m.format)}</span>
            ${m.stream ? `<span class="pill">${escapeHtml(ui.t.live)}</span>` : ''}
          </div>
          <h3 class="stage-title">${escapeHtml(title)}</h3>
        </div>
        <div class="stage-teams">
          ${renderTeamSlot(0)}
          ${renderTeamSlot(1)}
        </div>
        <div class="stage-foot">
          <span>${escapeHtml(m.date)}</span>
          <span>${escapeHtml(m.time)} WIB</span>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- Teams ---------- */

  const final = matches.find(m => m.round === 'Grand Final') || matches[matches.length - 1];
  const slot = $('#champion-slot');
  if (final && final.done) {
    const champion = displayName(final.teams[final.winnerSlot]);
    slot.innerHTML = `<div class="card champion"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2-1.2.5-2 2-2 3.8M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg><div><small>${escapeHtml(ui.t.winner)} &middot; Grand Final</small><strong>${escapeHtml(champion)}</strong></div></div>`;
    slot.classList.remove('hidden');
  } else {
    slot.innerHTML = '';
    slot.classList.add('hidden');
  }

  // Render kartu jadwal 3 hari secara dinamis sesuai konfigurasi tanggal & jadwal admin
  const timeline = $('#home-timeline');
  if (timeline) {
    timeline.innerHTML = ui.cfg.days.map(dayObj => {
      const dayMatches = matches.filter(m => Number(m.day) === Number(dayObj.day));
      const roundGroups = new Map();
      for (const m of dayMatches) {
        if (!roundGroups.has(m.round)) roundGroups.set(m.round, []);
        roundGroups.get(m.round).push(m);
      }

      const itemsHtml = [];
      for (const [roundName, rMatches] of roundGroups.entries()) {
        if (roundName === 'Semifinals' && rMatches.length === 2) {
          rMatches.forEach((sm, idx) => {
            itemsHtml.push(`<li><span>Semifinal ${idx + 1} (${escapeHtml(sm.id)})</span><span>${escapeHtml(sm.time)} WIB &middot; ${escapeHtml(sm.format)}</span></li>`);
          });
        } else if (roundName === '3rd Place Match' || roundName === 'Grand Final') {
          const m = rMatches[0];
          itemsHtml.push(`<li><span>${escapeHtml(roundName)} (${escapeHtml(m.id)})</span><span>${escapeHtml(m.time)} WIB &middot; ${escapeHtml(m.format)}</span></li>`);
        } else {
          const times = [...new Set(rMatches.map(m => m.time))];
          const kloters = [...new Set(rMatches.map(m => m.kloter).filter(Boolean))];
          const timeText = times.length > 1 ? `${times[0]} – ${times[times.length - 1]} WIB` : `${times[0] || ''} WIB`;
          const kloterLabel = kloters.length > 1 ? ` (Kloter ${kloters.join(' & ')})` : '';
          const fmt = rMatches[0]?.format || 'BO1';
          itemsHtml.push(`<li><span>${escapeHtml(roundName)}${escapeHtml(kloterLabel)}</span><span>${escapeHtml(timeText)} &middot; ${escapeHtml(fmt)}</span></li>`);
        }
      }
      if (dayMatches.some(m => m.stream)) {
        itemsHtml.push(`<li><span>Status</span><span>Live Broadcast</span></li>`);
      }

      return `<div class="card">
        <div class="day-num">${escapeHtml(ui.t.day.toUpperCase())} ${dayObj.day} &middot; ${escapeHtml(dayObj.date.toUpperCase())}</div>
        <h3>${escapeHtml(dayObj.title)}</h3>
        <ul>${itemsHtml.join('')}</ul>
      </div>`;
    }).join('');
  }
}

/* ---------- Bracket (Challonge style, Dynamic Structure) ---------- */
function computeLayout(matches) {
  const positions = new Map();
  const mainRounds = [];
  for (const m of matches) {
    if (m.round !== '3rd Place Match' && !mainRounds.includes(m.round)) {
      mainRounds.push(m.round);
    }
  }
  const byRound = (rName) => matches.filter(m => m.round === rName);
  const r0 = mainRounds[0] ? byRound(mainRounds[0]) : [];
  const r1 = mainRounds[1] ? byRound(mainRounds[1]) : [];
  const hasPartialPrelim = mainRounds.length >= 2 && r0.length < 2 * r1.length;

  let slotHeight = SLOT_HEIGHT;

  if (hasPartialPrelim) {
    const r1ById = new Map(r1.map(m => [m.id, m]));
    const hasDoubleFeeder = r1.some(m => m.s0?.w && m.s1?.w);
    if (r1.length <= 2) slotHeight = 148;
    else if (r1.length <= 4) slotHeight = 136;
    else if (r1.length <= 8) slotHeight = 128;
    else if (r1.length <= 16) slotHeight = hasDoubleFeeder ? 128 : 108;
    else slotHeight = hasDoubleFeeder ? 124 : 92;

    r1.forEach((match, index) => {
      positions.set(match.id, { col: 1, cy: TOP_OFFSET + index * slotHeight + slotHeight / 2 });
    });
    r0.forEach((match, index) => {
      const target = match.next ? positions.get(match.next.m) : null;
      const targetMatch = match.next ? r1ById.get(match.next.m) : null;
      const bothFeeders = Boolean(targetMatch && targetMatch.s0?.w && targetMatch.s1?.w);
      const offset = bothFeeders ? (CARD_HEIGHT + 12) / 2 : 13;
      const cy = target ? (target.cy + (match.next.slot === 0 ? -offset : offset)) : (TOP_OFFSET + index * slotHeight + slotHeight / 2);
      positions.set(match.id, { col: 0, cy });
    });
    for (let col = 2; col < mainRounds.length; col++) {
      const roundMatches = byRound(mainRounds[col]);
      roundMatches.forEach((match, idx) => {
        const f0 = match.s0 && (match.s0.w || match.s0.l) ? positions.get(match.s0.w || match.s0.l) : null;
        const f1 = match.s1 && (match.s1.w || match.s1.l) ? positions.get(match.s1.w || match.s1.l) : null;
        const fallback = TOP_OFFSET + idx * slotHeight * Math.pow(2, col - 1) + slotHeight / 2;
        const cy = (f0 && f1) ? (f0.cy + f1.cy) / 2 : (f0 ? f0.cy : (f1 ? f1.cy : fallback));
        positions.set(match.id, { col, cy });
      });
    }
  } else {
    if (r0.length <= 2) slotHeight = 148;
    else if (r0.length <= 8) slotHeight = 128;
    else if (r0.length <= 16) slotHeight = 104;
    else slotHeight = 84;

    r0.forEach((match, index) => {
      positions.set(match.id, { col: 0, cy: TOP_OFFSET + index * slotHeight + slotHeight / 2 });
    });
    for (let col = 1; col < mainRounds.length; col++) {
      const roundMatches = byRound(mainRounds[col]);
      roundMatches.forEach((match, idx) => {
        const f0 = match.s0 && (match.s0.w || match.s0.l) ? positions.get(match.s0.w || match.s0.l) : null;
        const f1 = match.s1 && (match.s1.w || match.s1.l) ? positions.get(match.s1.w || match.s1.l) : null;
        const fallback = TOP_OFFSET + idx * slotHeight * Math.pow(2, col) + slotHeight / 2;
        const cy = (f0 && f1) ? (f0.cy + f1.cy) / 2 : (f0 ? f0.cy : (f1 ? f1.cy : fallback));
        positions.set(match.id, { col, cy });
      });
    }
  }

  const gfMatch = matches.find(m => m.round === 'Grand Final');
  const thirdMatch = matches.find(m => m.round === '3rd Place Match');
  if (thirdMatch) {
    const gfPos = gfMatch ? positions.get(gfMatch.id) : { col: Math.max(0, mainRounds.length - 1), cy: 200 };
    positions.set(thirdMatch.id, { col: gfPos.col, cy: gfPos.cy + 120 });
  }

  let maxCy = 240;
  for (const pos of positions.values()) {
    if (pos.cy > maxCy) maxCy = pos.cy;
  }

  const labels = mainRounds.map(r => (r === 'Grand Final' ? 'Finals' : r));
  const totalHeight = Math.max(maxCy + 84, 360);
  return { positions, labels, totalHeight };
}

function rowHtml(match, slot) {
  const teamId = match.teams[slot];
  const name = displayName(teamId);
  let state = '';
  if (match.done) state = match.winnerSlot === slot ? 'win' : 'lose';
  return `<div class="row ${state}" data-team="${teamId || ''}">
    <span class="seed">${seedOf(teamId)}</span>
    <span class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
    <span class="mark">${match.done && match.winnerSlot === slot ? 'W' : ''}</span>
  </div>`;
}

function renderBracket() {
  const stage = $('#bracket-stage');
  const matches = [...ui.resolved.values()];
  const { positions, labels, totalHeight } = computeLayout(matches);
  const width = COLUMN_STEP * Math.max(labels.length, 1) + 40;
  const height = totalHeight;

  const bracketSub = $('#bracket-sub');
  if (bracketSub) {
    const n = Math.max(2, ui.teamsList.length);
    const k = Math.pow(2, Math.ceil(Math.log2(n)));
    const byes = k - n;
    bracketSub.textContent = `Single Elimination · ${n} Tim · Bagan ${k} Slot${byes > 0 ? ` (${byes} BYE)` : ''} · ${matches.length} Laga · ${ui.cfg.datesBanner}`;
  }

  const jumps = $('#round-jumps');
  if (jumps) {
    jumps.innerHTML = labels.map((label, col) => `<button type="button" class="round-jump" data-jump-col="${col}">${escapeHtml(label)}</button>`).join('');
  }

  let cards = labels.map((label, col) => `<div class="round-label" style="left:${col * COLUMN_STEP + 42}px">${escapeHtml(label)}</div>`).join('');
  const paths = [];
  ui.connectors = [];

  for (const match of matches) {
    const position = positions.get(match.id);
    if (!position) continue;
    const left = position.col * COLUMN_STEP + 16;
    const top = position.cy - CARD_HEIGHT / 2;
    const number = match.id.replace('M', '');
    if (match.round === 'Grand Final' || match.round === '3rd Place Match') {
      const tagText = `${match.round} (${match.format})`;
      cards += `<div class="match-tag" style="left:${left + 26}px;top:${top - 18}px">${escapeHtml(tagText)}</div>`;
    }
    cards += `<div class="match ${match.stream ? 'stream' : ''}" data-match="${match.id}" style="left:${left}px;top:${top}px">
      <span class="match-no">${number}</span>
      <div class="match-box">${rowHtml(match, 0)}${rowHtml(match, 1)}</div>
    </div>`;

    if (match.round === '3rd Place Match') continue;
    [match.s0, match.s1].forEach((definition, slot) => {
      if (!definition || !definition.w) return;
      const feeder = ui.resolved.get(definition.w);
      const from = positions.get(definition.w);
      if (!feeder || !from) return;
      const x1 = from.col * COLUMN_STEP + 16 + CARD_WIDTH;
      const x2 = left + 26;
      const y2 = top + (slot === 0 ? 13 : 39);
      const mid = x1 + (x2 - x1) / 2;
      const teamId = feeder.done ? feeder.teams[feeder.winnerSlot] : '';
      paths.push(`<path data-team="${teamId}" d="M${x1} ${from.cy} H${mid} V${y2} H${x2}"/>`);
    });
  }

  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  stage.style.zoom = ui.zoom;
  const zoomNode = $('#zoom-level');
  if (zoomNode) zoomNode.textContent = `${Math.round(ui.zoom * 100)}%`;
  stage.innerHTML = `<svg class="bracket-svg" width="${width}" height="${height}">${paths.join('')}</svg>${cards}`;
  applyBracketSearch();
}

function highlightTeam(teamId) {
  document.querySelectorAll('#bracket-stage .row').forEach(row => row.classList.toggle('lit', Boolean(teamId) && row.dataset.team === teamId));
  document.querySelectorAll('#bracket-stage path').forEach(path => path.classList.toggle('lit', Boolean(teamId) && path.dataset.team === teamId));
}

function applyBracketSearch() {
  const query = $('#bracket-search').value.trim().toLowerCase();
  document.querySelectorAll('#bracket-stage .match').forEach(card => {
    if (!query) { card.classList.remove('dim'); return; }
    const match = ui.resolved.get(card.dataset.match);
    const hit = match && match.teams.some(teamId => displayName(teamId).toLowerCase().includes(query));
    card.classList.toggle('dim', !hit);
  });
}

function setupBracketInteractions() {
  const stage = $('#bracket-stage');
  const shell = $('#bracket-shell');
  stage.addEventListener('mouseover', event => {
    const row = event.target.closest('.row');
    highlightTeam(row ? row.dataset.team : '');
  });
  stage.addEventListener('mouseleave', () => highlightTeam(''));
  stage.addEventListener('click', event => {
    const card = event.target.closest('.match');
    if (card && !shell.dataset.moved) openMatch(card.dataset.match);
  });

  const setZoom = (value) => {
    ui.zoom = Math.min(1.6, Math.max(0.4, Math.round(value * 100) / 100));
    stage.style.zoom = ui.zoom;
    const zoomNode = $('#zoom-level');
    if (zoomNode) zoomNode.textContent = `${Math.round(ui.zoom * 100)}%`;
  };
  $('#zoom-in').addEventListener('click', () => setZoom(ui.zoom + 0.1));
  $('#zoom-out').addEventListener('click', () => setZoom(ui.zoom - 0.1));
  $('#zoom-reset').addEventListener('click', () => { setZoom(window.innerWidth < 640 ? 0.75 : 1); shell.scrollTo({ left: 0, top: 0 }); });
  $('#bracket-search').addEventListener('input', applyBracketSearch);

  const jumps = $('#round-jumps');
  if (jumps) {
    jumps.addEventListener('click', event => {
      const btn = event.target.closest('[data-jump-col]');
      if (!btn) return;
      const col = Number(btn.dataset.jumpCol) || 0;
      shell.scrollTo({ left: col * COLUMN_STEP * ui.zoom, behavior: 'smooth' });
    });
  }

  let drag = null;
  shell.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') return;
    drag = { x: event.clientX, y: event.clientY, left: shell.scrollLeft, top: shell.scrollTop };
    delete shell.dataset.moved;
  });
  window.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { shell.dataset.moved = '1'; shell.classList.add('dragging'); }
    shell.scrollLeft = drag.left - dx;
    shell.scrollTop = drag.top - dy;
  });
  window.addEventListener('pointerup', () => {
    drag = null;
    shell.classList.remove('dragging');
    setTimeout(() => delete shell.dataset.moved, 0);
  });
}

/* ---------- Match modal ---------- */
function openMatch(matchId) {
  const match = ui.resolved.get(matchId);
  if (!match) return;
  $('#modal-eyebrow').textContent = `${match.round} · ${ui.t.day} ${match.day} · ${match.date}`;
  $('#modal-title').textContent = `Match ${match.id.replace('M', '')} · ${match.format}`;
  const team = (slot) => {
    const teamId = match.teams[slot];
    const name = displayName(teamId) || ui.t.tbd;
    const win = match.done && match.winnerSlot === slot;
    return `<div class="modal-team ${win ? 'win' : ''}"><span class="seed-lg" style="width:28px;text-align:center;font-family:var(--font-mono);font-size:12px;color:var(--muted)">${seedOf(teamId)}</span><strong>${escapeHtml(name)}</strong>${win ? `<span class="pill">${escapeHtml(ui.t.winner)}</span>` : ''}</div>`;
  };
  const next = match.next ? `<span>${escapeHtml(ui.t.nextMatch)}: Match ${match.next.m.replace('M', '')}</span>` : '';
  $('#modal-body').innerHTML = `${team(0)}${team(1)}<div class="modal-info"><span>${escapeHtml(match.date)} · ${escapeHtml(match.time)} WIB${match.kloter ? ` · Kloter ${match.kloter}` : ''}</span>${next}${match.stream ? `<span>${escapeHtml(ui.t.live)}</span>` : ''}</div>`;
  $('#modal').classList.add('open');
}

function closeModal() { $('#modal').classList.remove('open'); }

/* ---------- Schedule ---------- */
function listItemHtml(match) {
  const team = (slot) => {
    const name = displayName(match.teams[slot]);
    const win = match.done && match.winnerSlot === slot;
    return `<div class="list-team ${win ? 'win' : ''} ${name ? '' : 'empty'}"><span>${escapeHtml(name || ui.t.tbd)}</span><span>${win ? 'W' : ''}</span></div>`;
  };
  return `<div class="list-item" data-match="${match.id}">
    <div class="list-meta"><span>M${match.id.replace('M', '')} · ${escapeHtml(match.date)} · ${escapeHtml(match.time)}${match.kloter ? ` · K${match.kloter}` : ''}</span><span>${match.stream ? `<span class="pill">${escapeHtml(ui.t.live)}</span>` : escapeHtml(match.format)}</span></div>
    ${team(0)}${team(1)}
  </div>`;
}

function renderSchedule() {
  const scheduleSub = $('#schedule-sub');
  if (scheduleSub) scheduleSub.textContent = `${ui.cfg.datesBanner} · WIB`;

  $('#day-tabs').innerHTML = ui.cfg.days.map(d => `<button class="tab ${ui.day === d.day ? 'active' : ''}" data-day="${d.day}">${escapeHtml(ui.t.day)} ${d.day} · ${escapeHtml(d.date)}</button>`).join('');
  const groups = new Map();
  [...ui.resolved.values()].filter(match => Number(match.day) === Number(ui.day)).forEach(match => {
    const key = `${match.round}|${match.date}|${match.time}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  });
  $('#schedule-list').innerHTML = [...groups.entries()].map(([key, matches]) => {
    const [round, date, time] = key.split('|');
    return `<div class="round-block"><h3>${escapeHtml(round)}<span>${escapeHtml(date)} · ${escapeHtml(time)} WIB · ${escapeHtml(matches[0].format)}</span></h3><div class="list">${matches.map(listItemHtml).join('')}</div></div>`;
  }).join('');
}

/* ---------- Teams ---------- */
function renderTeams() {
  const teamsSub = $('#teams-sub');
  if (teamsSub) teamsSub.textContent = `${ui.teamsList.length}`;
  const filters = [['all', ui.t.filterAll], ['active', ui.t.filterActive], ['out', ui.t.filterOut]];
  $('#team-tabs').innerHTML = filters.map(([key, label]) => `<button class="tab ${ui.teamFilter === key ? 'active' : ''}" data-filter="${key}">${escapeHtml(label)}</button>`).join('');
  const out = eliminatedTeams(ui.resolved);
  const query = ($('#team-search')?.value || '').trim().toLowerCase();
  const list = ui.teamsList.filter(team => {
    if (ui.teamFilter === 'active' && out.has(team.id)) return false;
    if (ui.teamFilter === 'out' && !out.has(team.id)) return false;
    if (query) {
      const name = displayName(team.id).toLowerCase();
      const seedStr = `${team.seed} ${team.id.toLowerCase()}`;
      if (!name.includes(query) && !seedStr.includes(query)) return false;
    }
    return true;
  });
  $('#team-grid').innerHTML = list.map(team => {
    const name = displayName(team.id);
    return `<div class="team-card ${out.has(team.id) ? 'out' : ''}">
      <span class="seed-lg">${team.seed}</span>
      <div style="min-width:0;flex:1"><strong class="${name ? '' : 'empty'}">${escapeHtml(name || ui.t.emptySlot)}</strong>
      <small>${escapeHtml(team.initialRound)} · M${escapeHtml(team.entryMatch.replace('M', ''))} · ${escapeHtml(team.initialDate)} · ${escapeHtml(team.initialTime)}${team.hasBye ? ' · BYE' : ''}</small></div>
    </div>`;
  }).join('');
}

/* ---------- Rules ---------- */
function renderRules() {
  const query = $('#rules-search').value.trim().toLowerCase();
  const chapters = TOURNAMENT_RULES.map(chapter => ({
    ...chapter,
    items: chapter.items.filter(item => !query || `${chapter.title} ${item.title} ${item.text}`.toLowerCase().includes(query))
  })).filter(chapter => chapter.items.length);
  $('#rules-toc').innerHTML = TOURNAMENT_RULES.map(chapter => `<a href="#rules" data-chapter="${chapter.id}">${chapter.chapter} · ${escapeHtml(chapter.title)}</a>`).join('');
  $('#rules-body').innerHTML = chapters.map(chapter => `<article class="chapter" id="${chapter.id}">
    <div class="chapter-tag">${chapter.chapter}</div><h3>${escapeHtml(chapter.title)}</h3><p>${escapeHtml(chapter.summary)}</p>
    ${chapter.items.map(item => `<div class="clause"><b>${item.number}</b><div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.text)}</p></div></div>`).join('')}
  </article>`).join('');
}

/* ---------- Stream ---------- */
const CHANNELS_CONFIG = [
  {
    key: 'youtube',
    name: 'YouTube Live',
    color: '#ef4444',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>'
  },
  {
    key: 'instagram',
    name: 'Instagram Live',
    color: '#e1306c',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>'
  },
  {
    key: 'tiktok',
    name: 'TikTok Live',
    color: '#06b6d4',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.3 6.3 0 0 0 1.87-4.49V8.82a8.28 8.28 0 0 0 4.9 1.58V6.95a4.83 4.83 0 0 1-1-.26z"/></svg>'
  },
  {
    key: 'twitch',
    name: 'Twitch',
    color: '#9333ea',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.149 0l-1.612 4.119v16.036h5.051v3.845h3.819l3.842-3.845h4.821l5.93-5.928V0H2.149zm19.641 13.411l-3.568 3.568h-5.051l-3.328 3.328v-3.328H5.661V1.9h16.129v11.511z"/><path d="M10.866 5.228h2.378v6.892h-2.378zm5.952 0h2.378v6.892h-2.378z"/></svg>'
  },
  {
    key: 'prism',
    name: 'PRISM Live',
    color: '#0d9488',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polygon points="2 17 12 22 22 17 12 12 2 17"/><polygon points="2 12 12 17 22 12 12 7 2 12"/></svg>'
  }
];

function channelsMarkup() {
  const streams = ui.data.streams || {};
  return CHANNELS_CONFIG.map(ch => {
    const url = (streams[ch.key] || '').trim();
    const isActive = Boolean(url && url.length > 5);
    const tag = isActive ? 'a' : 'div';
    const hrefAttr = isActive ? `href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"` : 'aria-disabled="true"';
    const statusPill = isActive
      ? `<span class="pill-live"><i></i>${escapeHtml(ui.t.liveActive || 'LIVE')}</span>`
      : `<span class="pill-offline">${escapeHtml(ui.t.liveInactive || 'OFFLINE')}</span>`;
    const actionText = isActive
      ? `${escapeHtml(ui.t.openStream || 'Buka Siaran')} &rarr;`
      : `${escapeHtml(ui.t.streamOffline || 'Siaran tidak aktif')}`;

    return `
      <${tag} class="channel-card ${isActive ? 'active' : 'inactive'}" ${hrefAttr}>
        <div class="channel-head">
          <div class="channel-brand">
            <span class="channel-icon" style="color:${ch.color}">${ch.svg}</span>
            <span>${escapeHtml(ch.name)}</span>
          </div>
          ${statusPill}
        </div>
        <div class="channel-action">
          <span>${actionText}</span>
        </div>
      </${tag}>
    `;
  }).join('');
}

function renderStream() {
  const html = channelsMarkup();
  const container = $('#channels-grid');
  if (container) container.innerHTML = html;
  const homeContainer = $('#home-channels-grid');
  if (homeContainer) homeContainer.innerHTML = html;

  const heroBtn = $('#hero-stream-btn');
  if (heroBtn) {
    const streams = ui.data.streams || {};
    const firstActive = Object.values(streams).find(u => u && u.trim().length > 5);
    if (firstActive) {
      heroBtn.href = firstActive;
      heroBtn.style.pointerEvents = 'auto';
      heroBtn.style.opacity = '1';
    } else {
      heroBtn.removeAttribute('href');
      heroBtn.style.pointerEvents = 'none';
      heroBtn.style.opacity = '0.5';
    }
  }

  $('#stream-list').innerHTML = [...ui.resolved.values()].filter(match => match.stream).map(listItemHtml).join('');
}

/* ---------- Data sync ---------- */
function setSync(mode) {
  const node = $('#sync');
  node.className = `sync ${mode}`;
  node.title = mode === 'online' ? 'Online' : 'Offline';
}

async function syncData() {
  try {
    ui.data = await fetchRemote();
    writeCache(ui.data);
    setSync('online');
  } catch {
    setSync('offline');
  }
  renderAll();
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ---------- Boot ---------- */
function boot() {
  const select = $('#lang-select');
  select.innerHTML = LANGUAGES.map(item => `<option value="${item.code}">${item.label}</option>`).join('');
  select.value = ui.lang;

  const setLang = (code) => {
    ui.lang = code;
    select.value = code;
    localStorage.setItem('uajm_lang', ui.lang);
    applyLanguage();
    renderAll();
  };

  select.addEventListener('change', () => setLang(select.value));
  document.querySelectorAll('[data-quick-lang]').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.quickLang));
  });

  $('#theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('uajm_theme', next);
  });

  document.addEventListener('click', event => {
    const dayTab = event.target.closest('[data-day]');
    if (dayTab) { ui.day = Number(dayTab.dataset.day); renderSchedule(); return; }
    const filterTab = event.target.closest('[data-filter]');
    if (filterTab) { ui.teamFilter = filterTab.dataset.filter; renderTeams(); return; }
    const chapterLink = event.target.closest('[data-chapter]');
    if (chapterLink) { event.preventDefault(); document.getElementById(chapterLink.dataset.chapter)?.scrollIntoView({ behavior: 'smooth' }); return; }
    const item = event.target.closest('.list-item, .stage-card');
    if (item && item.dataset.match) openMatch(item.dataset.match);
  });

  $('#team-search')?.addEventListener('input', renderTeams);
  $('#rules-search').addEventListener('input', renderRules);
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', event => { if (event.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
  window.addEventListener('hashchange', applyRoute);

  applyLanguage();
  applyRoute();
  setupBracketInteractions();
  renderAll();
  syncData();
  subscribeRemote(data => {
    ui.data = data;
    writeCache(data);
    setSync('online');
    renderAll();
    showToast('Live update');
  });
}

boot();
