import {
  DB_ROOT, readCache, writeCache, fetchRemote, subscribeRemote,
  resolveMatches, getActiveMatches, getActiveTeams, normalizeConfig, defaultConfig,
  teamName, teamMeta, downstreamMatches, formatIsoDateId, padTeamId, escapeHtml
} from '../core.js';

// Akun panitia disimpan sebagai hash SHA-256 dari "uajm-esport:<username>:<password>".
const ACCOUNT_HASHES = {
  athallah: '697684fefde11876927a3278268f5e991ef060fcf19eda3506509de002a9f97d',
  putra: '0d17d2cbf4eaefb03b9f95a65471eddd82f241aa5d34c47740f9826122adaf2d',
  nayrbryanGaming: '6f3d799f654a8ee3d7f3f0019f002185bb09831820f0d06a31e89f7f1a1bb3d2',
  nayrbryaGaming: '7a6378bac310002782c40b675645804009d38753f91d6bf281a53e7b0221a764',
  anneliese: '7b8b8fec48fe0afc70afe1f57f5c2e64963e9b1ca6d5307134b031421632a488'
};
const SESSION_KEY = 'uajm_admin_user';

const admin = {
  data: readCache(),
  round: 'all',
  schedRound: 'all',
  structRound: 'all'
};
const $ = (selector) => document.querySelector(selector);

async function sha256(text) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function setSync(online) {
  $('#sync').className = `sync ${online ? 'online' : 'offline'}`;
}

/* ---------- Auth ---------- */
async function handleLogin(event) {
  event.preventDefault();
  const username = $('#login-user').value.trim();
  const password = $('#login-pass').value;
  const expected = ACCOUNT_HASHES[username];
  const digest = await sha256(`uajm-esport:${username}:${password}`);
  if (!expected || digest !== expected) {
    $('#login-error').textContent = 'Nama pengguna atau kata sandi salah.';
    $('#login-pass').value = '';
    return;
  }
  sessionStorage.setItem(SESSION_KEY, username);
  $('#login-error').textContent = '';
  enterPanel(username);
}

function enterPanel(username) {
  $('#who').textContent = username;
  $('#login-view').classList.add('hidden');
  $('#panel-view').classList.remove('hidden');
  loadData();
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

/* ---------- Data ---------- */
async function loadData() {
  try {
    admin.data = await fetchRemote();
    writeCache(admin.data);
    setSync(true);
  } catch {
    setSync(false);
    showToast('Gagal terhubung ke database, memakai data lokal');
  }
  renderAllPanels();
}

function renderAllPanels() {
  admin.data.config = normalizeConfig(admin.data.config);
  populateRoundSelects();
  renderTeams();
  renderSchedulePanel();
  renderStructurePanel();
  renderResults();
  renderStreams();
}

function populateRoundSelects() {
  const matches = getActiveMatches(admin.data);
  const rounds = [...new Set(matches.map(m => m.round))];
  ['#round-filter', '#sched-round-filter', '#struct-round-filter'].forEach(sel => {
    const node = $(sel);
    if (!node) return;
    const prev = node.value || 'all';
    node.innerHTML = `<option value="all">Semua babak</option>` +
      rounds.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    node.value = rounds.includes(prev) ? prev : 'all';
  });
}

async function remoteWrite(path, method, body) {
  const response = await fetch(`${DB_ROOT}/${path}.json`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

/* ---------- Tab 1: Team names & Challonge Bracket Sizing ---------- */
function describeChallongeTopology(teamCount, thirdPlace = true) {
  const n = Math.max(2, Math.min(128, Math.round(Number(teamCount) || 58)));
  const k = Math.pow(2, Math.ceil(Math.log2(n)));
  const byes = k - n;
  const playInCount = n - (k / 2);
  const totalMatches = (n - 1) + (thirdPlace && n >= 4 ? 1 : 0);
  const byeInfo = byes > 0 ? `${byes} BYE (Seed 1${byes > 1 ? `–${byes}` : ''})` : '0 BYE (Bagan Penuh)';
  const playInInfo = playInCount > 0 ? `${playInCount} laga Round 1` : 'Langsung Babak Utama';
  return {
    n, k, byes, playInCount, totalMatches,
    summary: `Ukuran Bracket: ${n} Tim · Pohon Bagan: ${k} Slot · ${byeInfo} · ${playInInfo} · Total: ${totalMatches} Pertandingan`
  };
}

function getSlotTeamsForConfig(state, cfg) {
  return getActiveTeams({
    ...state,
    config: { ...cfg, autoFitTeams: false }
  });
}

function renderTeams() {
  const cfg = normalizeConfig(admin.data.config);
  const teams = getSlotTeamsForConfig(admin.data, cfg);
  const filledCount = teams.filter(t => Boolean(teamName(admin.data, t.id))).length;
  const topo = describeChallongeTopology(cfg.teamCount, cfg.thirdPlace);

  const summaryEl = $('#teams-bracket-summary');
  if (summaryEl) {
    summaryEl.textContent = `${topo.summary} · Tim Terisi: ${filledCount}/${cfg.teamCount}`;
  }
  const quickCountEl = $('#team-count-quick');
  if (quickCountEl) quickCountEl.value = cfg.teamCount;
  const autoFitEl = $('#cfg-auto-fit');
  if (autoFitEl) autoFitEl.checked = cfg.autoFitTeams !== false;

  document.querySelectorAll('[data-quick-preset]').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.quickPreset) === cfg.teamCount);
  });

  $('#team-edit').innerHTML = teams.map(team => `<label>
    <span class="seed-lg">${team.seed}</span>
    <input data-team="${team.id}" data-seed="${team.seed}" maxlength="40" placeholder="Nama tim Seed ${team.seed}..." value="${escapeHtml(teamName(admin.data, team.id))}" aria-label="Nama tim seed ${team.seed}">
    <small>${escapeHtml(team.entryMatch)}${team.hasBye ? ' BYE' : ''}</small>
    ${cfg.teamCount > 2 ? `<button type="button" class="team-del" data-remove-seed="${team.seed}" title="Hapus slot Seed ${team.seed} dan sesuaikan bracket">&times;</button>` : ''}
  </label>`).join('');
}

function collectTeamNames() {
  const names = {};
  document.querySelectorAll('#team-edit input[data-team]').forEach(input => {
    const value = input.value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
    if (value) names[input.dataset.team] = value;
  });
  return names;
}

function collectOrderedInputValues() {
  const inputs = [...document.querySelectorAll('#team-edit input[data-team]')];
  if (!inputs.length) {
    const cfg = normalizeConfig(admin.data.config);
    const list = [];
    for (let s = 1; s <= cfg.teamCount; s++) {
      list.push(teamName(admin.data, padTeamId(s)));
    }
    return list;
  }
  return inputs.map(input => input.value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40));
}

async function resizeBracketSlots(targetCount, { keepAutoFit = null, toastPrefix = '' } = {}) {
  const cfg = normalizeConfig(admin.data.config);
  const newCount = Math.max(2, Math.min(128, Math.round(Number(targetCount) || cfg.teamCount)));
  const currentValues = collectOrderedInputValues();
  const nextTeams = {};
  for (let i = 0; i < newCount; i++) {
    const val = (currentValues[i] || '').trim();
    if (val) nextTeams[padTeamId(i + 1)] = val;
  }
  const filledCount = Object.keys(nextTeams).length;
  cfg.teamCount = newCount;
  cfg.customStructure = newCount !== 58;
  cfg.matchOverrides = {};
  if (keepAutoFit !== null) {
    cfg.autoFitTeams = Boolean(keepAutoFit);
  } else if (filledCount >= 2 && filledCount !== newCount) {
    // Jika admin memilih jumlah slot spesifik yang berbeda dari jumlah tim terisi saat ini, kunci ke jumlah slot pilihan admin
    cfg.autoFitTeams = false;
  }

  admin.data.teams = nextTeams;
  admin.data.config = cfg;
  writeCache(admin.data);
  renderAllPanels();
  try {
    await Promise.all([
      remoteWrite('config', 'PUT', cfg),
      remoteWrite('teams', 'PUT', nextTeams)
    ]);
    setSync(true);
    const topo = describeChallongeTopology(newCount, cfg.thirdPlace);
    showToast(`${toastPrefix ? `${toastPrefix} · ` : ''}Bracket disesuaikan ke ${newCount} tim (${topo.byes} BYE, ${topo.totalMatches} laga)`);
  } catch {
    setSync(false);
    showToast(`Ukuran bracket diubah ke ${newCount} tim (tersimpan lokal)`);
  }
}

async function removeTeamSlot(seedIndex) {
  const cfg = normalizeConfig(admin.data.config);
  if (cfg.teamCount <= 2) {
    showToast('Minimal harus ada 2 tim di dalam bracket');
    return;
  }
  const values = collectOrderedInputValues();
  const idx = Number(seedIndex) - 1;
  if (idx < 0 || idx >= values.length) return;
  values.splice(idx, 1);
  const newCount = Math.max(2, values.length);
  const nextTeams = {};
  values.forEach((val, i) => {
    if (val) nextTeams[padTeamId(i + 1)] = val;
  });
  cfg.teamCount = newCount;
  cfg.customStructure = newCount !== 58;
  cfg.matchOverrides = {};
  admin.data.teams = nextTeams;
  admin.data.config = cfg;
  writeCache(admin.data);
  renderAllPanels();
  try {
    await Promise.all([
      remoteWrite('config', 'PUT', cfg),
      remoteWrite('teams', 'PUT', nextTeams)
    ]);
    setSync(true);
    showToast(`Seed ${seedIndex} dihapus · Bracket kini ${newCount} tim`);
  } catch {
    setSync(false);
  }
}

async function fitBracketToFilledTeams() {
  const values = collectOrderedInputValues().filter(Boolean);
  if (values.length < 2) {
    showToast('Isi minimal 2 nama tim terlebih dahulu untuk menyesuaikan ukuran bracket');
    return;
  }
  const newCount = Math.min(128, values.length);
  const nextTeams = {};
  values.slice(0, newCount).forEach((val, idx) => {
    nextTeams[padTeamId(idx + 1)] = val;
  });
  const cfg = normalizeConfig(admin.data.config);
  cfg.teamCount = newCount;
  cfg.customStructure = newCount !== 58;
  cfg.autoFitTeams = true;
  cfg.matchOverrides = {};
  admin.data.teams = nextTeams;
  admin.data.config = cfg;
  writeCache(admin.data);
  renderAllPanels();
  try {
    await Promise.all([
      remoteWrite('config', 'PUT', cfg),
      remoteWrite('teams', 'PUT', nextTeams)
    ]);
    setSync(true);
    showToast(`Bracket otomatis disesuaikan ke ${newCount} tim terisi`);
  } catch {
    setSync(false);
  }
}

async function shuffleTeamNamesQuick() {
  const values = collectOrderedInputValues();
  const filled = values.filter(Boolean);
  if (filled.length < 2) {
    showToast('Minimal 2 nama tim harus terisi untuk mengacak urutan seed');
    return;
  }
  for (let i = filled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filled[i], filled[j]] = [filled[j], filled[i]];
  }
  const nextTeams = {};
  filled.forEach((val, idx) => {
    nextTeams[padTeamId(idx + 1)] = val;
  });
  admin.data.teams = nextTeams;
  writeCache(admin.data);
  renderAllPanels();
  try {
    await remoteWrite('teams', 'PUT', nextTeams);
    setSync(true);
    showToast(`Urutan seed ${filled.length} tim berhasil diacak`);
  } catch {
    setSync(false);
  }
}

async function saveTeams() {
  const cfg = normalizeConfig(admin.data.config);
  const autoFit = Boolean($('#cfg-auto-fit')?.checked);
  const quickCountRaw = Number($('#team-count-quick')?.value || cfg.teamCount);
  const ordered = collectOrderedInputValues();
  const filled = ordered.filter(Boolean);

  let targetCount = Math.max(2, Math.min(128, Math.round(quickCountRaw)));
  let names = {};

  if (autoFit && filled.length >= 2) {
    targetCount = Math.min(128, filled.length);
    filled.slice(0, targetCount).forEach((val, idx) => {
      names[padTeamId(idx + 1)] = val;
    });
  } else {
    names = collectTeamNames();
  }

  const sizeChanged = targetCount !== cfg.teamCount;
  cfg.teamCount = targetCount;
  cfg.customStructure = targetCount !== 58;
  cfg.autoFitTeams = autoFit;
  if (sizeChanged) {
    cfg.matchOverrides = {};
  }

  admin.data.teams = names;
  admin.data.config = cfg;
  writeCache(admin.data);
  try {
    await Promise.all([
      remoteWrite('teams', 'PUT', names),
      remoteWrite('config', 'PUT', cfg)
    ]);
    setSync(true);
    const topo = describeChallongeTopology(cfg.teamCount, cfg.thirdPlace);
    showToast(`${Object.keys(names).length} tim tersimpan · Bracket: ${cfg.teamCount} slot (${topo.byes} BYE, ${topo.totalMatches} laga)`);
  } catch {
    setSync(false);
    showToast('Gagal menyimpan ke database');
  }
  renderAllPanels();
}

function applyBulk() {
  const rawLines = $('#bulk-text').value.split(/\r?\n/).map(line => line.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40));
  const nonEmpty = rawLines.filter(Boolean);
  const cfg = normalizeConfig(admin.data.config);
  const autoFit = $('#cfg-auto-fit')?.checked !== false;

  if (autoFit && nonEmpty.length >= 2) {
    const newCount = Math.max(2, Math.min(128, nonEmpty.length));
    const nextTeams = {};
    nonEmpty.slice(0, newCount).forEach((val, idx) => {
      nextTeams[padTeamId(idx + 1)] = val;
    });
    cfg.teamCount = newCount;
    cfg.customStructure = newCount !== 58;
    cfg.matchOverrides = {};
    admin.data.teams = nextTeams;
    admin.data.config = cfg;
    renderAllPanels();
    showToast(`Diterapkan ${newCount} tim & ukuran bracket disesuaikan ke ${newCount} slot. Klik Simpan untuk menerbitkan.`);
    return;
  }

  document.querySelectorAll('#team-edit input[data-team]').forEach((input, index) => {
    if (rawLines[index] !== undefined) input.value = rawLines[index];
  });
  showToast('Diterapkan ke form. Tekan Simpan untuk menerbitkan.');
}

/* ---------- Tab 2: Tanggal & Jadwal ---------- */
function renderSchedulePanel() {
  const cfg = normalizeConfig(admin.data.config);
  $('#cfg-dates-banner').value = cfg.datesBanner || '';

  $('#days-edit-grid').innerHTML = cfg.days.map(d => `
    <div class="day-edit-card">
      <h3>Hari ${d.day} (Day ${d.day})</h3>
      <label class="field" style="margin-bottom:4px">
        <span>Pilih dari Kalender</span>
        <input class="input" type="date" data-day-iso="${d.day}" value="${escapeHtml(d.iso || '')}">
      </label>
      <label class="field" style="margin-bottom:4px">
        <span>Teks Tanggal Tampil</span>
        <input class="input" type="text" data-day-date="${d.day}" value="${escapeHtml(d.date)}" placeholder="Contoh: 10 Nov 2026">
      </label>
      <label class="field" style="margin-bottom:0">
        <span>Judul / Fokus Hari</span>
        <input class="input" type="text" data-day-title="${d.day}" value="${escapeHtml(d.title)}" placeholder="Contoh: Round 1 → Quarterfinals">
      </label>
    </div>
  `).join('');

  const dayOptions = (selectedDay) => cfg.days.map(d =>
    `<option value="${d.day}" ${Number(selectedDay) === Number(d.day) ? 'selected' : ''}>Hari ${d.day}</option>`
  ).join('');

  const fmtOptions = (selectedFmt) => ['BO1', 'BO3', 'BO5', 'BO7'].map(f =>
    `<option value="${f}" ${selectedFmt === f ? 'selected' : ''}>${f}</option>`
  ).join('');

  $('#round-schedule-list').innerHTML = Object.values(cfg.roundSchedule).map(rs => `
    <div class="round-sched-row">
      <strong>${escapeHtml(rs.label)}</strong>
      <select class="select" data-rs-day="${rs.key}" aria-label="Hari ${escapeHtml(rs.label)}">${dayOptions(rs.day)}</select>
      <input class="input" type="text" data-rs-date="${rs.key}" value="${escapeHtml(rs.date || '')}" placeholder="Ikut tanggal Hari">
      <input class="input" type="text" data-rs-time="${rs.key}" value="${escapeHtml(rs.time)}" placeholder="18.30">
      <select class="select" data-rs-format="${rs.key}" aria-label="Format ${escapeHtml(rs.label)}">${fmtOptions(rs.format)}</select>
      <label class="chk-inline"><input type="checkbox" data-rs-stream="${rs.key}" ${rs.stream ? 'checked' : ''}> Live</label>
    </div>
  `).join('');

  renderMatchDatesList();
}

function renderMatchDatesList() {
  const cfg = normalizeConfig(admin.data.config);
  const resolved = resolveMatches(admin.data);
  const all = [...resolved.values()];
  const list = all.filter(m => admin.schedRound === 'all' || m.round === admin.schedRound);

  const dayOptions = (selectedDay) => cfg.days.map(d =>
    `<option value="${d.day}" ${Number(selectedDay) === Number(d.day) ? 'selected' : ''}>Hari ${d.day}</option>`
  ).join('');

  const fmtOptions = (selectedFmt) => ['BO1', 'BO3', 'BO5', 'BO7'].map(f =>
    `<option value="${f}" ${selectedFmt === f ? 'selected' : ''}>${f}</option>`
  ).join('');

  const kloterOptions = (selectedKloter) => [
    ['', 'Tanpa Kloter'],
    ['1', 'Kloter 1'],
    ['2', 'Kloter 2'],
    ['3', 'Kloter 3']
  ].map(([val, lbl]) => `<option value="${val}" ${String(selectedKloter || '') === val ? 'selected' : ''}>${lbl}</option>`).join('');

  $('#match-dates-list').innerHTML = list.map(m => {
    const t0 = m.teams[0] ? (teamName(admin.data, m.teams[0]) || `Seed ${teamMeta(m.teams[0], admin.data)?.seed}`) : 'TBD';
    const t1 = m.teams[1] ? (teamName(admin.data, m.teams[1]) || `Seed ${teamMeta(m.teams[1], admin.data)?.seed}`) : 'TBD';
    return `<div class="match-date-row" data-match-row="${m.id}">
      <span class="meta"><strong>${m.id}</strong> · ${escapeHtml(m.round)}</span>
      <span style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t0)} vs ${escapeHtml(t1)}</span>
      <select class="select" data-md-day="${m.id}">${dayOptions(m.day)}</select>
      <input class="input" type="date" data-md-cal="${m.id}" title="Pilih tanggal dari kalender">
      <input class="input" type="text" data-md-date="${m.id}" value="${escapeHtml(m.date)}" placeholder="10 Nov 2026">
      <input class="input" type="text" data-md-time="${m.id}" value="${escapeHtml(m.time)}" placeholder="18.30">
      <div style="display:flex;gap:4px">
        <select class="select" data-md-kloter="${m.id}" style="padding:0 6px">${kloterOptions(m.kloter)}</select>
        <select class="select" data-md-format="${m.id}" style="padding:0 6px">${fmtOptions(m.format)}</select>
      </div>
    </div>`;
  }).join('');
}

function buildBannerFromDays(days) {
  if (!days || !days.length) return '10 – 12 NOV 2026';
  const first = days[0].date || '';
  const last = days[days.length - 1].date || '';
  if (first === last) return first.toUpperCase();
  const fParts = first.split(' ');
  const lParts = last.split(' ');
  if (fParts.length === 3 && lParts.length === 3 && fParts[1] === lParts[1] && fParts[2] === lParts[2]) {
    return `${fParts[0]} – ${lParts[0]} ${lParts[1].toUpperCase()} ${lParts[2]}`;
  }
  return `${first.toUpperCase()} – ${last.toUpperCase()}`;
}

async function saveScheduleConfig() {
  const cfg = normalizeConfig(admin.data.config);

  cfg.days = cfg.days.map(d => {
    const isoNode = $(`[data-day-iso="${d.day}"]`);
    const dateNode = $(`[data-day-date="${d.day}"]`);
    const titleNode = $(`[data-day-title="${d.day}"]`);
    const iso = isoNode ? isoNode.value.trim() : d.iso;
    const date = dateNode && dateNode.value.trim() ? dateNode.value.trim() : (formatIsoDateId(iso) || d.date);
    const title = titleNode && titleNode.value.trim() ? titleNode.value.trim() : d.title;
    return { day: d.day, iso, date, title };
  });

  const bannerInput = $('#cfg-dates-banner').value.trim();
  cfg.datesBanner = bannerInput || buildBannerFromDays(cfg.days);

  for (const key of Object.keys(cfg.roundSchedule)) {
    const dayEl = $(`[data-rs-day="${key}"]`);
    const dateEl = $(`[data-rs-date="${key}"]`);
    const timeEl = $(`[data-rs-time="${key}"]`);
    const fmtEl = $(`[data-rs-format="${key}"]`);
    const streamEl = $(`[data-rs-stream="${key}"]`);
    if (dayEl) cfg.roundSchedule[key].day = Number(dayEl.value) || cfg.roundSchedule[key].day;
    if (dateEl) cfg.roundSchedule[key].date = dateEl.value.trim();
    if (timeEl && timeEl.value.trim()) cfg.roundSchedule[key].time = timeEl.value.trim();
    if (fmtEl) cfg.roundSchedule[key].format = fmtEl.value;
    if (streamEl) cfg.roundSchedule[key].stream = Boolean(streamEl.checked);
  }

  // Simpan juga perubahan per-pertandingan yang sedang tampil
  document.querySelectorAll('[data-match-row]').forEach(row => {
    const mId = row.dataset.matchRow;
    const dayVal = Number($(`[data-md-day="${mId}"]`)?.value || 1);
    const dateVal = ($(`[data-md-date="${mId}"]`)?.value || '').trim();
    const timeVal = ($(`[data-md-time="${mId}"]`)?.value || '').trim();
    const kloterRaw = $(`[data-md-kloter="${mId}"]`)?.value ?? '';
    const fmtVal = $(`[data-md-format="${mId}"]`)?.value || 'BO1';

    cfg.matchOverrides[mId] = {
      ...(cfg.matchOverrides[mId] || {}),
      day: dayVal,
      date: dateVal,
      time: timeVal,
      kloter: kloterRaw ? Number(kloterRaw) : null,
      format: fmtVal
    };
  });

  admin.data.config = cfg;
  writeCache(admin.data);
  try {
    await remoteWrite('config', 'PUT', cfg);
    setSync(true);
    showToast('Tanggal & jadwal pertandingan berhasil disimpan');
  } catch {
    setSync(false);
    showToast('Disimpan di lokal (gagal terhubung ke server)');
  }
  renderAllPanels();
}

async function resetScheduleDefault() {
  if (!confirm('Reset semua pengaturan tanggal & jadwal ke default (10–12 Nov 2026)?')) return;
  const def = defaultConfig();
  const cfg = normalizeConfig(admin.data.config);
  cfg.datesBanner = def.datesBanner;
  cfg.days = def.days;
  cfg.roundSchedule = def.roundSchedule;
  // Hapus override tanggal/jam namun pertahankan override slot s0/s1 jika ada
  for (const mId of Object.keys(cfg.matchOverrides)) {
    const ov = cfg.matchOverrides[mId];
    if (ov) {
      delete ov.day;
      delete ov.date;
      delete ov.time;
      delete ov.kloter;
      delete ov.format;
      if (Object.keys(ov).length === 0) delete cfg.matchOverrides[mId];
    }
  }
  admin.data.config = cfg;
  writeCache(admin.data);
  try {
    await remoteWrite('config', 'PUT', cfg);
    setSync(true);
    showToast('Jadwal berhasil direset ke default');
  } catch {
    setSync(false);
  }
  renderAllPanels();
}

/* ---------- Tab 3: Struktur Pertandingan ---------- */
function encodeSlotValue(slotObj) {
  if (!slotObj || typeof slotObj !== 'object') return '';
  if (slotObj.t) return `t:${slotObj.t}`;
  if (slotObj.w) return `w:${slotObj.w}`;
  if (slotObj.l) return `l:${slotObj.l}`;
  return '';
}

function decodeSlotValue(val) {
  if (!val || typeof val !== 'string') return null;
  const [kind, id] = val.split(':');
  if (kind === 't' && id) return { t: id };
  if (kind === 'w' && id) return { w: id };
  if (kind === 'l' && id) return { l: id };
  return null;
}

function renderStructurePanel() {
  const cfg = normalizeConfig(admin.data.config);
  $('#cfg-team-count').value = cfg.teamCount;
  $('#cfg-structure-mode').value = (cfg.teamCount === 58 && !cfg.customStructure) ? 'challonge58' : 'auto';
  $('#cfg-third-place').value = String(cfg.thirdPlace);

  const topo = describeChallongeTopology(cfg.teamCount, cfg.thirdPlace);
  const structSummary = $('#structure-summary');
  if (structSummary) {
    structSummary.textContent = topo.summary;
  }

  document.querySelectorAll('[data-team-preset]').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.teamPreset) === cfg.teamCount);
  });

  renderMatchStructureList();
}

function renderMatchStructureList() {
  const cfg = normalizeConfig(admin.data.config);
  const matches = getActiveMatches(admin.data);
  const list = matches.filter(m => admin.structRound === 'all' || m.round === admin.structRound);

  const teamOptions = [];
  for (let s = 1; s <= cfg.teamCount; s++) {
    const tId = padTeamId(s);
    const tName = teamName(admin.data, tId);
    teamOptions.push({ val: `t:${tId}`, label: `Seed ${s} (${tId})${tName ? ` - ${tName}` : ''}` });
  }
  const winnerOptions = matches.map(m => ({ val: `w:${m.id}`, label: `Pemenang ${m.id} (${m.round})` }));
  const loserOptions = matches.map(m => ({ val: `l:${m.id}`, label: `Kalah ${m.id} (${m.round})` }));

  const buildSelectOptions = (currentSlot) => {
    const cur = encodeSlotValue(currentSlot);
    const renderOptGroup = (title, items) => `<optgroup label="${escapeHtml(title)}">` +
      items.map(it => `<option value="${escapeHtml(it.val)}" ${it.val === cur ? 'selected' : ''}>${escapeHtml(it.label)}</option>`).join('') +
      `</optgroup>`;
    return renderOptGroup('Slot Tim (Seed)', teamOptions) +
      renderOptGroup('Pemenang Pertandingan', winnerOptions) +
      renderOptGroup('Kalah Pertandingan', loserOptions);
  };

  const fmtOptions = (selectedFmt) => ['BO1', 'BO3', 'BO5', 'BO7'].map(f =>
    `<option value="${f}" ${selectedFmt === f ? 'selected' : ''}>${f}</option>`
  ).join('');

  const kloterOptions = (selectedKloter) => [
    ['', 'Tanpa Kloter'],
    ['1', 'Kloter 1'],
    ['2', 'Kloter 2'],
    ['3', 'Kloter 3']
  ].map(([val, lbl]) => `<option value="${val}" ${String(selectedKloter || '') === val ? 'selected' : ''}>${lbl}</option>`).join('');

  $('#match-structure-list').innerHTML = list.map(m => `
    <div class="match-edit-row" data-struct-row="${m.id}">
      <span class="meta"><strong>${m.id}</strong> · ${escapeHtml(m.round)}<br>${escapeHtml(m.date)} · ${escapeHtml(m.time)}</span>
      <select class="select" data-ms-s0="${m.id}" aria-label="Slot 1 ${m.id}">${buildSelectOptions(m.s0)}</select>
      <button class="btn btn-ghost btn-sm" type="button" data-swap-slots="${m.id}" title="Tukar posisi Slot 1 dan Slot 2">&#8646;</button>
      <select class="select" data-ms-s1="${m.id}" aria-label="Slot 2 ${m.id}">${buildSelectOptions(m.s1)}</select>
      <select class="select" data-ms-format="${m.id}" aria-label="Format ${m.id}">${fmtOptions(m.format)}</select>
      <select class="select" data-ms-kloter="${m.id}" aria-label="Kloter ${m.id}">${kloterOptions(m.kloter)}</select>
      <label class="chk-inline"><input type="checkbox" data-ms-stream="${m.id}" ${m.stream ? 'checked' : ''}> Live</label>
    </div>
  `).join('');
}

async function saveStructureConfig() {
  const cfg = normalizeConfig(admin.data.config);
  const newCount = Math.max(2, Math.min(128, Math.round(Number($('#cfg-team-count').value) || 58)));
  const modeVal = $('#cfg-structure-mode').value;
  const newCustom = newCount !== 58 || modeVal === 'auto';
  const newThird = $('#cfg-third-place').value === 'true';

  const structureTopologyChanged = (newCount !== cfg.teamCount) || (newCustom !== cfg.customStructure) || (newThird !== cfg.thirdPlace);

  cfg.teamCount = newCount;
  cfg.customStructure = newCustom;
  cfg.thirdPlace = newThird;

  if (structureTopologyChanged) {
    // Jika ukuran bracket berubah, bersihkan override s0/s1 lama agar struktur pohon baru bersih
    cfg.matchOverrides = {};
    const filledCount = Object.values(admin.data.teams || {}).filter(v => typeof v === 'string' && v.trim()).length;
    if (filledCount >= 2 && filledCount !== newCount) {
      cfg.autoFitTeams = false;
    }
  } else {
    document.querySelectorAll('[data-struct-row]').forEach(row => {
      const mId = row.dataset.structRow;
      const s0Val = decodeSlotValue($(`[data-ms-s0="${mId}"]`)?.value);
      const s1Val = decodeSlotValue($(`[data-ms-s1="${mId}"]`)?.value);
      const fmtVal = $(`[data-ms-format="${mId}"]`)?.value || 'BO1';
      const kloterRaw = $(`[data-ms-kloter="${mId}"]`)?.value ?? '';
      const streamVal = Boolean($(`[data-ms-stream="${mId}"]`)?.checked);

      cfg.matchOverrides[mId] = {
        ...(cfg.matchOverrides[mId] || {}),
        s0: s0Val,
        s1: s1Val,
        format: fmtVal,
        kloter: kloterRaw ? Number(kloterRaw) : null,
        stream: streamVal
      };
    });
  }

  admin.data.config = cfg;
  writeCache(admin.data);
  try {
    await remoteWrite('config', 'PUT', cfg);
    setSync(true);
    const topo = describeChallongeTopology(cfg.teamCount, cfg.thirdPlace);
    showToast(`Struktur disimpan: ${cfg.teamCount} tim (${topo.byes} BYE, ${topo.totalMatches} laga)`);
  } catch {
    setSync(false);
    showToast('Disimpan di lokal (gagal terhubung ke server)');
  }
  renderAllPanels();
}

async function shuffleSeeds() {
  if (!confirm('Acak urutan posisi seluruh tim di dalam struktur bracket?')) return;
  const cfg = normalizeConfig(admin.data.config);
  const matches = getActiveMatches(admin.data);

  // Kumpulkan semua slot tim langsung (t: Txx) pada bracket aktif
  const teamSlots = [];
  matches.forEach(m => {
    if (m.s0?.t) teamSlots.push({ mId: m.id, key: 's0', t: m.s0.t, other: m.s1 });
    if (m.s1?.t) teamSlots.push({ mId: m.id, key: 's1', t: m.s1.t, other: m.s0 });
  });

  const pool = teamSlots.map(item => item.t);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const byMatch = new Map(matches.map(m => [m.id, { s0: { ...m.s0 }, s1: { ...m.s1 } }]));
  teamSlots.forEach((slotInfo, idx) => {
    const entry = byMatch.get(slotInfo.mId);
    entry[slotInfo.key] = { t: pool[idx] };
  });

  for (const [mId, pair] of byMatch.entries()) {
    cfg.matchOverrides[mId] = {
      ...(cfg.matchOverrides[mId] || {}),
      s0: pair.s0,
      s1: pair.s1
    };
  }

  admin.data.config = cfg;
  writeCache(admin.data);
  try {
    await remoteWrite('config', 'PUT', cfg);
    setSync(true);
    showToast('Urutan posisi tim di bracket berhasil diacak');
  } catch {
    setSync(false);
  }
  renderAllPanels();
}

async function resetStructureDefault() {
  if (!confirm('Reset struktur pertandingan kembali ke default 58 Tim Challonge?')) return;
  const def = defaultConfig();
  const cfg = normalizeConfig(admin.data.config);
  cfg.teamCount = def.teamCount;
  cfg.customStructure = def.customStructure;
  cfg.thirdPlace = def.thirdPlace;
  cfg.matchOverrides = {};
  admin.data.config = cfg;
  writeCache(admin.data);
  try {
    await remoteWrite('config', 'PUT', cfg);
    setSync(true);
    showToast('Struktur pertandingan direset ke default 58 tim');
  } catch {
    setSync(false);
  }
  renderAllPanels();
}

/* ---------- Tab 4: Results ---------- */
function renderResults() {
  const resolved = resolveMatches(admin.data);
  const all = [...resolved.values()];
  $('#done-count').textContent = `${all.filter(match => match.done).length} / ${all.length} selesai`;
  const list = all.filter(match => admin.round === 'all' || match.round === admin.round);
  $('#result-list').innerHTML = list.map(match => {
    const ready = match.teams[0] && match.teams[1];
    const pick = (slot) => {
      const teamId = match.teams[slot];
      const meta = teamMeta(teamId, admin.data);
      const label = teamId ? (teamName(admin.data, teamId) || `Seed ${meta?.seed || ''} (belum diisi)`) : 'Menunggu';
      return `<button class="pick ${match.winnerSlot === slot ? 'on' : ''}" type="button" data-match="${match.id}" data-slot="${slot}" ${ready ? '' : 'disabled'}>${escapeHtml(label)}</button>`;
    };
    return `<div class="result-row">
      <span class="meta">${match.id} · ${escapeHtml(match.round)}<br>${escapeHtml(match.date)} · ${escapeHtml(match.time)} · ${escapeHtml(match.format)}</span>
      ${pick(0)}${pick(1)}
      <button class="btn btn-ghost btn-sm" type="button" data-reset="${match.id}" ${match.done ? '' : 'disabled'}>Reset</button>
    </div>`;
  }).join('');
}

async function setWinner(matchId, slot) {
  const current = admin.data.results[matchId];
  if (current && current.w === slot) return;
  const cleared = current ? downstreamMatches(matchId, admin.data).filter(id => admin.data.results[id]) : [];
  admin.data.results[matchId] = { w: slot, at: Date.now() };
  cleared.forEach(id => delete admin.data.results[id]);
  writeCache(admin.data);
  renderResults();
  try {
    await remoteWrite(`results/${matchId}`, 'PUT', admin.data.results[matchId]);
    await Promise.all(cleared.map(id => remoteWrite(`results/${id}`, 'DELETE')));
    setSync(true);
    showToast(`${matchId} tersimpan`);
  } catch {
    setSync(false);
    showToast('Gagal menyimpan ke database');
  }
}

async function resetMatch(matchId) {
  const affected = [matchId, ...downstreamMatches(matchId, admin.data)].filter(id => admin.data.results[id]);
  if (affected.length > 1 && !confirm(`Reset ${matchId} juga akan menghapus hasil: ${affected.slice(1).join(', ')}. Lanjutkan?`)) return;
  affected.forEach(id => delete admin.data.results[id]);
  writeCache(admin.data);
  renderResults();
  try {
    await Promise.all(affected.map(id => remoteWrite(`results/${id}`, 'DELETE')));
    setSync(true);
    showToast(`${affected.length} hasil direset`);
  } catch {
    setSync(false);
    showToast('Gagal menghapus di database');
  }
}

/* ---------- Tab 5: Streams Management ---------- */
function renderStreams() {
  const s = admin.data.streams || {};
  $('#stream-youtube').value = s.youtube || '';
  $('#stream-instagram').value = s.instagram || '';
  $('#stream-tiktok').value = s.tiktok || '';
  $('#stream-twitch').value = s.twitch || '';
  $('#stream-prism').value = s.prism || '';
}

async function saveStreams() {
  const streams = {
    youtube: ($('#stream-youtube').value || '').trim(),
    instagram: ($('#stream-instagram').value || '').trim(),
    tiktok: ($('#stream-tiktok').value || '').trim(),
    twitch: ($('#stream-twitch').value || '').trim(),
    prism: ($('#stream-prism').value || '').trim()
  };
  admin.data.streams = streams;
  writeCache(admin.data);
  try {
    await remoteWrite('streams', 'PUT', streams);
    setSync(true);
    showToast('Link siaran langsung berhasil disimpan');
  } catch {
    setSync(false);
    showToast('Gagal menyimpan ke database');
  }
}

/* ---------- Boot ---------- */
function boot() {
  $('#login-form').addEventListener('submit', handleLogin);
  $('#logout').addEventListener('click', logout);
  $('#theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('uajm_theme', next);
  });

  const panels = ['teams', 'schedule', 'structure', 'results', 'streams'];
  document.querySelectorAll('[data-panel]').forEach(tab => tab.addEventListener('click', () => {
    const target = tab.dataset.panel;
    document.querySelectorAll('[data-panel]').forEach(other => other.classList.toggle('active', other === tab));
    panels.forEach(p => $(`#panel-${p}`)?.classList.toggle('hidden', p !== target));
    renderAllPanels();
  }));

  // Tab 1: Teams & Challonge Bracket Size Controls
  $('#save-teams').addEventListener('click', saveTeams);
  $('#bulk-toggle').addEventListener('click', () => $('#bulk-box').classList.toggle('hidden'));
  $('#bulk-apply').addEventListener('click', applyBulk);
  $('#clear-teams').addEventListener('click', () => {
    if (!confirm('Kosongkan semua nama tim di form? Perubahan baru terbit setelah Simpan.')) return;
    document.querySelectorAll('#team-edit input[data-team]').forEach(input => { input.value = ''; });
  });
  $('#team-dec')?.addEventListener('click', () => {
    const cur = Number($('#team-count-quick')?.value || normalizeConfig(admin.data.config).teamCount);
    resizeBracketSlots(cur - 1, { toastPrefix: '-1 slot tim' });
  });
  $('#team-inc')?.addEventListener('click', () => {
    const cur = Number($('#team-count-quick')?.value || normalizeConfig(admin.data.config).teamCount);
    resizeBracketSlots(cur + 1, { toastPrefix: '+1 slot tim' });
  });
  $('#fit-filled-teams')?.addEventListener('click', fitBracketToFilledTeams);
  $('#shuffle-teams-quick')?.addEventListener('click', shuffleTeamNamesQuick);
  $('#team-count-quick')?.addEventListener('change', event => {
    resizeBracketSlots(event.target.value);
  });
  $('#cfg-auto-fit')?.addEventListener('change', async event => {
    const cfg = normalizeConfig(admin.data.config);
    cfg.autoFitTeams = Boolean(event.target.checked);
    admin.data.config = cfg;
    writeCache(admin.data);
    try {
      await remoteWrite('config', 'PUT', cfg);
      setSync(true);
    } catch {
      setSync(false);
    }
  });
  document.querySelectorAll('[data-quick-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const count = Number(btn.dataset.quickPreset) || 58;
      resizeBracketSlots(count, { toastPrefix: `Preset ${count} Tim` });
    });
  });
  $('#team-edit').addEventListener('click', event => {
    const delBtn = event.target.closest('[data-remove-seed]');
    if (!delBtn) return;
    event.preventDefault();
    removeTeamSlot(Number(delBtn.dataset.removeSeed));
  });

  // Tab 2: Schedule & Dates
  $('#save-schedule').addEventListener('click', saveScheduleConfig);
  $('#save-schedule-rounds').addEventListener('click', saveScheduleConfig);
  $('#save-match-dates').addEventListener('click', saveScheduleConfig);
  $('#reset-schedule').addEventListener('click', resetScheduleDefault);

  $('#sync-banner-dates').addEventListener('click', () => {
    const days = [1, 2, 3].map(d => ({
      day: d,
      date: ($(`[data-day-date="${d}"]`)?.value || '').trim()
    }));
    $('#cfg-dates-banner').value = buildBannerFromDays(days);
    showToast('Label rentang tanggal diperbarui dari Hari 1–3');
  });

  $('#days-edit-grid').addEventListener('input', event => {
    const isoInput = event.target.closest('[data-day-iso]');
    if (isoInput) {
      const dayNum = isoInput.dataset.dayIso;
      const formatted = formatIsoDateId(isoInput.value);
      if (formatted) {
        const dateInput = $(`[data-day-date="${dayNum}"]`);
        if (dateInput) dateInput.value = formatted;
        document.querySelectorAll(`[data-match-row]`).forEach(row => {
          const mId = row.dataset.matchRow;
          if ($(`[data-md-day="${mId}"]`)?.value === String(dayNum)) {
            const mdDate = $(`[data-md-date="${mId}"]`);
            if (mdDate) mdDate.value = formatted;
          }
        });
        const days = [1, 2, 3].map(d => ({
          day: d,
          date: ($(`[data-day-date="${d}"]`)?.value || '').trim()
        }));
        $('#cfg-dates-banner').value = buildBannerFromDays(days);
      }
      return;
    }
    const dateInput = event.target.closest('[data-day-date]');
    if (dateInput) {
      const dayNum = dateInput.dataset.dayDate;
      const val = dateInput.value.trim();
      if (val) {
        document.querySelectorAll(`[data-match-row]`).forEach(row => {
          const mId = row.dataset.matchRow;
          if ($(`[data-md-day="${mId}"]`)?.value === String(dayNum)) {
            const mdDate = $(`[data-md-date="${mId}"]`);
            if (mdDate) mdDate.value = val;
          }
        });
      }
    }
  });

  $('#sched-round-filter').addEventListener('change', event => {
    admin.schedRound = event.target.value;
    renderMatchDatesList();
  });

  $('#match-dates-list').addEventListener('input', event => {
    const cal = event.target.closest('[data-md-cal]');
    if (cal) {
      const mId = cal.dataset.mdCal;
      const formatted = formatIsoDateId(cal.value);
      if (formatted) {
        const txt = $(`[data-md-date="${mId}"]`);
        if (txt) txt.value = formatted;
      }
    }
  });

  // Tab 3: Structure
  $('#save-structure').addEventListener('click', saveStructureConfig);
  $('#save-match-structure').addEventListener('click', saveStructureConfig);
  $('#shuffle-seeds').addEventListener('click', shuffleSeeds);
  $('#reset-structure').addEventListener('click', resetStructureDefault);

  $('#cfg-team-count')?.addEventListener('change', () => {
    const count = Number($('#cfg-team-count').value) || 58;
    $('#cfg-structure-mode').value = count === 58 ? 'challonge58' : 'auto';
    saveStructureConfig();
  });
  $('#cfg-structure-mode')?.addEventListener('change', saveStructureConfig);
  $('#cfg-third-place')?.addEventListener('change', saveStructureConfig);

  document.querySelectorAll('[data-team-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const count = Number(btn.dataset.teamPreset) || 58;
      $('#cfg-team-count').value = count;
      $('#cfg-structure-mode').value = count === 58 ? 'challonge58' : 'auto';
      saveStructureConfig();
    });
  });

  $('#struct-round-filter').addEventListener('change', event => {
    admin.structRound = event.target.value;
    renderMatchStructureList();
  });

  $('#match-structure-list').addEventListener('click', event => {
    const swapBtn = event.target.closest('[data-swap-slots]');
    if (!swapBtn) return;
    const mId = swapBtn.dataset.swapSlots;
    const s0 = $(`[data-ms-s0="${mId}"]`);
    const s1 = $(`[data-ms-s1="${mId}"]`);
    if (s0 && s1) {
      const tmp = s0.value;
      s0.value = s1.value;
      s1.value = tmp;
      showToast(`Slot 1 & 2 pada ${mId} ditukar. Klik Simpan Struktur Laga untuk menerbitkan.`);
    }
  });

  // Tab 4: Results
  $('#round-filter').addEventListener('change', event => { admin.round = event.target.value; renderResults(); });
  $('#result-list').addEventListener('click', event => {
    const pick = event.target.closest('[data-slot]');
    if (pick && !pick.disabled) { setWinner(pick.dataset.match, Number(pick.dataset.slot)); return; }
    const reset = event.target.closest('[data-reset]');
    if (reset && !reset.disabled) resetMatch(reset.dataset.reset);
  });

  // Tab 5: Streams
  $('#save-streams').addEventListener('click', saveStreams);
  $('#clear-streams').addEventListener('click', () => {
    if (!confirm('Kosongkan semua link siaran langsung? Channel akan berstatus offline di halaman publik.')) return;
    ['#stream-youtube', '#stream-instagram', '#stream-tiktok', '#stream-twitch', '#stream-prism'].forEach(sel => {
      $(sel).value = '';
    });
  });

  const user = sessionStorage.getItem(SESSION_KEY);
  if (user && ACCOUNT_HASHES[user]) {
    enterPanel(user);
    subscribeRemote(data => {
      admin.data = data;
      writeCache(data);
      renderAllPanels();
    });
  }
}

boot();
