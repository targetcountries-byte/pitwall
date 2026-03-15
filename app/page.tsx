'use client'
import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { fetchDrivers, fetchLaptimes, fetchFastestLapTel, fetchTelemetry } from '@/lib/api'
import type { DriverData, LapRow } from '@/lib/api'
import { AVAILABLE_YEARS, EVENTS_BY_YEAR, SESSION_CODES, SESSION_MAP, SESSION_URL_MAP, COMPOUND_COLORS } from '@/lib/constants'
import dynamic from 'next/dynamic'
import { RefreshCw, Share2, Zap, Star, X, ChevronDown, ChevronUp } from 'lucide-react'

const LapChart         = dynamic(()=>import('@/components/charts/LapChart').then(m=>({default:m.LapChart})),         {ssr:false,loading:()=><Sk h={460}/>})
const TelemetryChart   = dynamic(()=>import('@/components/charts/TelemetryChart').then(m=>({default:m.TelemetryChart})),  {ssr:false,loading:()=><Sk h={400}/>})
const StintChart       = dynamic(()=>import('@/components/charts/StintChart').then(m=>({default:m.StintChart})),         {ssr:false,loading:()=><Sk h={200}/>})
const TyreStrategyChart= dynamic(()=>import('@/components/charts/TyreStrategyChart').then(m=>({default:m.TyreStrategyChart})),{ssr:false,loading:()=><Sk h={160}/>})
const SectorChart      = dynamic(()=>import('@/components/charts/SectorChart').then(m=>({default:m.SectorChart})),       {ssr:false,loading:()=><Sk h={260}/>})
const PositionChart    = dynamic(()=>import('@/components/charts/PositionChart').then(m=>({default:m.PositionChart})),   {ssr:false,loading:()=><Sk h={260}/>})
const GGChart          = dynamic(()=>import('@/components/charts/GGChart').then(m=>({default:m.GGChart})),               {ssr:false,loading:()=><Sk h={300}/>})

function Sk({h}:{h:number}){ return <div className="w-full animate-pulse bg-base-300/30 rounded-xl" style={{height:h}}/> }
function fmt(t:number){ const m=Math.floor(t/60),s=(t%60).toFixed(3).padStart(6,'0'); return m>0?`${m}:${s}`:(t%60).toFixed(3) }

// Section wrapper — collapsible like tracinginsights
function Section({ id, title, desc, children, defaultOpen=true }: { id:string; title:string; desc:string; children:React.ReactNode; defaultOpen?:boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section id={id} className="mx-0.5 sm:mx-1 md:mx-2 lg:mx-4 mb-3">
      <div className="bg-base-100/20 rounded-xl border border-white/5">
        <button onClick={()=>setOpen(o=>!o)}
          className="w-full flex items-center justify-between px-3 sm:px-5 py-3 hover:bg-white/5 transition-colors rounded-xl">
          <div className="text-left">
            <h2 className="text-sm sm:text-base font-bold text-primary uppercase tracking-wide">{title}</h2>
            <p className="text-xs text-base-content/35 mt-0.5">{desc}</p>
          </div>
          {open ? <ChevronUp size={16} className="text-primary/50 shrink-0"/> : <ChevronDown size={16} className="text-primary/50 shrink-0"/>}
        </button>
        {open && <div className="px-2 sm:px-4 pb-4">{children}</div>}
      </div>
    </section>
  )
}

function Dashboard() {
  const sp = useSearchParams()
  const router = useRouter()
  const store = useStore()
  const { year, event, session, drivers, driverData, mode, fuelCorr, hideOutliers,
          smoothChart, showTrackStatus, autoSelectFastest, favoriteDrivers,
          setYear, setEvent, setSession, setDrivers, setDriverData, toggle, addFavorite, removeFavorite, setMode } = store

  const [available, setAvailable]     = useState<{driver:string;team:string;color:string;fn:string;ln:string;url:string}[]>([])
  const [loading,   setLoading]       = useState(false)
  const [loadSet,   setLoadSet]       = useState<Set<string>>(new Set())
  const [error,     setError]         = useState<string|null>(null)
  const [selLaps,   setSelLaps]       = useState<{key:string;driver:string;lap:number;time:number}[]>([])
  const [favInput,  setFavInput]      = useState('')
  const [urlDone,   setUrlDone]       = useState(false)

  const fetchedRef = useRef(new Set<string>())
  const sessKeyRef = useRef('')

  // Parse URL params on mount (TracingInsights uses y=,e=,s=,d=,l=,mode=)
  useEffect(() => {
    if (urlDone) return
    const y = sp.get('y'), e = sp.get('e'), s = sp.get('s')
    const d = sp.get('d'), m = sp.get('mode')
    if (y) setYear(+y)
    if (e) {
      // TracingInsights shortens event names: "Chinese" -> match full name
      const yr = y ? +y : year
      const evts = EVENTS_BY_YEAR[yr] ?? []
      const full = evts.find(ev => ev.toLowerCase().includes(e.toLowerCase()) || ev.replace(' Grand Prix','').toLowerCase() === e.toLowerCase()) ?? e
      setEvent(full)
    }
    if (s) {
      const sessionCode = SESSION_URL_MAP[s] ?? s
      setSession(sessionCode)
    }
    if (d) setDrivers(d.split(',').filter(Boolean))
    if (m) setMode(m === '2' ? 'expert' : 'essential')
    setUrlDone(true)
  }, [sp, urlDone])

  // Load drivers list when year/event/session changes
  useEffect(() => {
    if (!event || !session) return
    const key = `${year}|${event}|${session}`
    if (sessKeyRef.current === key) return
    sessKeyRef.current = key
    fetchedRef.current = new Set()
    setLoading(true); setError(null); setAvailable([])
    fetchDrivers(year, event, session)
      .then(ds => {
        setAvailable(ds)
        const cur = useStore.getState().drivers
        if (!cur.length) {
          const favHits = favoriteDrivers.filter(f => ds.some(d => d.driver === f))
          setDrivers(favHits.length ? favHits : ds.slice(0,5).map(d => d.driver))
        }
      })
      .catch(() => setError(`No data for "${event}" — ${SESSION_MAP[session]??session} ${year}.\nData is published ~30 min after each session ends.`))
      .finally(() => setLoading(false))
  }, [year, event, session])

  // Fetch data for newly selected drivers
  useEffect(() => {
    if (!available.length) return
    const toLoad = drivers.filter(c => !fetchedRef.current.has(c) && !driverData[c])
    if (!toLoad.length) return
    toLoad.forEach(c => fetchedRef.current.add(c))
    setLoadSet(prev => new Set([...Array.from(prev), ...toLoad]))
    toLoad.forEach(async code => {
      const info = available.find(d => d.driver === code)
      try {
        const [laps, tel] = await Promise.all([
          fetchLaptimes(year, event, session, code),
          autoSelectFastest ? fetchFastestLapTel(year, event, session, code) : Promise.resolve([])
        ])
        setDriverData(code, { code, team:info?.team??'', color:info?.color??'#888', fn:info?.fn??'', ln:info?.ln??'', photoUrl:info?.url??'', laps, tel, selectedLap:null })
      } catch {}
      finally { setLoadSet(prev => { const n = new Set(Array.from(prev)); n.delete(code); return n }) }
    })
  }, [drivers, available])

  const activeData: DriverData[] = drivers.map(d => driverData[d]).filter(Boolean)

  const onLapClick = useCallback(async (code: string, lap: LapRow) => {
    const key = `${code}-${lap.lap}`
    setSelLaps(prev => prev.find(l => l.key === key) ? prev.filter(l => l.key !== key) : [...prev, {key,driver:code,lap:lap.lap,time:lap.time??0}])
    const tel = await fetchTelemetry(year, event, session, code, lap.lap)
    const ex = useStore.getState().driverData[code]
    if (ex) setDriverData(code, {...ex, tel, selectedLap: lap.lap})
  }, [year, event, session])

  const share = () => {
    // Build TracingInsights-style URL
    const eShort = event.replace(' Grand Prix','')
    const sUrl = session === 'FP1'?'P1' : session === 'FP2'?'P2' : session === 'FP3'?'P3' : session
    const p = new URLSearchParams({ y:String(year), e:eShort, s:sUrl, d:drivers.join(','), mode:mode==='expert'?'2':'1' })
    navigator.clipboard.writeText(location.origin+'/?'+p).then(()=>alert('Share link copied!'))
  }

  const clearAll = () => { setDrivers([]); fetchedRef.current = new Set() }
  const events = EVENTS_BY_YEAR[year] ?? []

  const handleYear = (y: number) => {
    const evts = EVENTS_BY_YEAR[y] ?? []
    setYear(y); setEvent(evts[0] ?? ''); setSession('Q')
  }
  const handleEvent = (e: string) => {
    setEvent(e)
    const testingPrefixes = ['Pre-Season']
    if (testingPrefixes.some(p => e.startsWith(p))) setSession('FP1')
  }

  return (
    <div className="container mx-auto max-w-screen-2xl px-1 sm:px-2 md:px-4">

      {/* Banner (TracingInsights shows article banners) */}
      <div className="mx-0.5 sm:mx-1 mb-2 text-center text-xs text-base-content/30 py-1">
        Formula 1 Telemetry Analysis & Charts · Download, edit, and share the charts freely — no credits needed 💚
      </div>

      {/* ── SELECTORS CARD ── */}
      <section className="mx-0.5 sm:mx-1 mb-3 relative z-[60]">
        <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">

          {/* Essential / Expert toggle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="tabs tabs-boxed bg-base-300/40">
              <button onClick={()=>setMode('essential')} className={`tab tab-sm ${mode==='essential'?'tab-active':''}`}>Essential</button>
              <button onClick={()=>setMode('expert')} className={`tab tab-sm ${mode==='expert'?'tab-active':''}`}>
                Expert <span className="badge badge-primary badge-xs ml-1">NEW</span>
              </button>
            </div>
          </div>

          {/* Year */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 relative z-[50]">
            <label className="block text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">Select Year</label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_YEARS.map(y => (
                <button key={y} onClick={()=>handleYear(y)}
                  className={`btn btn-sm font-mono ${year===y?'btn-primary':'btn-ghost border border-base-300/40 hover:btn-primary hover:btn-outline'}`}>{y}</button>
              ))}
            </div>
          </div>

          {/* Event */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 relative z-[40]">
            <label className="block text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">Select Event</label>
            <select id="eventSelect" value={event} onChange={e=>handleEvent(e.target.value)}
              className="ti-select max-w-lg text-sm">
              {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>

          {/* Session */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 relative z-[30]">
            <label className="block text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">Select Session</label>
            <select id="sessionSelect" value={session} onChange={e=>setSession(e.target.value)}
              className="ti-select max-w-xs text-sm">
              {SESSION_CODES.map(s => <option key={s} value={s}>{SESSION_MAP[s]}</option>)}
            </select>
          </div>

          {/* Drivers */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 relative z-[20]">
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Select Drivers</label>
              {loading && <RefreshCw size={12} className="animate-spin text-primary"/>}
              {loadSet.size > 0 && <span className="text-[10px] text-base-content/40">{loadSet.size} loading…</span>}
            </div>

            {/* Selected tags */}
            {drivers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {drivers.map(d => {
                  const info = available.find(a => a.driver === d)
                  return (
                    <button key={d} onClick={()=>{store.toggleDriver(d);fetchedRef.current.delete(d)}}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-mono font-semibold cursor-pointer hover:opacity-70 transition-opacity"
                      style={{borderColor:info?.color??'#888',color:info?.color??'#888',background:(info?.color??'#888')+'18'}}>
                      {info?.url && <img src={info.url} alt={d} className="w-4 h-4 rounded-full object-cover object-top" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>}
                      {d} <X size={9}/>
                    </button>
                  )
                })}
                <button onClick={clearAll} className="inline-flex items-center gap-1 rounded-lg border border-error/30 px-2 py-1 text-[10px] text-error hover:bg-error/10 cursor-pointer">
                  <X size={9}/> clear all
                </button>
              </div>
            )}

            {/* Available driver pills */}
            {available.length > 0 && (
              <div id="driversSelect" className="flex flex-wrap gap-1.5">
                {available.map(d => {
                  const active = drivers.includes(d.driver)
                  const isLoad = loadSet.has(d.driver)
                  return (
                    <button key={d.driver} title={`${d.fn} ${d.ln} · ${d.team}`}
                      onClick={()=>{store.toggleDriver(d.driver);if(active)fetchedRef.current.delete(d.driver)}}
                      className={`btn btn-xs font-mono gap-1 ${active?'btn-primary':' btn-ghost border border-base-300/40 opacity-60 hover:opacity-100'}`}
                      style={active?{borderColor:d.color,color:d.color,background:d.color+'22'}:{}}>
                      {isLoad?<RefreshCw size={9} className="animate-spin"/>:null}
                      {d.driver}
                    </button>
                  )
                })}
              </div>
            )}

            {error && <div className="alert alert-warning text-xs py-2 mt-2 rounded-lg whitespace-pre-wrap"><span>{error}</span></div>}
          </div>

          {/* Favorites */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 relative z-[10]">
            <div className="bg-base-200/30 border border-primary/15 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider flex items-center gap-1.5">
                  <Star size={11} className="text-warning fill-warning"/> Favorite Drivers
                </span>
                <span className="text-[10px] text-base-content/30">Auto-selected when available</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-5">
                {favoriteDrivers.length === 0
                  ? <span id="favoriteDriversHint" className="text-xs text-base-content/20 italic">No favorite drivers saved yet.</span>
                  : <div id="favoriteDriversList" className="flex flex-wrap gap-1.5">{favoriteDrivers.map(d=>(
                    <span key={d} className="badge badge-outline badge-sm gap-1 font-mono">
                      <button onClick={()=>store.toggleDriver(d)} className="hover:text-primary">{d}</button>
                      <button onClick={()=>removeFavorite(d)}><X size={8} className="hover:text-error"/></button>
                    </span>
                  ))}</div>}
              </div>
              <div className="flex gap-1.5 items-center">
                <input id="favoriteDriverInput" value={favInput} maxLength={3}
                  onChange={e=>setFavInput(e.target.value.toUpperCase())}
                  onKeyDown={e=>{if(e.key==='Enter'&&favInput.length>=2){addFavorite(favInput);setFavInput('')}}}
                  className="input input-bordered input-xs w-24 font-mono uppercase bg-base-200/50" placeholder="HAM"/>
                <button onClick={()=>{if(favInput.length>=2){addFavorite(favInput);setFavInput('')}}} className="btn btn-primary btn-xs">Add</button>
                <button onClick={clearAll} className="btn btn-ghost btn-xs border border-base-300/40">Clear</button>
              </div>
              <p className="text-[10px] text-base-content/25 mt-1.5">Use 3-letter driver codes like HAM, VER, BOT.</p>
            </div>
          </div>

          {/* Controls bar — exact like TracingInsights */}
          <div id="lapchart-shared-controls" className="border-t border-base-300/20 px-2 sm:px-4 py-2.5 flex flex-wrap items-center justify-center gap-0.5 sm:gap-1.5">
            {([
              ['autoSelectFastest', autoSelectFastest, 'Auto select fastest lap', <Zap key="z" size={12} className="text-warning"/>],
              ['fuelCorr',          fuelCorr,          'Fuel Correction',         null],
              ['hideOutliers',      hideOutliers,      'Hide Outliers(107%)',      null],
              ['smoothChart',       smoothChart,       'Smooth lap chart',         null],
              ['showTrackStatus',   showTrackStatus,   'Show Track Status',        null],
            ] as [string,boolean,string,React.ReactNode][]).map(([id,val,label,icon]) => (
              <label key={id} className="flex items-center gap-1 sm:gap-1.5 px-1 py-1 cursor-pointer select-none hover:scale-105 transition-transform">
                <input id={id} type="checkbox" checked={val} onChange={()=>toggle(id as any)} className="checkbox checkbox-primary checkbox-xs sm:checkbox-sm"/>
                {icon}<span className="text-xs sm:text-sm text-primary">{label}</span>
              </label>
            ))}
            <button onClick={share} className="btn btn-ghost btn-xs gap-1 text-primary ml-auto">
              <Share2 size={11}/> Share
            </button>
          </div>
        </div>
      </section>

      {/* Loading */}
      {loading && <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary"/></div>}

      {/* Empty */}
      {!activeData.length && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-base-content/15 select-none">
          <div className="text-8xl">🏁</div>
          <p className="text-xl font-semibold">Select a year, event and session</p>
          <p className="text-sm opacity-70">Live F1 telemetry from github.com/TracingInsights</p>
        </div>
      )}

      {/* ── CHARTS (only when data loaded) ── */}
      {activeData.length > 0 && (<>

        {/* LAP CHART */}
        <section id="chart-container" className="mx-0.5 sm:mx-1 md:mx-2 lg:mx-4 mb-3">
          <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-2 sm:p-3 lg:p-5 min-h-[38rem]">
            <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
              <div>
                <h2 className="text-sm sm:text-xl font-bold text-primary">
                  {event} — {year} {SESSION_MAP[session]??session}
                </h2>
                <p className="text-xs text-base-content/35 mt-0.5">
                  {hideOutliers&&'Outliers hidden · '}{fuelCorr&&'Fuel corrected · '}Click any dot to load telemetry
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {loadSet.size>0 && <RefreshCw size={12} className="animate-spin text-primary"/>}
                {activeData.map(d => (
                  <span key={d.code} className="badge badge-sm font-mono gap-1"
                    style={{borderColor:d.color,color:d.color,background:d.color+'20'}}>
                    {d.photoUrl && <img src={d.photoUrl} alt={d.code} className="w-4 h-4 rounded-full object-cover object-top" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>}
                    {d.code}
                  </span>
                ))}
              </div>
            </div>

            <div id="chart"><LapChart drivers={activeData} fuelCorr={fuelCorr} hideOutliers={hideOutliers}
              smooth={smoothChart} showTrackStatus={showTrackStatus}
              onLapClick={onLapClick} selectedLapKeys={selLaps.map(l=>l.key)}/></div>

            {/* Selected lap cards */}
            {selLaps.length > 0 && (
              <div id="telemetry-lap-cards" className="mt-4 pt-3 border-t border-base-300/20">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-widest">Laps Selected ({selLaps.length})</h3>
                  <button onClick={()=>setSelLaps([])} className="btn btn-ghost btn-xs text-error text-[10px]">Clear All</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {selLaps.map(sl => {
                    const info = available.find(d => d.driver === sl.driver)
                    const lap = driverData[sl.driver]?.laps.find(l => l.lap === sl.lap)
                    const c = info?.color ?? '#888'
                    return (
                      <div key={sl.key} onClick={()=>setSelLaps(p=>p.filter(l=>l.key!==sl.key))}
                        className="rounded-lg border p-2 cursor-pointer hover:opacity-60 transition-opacity relative group"
                        style={{borderColor:c+'44',background:c+'0c'}}>
                        <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={9} className="text-error"/></button>
                        <div className="font-mono text-xs font-bold mb-0.5" style={{color:c}}>{sl.driver}</div>
                        <div className="text-xs text-base-content/50">Lap {sl.lap}</div>
                        <div className="text-sm font-bold text-primary font-mono">{fmt(sl.time)}</div>
                        {lap && (
                          <>
                            <span className="inline-block text-[9px] px-1.5 py-0.5 rounded font-mono mt-1 font-bold"
                              style={{background:COMPOUND_COLORS[lap.compound]+'2a',color:COMPOUND_COLORS[lap.compound],border:`1px solid ${COMPOUND_COLORS[lap.compound]}55`}}>
                              {lap.compound[0]} {lap.life}L{lap.fresh?' ★':''}
                            </span>
                            {lap.s1 != null && (
                              <div className="text-[9px] text-base-content/30 mt-1 font-mono">
                                {lap.s1.toFixed(3)} · {lap.s2?.toFixed(3)} · {lap.s3?.toFixed(3)}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* TELEMETRY */}
        <Section id="tel-chart-container" title="Speed Trace & Telemetry"
          desc={activeData.some(d=>d.tel.length>0) ? 'Fastest lap telemetry. Click any lap dot above to compare specific laps.' : 'Click any lap dot above to load telemetry comparison.'}>
          <TelemetryChart drivers={activeData}/>
        </Section>

        {/* STINT ANALYSIS */}
        <Section id="stint-analysis-section" title="Stint Analysis"
          desc="Explore lap times within each stint. Stint numbers reset to 1 after every pit stop, with tyre compound colors highlighting performance changes.">
          <StintChart drivers={activeData}/>
        </Section>

        {/* TYRE STRATEGY */}
        <Section id="tyre-strategy-chart" title="Tyre Strategy"
          desc="Overview of tyre strategy per driver — compounds used, stint length, and pit stop timing.">
          <TyreStrategyChart drivers={activeData}/>
        </Section>

        {/* SECTOR ANALYSIS */}
        <Section id="sector-chart-section" title="Sector Analysis"
          desc="Analyze sector times (S1, S2, S3) across laps. Toggle sectors to compare specific performance areas.">
          <SectorChart drivers={activeData}/>
        </Section>

        {/* POSITION CHANGES */}
        <Section id="position-changes-section" title="Position Changes"
          desc="Track driver positions lap-by-lap. Lines show how each driver's race position evolved. P1 at the top.">
          <PositionChart drivers={activeData}/>
        </Section>

        {/* GG PLOT — Expert only */}
        {mode === 'expert' && (
          <Section id="gg-plot" title="GG Plot" desc="Lateral vs longitudinal G-forces. Reveals the car performance envelope. Load telemetry above first.">
            <GGChart drivers={activeData}/>
          </Section>
        )}
      </>)}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><span className="loading loading-spinner loading-lg text-primary"/></div>}>
      <Dashboard/>
    </Suspense>
  )
}
