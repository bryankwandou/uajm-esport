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

export const DEFAULT_DAYS = [
  { day: 1, date: '10 Nov 2026', iso: '2026-11-10', title: 'Round 1 → Quarterfinals' },
  { day: 2, date: '11 Nov 2026', iso: '2026-11-11', title: 'Semifinals Showdown' },
  { day: 3, date: '12 Nov 2026', iso: '2026-11-12', title: '3rd Place & Grand Final' }
];

export const DEFAULT_ROUND_SCHEDULE = {
  R1_K1: { key: 'R1_K1', label: 'Round 1 (Kloter 1)', round: 'Round 1', kloter: 1, day: 1, time: '18.30', format: 'BO1', stream: false },
  R1_K2: { key: 'R1_K2', label: 'Round 1 (Kloter 2)', round: 'Round 1', kloter: 2, day: 1, time: '18.45', format: 'BO1', stream: false },
  R32_K1: { key: 'R32_K1', label: 'Round of 32 (Kloter 1)', round: 'Round of 32', kloter: 1, day: 1, time: '19.25', format: 'BO1', stream: false },
  R32_K2: { key: 'R32_K2', label: 'Round of 32 (Kloter 2)', round: 'Round of 32', kloter: 2, day: 1, time: '19.40', format: 'BO1', stream: false },
  R16: { key: 'R16', label: 'Round of 16', round: 'Round of 16', kloter: null, day: 1, time: '20.20', format: 'BO1', stream: false },
  QF: { key: 'QF', label: 'Quarterfinals', round: 'Quarterfinals', kloter: null, day: 1, time: '21.00', format: 'BO1', stream: false },
  SF1: { key: 'SF1', label: 'Semifinal 1', round: 'Semifinals', matchIndex: 0, kloter: null, day: 2, time: '18.30', format: 'BO3', stream: true },
  SF2: { key: 'SF2', label: 'Semifinal 2', round: 'Semifinals', matchIndex: 1, kloter: null, day: 2, time: '19.45', format: 'BO3', stream: true },
  THIRD: { key: 'THIRD', label: '3rd Place Match', round: '3rd Place Match', kloter: null, day: 3, time: '18.30', format: 'BO3', stream: true },
  GF: { key: 'GF', label: 'Grand Final', round: 'Grand Final', kloter: null, day: 3, time: '19.45', format: 'BO5', stream: true }
};

export function defaultConfig() {
  return {
    datesBanner: '10 – 12 NOV 2026',
    teamCount: 58,
    autoFitTeams: true,
    thirdPlace: true,
    customStructure: false,
    days: DEFAULT_DAYS.map(d => ({ ...d })),
    roundSchedule: Object.fromEntries(
      Object.entries(DEFAULT_ROUND_SCHEDULE).map(([k, v]) => [k, { ...v }])
    ),
    matchOverrides: {}
  };
}

export function normalizeConfig(raw) {
  const base = defaultConfig();
  if (!raw || typeof raw !== 'object') return base;
  if (typeof raw.datesBanner === 'string' && raw.datesBanner.trim()) {
    base.datesBanner = raw.datesBanner.trim();
  }
  if (raw.teamCount !== undefined) {
    const n = Number(raw.teamCount);
    if (Number.isFinite(n) && n >= 2 && n <= 128) base.teamCount = Math.round(n);
  }
  if (typeof raw.autoFitTeams === 'boolean') base.autoFitTeams = raw.autoFitTeams;
  if (typeof raw.thirdPlace === 'boolean') base.thirdPlace = raw.thirdPlace;
  if (typeof raw.customStructure === 'boolean') base.customStructure = raw.customStructure;

  if (Array.isArray(raw.days) && raw.days.length > 0) {
    base.days = raw.days.map((d, idx) => ({
      day: Number(d.day) || (idx + 1),
      date: typeof d.date === 'string' && d.date.trim() ? d.date.trim() : (DEFAULT_DAYS[idx]?.date || `Day ${idx + 1}`),
      iso: typeof d.iso === 'string' ? d.iso : (DEFAULT_DAYS[idx]?.iso || ''),
      title: typeof d.title === 'string' && d.title.trim() ? d.title.trim() : (DEFAULT_DAYS[idx]?.title || '')
    }));
  }

  if (raw.roundSchedule && typeof raw.roundSchedule === 'object') {
    for (const key of Object.keys(base.roundSchedule)) {
      const item = raw.roundSchedule[key];
      if (item && typeof item === 'object') {
        base.roundSchedule[key] = {
          ...base.roundSchedule[key],
          day: Number(item.day) || base.roundSchedule[key].day,
          date: typeof item.date === 'string' ? item.date.trim() : '',
          time: typeof item.time === 'string' && item.time.trim() ? item.time.trim() : base.roundSchedule[key].time,
          format: typeof item.format === 'string' && item.format.trim() ? item.format.trim() : base.roundSchedule[key].format,
          stream: typeof item.stream === 'boolean' ? item.stream : base.roundSchedule[key].stream
        };
      }
    }
  }

  if (raw.matchOverrides && typeof raw.matchOverrides === 'object') {
    base.matchOverrides = { ...raw.matchOverrides };
  }
  return base;
}

export function emptyState() {
  return {
    teams: {},
    results: {},
    streams: { ...DEFAULT_STREAMS },
    config: defaultConfig()
  };
}

export function readCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        teams: parsed.teams || {},
        results: parsed.results || {},
        streams: Object.assign({ ...DEFAULT_STREAMS }, parsed.streams || {}),
        config: normalizeConfig(parsed.config)
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
    streams: Object.assign({ ...DEFAULT_STREAMS }, data.streams || {}),
    config: normalizeConfig(data.config)
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
  const raw = state?.teams?.[teamId];
  return typeof raw === 'string' ? raw.trim() : '';
}

export function padTeamId(seed) {
  return `T${String(seed).padStart(2, '0')}`;
}

// Menghitung jumlah tim efektif berdasarkan konfigurasi & daftar tim yang diisi
export function effectiveTeamCount(state) {
  const cfg = normalizeConfig(state?.config);
  const teamsObj = state?.teams || {};
  const filledKeys = Object.keys(teamsObj).filter(k => typeof teamsObj[k] === 'string' && teamsObj[k].trim().length > 0);
  if (cfg.autoFitTeams && filledKeys.length >= 2) {
    // Cari seed tertinggi yang terisi atau jumlah tim terisi
    let maxSeed = filledKeys.length;
    for (const k of filledKeys) {
      const m = /^T(\d+)$/.exec(k);
      if (m) maxSeed = Math.max(maxSeed, Number(m[1]));
    }
    // Jika tim diisi berurutan atau tempel massal, gunakan jumlah tim yang terisi jika semua <= maxSeed
    const count = filledKeys.length;
    if (count >= 2 && count <= 128 && maxSeed === count) {
      return count;
    }
  }
  return Math.max(2, Math.min(128, cfg.teamCount || 58));
}

function roundNameForMatches(matchCount, isPreliminary) {
  if (isPreliminary) return 'Round 1';
  if (matchCount === 64) return 'Round of 128';
  if (matchCount === 32) return 'Round of 64';
  if (matchCount === 16) return 'Round of 32';
  if (matchCount === 8) return 'Round of 16';
  if (matchCount === 4) return 'Quarterfinals';
  if (matchCount === 2) return 'Semifinals';
  if (matchCount === 1) return 'Grand Final';
  return `Round (${matchCount * 2})`;
}

// Urutan seeding pohon biner standar Challonge untuk K slot (K pangkat 2)
export function challongeSeedOrder(slotCount) {
  let order = [1, 2];
  while (order.length < slotCount) {
    const sum = order.length * 2 + 1;
    const next = [];
    for (const s of order) {
      next.push(s, sum - s);
    }
    order = next;
  }
  return order;
}

// Generator Single Elimination standar Challonge untuk jumlah tim 2 s/d 128
export function generateBracketMatches(teamCount, thirdPlace = true) {
  const n = Math.max(2, Math.min(128, Math.round(Number(teamCount) || 58)));
  if (n === 2) {
    return [{
      id: 'M1',
      round: 'Grand Final',
      day: 3,
      date: '12 Nov 2026',
      time: '19.45',
      kloter: null,
      stream: true,
      format: 'BO5',
      s0: { t: 'T01' },
      s1: { t: 'T02' },
      next: null
    }];
  }

  const p = Math.pow(2, Math.ceil(Math.log2(n)));
  const byes = p - n;
  const prelimMatchesCount = n - (p / 2);

  let matchCounter = 1;
  const nextId = () => `M${matchCounter++}`;
  const allMatches = [];

  if (prelimMatchesCount > 0 && byes > 0) {
    const firstFullCount = p / 4; // jumlah match di babak penuh pertama (total 2 * firstFullCount slot)
    const slotCount = firstFullCount * 2;
    const seedRanks = challongeSeedOrder(slotCount);

    const prelimMatches = [];
    for (let i = 0; i < prelimMatchesCount; i++) {
      const kloter = prelimMatchesCount > 8 ? (i < Math.ceil(prelimMatchesCount / 2) ? 1 : 2) : 1;
      prelimMatches.push({
        id: nextId(),
        round: 'Round 1',
        day: 1,
        date: '10 Nov 2026',
        time: kloter === 2 ? '18.45' : '18.30',
        kloter,
        format: 'BO1',
        s0: null,
        s1: null,
        next: null
      });
    }

    const fullRoundName = roundNameForMatches(firstFullCount, false);
    const fullMatches = [];
    for (let i = 0; i < firstFullCount; i++) {
      const kloter = firstFullCount >= 8 ? (i < Math.ceil(firstFullCount / 2) ? 1 : 2) : null;
      fullMatches.push({
        id: nextId(),
        round: fullRoundName,
        day: fullRoundName === 'Semifinals' ? 2 : (fullRoundName === 'Grand Final' ? 3 : 1),
        date: fullRoundName === 'Semifinals' ? '11 Nov 2026' : (fullRoundName === 'Grand Final' ? '12 Nov 2026' : '10 Nov 2026'),
        time: fullRoundName === 'Grand Final' ? '19.45' : (fullRoundName === 'Semifinals' ? (i === 0 ? '18.30' : '19.45') : (kloter === 2 ? '19.40' : '19.25')),
        kloter,
        stream: fullRoundName === 'Semifinals' || fullRoundName === 'Grand Final',
        format: fullRoundName === 'Grand Final' ? 'BO5' : (fullRoundName === 'Semifinals' ? 'BO3' : 'BO1'),
        s0: null,
        s1: null,
        bye: false,
        next: null
      });
    }

    // Slot dengan seedRank <= byes mendapat BYE langsung di fullMatches sesuai urutan pohon Challonge
    let prelimCursor = 0;
    for (let i = 0; i < firstFullCount; i++) {
      const r0 = seedRanks[2 * i];
      const r1 = seedRanks[2 * i + 1];
      const isBye0 = r0 <= byes;
      const isBye1 = r1 <= byes;

      if (isBye0) {
        fullMatches[i].s0 = { t: padTeamId(r0) };
        fullMatches[i].bye = true;
      } else {
        const pm = prelimMatches[prelimCursor++];
        pm.s0 = { t: padTeamId(r0) };
        pm.s1 = { t: padTeamId(p + 1 - r0) };
        pm.next = { m: fullMatches[i].id, slot: 0 };
        fullMatches[i].s0 = { w: pm.id };
      }

      if (isBye1) {
        fullMatches[i].s1 = { t: padTeamId(r1) };
        fullMatches[i].bye = true;
      } else {
        const pm = prelimMatches[prelimCursor++];
        pm.s0 = { t: padTeamId(r1) };
        pm.s1 = { t: padTeamId(p + 1 - r1) };
        pm.next = { m: fullMatches[i].id, slot: 1 };
        fullMatches[i].s1 = { w: pm.id };
      }
    }

    allMatches.push(...prelimMatches);
    allMatches.push(...fullMatches);

    let prevRoundMatches = fullMatches;
    while (prevRoundMatches.length > 1) {
      const count = prevRoundMatches.length / 2;
      const rName = roundNameForMatches(count, false);
      const currentRound = [];
      for (let i = 0; i < count; i++) {
        const m0 = prevRoundMatches[2 * i];
        const m1 = prevRoundMatches[2 * i + 1];
        const mId = nextId();
        m0.next = { m: mId, slot: 0 };
        m1.next = { m: mId, slot: 1 };
        currentRound.push({
          id: mId,
          round: rName,
          day: rName === 'Semifinals' ? 2 : (rName === 'Grand Final' ? 3 : 1),
          date: rName === 'Semifinals' ? '11 Nov 2026' : (rName === 'Grand Final' ? '12 Nov 2026' : '10 Nov 2026'),
          time: rName === 'Grand Final' ? '19.45' : (rName === 'Semifinals' ? (i === 0 ? '18.30' : '19.45') : (rName === 'Quarterfinals' ? '21.00' : '20.20')),
          kloter: null,
          stream: rName === 'Semifinals' || rName === 'Grand Final',
          format: rName === 'Grand Final' ? 'BO5' : (rName === 'Semifinals' ? 'BO3' : 'BO1'),
          s0: { w: m0.id },
          s1: { w: m1.id },
          next: null
        });
      }

      if (count === 1 && thirdPlace && n >= 4 && prevRoundMatches.length === 2) {
        const gf = currentRound[0];
        const thirdId = gf.id;
        const realGfId = nextId();
        gf.id = realGfId;
        prevRoundMatches[0].next = { m: realGfId, slot: 0 };
        prevRoundMatches[1].next = { m: realGfId, slot: 1 };
        prevRoundMatches[0].nextLoser = { m: thirdId, slot: 0 };
        prevRoundMatches[1].nextLoser = { m: thirdId, slot: 1 };
        allMatches.push({
          id: thirdId,
          round: '3rd Place Match',
          day: 3,
          date: '12 Nov 2026',
          time: '18.30',
          kloter: null,
          stream: true,
          format: 'BO3',
          s0: { l: prevRoundMatches[0].id },
          s1: { l: prevRoundMatches[1].id },
          next: null
        });
      }

      allMatches.push(...currentRound);
      prevRoundMatches = currentRound;
    }
  } else {
    // Jumlah tim tepat pangkat 2 (4, 8, 16, 32, 64, 128) - tanpa BYE, urutan pohon Challonge
    let count = p / 2;
    const seedOrder = challongeSeedOrder(p);
    let prevRoundMatches = [];
    while (count >= 1) {
      const rName = roundNameForMatches(count, false);
      const currentRound = [];
      for (let i = 0; i < count; i++) {
        const mId = nextId();
        const kloter = count >= 16 ? (i < count / 2 ? 1 : 2) : null;
        if (prevRoundMatches.length === 0) {
          currentRound.push({
            id: mId,
            round: rName,
            day: rName === 'Semifinals' ? 2 : (rName === 'Grand Final' ? 3 : 1),
            date: rName === 'Semifinals' ? '11 Nov 2026' : (rName === 'Grand Final' ? '12 Nov 2026' : '10 Nov 2026'),
            time: rName === 'Grand Final' ? '19.45' : (rName === 'Semifinals' ? (i === 0 ? '18.30' : '19.45') : (kloter === 2 ? '18.45' : '18.30')),
            kloter,
            stream: rName === 'Semifinals' || rName === 'Grand Final',
            format: rName === 'Grand Final' ? 'BO5' : (rName === 'Semifinals' ? 'BO3' : 'BO1'),
            s0: { t: padTeamId(seedOrder[2 * i]) },
            s1: { t: padTeamId(seedOrder[2 * i + 1]) },
            next: null
          });
        } else {
          const m0 = prevRoundMatches[2 * i];
          const m1 = prevRoundMatches[2 * i + 1];
          m0.next = { m: mId, slot: 0 };
          m1.next = { m: mId, slot: 1 };
          currentRound.push({
            id: mId,
            round: rName,
            day: rName === 'Semifinals' ? 2 : (rName === 'Grand Final' ? 3 : 1),
            date: rName === 'Semifinals' ? '11 Nov 2026' : (rName === 'Grand Final' ? '12 Nov 2026' : '10 Nov 2026'),
            time: rName === 'Grand Final' ? '19.45' : (rName === 'Semifinals' ? (i === 0 ? '18.30' : '19.45') : (rName === 'Quarterfinals' ? '21.00' : '20.20')),
            kloter,
            stream: rName === 'Semifinals' || rName === 'Grand Final',
            format: rName === 'Grand Final' ? 'BO5' : (rName === 'Semifinals' ? 'BO3' : 'BO1'),
            s0: { w: m0.id },
            s1: { w: m1.id },
            next: null
          });
        }
      }

      if (count === 1 && thirdPlace && n >= 4 && prevRoundMatches.length === 2) {
        const gf = currentRound[0];
        const thirdId = gf.id;
        const realGfId = nextId();
        gf.id = realGfId;
        prevRoundMatches[0].next = { m: realGfId, slot: 0 };
        prevRoundMatches[1].next = { m: realGfId, slot: 1 };
        prevRoundMatches[0].nextLoser = { m: thirdId, slot: 0 };
        prevRoundMatches[1].nextLoser = { m: thirdId, slot: 1 };
        allMatches.push({
          id: thirdId,
          round: '3rd Place Match',
          day: 3,
          date: '12 Nov 2026',
          time: '18.30',
          kloter: null,
          stream: true,
          format: 'BO3',
          s0: { l: prevRoundMatches[0].id },
          s1: { l: prevRoundMatches[1].id },
          next: null
        });
      }

      allMatches.push(...currentRound);
      prevRoundMatches = currentRound;
      count = Math.floor(count / 2);
    }
  }

  return allMatches;
}

function scheduleKeyForMatch(match, semiIndex) {
  if (match.round === 'Round 1') return match.kloter === 2 ? 'R1_K2' : 'R1_K1';
  if (match.round === 'Round of 32') return match.kloter === 2 ? 'R32_K2' : 'R32_K1';
  if (match.round === 'Round of 16') return 'R16';
  if (match.round === 'Quarterfinals') return 'QF';
  if (match.round === 'Semifinals') return semiIndex === 1 ? 'SF2' : 'SF1';
  if (match.round === '3rd Place Match') return 'THIRD';
  if (match.round === 'Grand Final') return 'GF';
  return null;
}

export function getActiveMatches(state) {
  const cfg = normalizeConfig(state?.config);
  const activeCount = effectiveTeamCount(state);
  let base;
  if (activeCount === 58 && !cfg.customStructure) {
    base = BRACKET_MATCHES
      .filter(m => cfg.thirdPlace || m.round !== '3rd Place Match')
      .map(m => ({
        ...m,
        s0: m.s0 ? { ...m.s0 } : null,
        s1: m.s1 ? { ...m.s1 } : null,
        next: m.next ? { ...m.next } : null,
        nextLoser: (!cfg.thirdPlace && m.nextLoser) ? null : (m.nextLoser ? { ...m.nextLoser } : undefined)
      }));
  } else {
    base = generateBracketMatches(activeCount, cfg.thirdPlace);
  }

  let semiCounter = 0;
  for (const match of base) {
    const sIdx = match.round === 'Semifinals' ? semiCounter++ : 0;
    const sKey = scheduleKeyForMatch(match, sIdx);
    const rs = sKey ? cfg.roundSchedule[sKey] : null;
    if (rs) {
      match.day = Number(rs.day) || match.day;
      match.time = rs.time || match.time;
      match.format = rs.format || match.format;
      if (typeof rs.stream === 'boolean') match.stream = rs.stream;
    }
    const dayObj = cfg.days.find(d => Number(d.day) === Number(match.day));
    if (rs && rs.date) {
      match.date = rs.date;
    } else if (dayObj && dayObj.date) {
      match.date = dayObj.date;
    }

    const ov = cfg.matchOverrides?.[match.id];
    if (ov && typeof ov === 'object') {
      if (ov.day !== undefined && Number(ov.day)) {
        match.day = Number(ov.day);
        const ovDay = cfg.days.find(d => Number(d.day) === Number(match.day));
        if (ovDay && !ov.date) match.date = ovDay.date;
      }
      if (typeof ov.date === 'string' && ov.date.trim()) match.date = ov.date.trim();
      if (typeof ov.time === 'string' && ov.time.trim()) match.time = ov.time.trim();
      if (typeof ov.format === 'string' && ov.format.trim()) match.format = ov.format.trim();
      if (ov.kloter !== undefined) match.kloter = ov.kloter ? Number(ov.kloter) : null;
      if (typeof ov.stream === 'boolean') match.stream = ov.stream;
      if (ov.s0 && typeof ov.s0 === 'object') match.s0 = { ...ov.s0 };
      if (ov.s1 && typeof ov.s1 === 'object') match.s1 = { ...ov.s1 };
    }
  }
  return base;
}

export function getActiveTeams(state) {
  const activeCount = effectiveTeamCount(state);
  const matches = getActiveMatches(state);
  const firstRoundName = matches[0]?.round || 'Round 1';
  const hasPrelimRound = matches.length > 1 && matches.some(m => m.round !== firstRoundName && (m.s0?.t || m.s1?.t));
  const entryMap = new Map();

  for (const match of matches) {
    [match.s0, match.s1].forEach((slotDef, idx) => {
      if (slotDef && slotDef.t && !entryMap.has(slotDef.t)) {
        const isBye = hasPrelimRound && match.round !== firstRoundName;
        entryMap.set(slotDef.t, {
          entryMatch: match.id,
          slot: idx,
          initialRound: match.round,
          kloter: match.kloter,
          initialTime: match.time,
          initialDate: match.date,
          hasBye: isBye,
          seedStatus: isBye ? 'BYE Seed' : 'Reguler'
        });
      }
    });
  }

  const list = [];
  for (let seed = 1; seed <= activeCount; seed++) {
    const id = padTeamId(seed);
    const fallback = TEAMS_DATA[seed - 1] || {};
    const entry = entryMap.get(id) || {
      entryMatch: fallback.entryMatch || 'M1',
      slot: fallback.slot || 0,
      initialRound: fallback.initialRound || 'Round 1',
      kloter: fallback.kloter || 1,
      initialTime: fallback.initialTime || '18.30',
      initialDate: '10 Nov 2026',
      hasBye: Boolean(fallback.hasBye),
      seedStatus: fallback.seedStatus || 'Reguler'
    };
    list.push({
      id,
      seed,
      name: teamName(state, id),
      ...entry
    });
  }
  return list;
}

const STATIC_TEAM_INDEX = new Map(TEAMS_DATA.map(team => [team.id, team]));
export function teamMeta(teamId, state) {
  if (!teamId) return null;
  if (state) {
    const list = getActiveTeams(state);
    const found = list.find(t => t.id === teamId);
    if (found) return found;
  }
  if (STATIC_TEAM_INDEX.has(teamId)) return STATIC_TEAM_INDEX.get(teamId);
  const m = /^T(\d+)$/.exec(teamId);
  if (m) {
    const seed = Number(m[1]);
    return { id: teamId, seed, name: '', entryMatch: 'M1', slot: 0, initialRound: 'Round 1', kloter: 1, initialTime: '18.30', hasBye: false };
  }
  return null;
}

// Mengembalikan daftar pertandingan dengan ID tim yang sudah diselesaikan.
export function resolveMatches(state) {
  const activeMatches = getActiveMatches(state);
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

  for (const match of activeMatches) {
    const teams = [slotTeam(match.s0), slotTeam(match.s1)];
    const result = state?.results?.[match.id];
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
  for (const match of resolved.values()) {
    if (match.round === '3rd Place Match' && match.done) {
      const loser = match.teams[1 - match.winnerSlot];
      if (loser) out.add(loser);
    }
  }
  return out;
}

export function downstreamMatches(matchId, state) {
  const activeMatches = getActiveMatches(state);
  const out = [];
  const queue = [matchId];
  while (queue.length) {
    const currentId = queue.shift();
    const current = activeMatches.find(item => item.id === currentId);
    if (!current) continue;
    for (const link of [current.next, current.nextLoser]) {
      if (link && !out.includes(link.m)) {
        out.push(link.m);
        queue.push(link.m);
      }
    }
    for (const m of activeMatches) {
      const refs = [m.s0?.w, m.s0?.l, m.s1?.w, m.s1?.l];
      if (refs.includes(currentId) && !out.includes(m.id)) {
        out.push(m.id);
        queue.push(m.id);
      }
    }
  }
  return out;
}

export function formatIsoDateId(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return '';
  const parts = isoStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return '';
  const [year, month, day] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const mName = months[month - 1];
  if (!mName) return '';
  return `${day} ${mName} ${year}`;
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
