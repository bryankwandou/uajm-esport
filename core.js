// Logika inti bersama untuk halaman publik dan panel admin.
import { TOURNAMENT_INFO, BRACKET_MATCHES } from './bracket-data.js';
import { TEAMS_DATA } from './teams-data.js';

export const DB_ROOT = `${TOURNAMENT_INFO.firebaseDatabaseUrl}/uajm`;
const CACHE_KEY = 'uajm_state_v3';

export const DEFAULT_STREAMS = {
  youtube: '',
  instagram: '',
  tiktok: '',
  twitch: '',
  prism: ''
};

export function emptyState() {
  return {
    teams: {},
    results: {},
    streams: { ...DEFAULT_STREAMS }
  };
}

export function readCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        teams: parsed.teams || {},
        results: parsed.results || {},
        streams: Object.assign({ ...DEFAULT_STREAMS }, parsed.streams || {})
      };
    }
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
  return emptyState();
}

export function writeCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

export async function fetchRemote() {
  const response = await fetch(`${DB_ROOT}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) || {};
  return {
    teams: data.teams || {},
    results: data.results || {},
    streams: Object.assign({ ...DEFAULT_STREAMS }, data.streams || {})
  };
}

export function subscribeRemote(onChange) {
  if (!('EventSource' in window)) return null;
  const source = new EventSource(`${DB_ROOT}.json`);
  const refresh = () => fetchRemote().then(onChange).catch(() => {});
  source.addEventListener('put', refresh);
  source.addEventListener('patch', refresh);
  return source;
}

export function teamName(state, teamId) {
  if (!teamId) return '';
  const raw = state.teams[teamId];
  return typeof raw === 'string' ? raw.trim() : '';
}

const TEAM_INDEX = new Map(TEAMS_DATA.map(team => [team.id, team]));
export function teamMeta(teamId) {
  return TEAM_INDEX.get(teamId) || null;
}

// Mengembalikan daftar pertandingan dengan ID tim yang sudah diselesaikan.
export function resolveMatches(state) {
  const resolved = new Map();
  const slotTeam = (definition) => {
    if (!definition || typeof definition !== 'object') return null;
    if (definition.t) return definition.t;
    const source = resolved.get(definition.w || definition.l);
    if (!source || source.winnerSlot === null) return null;
    const winnerId = source.teams[source.winnerSlot];
    const loserId = source.teams[1 - source.winnerSlot];
    return definition.w ? winnerId : loserId;
  };

  for (const match of BRACKET_MATCHES) {
    const teams = [slotTeam(match.s0), slotTeam(match.s1)];
    const result = state.results[match.id];
    const slot = result && (result.w === 0 || result.w === 1) ? result.w : null;
    const winnerSlot = slot !== null && teams[slot] ? slot : null;
    resolved.set(match.id, {
      ...match,
      teams,
      winnerSlot,
      done: winnerSlot !== null,
      score: result && Array.isArray(result.score) ? result.score : null
    });
  }
  return resolved;
}

export function eliminatedTeams(resolved) {
  const out = new Set();
  for (const match of resolved.values()) {
    if (!match.done || match.nextLoser) continue;
    const loser = match.teams[1 - match.winnerSlot];
    if (loser) out.add(loser);
  }
  const third = resolved.get('M57');
  if (third && third.done) out.add(third.teams[1 - third.winnerSlot]);
  return out;
}

export function downstreamMatches(matchId) {
  const out = [];
  const queue = [matchId];
  while (queue.length) {
    const currentId = queue.shift();
    const current = BRACKET_MATCHES.find(item => item.id === currentId);
    if (!current) continue;
    for (const link of [current.next, current.nextLoser]) {
      if (link && !out.includes(link.m)) {
        out.push(link.m);
        queue.push(link.m);
      }
    }
  }
  return out;
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
