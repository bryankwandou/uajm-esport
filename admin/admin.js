import { TEAMS_DATA } from '../teams-data.js';
import {
  DB_ROOT, readCache, writeCache, fetchRemote, subscribeRemote,
  resolveMatches, teamName, teamMeta, downstreamMatches, escapeHtml
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

const admin = { data: readCache(), round: 'all' };
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
  renderTeams();
  renderResults();
  renderStreams();
}

async function remoteWrite(path, method, body) {
  const response = await fetch(`${DB_ROOT}/${path}.json`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

/* ---------- Team names ---------- */
function renderTeams() {
  $('#team-edit').innerHTML = TEAMS_DATA.map(team => `<label>
    <span class="seed-lg">${team.seed}</span>
    <input data-team="${team.id}" maxlength="40" value="${escapeHtml(teamName(admin.data, team.id))}" aria-label="Nama tim seed ${team.seed}">
    <small>${team.entryMatch}${team.hasBye ? ' BYE' : ''}</small>
  </label>`).join('');
}

function collectTeamNames() {
  const names = {};
  document.querySelectorAll('#team-edit input').forEach(input => {
    const value = input.value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
    if (value) names[input.dataset.team] = value;
  });
  return names;
}

async function saveTeams() {
  const names = collectTeamNames();
  admin.data.teams = names;
  writeCache(admin.data);
  try {
    await remoteWrite('teams', 'PUT', names);
    setSync(true);
    showToast(`${Object.keys(names).length} nama tim tersimpan`);
  } catch {
    setSync(false);
    showToast('Gagal menyimpan ke database');
  }
  renderResults();
}

function applyBulk() {
  const lines = $('#bulk-text').value.split(/\r?\n/).map(line => line.trim());
  document.querySelectorAll('#team-edit input').forEach((input, index) => {
    if (lines[index] !== undefined) input.value = lines[index].slice(0, 40);
  });
  showToast('Diterapkan ke form. Tekan Simpan untuk menerbitkan.');
}

/* ---------- Streams Management ---------- */
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

/* ---------- Results ---------- */
function renderResults() {
  const resolved = resolveMatches(admin.data);
  const all = [...resolved.values()];
  $('#done-count').textContent = `${all.filter(match => match.done).length} / ${all.length} selesai`;
  const list = all.filter(match => admin.round === 'all' || match.round === admin.round);
  $('#result-list').innerHTML = list.map(match => {
    const ready = match.teams[0] && match.teams[1];
    const pick = (slot) => {
      const teamId = match.teams[slot];
      const meta = teamMeta(teamId);
      const label = teamId ? (teamName(admin.data, teamId) || `Seed ${meta.seed} (belum diisi)`) : 'Menunggu';
      return `<button class="pick ${match.winnerSlot === slot ? 'on' : ''}" data-match="${match.id}" data-slot="${slot}" ${ready ? '' : 'disabled'}>${escapeHtml(label)}</button>`;
    };
    return `<div class="result-row">
      <span class="meta">${match.id} · ${match.round}<br>${match.time} · ${match.format}</span>
      ${pick(0)}${pick(1)}
      <button class="btn btn-ghost btn-sm" data-reset="${match.id}" ${match.done ? '' : 'disabled'}>Reset</button>
    </div>`;
  }).join('');
}

async function setWinner(matchId, slot) {
  const current = admin.data.results[matchId];
  if (current && current.w === slot) return;
  const cleared = current ? downstreamMatches(matchId).filter(id => admin.data.results[id]) : [];
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
  const affected = [matchId, ...downstreamMatches(matchId)].filter(id => admin.data.results[id]);
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

/* ---------- Boot ---------- */
function boot() {
  $('#login-form').addEventListener('submit', handleLogin);
  $('#logout').addEventListener('click', logout);
  $('#theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('uajm_theme', next);
  });
  document.querySelectorAll('[data-panel]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-panel]').forEach(other => other.classList.toggle('active', other === tab));
    $('#panel-teams').classList.toggle('hidden', tab.dataset.panel !== 'teams');
    $('#panel-results').classList.toggle('hidden', tab.dataset.panel !== 'results');
    $('#panel-streams').classList.toggle('hidden', tab.dataset.panel !== 'streams');
    if (tab.dataset.panel === 'results') renderResults();
    if (tab.dataset.panel === 'streams') renderStreams();
  }));
  $('#save-teams').addEventListener('click', saveTeams);
  $('#bulk-toggle').addEventListener('click', () => $('#bulk-box').classList.toggle('hidden'));
  $('#bulk-apply').addEventListener('click', applyBulk);
  $('#clear-teams').addEventListener('click', () => {
    if (!confirm('Kosongkan semua nama tim di form? Perubahan baru terbit setelah Simpan.')) return;
    document.querySelectorAll('#team-edit input').forEach(input => { input.value = ''; });
  });

  $('#save-streams').addEventListener('click', saveStreams);
  $('#clear-streams').addEventListener('click', () => {
    if (!confirm('Kosongkan semua link siaran langsung? Channel akan berstatus offline di halaman publik.')) return;
    ['#stream-youtube', '#stream-instagram', '#stream-tiktok', '#stream-twitch', '#stream-prism'].forEach(sel => {
      $(sel).value = '';
    });
  });

  $('#round-filter').addEventListener('change', event => { admin.round = event.target.value; renderResults(); });
  $('#result-list').addEventListener('click', event => {
    const pick = event.target.closest('[data-slot]');
    if (pick && !pick.disabled) { setWinner(pick.dataset.match, Number(pick.dataset.slot)); return; }
    const reset = event.target.closest('[data-reset]');
    if (reset && !reset.disabled) resetMatch(reset.dataset.reset);
  });

  const user = sessionStorage.getItem(SESSION_KEY);
  if (user && ACCOUNT_HASHES[user]) {
    enterPanel(user);
    subscribeRemote(data => {
      admin.data = data;
      writeCache(data);
      renderResults();
      renderStreams();
    });
  }
}

boot();
