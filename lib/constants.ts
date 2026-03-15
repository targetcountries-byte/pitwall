// TracingInsights uses jsDelivr CDN for cached serving
export const CDN_BASE = 'https://cdn.jsdelivr.net/gh/TracingInsights'
// Fallback chain used by TracingInsights itself
export const CDN_FALLBACKS = [
  'https://cdn.jsdelivr.net/gh/TracingInsights',
  'https://cdn.statically.io/gh/TracingInsights',
  'https://raw.githack.com/TracingInsights',
  'https://raw.githubusercontent.com/TracingInsights',
]

// Session: UI code -> folder name in repo
export const SESSION_MAP: Record<string, string> = {
  FP1: 'Practice 1', FP2: 'Practice 2', FP3: 'Practice 3',
  SQ:  'Sprint Qualifying', SR: 'Sprint',
  Q:   'Qualifying',        R:  'Race',
}
export const SESSION_CODES = ['FP1','FP2','FP3','SQ','SR','Q','R']

// URL param session codes (TracingInsights uses P1,P2,P3,SQ,SR,Q,R in URL)
export const SESSION_URL_MAP: Record<string, string> = {
  P1:'FP1', P2:'FP2', P3:'FP3', SQ:'SQ', SR:'SR', Q:'Q', R:'R',
  FP1:'FP1', FP2:'FP2', FP3:'FP3',
}

export const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '#3671C6', 'Ferrari': '#E8002D', 'McLaren': '#FF8000',
  'Mercedes': '#27F4D2', 'Aston Martin': '#229971', 'Alpine': '#FF87BC',
  'Williams': '#64C4FF', 'Racing Bulls': '#6692FF', 'Kick Sauber': '#52E252',
  'Haas F1 Team': '#B6BABD', 'Audi': '#D4FF00', 'Cadillac': '#C8102E',
  'AlphaTauri': '#6692FF', 'Alpha Tauri': '#6692FF', 'Alfa Romeo': '#A32732',
  'Sauber': '#52E252', 'Toro Rosso': '#4169E1', 'Force India': '#F596C8',
  'Racing Point': '#F596C8', 'Renault': '#FFF500', 'Haas': '#B6BABD',
}

export const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#e8002d', MEDIUM: '#ffd600', HARD: '#f0f0ec',
  INTER: '#39b54a', WET: '#0067ff', UNKNOWN: '#888888',
}

// All themes exactly as on tracinginsights.com
export const THEMES = [
  { id: 'tracinginsights', label: 'Tracing Insights' },
  { id: 'luxury',        label: 'Luxury' },
  { id: 'night',         label: 'Night' },
  { id: 'coffee',        label: 'Coffee' },
  { id: 'dim',           label: 'Dim' },
  { id: 'mercedes',      label: 'Mercedes' },
  { id: 'astonmartin',   label: 'Aston Martin' },
  { id: 'haas',          label: 'Haas' },
  { id: 'redbull',       label: 'Red Bull' },
  { id: 'williams',      label: 'Williams' },
  { id: 'racingbulls',   label: 'Racing Bulls' },
  { id: 'mclaren',       label: 'McLaren' },
  { id: 'sauber',        label: 'Sauber' },
  { id: 'alpine',        label: 'Alpine' },
  { id: 'ferrari',       label: 'Ferrari' },
  { id: 'synthwave',     label: 'Synthwave' },
  { id: 'halloween',     label: 'Halloween' },
  { id: 'forest',        label: 'Forest' },
  { id: 'dracula',       label: 'Dracula' },
  { id: 'sunset',        label: 'Sunset' },
]

// All analysis pages
export const ANALYSIS_PAGES = [
  { slug: 'race-pace',                      label: 'Race Pace' },
  { slug: 'championship-standings',         label: 'Championship Standings' },
  { slug: 'corner-analysis',                label: 'Corner Analysis' },
  { slug: 'circuit-maps',                   label: 'Circuit Maps' },
  { slug: 'downforce-configurations',       label: 'Downforce Configurations' },
  { slug: 'download-raw-data',              label: 'Download Raw Data' },
  { slug: 'drivers-in-traffic',             label: 'Drivers In Traffic' },
  { slug: 'fan-ratings',                    label: 'Fan Ratings' },
  { slug: 'fastest-lap',                    label: 'Fastest Lap' },
  { slug: 'gg-plot',                        label: 'GG Plot' },
  { slug: 'heat-map',                       label: 'Heat Map' },
  { slug: 'ideal-lap',                      label: 'Ideal Lap' },
  { slug: 'lap-chart',                      label: 'Lap Chart' },
  { slug: 'laps-in-top-ten',               label: 'Laps In Top Ten' },
  { slug: 'laptimes-delta',                 label: 'Laptimes Delta' },
  { slug: 'lateral-acceleration-vs-speed',  label: 'Lateral Acceleration vs Speed' },
  { slug: 'longitudinal-acceleration-vs-speed', label: 'Longitudinal Acceleration vs Speed' },
  { slug: 'long-run-race-pace',             label: 'Long Run Race Pace' },
  { slug: 'max-throttle',                   label: 'Max Throttle' },
  { slug: 'overtakes',                      label: 'Overtakes' },
  { slug: 'peak-g-forces',                  label: 'Peak G Forces' },
  { slug: 'penalty-points',                 label: 'Penalty Points' },
  { slug: 'pit-stops',                      label: 'Pit Stops' },
  { slug: 'positions-change',               label: 'Positions Change' },
  { slug: 'race-launch-performance-ratings',label: 'Race Launch Performance Ratings' },
  { slug: 'race-trace',                     label: 'Race Trace' },
  { slug: 'top-speed-at-speed-trap',        label: 'Top Speed At Speed Trap' },
  { slug: 'track-temperature',              label: 'Track Temperature' },
  { slug: 'tyre-degradation',               label: 'Tyre Degradation' },
  { slug: 'tyre-strategy',                  label: 'Tyre Strategy' },
  { slug: 'wdc-contenders',                 label: 'WDC Contenders' },
  { slug: 'weekend-results',                label: 'Weekend Results' },
]

// Events per year — exact folder names from TracingInsights GitHub
export const AVAILABLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]

export const EVENTS_BY_YEAR: Record<number, string[]> = {
  2026: ['Pre-Season Testing 1','Pre-Season Testing 2','Pre-Season Testing','Australian Grand Prix','Chinese Grand Prix'],
  2025: ['Pre-Season Testing','Australian Grand Prix','Chinese Grand Prix','Japanese Grand Prix','Bahrain Grand Prix','Saudi Arabian Grand Prix','Miami Grand Prix','Emilia Romagna Grand Prix','Monaco Grand Prix','Spanish Grand Prix','Canadian Grand Prix','Austrian Grand Prix','British Grand Prix','Belgian Grand Prix','Hungarian Grand Prix','Dutch Grand Prix','Italian Grand Prix','Azerbaijan Grand Prix','Singapore Grand Prix','United States Grand Prix','Mexico City Grand Prix','São Paulo Grand Prix','Las Vegas Grand Prix','Qatar Grand Prix','Abu Dhabi Grand Prix'],
  2024: ['Australian Grand Prix','Japanese Grand Prix','Chinese Grand Prix','Miami Grand Prix','Emilia Romagna Grand Prix','Monaco Grand Prix','Canadian Grand Prix','Spanish Grand Prix','Austrian Grand Prix','British Grand Prix','Hungarian Grand Prix','Belgian Grand Prix','Dutch Grand Prix','Italian Grand Prix','Azerbaijan Grand Prix','Singapore Grand Prix','United States Grand Prix','Mexico City Grand Prix','São Paulo Grand Prix','Las Vegas Grand Prix','Qatar Grand Prix','Abu Dhabi Grand Prix','Bahrain Grand Prix','Saudi Arabian Grand Prix'],
  2023: ['Pre-Season Testing','Bahrain Grand Prix','Saudi Arabian Grand Prix','Australian Grand Prix','Azerbaijan Grand Prix','Miami Grand Prix','Monaco Grand Prix','Spanish Grand Prix','Canadian Grand Prix','Austrian Grand Prix','British Grand Prix','Hungarian Grand Prix','Belgian Grand Prix','Dutch Grand Prix','Italian Grand Prix','Singapore Grand Prix','Japanese Grand Prix','Qatar Grand Prix','United States Grand Prix','Mexico City Grand Prix','São Paulo Grand Prix','Las Vegas Grand Prix','Abu Dhabi Grand Prix'],
  2022: ['Pre-Season Test','Bahrain Grand Prix','Saudi Arabian Grand Prix','Australian Grand Prix','Emilia Romagna Grand Prix','Miami Grand Prix','Spanish Grand Prix','Monaco Grand Prix','Azerbaijan Grand Prix','Canadian Grand Prix','British Grand Prix','Austrian Grand Prix','French Grand Prix','Hungarian Grand Prix','Belgian Grand Prix','Dutch Grand Prix','Italian Grand Prix','Singapore Grand Prix','Japanese Grand Prix','United States Grand Prix','Mexico City Grand Prix','São Paulo Grand Prix','Abu Dhabi Grand Prix'],
  2021: ['Bahrain Grand Prix','Emilia Romagna Grand Prix','Portuguese Grand Prix','Spanish Grand Prix','Monaco Grand Prix','Azerbaijan Grand Prix','French Grand Prix','Styrian Grand Prix','Austrian Grand Prix','British Grand Prix','Hungarian Grand Prix','Belgian Grand Prix','Dutch Grand Prix','Italian Grand Prix','Russian Grand Prix','Turkish Grand Prix','United States Grand Prix','Mexico City Grand Prix','São Paulo Grand Prix','Qatar Grand Prix','Saudi Arabian Grand Prix','Abu Dhabi Grand Prix'],
  2020: ['Austrian Grand Prix','Styrian Grand Prix','Hungarian Grand Prix','British Grand Prix','70th Anniversary Grand Prix','Spanish Grand Prix','Belgian Grand Prix','Italian Grand Prix','Tuscan Grand Prix','Russian Grand Prix','Eifel Grand Prix','Portuguese Grand Prix','Emilia Romagna Grand Prix','Turkish Grand Prix','Bahrain Grand Prix','Sakhir Grand Prix','Abu Dhabi Grand Prix'],
  2019: ['Australian Grand Prix','Bahrain Grand Prix','Chinese Grand Prix','Azerbaijan Grand Prix','Spanish Grand Prix','Monaco Grand Prix','Canadian Grand Prix','French Grand Prix','Austrian Grand Prix','British Grand Prix','German Grand Prix','Hungarian Grand Prix','Belgian Grand Prix','Italian Grand Prix','Singapore Grand Prix','Russian Grand Prix','Japanese Grand Prix','Mexican Grand Prix','United States Grand Prix','Brazilian Grand Prix','Abu Dhabi Grand Prix'],
  2018: ['Australian Grand Prix','Bahrain Grand Prix','Chinese Grand Prix','Azerbaijan Grand Prix','Spanish Grand Prix','Monaco Grand Prix','Canadian Grand Prix','French Grand Prix','Austrian Grand Prix','British Grand Prix','German Grand Prix','Hungarian Grand Prix','Belgian Grand Prix','Italian Grand Prix','Singapore Grand Prix','Russian Grand Prix','Japanese Grand Prix','United States Grand Prix','Mexican Grand Prix','Brazilian Grand Prix','Abu Dhabi Grand Prix'],
}

// Sprint weekends
export const SPRINT_EVENTS = new Set([
  'Chinese Grand Prix','Miami Grand Prix','United States Grand Prix',
  'São Paulo Grand Prix','Qatar Grand Prix','Austrian Grand Prix',
  'Belgian Grand Prix','Azerbaijan Grand Prix',
])

// Track status from DATA_REFERENCE.md
export const TRACK_STATUS: Record<string, { label: string; color: string }> = {
  '1': { label: 'Track Clear',    color: 'transparent' },
  '2': { label: 'Yellow Flag',    color: 'rgba(255,235,0,0.10)' },
  '4': { label: 'Safety Car',     color: 'rgba(255,165,0,0.12)' },
  '5': { label: 'Red Flag',       color: 'rgba(220,0,0,0.14)' },
  '6': { label: 'VSC Deployed',   color: 'rgba(255,200,0,0.10)' },
  '7': { label: 'VSC Ending',     color: 'rgba(255,220,0,0.07)' },
}

export const RACE_SCHEDULE_2026 = [
  { round:0, name:'Pre-Season Testing 1',    loc:'Bahrain',     country:'Bahrain',      r:'2026-02-18', sprint:false, testing:true },
  { round:0, name:'Pre-Season Testing 2',    loc:'Bahrain',     country:'Bahrain',      r:'2026-02-25', sprint:false, testing:true },
  { round:1, name:'Australian Grand Prix',   loc:'Melbourne',   country:'Australia',    r:'2026-03-15', sprint:false },
  { round:2, name:'Chinese Grand Prix',      loc:'Shanghai',    country:'China',        r:'2026-03-22', sprint:true },
  { round:3, name:'Japanese Grand Prix',     loc:'Suzuka',      country:'Japan',        r:'2026-04-05', sprint:false },
  { round:4, name:'Bahrain Grand Prix',      loc:'Sakhir',      country:'Bahrain',      r:'2026-04-19', sprint:false },
  { round:5, name:'Saudi Arabian Grand Prix',loc:'Jeddah',      country:'Saudi Arabia', r:'2026-04-26', sprint:false },
  { round:6, name:'Miami Grand Prix',        loc:'Miami',       country:'USA',          r:'2026-05-03', sprint:true },
  { round:7, name:'Emilia Romagna Grand Prix',loc:'Imola',      country:'Italy',        r:'2026-05-17', sprint:false },
  { round:8, name:'Monaco Grand Prix',       loc:'Monaco',      country:'Monaco',       r:'2026-05-24', sprint:false },
  { round:9, name:'Spanish Grand Prix',      loc:'Barcelona',   country:'Spain',        r:'2026-05-31', sprint:false },
  { round:10,name:'Canadian Grand Prix',     loc:'Montreal',    country:'Canada',       r:'2026-06-14', sprint:false },
  { round:11,name:'Austrian Grand Prix',     loc:'Spielberg',   country:'Austria',      r:'2026-06-28', sprint:false },
  { round:12,name:'British Grand Prix',      loc:'Silverstone', country:'UK',           r:'2026-07-05', sprint:false },
  { round:13,name:'Belgian Grand Prix',      loc:'Spa',         country:'Belgium',      r:'2026-07-26', sprint:false },
  { round:14,name:'Hungarian Grand Prix',    loc:'Budapest',    country:'Hungary',      r:'2026-08-02', sprint:false },
  { round:15,name:'Dutch Grand Prix',        loc:'Zandvoort',   country:'Netherlands',  r:'2026-08-30', sprint:false },
  { round:16,name:'Italian Grand Prix',      loc:'Monza',       country:'Italy',        r:'2026-09-06', sprint:false },
  { round:17,name:'Azerbaijan Grand Prix',   loc:'Baku',        country:'Azerbaijan',   r:'2026-09-20', sprint:false },
  { round:18,name:'Singapore Grand Prix',    loc:'Singapore',   country:'Singapore',    r:'2026-10-04', sprint:false },
  { round:19,name:'United States Grand Prix',loc:'Austin',      country:'USA',          r:'2026-10-18', sprint:true },
  { round:20,name:'Mexico City Grand Prix',  loc:'Mexico City', country:'Mexico',       r:'2026-10-25', sprint:false },
  { round:21,name:'São Paulo Grand Prix',    loc:'São Paulo',   country:'Brazil',       r:'2026-11-08', sprint:true },
  { round:22,name:'Las Vegas Grand Prix',    loc:'Las Vegas',   country:'USA',          r:'2026-11-21', sprint:false },
  { round:23,name:'Qatar Grand Prix',        loc:'Lusail',      country:'Qatar',        r:'2026-11-29', sprint:true },
  { round:24,name:'Abu Dhabi Grand Prix',    loc:'Abu Dhabi',   country:'UAE',          r:'2026-12-06', sprint:false },
]
export const RACE_SCHEDULE_2025 = [
  { round:1, name:'Australian Grand Prix',    loc:'Melbourne',   country:'Australia',    r:'2025-03-16', sprint:false },
  { round:2, name:'Chinese Grand Prix',       loc:'Shanghai',    country:'China',        r:'2025-03-23', sprint:true },
  { round:3, name:'Japanese Grand Prix',      loc:'Suzuka',      country:'Japan',        r:'2025-04-06', sprint:false },
  { round:4, name:'Bahrain Grand Prix',       loc:'Sakhir',      country:'Bahrain',      r:'2025-04-13', sprint:false },
  { round:5, name:'Saudi Arabian Grand Prix', loc:'Jeddah',      country:'Saudi Arabia', r:'2025-04-20', sprint:false },
  { round:6, name:'Miami Grand Prix',         loc:'Miami',       country:'USA',          r:'2025-05-04', sprint:true },
  { round:7, name:'Emilia Romagna Grand Prix',loc:'Imola',       country:'Italy',        r:'2025-05-18', sprint:false },
  { round:8, name:'Monaco Grand Prix',        loc:'Monaco',      country:'Monaco',       r:'2025-05-25', sprint:false },
  { round:9, name:'Spanish Grand Prix',       loc:'Barcelona',   country:'Spain',        r:'2025-06-01', sprint:false },
  { round:10,name:'Canadian Grand Prix',      loc:'Montreal',    country:'Canada',       r:'2025-06-15', sprint:false },
  { round:11,name:'Austrian Grand Prix',      loc:'Spielberg',   country:'Austria',      r:'2025-06-29', sprint:false },
  { round:12,name:'British Grand Prix',       loc:'Silverstone', country:'UK',           r:'2025-07-06', sprint:false },
  { round:13,name:'Belgian Grand Prix',       loc:'Spa',         country:'Belgium',      r:'2025-07-27', sprint:false },
  { round:14,name:'Hungarian Grand Prix',     loc:'Budapest',    country:'Hungary',      r:'2025-08-03', sprint:false },
  { round:15,name:'Dutch Grand Prix',         loc:'Zandvoort',   country:'Netherlands',  r:'2025-08-31', sprint:false },
  { round:16,name:'Italian Grand Prix',       loc:'Monza',       country:'Italy',        r:'2025-09-07', sprint:false },
  { round:17,name:'Azerbaijan Grand Prix',    loc:'Baku',        country:'Azerbaijan',   r:'2025-09-21', sprint:false },
  { round:18,name:'Singapore Grand Prix',     loc:'Singapore',   country:'Singapore',    r:'2025-10-05', sprint:false },
  { round:19,name:'United States Grand Prix', loc:'Austin',      country:'USA',          r:'2025-10-19', sprint:true },
  { round:20,name:'Mexico City Grand Prix',   loc:'Mexico City', country:'Mexico',       r:'2025-10-26', sprint:false },
  { round:21,name:'São Paulo Grand Prix',     loc:'São Paulo',   country:'Brazil',       r:'2025-11-09', sprint:true },
  { round:22,name:'Las Vegas Grand Prix',     loc:'Las Vegas',   country:'USA',          r:'2025-11-22', sprint:false },
  { round:23,name:'Qatar Grand Prix',         loc:'Lusail',      country:'Qatar',        r:'2025-11-30', sprint:true },
  { round:24,name:'Abu Dhabi Grand Prix',     loc:'Abu Dhabi',   country:'UAE',          r:'2025-12-07', sprint:false },
]

const FLAGS: Record<string, string> = {
  Australia:'🇦🇺',China:'🇨🇳',Japan:'🇯🇵',Bahrain:'🇧🇭','Saudi Arabia':'🇸🇦',
  USA:'🇺🇸',Italy:'🇮🇹',Monaco:'🇲🇨',Spain:'🇪🇸',Canada:'🇨🇦',Austria:'🇦🇹',
  UK:'🇬🇧',Belgium:'🇧🇪',Hungary:'🇭🇺',Netherlands:'🇳🇱',Azerbaijan:'🇦🇿',
  Singapore:'🇸🇬',Mexico:'🇲🇽',Brazil:'🇧🇷',Qatar:'🇶🇦',UAE:'🇦🇪',
}
export const getFlag = (c: string) => FLAGS[c] ?? '🏁'
