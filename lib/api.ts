import { CDN_BASE, CDN_FALLBACKS, SESSION_MAP, TEAM_COLORS } from './constants'

const enc = (s: string) => encodeURIComponent(s)

// Build CDN URL (jsDelivr with cache-busting like TracingInsights does)
export function cdnUrl(year: number, event: string, session: string) {
  const folder = SESSION_MAP[session] ?? session
  const ts = Math.floor(Date.now() / 60000) * 60000 // 1-min cache busting
  return `${CDN_BASE}/${year}@main/${enc(event)}/${enc(folder)}`
}

// Fetch with CDN fallback chain
async function fetchWithFallback(path: string): Promise<Response> {
  const ts = `?_=${Date.now()}`
  for (const base of CDN_FALLBACKS) {
    try {
      const r = await fetch(`${base}/${path}${ts}`, { signal: AbortSignal.timeout(8000) })
      if (r.ok) return r
    } catch {}
  }
  throw new Error(`All CDNs failed for: ${path}`)
}

function sessionPath(year: number, event: string, session: string) {
  const folder = SESSION_MAP[session] ?? session
  return `${year}@main/${enc(event)}/${enc(folder)}`
}

export interface DriverInfo {
  driver: string; team: string; color: string
  fn: string; ln: string; dn: string; url: string
}

export interface LapRow {
  lap: number; time: number | null
  compound: string; stint: number; life: number
  s1: number | null; s2: number | null; s3: number | null
  ms1: number | null; ms2: number | null; ms3: number | null
  pos: number; pb: boolean; del: boolean; fresh: boolean; iacc: boolean
  status: string
  vi1: number | null; vi2: number | null; vfl: number | null; vst: number | null
  pin: number | null; pout: number | null
  sesT: number | null; lST: number | null
}

export interface TelPoint {
  time: number; speed: number; throttle: number; brake: number
  gear: number; rpm: number; drs: number; distance: number
  acc_x: number; acc_y: number; acc_z: number
  x: number; y: number; z: number
  driverAhead: string; distanceToDriverAhead: number
}

export interface DriverData {
  code: string; team: string; color: string
  fn: string; ln: string; photoUrl: string
  laps: LapRow[]; tel: TelPoint[]; selectedLap: number | null
}

export interface Corner {
  CornerNumber: number; X: number; Y: number; Angle: number; Distance: number
}

// ── Drivers ──────────────────────────────────────────────────────────────────
export async function fetchDrivers(year: number, event: string, session: string): Promise<DriverInfo[]> {
  const r = await fetchWithFallback(`${sessionPath(year, event, session)}/drivers.json`)
  const d = await r.json()
  return (d.drivers as any[]).map(x => ({
    driver: x.driver,
    team:   x.team,
    color:  x.tc ? `#${x.tc}` : (TEAM_COLORS[x.team] ?? '#888888'),
    fn:     x.fn ?? '',
    ln:     x.ln ?? '',
    dn:     String(x.dn ?? ''),
    url:    x.url ?? '',
  }))
}

// ── Laptimes ─────────────────────────────────────────────────────────────────
export async function fetchLaptimes(year: number, event: string, session: string, driver: string): Promise<LapRow[]> {
  try {
    const r = await fetchWithFallback(`${sessionPath(year, event, session)}/${driver}/laptimes.json`)
    const d = await r.json()
    const len = (d.lap as any[]).length
    const n = (v: any): number | null => (v === 'None' || v === null || v === undefined) ? null : +v
    const b = (v: any): boolean => v === true || v === 'True' || v === 1
    return Array.from({ length: len }, (_, i) => ({
      lap:     d.lap[i],
      time:    n(d.time[i]),
      compound: (() => { const v = d.compound?.[i]; return (!v || v === 'None' || v === 'none') ? 'UNKNOWN' : (v as string).toUpperCase() })(),
      stint:   d.stint?.[i] ?? 1,
      life:    d.life?.[i] ?? 0,
      s1:      n(d.s1?.[i]), s2: n(d.s2?.[i]), s3: n(d.s3?.[i]),
      ms1:     n(d.ms1?.[i]), ms2: n(d.ms2?.[i]), ms3: n(d.ms3?.[i]),
      pos:     (() => { const v = d.pos?.[i]; return (v === 'None' || v === null || v === undefined) ? 0 : +v })(),
      pb:      b(d.pb?.[i]),
      del:     b(d.del?.[i]),
      fresh:   b(d.fresh?.[i]),
      iacc:    b(d.iacc?.[i]),
      status:  String(d.status?.[i] ?? '1'),
      vi1:     n(d.vi1?.[i]), vi2: n(d.vi2?.[i]), vfl: n(d.vfl?.[i]), vst: n(d.vst?.[i]),
      pin:     n(d.pin?.[i]), pout: n(d.pout?.[i]),
      sesT:    n(d.sesT?.[i]), lST: n(d.lST?.[i]),
    }))
  } catch { return [] }
}

// ── Telemetry ─────────────────────────────────────────────────────────────────
export async function fetchTelemetry(year: number, event: string, session: string, driver: string, lapNum: number): Promise<TelPoint[]> {
  try {
    const r = await fetchWithFallback(`${sessionPath(year, event, session)}/${driver}/${lapNum}_tel.json`)
    const raw = await r.json()
    const t = raw.tel ?? raw
    if (!t?.time?.length) return []
    const n = (v: any) => (v === null || v === undefined || v === 'None') ? 0 : +v
    return (t.time as any[]).map((_, i) => ({
      time:                  n(t.time[i]),
      speed:                 n(t.speed[i]),
      throttle:              n(t.throttle[i]),
      brake:                 t.brake?.[i] ? 1 : 0,
      gear:                  n(t.gear[i]),
      rpm:                   n(t.rpm[i]),
      drs:                   n(t.drs[i]),
      distance:              n(t.distance[i]),
      acc_x:                 n(t.acc_x?.[i]),
      acc_y:                 n(t.acc_y?.[i]),
      acc_z:                 n(t.acc_z?.[i]),
      x:                     n(t.x?.[i]),
      y:                     n(t.y?.[i]),
      z:                     n(t.z?.[i]),
      driverAhead:           String(t.DriverAhead?.[i] ?? ''),
      distanceToDriverAhead: n(t.DistanceToDriverAhead?.[i]),
    }))
  } catch { return [] }
}

// ── Fastest lap tel ────────────────────────────────────────────────────────────
export async function fetchFastestLapTel(year: number, event: string, session: string, driver: string): Promise<TelPoint[]> {
  const laps = await fetchLaptimes(year, event, session, driver)
  const valid = laps.filter(l => l.time !== null && !l.del).sort((a,b) => (a.time??9999)-(b.time??9999))
  if (!valid.length) return []
  return fetchTelemetry(year, event, session, driver, valid[0].lap)
}

// ── Corners ────────────────────────────────────────────────────────────────────
export async function fetchCorners(year: number, event: string, session: string): Promise<Corner[] | null> {
  try {
    const r = await fetchWithFallback(`${sessionPath(year, event, session)}/corners.json`)
    if (!r.ok) return null
    const d = await r.json()
    if (!d?.CornerNumber?.length) return null
    return (d.CornerNumber as number[]).map((_: number, i: number) => ({
      CornerNumber: d.CornerNumber[i], X: d.X[i], Y: d.Y[i],
      Angle: d.Angle[i], Distance: d.Distance[i],
    }))
  } catch { return null }
}

// ── Weather ────────────────────────────────────────────────────────────────────
export interface WeatherData {
  wT: number[]; wAT: number[]; wH: number[]; wP: number[]
  wR: boolean[]; wTT: number[]; wWD: number[]; wWS: number[]
}

export async function fetchWeather(year: number, event: string, session: string): Promise<WeatherData | null> {
  try {
    const r = await fetchWithFallback(`${sessionPath(year, event, session)}/weather.json`)
    if (!r.ok) return null
    const d = await r.json()
    // Normalize: wT is session time in seconds, other fields are measurements
    return {
      wT:  d.wT  ?? [],
      wAT: d.wAT ?? [],
      wH:  d.wH  ?? [],
      wP:  d.wP  ?? [],
      wR:  (d.wR  ?? []).map((v: any) => v === true || v === 'True' || v === 1),
      wTT: d.wTT ?? [],
      wWD: d.wWD ?? [],
      wWS: d.wWS ?? [],
    }
  } catch { return null }
}

// ── Race Control Messages ──────────────────────────────────────────────────────
export async function fetchRCM(year: number, event: string, session: string) {
  try {
    const r = await fetchWithFallback(`${sessionPath(year, event, session)}/rcm.json`)
    return await r.json()
  } catch { return null }
}

// ── Championship standings (Jolpica/Ergast) ───────────────────────────────────
export async function fetchDriverStandings(year: number) {
  try {
    const r = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/driverstandings/`)
    if (!r.ok) return []
    const d = await r.json()
    return d?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []
  } catch { return [] }
}
export async function fetchConstructorStandings(year: number) {
  try {
    const r = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/constructorstandings/`)
    if (!r.ok) return []
    const d = await r.json()
    return d?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? []
  } catch { return [] }
}
