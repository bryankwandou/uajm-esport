// Data turnamen UKM ESPORT UAJM 2026 Mobile Legends: Bang Bang
// Total 58 Tim, Single Elimination, 58 Pertandingan

export const TOURNAMENT_INFO = {
  name: 'UAJM ESPORT 2026',
  title: 'UAJM ESPORT CHAMPIONSHIP 2026',
  organizer: 'UKM Esport UAJM',
  subtitle: 'Official Tournament Bracket & Rundown System',
  format: 'Single Elimination (58 Tim)',
  dates: '10 - 12 November 2026',
  game: 'Mobile Legends: Bang Bang',
  firebaseDatabaseUrl: 'https://inex-ml-2026-default-rtdb.asia-southeast1.firebasedatabase.app',
  adminAuthUsername: 'nayrbryaGaming',
  adminAuthPassword: 'nayrbryanGaming',
  challongeUrl: 'https://challonge.com/6ayo1xlk'
};

export const BRACKET_MATCHES = [
  // Round 1 - Day 1 (10 Nov 2026) - Kloter 1 (18.30 WIB)
  { id: 'M1', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'yK', s1: 'Pejuang Warung biru', next: { m: 'M27', slot: 1 } },
  { id: 'M2', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'FC MW UNITED', s1: 'HDE Team 2', next: { m: 'M28', slot: 0 } },
  { id: 'M3', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'KENTAKIW', s1: 'Sakura Aeternum', next: { m: 'M28', slot: 1 } },
  { id: 'M4', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'TUJ ORVEX', s1: 'GodZla', next: { m: 'M29', slot: 0 } },
  { id: 'M5', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'AYAM SD X DHXWII', s1: 'Kaze Shouri', next: { m: 'M29', slot: 1 } },
  { id: 'M6', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'Legacy', s1: 'Abil Poke', next: { m: 'M30', slot: 0 } },
  { id: 'M7', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'WLEOWLEO', s1: "D'winners", next: { m: 'M30', slot: 1 } },
  { id: 'M8', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'FEB Unsoed', s1: 'Milano basing unsoed', next: { m: 'M31', slot: 1 } },
  { id: 'M9', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'HDE Sugeng Tumbler', s1: 'AROMA DKK JOSHJISH', next: { m: 'M32', slot: 0 } },
  { id: 'M10', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'Burung Hantu', s1: 'Criminal Uajm', next: { m: 'M32', slot: 1 } },
  { id: 'M11', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'ORD X HAVOC', s1: 'TONGKI GOAT', next: { m: 'M33', slot: 1 } },
  { id: 'M12', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'Cyg', s1: 'Black Stellar', next: { m: 'M34', slot: 0 } },
  { id: 'M13', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.30', kloter: 1, format: 'BO1', s0: 'SMAN1SUM', s1: 'Jawa', next: { m: 'M34', slot: 1 } },

  // Round 1 - Day 1 (10 Nov 2026) - Kloter 2 (18.45 WIB)
  { id: 'M14', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'ILLUSIONIST', s1: 'SNM (STECU NO MERC)', next: { m: 'M35', slot: 1 } },
  { id: 'M15', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'boti gerum', s1: 'Bissmillah Aamiin', next: { m: 'M36', slot: 0 } },
  { id: 'M16', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'Tumbuh Berkembang', s1: 'Sambel goreng puyu', next: { m: 'M36', slot: 1 } },
  { id: 'M17', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'Amatour', s1: 'Kontrakan Dicent', next: { m: 'M37', slot: 0 } },
  { id: 'M18', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: '777', s1: 'Wirze Familia', next: { m: 'M37', slot: 1 } },
  { id: 'M19', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'Blue Creamost', s1: 'Axilla', next: { m: 'M38', slot: 0 } },
  { id: 'M20', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'Trizzom', s1: 'Pasukan lembing hitam', next: { m: 'M38', slot: 1 } },
  { id: 'M21', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'coba coba', s1: 'ViperTom', next: { m: 'M39', slot: 1 } },
  { id: 'M22', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'Ilmu Daging', s1: 'Praktikum APSI', next: { m: 'M40', slot: 0 } },
  { id: 'M23', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'SASAKU PPL', s1: 'HIU FPIK', next: { m: 'M40', slot: 1 } },
  { id: 'M24', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'Yolanda Boys (YB)', s1: "Karisya's Fanclub", next: { m: 'M41', slot: 1 } },
  { id: 'M25', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'Koco Lestari', s1: 'ROS', next: { m: 'M42', slot: 0 } },
  { id: 'M26', round: 'Round 1', day: 1, date: '10 Nov 2026', time: '18.45', kloter: 2, format: 'BO1', s0: 'EMPEIROS DIVINE', s1: 'Tambal Bang', next: { m: 'M42', slot: 1 } },

  // Round of 32 - Day 1 (10 Nov 2026) - Kloter 1 (19.25 WIB)
  { id: 'M27', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.25', kloter: 1, format: 'BO1', s0: 'Hirogeru', s1: { w: 'M1' }, bye: true, next: { m: 'M43', slot: 0 } },
  { id: 'M28', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.25', kloter: 1, format: 'BO1', s0: { w: 'M2' }, s1: { w: 'M3' }, next: { m: 'M43', slot: 1 } },
  { id: 'M29', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.25', kloter: 1, format: 'BO1', s0: { w: 'M4' }, s1: { w: 'M5' }, next: { m: 'M44', slot: 0 } },
  { id: 'M30', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.25', kloter: 1, format: 'BO1', s0: { w: 'M6' }, s1: { w: 'M7' }, next: { m: 'M44', slot: 1 } },
  { id: 'M31', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.25', kloter: 1, format: 'BO1', s0: 'Kuncir Burjo', s1: { w: 'M8' }, bye: true, next: { m: 'M45', slot: 0 } },
  { id: 'M32', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.25', kloter: 1, format: 'BO1', s0: { w: 'M9' }, s1: { w: 'M10' }, next: { m: 'M45', slot: 1 } },
  { id: 'M33', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.25', kloter: 1, format: 'BO1', s0: 'Evos Blater', s1: { w: 'M11' }, bye: true, next: { m: 'M46', slot: 0 } },
  { id: 'M34', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.25', kloter: 1, format: 'BO1', s0: { w: 'M12' }, s1: { w: 'M13' }, next: { m: 'M46', slot: 1 } },

  // Round of 32 - Day 1 (10 Nov 2026) - Kloter 2 (19.40 WIB)
  { id: 'M35', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.40', kloter: 2, format: 'BO1', s0: 'Lamelo', s1: { w: 'M14' }, bye: true, next: { m: 'M47', slot: 0 } },
  { id: 'M36', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.40', kloter: 2, format: 'BO1', s0: { w: 'M15' }, s1: { w: 'M16' }, next: { m: 'M47', slot: 1 } },
  { id: 'M37', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.40', kloter: 2, format: 'BO1', s0: { w: 'M17' }, s1: { w: 'M18' }, next: { m: 'M48', slot: 0 } },
  { id: 'M38', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.40', kloter: 2, format: 'BO1', s0: { w: 'M19' }, s1: { w: 'M20' }, next: { m: 'M48', slot: 1 } },
  { id: 'M39', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.40', kloter: 2, format: 'BO1', s0: 'Yawis', s1: { w: 'M21' }, bye: true, next: { m: 'M49', slot: 0 } },
  { id: 'M40', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.40', kloter: 2, format: 'BO1', s0: { w: 'M22' }, s1: { w: 'M23' }, next: { m: 'M49', slot: 1 } },
  { id: 'M41', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.40', kloter: 2, format: 'BO1', s0: 'Sodiq baru belajar', s1: { w: 'M24' }, bye: true, next: { m: 'M50', slot: 0 } },
  { id: 'M42', round: 'Round of 32', day: 1, date: '10 Nov 2026', time: '19.40', kloter: 2, format: 'BO1', s0: { w: 'M25' }, s1: { w: 'M26' }, next: { m: 'M50', slot: 1 } },

  // Round of 16 - Day 1 (10 Nov 2026) - 20.20 WIB
  { id: 'M43', round: 'Round of 16', day: 1, date: '10 Nov 2026', time: '20.20', kloter: null, format: 'BO1', s0: { w: 'M27' }, s1: { w: 'M28' }, next: { m: 'M51', slot: 0 } },
  { id: 'M44', round: 'Round of 16', day: 1, date: '10 Nov 2026', time: '20.20', kloter: null, format: 'BO1', s0: { w: 'M29' }, s1: { w: 'M30' }, next: { m: 'M51', slot: 1 } },
  { id: 'M45', round: 'Round of 16', day: 1, date: '10 Nov 2026', time: '20.20', kloter: null, format: 'BO1', s0: { w: 'M31' }, s1: { w: 'M32' }, next: { m: 'M52', slot: 0 } },
  { id: 'M46', round: 'Round of 16', day: 1, date: '10 Nov 2026', time: '20.20', kloter: null, format: 'BO1', s0: { w: 'M33' }, s1: { w: 'M34' }, next: { m: 'M52', slot: 1 } },
  { id: 'M47', round: 'Round of 16', day: 1, date: '10 Nov 2026', time: '20.20', kloter: null, format: 'BO1', s0: { w: 'M35' }, s1: { w: 'M36' }, next: { m: 'M53', slot: 0 } },
  { id: 'M48', round: 'Round of 16', day: 1, date: '10 Nov 2026', time: '20.20', kloter: null, format: 'BO1', s0: { w: 'M37' }, s1: { w: 'M38' }, next: { m: 'M53', slot: 1 } },
  { id: 'M49', round: 'Round of 16', day: 1, date: '10 Nov 2026', time: '20.20', kloter: null, format: 'BO1', s0: { w: 'M39' }, s1: { w: 'M40' }, next: { m: 'M54', slot: 0 } },
  { id: 'M50', round: 'Round of 16', day: 1, date: '10 Nov 2026', time: '20.20', kloter: null, format: 'BO1', s0: { w: 'M41' }, s1: { w: 'M42' }, next: { m: 'M54', slot: 1 } },

  // Quarterfinals - Day 1 (10 Nov 2026) - 21.00 WIB
  { id: 'M51', round: 'Quarterfinals', day: 1, date: '10 Nov 2026', time: '21.00', kloter: null, format: 'BO1', s0: { w: 'M43' }, s1: { w: 'M44' }, next: { m: 'M55', slot: 0 } },
  { id: 'M52', round: 'Quarterfinals', day: 1, date: '10 Nov 2026', time: '21.00', kloter: null, format: 'BO1', s0: { w: 'M45' }, s1: { w: 'M46' }, next: { m: 'M55', slot: 1 } },
  { id: 'M53', round: 'Quarterfinals', day: 1, date: '10 Nov 2026', time: '21.00', kloter: null, format: 'BO1', s0: { w: 'M47' }, s1: { w: 'M48' }, next: { m: 'M56', slot: 0 } },
  { id: 'M54', round: 'Quarterfinals', day: 1, date: '10 Nov 2026', time: '21.00', kloter: null, format: 'BO1', s0: { w: 'M49' }, s1: { w: 'M50' }, next: { m: 'M56', slot: 1 } },

  // Semifinals - Day 2 (11 Nov 2026) - Stream BO3
  {
    id: 'M55',
    round: 'Semifinals',
    day: 2,
    date: '11 Nov 2026',
    time: '18.30',
    kloter: null,
    stream: true,
    format: 'BO3',
    s0: { w: 'M51' },
    s1: { w: 'M52' },
    next: { m: 'M58', slot: 0 },
    nextLoser: { m: 'M57', slot: 0 }
  },
  {
    id: 'M56',
    round: 'Semifinals',
    day: 2,
    date: '11 Nov 2026',
    time: '19.45',
    kloter: null,
    stream: true,
    format: 'BO3',
    s0: { w: 'M53' },
    s1: { w: 'M54' },
    next: { m: 'M58', slot: 1 },
    nextLoser: { m: 'M57', slot: 1 }
  },

  // Finals Day - Day 3 (12 Nov 2026) - Stream BO3 & BO5
  {
    id: 'M57',
    round: '3rd Place Match',
    day: 3,
    date: '12 Nov 2026',
    time: '18.30',
    kloter: null,
    stream: true,
    format: 'BO3',
    s0: { l: 'M55' },
    s1: { l: 'M56' },
    next: null
  },
  {
    id: 'M58',
    round: 'Grand Final',
    day: 3,
    date: '12 Nov 2026',
    time: '19.45',
    kloter: null,
    stream: true,
    format: 'BO5',
    s0: { w: 'M55' },
    s1: { w: 'M56' },
    next: null
  }
];

export const MATCH_BY_ID = Object.fromEntries(
  BRACKET_MATCHES.map(item => [item.id, item])
);

export const ROUNDS_ORDER = [
  'Round 1',
  'Round of 32',
  'Round of 16',
  'Quarterfinals',
  'Semifinals',
  '3rd Place Match',
  'Grand Final'
];
