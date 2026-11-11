import { BRACKET_MATCHES } from './bracket-data.js';
import { TEAMS_DATA } from './teams-data.js';
import { TOURNAMENT_RULES } from './rules-data.js';
import { LANGUAGES, RTL_LANGUAGES, getDictionary } from './i18n.js';
import {
  readCache, writeCache, fetchRemote, subscribeRemote,
  resolveMatches, eliminatedTeams, teamName, teamMeta, escapeHtml
} from './core.js';

const ROUTES = ['home', 'bracket', 'schedule', 'teams', 'rules', 'stream'];
const CARD_WIDTH = 234;
const CARD_HEIGHT = 52;
const COLUMN_STEP = 290;
const TOP_OFFSET = 56;
const SLOT_HEIGHT = 128;

const ui = {
  data: readCache(),
  resolved: null,
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
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = ui.t[node.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.placeholder = ui.t[node.dataset.i18nPlaceholder]; });
  $('#lang-select').setAttribute('aria-label', ui.t.language);
  $('#theme-btn').setAttribute('aria-label', ui.t.theme);
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
  const meta = teamMeta(teamId);
  return meta ? meta.seed : '';
}

function renderAll() {
  ui.resolved = resolveMatches(ui.data);
  renderLanding();
  renderBracket();
  renderSchedule();
  renderTeams();
  renderRules();
  renderStream();
}

/* ---------- Landing ---------- */
function renderLanding() {
  const done = [...ui.resolved.values()].filter(match => match.done).length;
  $('#stat-done').textContent = done;
  const final = ui.resolved.get('M58');
  const slot = $('#champion-slot');
  if (final && final.done) {
    const champion = displayName(final.teams[final.winnerSlot]);
    slot.innerHTML = `<div class="card champion"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2-1.2.5-2 2-2 3.8M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg><div><small>${escapeHtml(ui.t.winner)} &middot; Grand Final</small><strong>${escapeHtml(champion)}</strong></div></div>`;
    slot.classList.remove('hidden');
  } else {
    slot.innerHTML = '';
    slot.classList.add('hidden');
  }
}

/* ---------- Bracket (Challonge style) ---------- */
function computeLayout() {
  const positions = new Map();
  const roundOf32 = BRACKET_MATCHES.filter(match => match.round === 'Round of 32');
  roundOf32.forEach((match, index) => {
    positions.set(match.id, { col: 1, cy: TOP_OFFSET + index * SLOT_HEIGHT + SLOT_HEIGHT / 2 });
  });
  BRACKET_MATCHES.filter(match => match.round === 'Round 1').forEach(match => {
    const target = positions.get(match.next.m);
    const offset = (CARD_HEIGHT + 12) / 2;
    positions.set(match.id, { col: 0, cy: target.cy + (match.next.slot === 0 ? -offset : offset) });
  });
  const columnFor = { 'Round of 16': 2, Quarterfinals: 3, Semifinals: 4, 'Grand Final': 5 };
  BRACKET_MATCHES.filter(match => columnFor[match.round] !== undefined).forEach(match => {
    const feeders = [match.s0, match.s1].map(item => positions.get(item.w));
    positions.set(match.id, { col: columnFor[match.round], cy: (feeders[0].cy + feeders[1].cy) / 2 });
  });
  const grandFinal = positions.get('M58');
  positions.set('M57', { col: 5, cy: grandFinal.cy + 150 });
  return positions;
}

const LAYOUT = computeLayout();

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
  const width = COLUMN_STEP * 6 + 40;
  const height = TOP_OFFSET + SLOT_HEIGHT * 16 + 40;
  const labels = ['Round 1', 'Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Finals'];
  let cards = labels.map((label, col) => `<div class="round-label" style="left:${col * COLUMN_STEP + 42}px">${label}</div>`).join('');
  const paths = [];
  ui.connectors = [];

  for (const match of ui.resolved.values()) {
    const position = LAYOUT.get(match.id);
    const left = position.col * COLUMN_STEP + 16;
    const top = position.cy - CARD_HEIGHT / 2;
    const number = match.id.replace('M', '');
    cards += `<div class="match ${match.stream ? 'stream' : ''}" data-match="${match.id}" style="left:${left}px;top:${top}px">
      <span class="match-no">${number}</span>
      <div class="match-box">${rowHtml(match, 0)}${rowHtml(match, 1)}</div>
    </div>`;

    if (match.id === 'M57') continue;
    [match.s0, match.s1].forEach((definition, slot) => {
      if (!definition.w) return;
      const feeder = ui.resolved.get(definition.w);
      const from = LAYOUT.get(definition.w);
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
    const hit = match.teams.some(teamId => displayName(teamId).toLowerCase().includes(query));
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
  };
  $('#zoom-in').addEventListener('click', () => setZoom(ui.zoom + 0.1));
  $('#zoom-out').addEventListener('click', () => setZoom(ui.zoom - 0.1));
  $('#zoom-reset').addEventListener('click', () => { setZoom(window.innerWidth < 640 ? 0.75 : 1); shell.scrollTo({ left: 0, top: 0 }); });
  $('#bracket-search').addEventListener('input', applyBracketSearch);

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
  $('#modal-body').innerHTML = `${team(0)}${team(1)}<div class="modal-info"><span>${match.time} WIB${match.kloter ? ` · Kloter ${match.kloter}` : ''}</span>${next}${match.stream ? `<span>${escapeHtml(ui.t.live)}</span>` : ''}</div>`;
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
    <div class="list-meta"><span>M${match.id.replace('M', '')} · ${match.time}${match.kloter ? ` · K${match.kloter}` : ''}</span><span>${match.stream ? `<span class="pill">${escapeHtml(ui.t.live)}</span>` : match.format}</span></div>
    ${team(0)}${team(1)}
  </div>`;
}

function renderSchedule() {
  $('#day-tabs').innerHTML = [1, 2, 3].map(day => `<button class="tab ${ui.day === day ? 'active' : ''}" data-day="${day}">${escapeHtml(ui.t.day)} ${day}</button>`).join('');
  const groups = new Map();
  [...ui.resolved.values()].filter(match => match.day === ui.day).forEach(match => {
    const key = `${match.round}|${match.time}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  });
  $('#schedule-list').innerHTML = [...groups.entries()].map(([key, matches]) => {
    const [round, time] = key.split('|');
    return `<div class="round-block"><h3>${round}<span>${time} WIB · ${matches[0].format}</span></h3><div class="list">${matches.map(listItemHtml).join('')}</div></div>`;
  }).join('');
}

/* ---------- Teams ---------- */
function renderTeams() {
  const filters = [['all', ui.t.filterAll], ['active', ui.t.filterActive], ['out', ui.t.filterOut]];
  $('#team-tabs').innerHTML = filters.map(([key, label]) => `<button class="tab ${ui.teamFilter === key ? 'active' : ''}" data-filter="${key}">${escapeHtml(label)}</button>`).join('');
  const out = eliminatedTeams(ui.resolved);
  const list = TEAMS_DATA.filter(team => {
    if (ui.teamFilter === 'active') return !out.has(team.id);
    if (ui.teamFilter === 'out') return out.has(team.id);
    return true;
  });
  $('#team-grid').innerHTML = list.map(team => {
    const name = displayName(team.id);
    return `<div class="team-card ${out.has(team.id) ? 'out' : ''}">
      <span class="seed-lg">${team.seed}</span>
      <div style="min-width:0"><strong class="${name ? '' : 'empty'}">${escapeHtml(name || ui.t.emptySlot)}</strong>
      <small>${team.initialRound} · M${team.entryMatch.replace('M', '')} · ${team.initialTime}${team.hasBye ? ' · BYE' : ''}</small></div>
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
function renderStream() {
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
  select.addEventListener('change', () => {
    ui.lang = select.value;
    localStorage.setItem('uajm_lang', ui.lang);
    applyLanguage();
    renderAll();
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
    const item = event.target.closest('.list-item');
    if (item) openMatch(item.dataset.match);
  });

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
