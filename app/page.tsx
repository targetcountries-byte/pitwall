'use client'
import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useStore } from '@/lib/store'
import { fetchDrivers, fetchLaptimes, fetchFastestLapTel, fetchTelemetry, fetchWeather, fetchCorners } from '@/lib/api'
import type { DriverData, LapRow, WeatherData } from '@/lib/api'
import { AVAILABLE_YEARS, EVENTS_BY_YEAR, SESSION_CODES, SESSION_MAP, SESSION_URL_MAP, COMPOUND_COLORS } from '@/lib/constants'
import dynamic from 'next/dynamic'
import { RefreshCw, Share2, Zap, Star, X, ChevronDown, ChevronUp } from 'lucide-react'

declare global { interface Window { __preselectedLaps?: {driver:string;lap:number}[] } }

const LapChart         = dynamic(()=>import('@/components/charts/LapChart').then(m=>({default:m.LapChart})),                {ssr:false,loading:()=><Sk h={460}/>})
const TelemetryChart   = dynamic(()=>import('@/components/charts/TelemetryChart').then(m=>({default:m.TelemetryChart})),    {ssr:false,loading:()=><Sk h={700}/>})
const StintChart       = dynamic(()=>import('@/components/charts/StintChart').then(m=>({default:m.StintChart})),            {ssr:false,loading:()=><Sk h={200}/>})
const TyreStrategyChart= dynamic(()=>import('@/components/charts/TyreStrategyChart').then(m=>({default:m.TyreStrategyChart})),{ssr:false,loading:()=><Sk h={160}/>})
const SectorChart      = dynamic(()=>import('@/components/charts/SectorChart').then(m=>({default:m.SectorChart})),          {ssr:false,loading:()=><Sk h={260}/>})
const PositionChart    = dynamic(()=>import('@/components/charts/PositionChart').then(m=>({default:m.PositionChart})),      {ssr:false,loading:()=><Sk h={260}/>})
const GGChart          = dynamic(()=>import('@/components/charts/GGChart').then(m=>({default:m.GGChart})),                  {ssr:false,loading:()=><Sk h={300}/>})
const WeatherChart     = dynamic(()=>import('@/components/charts/WeatherChart').then(m=>({default:m.WeatherChart})),        {ssr:false,loading:()=><Sk h={220}/>})
const TrackMap         = dynamic(()=>import('@/components/charts/TrackMap').then(m=>({default:m.TrackMap})),                {ssr:false,loading:()=><Sk h={280}/>})
const SelectedLapCards = dynamic(()=>import('@/components/charts/SelectedLapCards').then(m=>({default:m.SelectedLapCards})),{ssr:false})

function Sk({h}:{h:number}){ return <div className="w-full animate-pulse bg-base-300/20 rounded-xl" style={{height:h}}/> }
function fmt(t:number){ const m=Math.floor(t/60),s=(t%60).toFixed(3).padStart(6,'0'); return m>0?`${m}:${s}`:(t%60).toFixed(3) }

function Section({ id, title, desc, children, defaultOpen=true, badge }: { id:string; title:string; desc:string; children:React.ReactNode; defaultOpen?:boolean; badge?:string }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section id={id} className="mx-0.5 sm:mx-1 md:mx-2 lg:mx-4 mb-3">
      <div className="rounded-xl border border-white/[0.06]" style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
        <button onClick={()=>setOpen(o=>!o)}
          className="w-full flex items-center justify-between px-3 sm:px-5 py-3.5 hover:bg-white/[0.03] transition-colors rounded-t-xl">
          <div className="text-left flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-primary uppercase tracking-wider">{title}</h2>
            {badge && <span className="badge badge-primary badge-xs">{badge}</span>}
          </div>
          {open ? <ChevronUp size={14} className="text-primary/40 shrink-0"/> : <ChevronDown size={14} className="text-primary/40 shrink-0"/>}
        </button>
        {open && (
          <div className="px-2 sm:px-3 lg:px-5 pb-4 pt-1">
            {desc && <p className="text-xs text-base-content/30 mb-3">{desc}</p>}
            {children}
          </div>
        )}
      </div>
    </section>
  )
}

function Dashboard() {
  const sp = useSearchParams()
  const store = useStore()
  const { year,event,session,drivers,driverData,mode,fuelCorr,hideOutliers,
          smoothChart,showTrackStatus,autoSelectFastest,annotateCharts,favoriteDrivers,
          setYear,setEvent,setSession,setDrivers,setDriverData,toggle,addFavorite,removeFavorite,setMode } = store

  const [available, setAvailable] = useState<{driver:string;team:string;color:string;fn:string;ln:string;url:string}[]>([])
  const [loading,   setLoading]   = useState(false)
  const [loadSet,   setLoadSet]   = useState<Set<string>>(new Set())
  const [error,     setError]     = useState<string|null>(null)
  const [selLaps,   setSelLaps]   = useState<{key:string;driver:string;lap:number;time:number}[]>([])
  const [favInput,  setFavInput]  = useState('')
  const [urlDone,   setUrlDone]   = useState(false)
  const [weather,   setWeather]   = useState<WeatherData|null>(null)
  const [corners,   setCorners]   = useState<any[]|null>(null)

  const fetchedRef = useRef(new Set<string>())
  const sessKeyRef = useRef('')

  // URL params
  useEffect(() => {
    if (urlDone) return
    const y=sp.get('y'), e=sp.get('e'), s=sp.get('s')
    const d=sp.get('d'), l=sp.get('l'), m=sp.get('mode')
    const yr = y ? +y : year
    if (y) setYear(yr)
    if (e) {
      const evts = EVENTS_BY_YEAR[yr] ?? []
      const eDec = decodeURIComponent(e)
      const full = evts.find(ev => ev===eDec || ev.toLowerCase().includes(eDec.toLowerCase()) || ev.replace(' Grand Prix','').toLowerCase()===eDec.toLowerCase()) ?? eDec
      setEvent(full)
    }
    if (s) setSession(SESSION_URL_MAP[s] ?? s)
    if (d) setDrivers(d.split(',').filter(Boolean))
    if (m) setMode(m==='2'?'expert':'essential')
    if (l) {
      const pre = l.split(',').filter(Boolean).map(entry => {
        const parts = entry.split('-')
        if (parts.length >= 5) {
          const driver = parts[parts.length-2], lap = parseInt(parts[parts.length-1])
          return isNaN(lap) ? null : { driver, lap }
        }
        return null
      }).filter((x): x is {driver:string;lap:number} => x !== null)
      if (pre.length) window.__preselectedLaps = pre
    }
    setUrlDone(true)
  }, [sp, urlDone])

  // Load session data
  useEffect(() => {
    if (!event || !session) return
    const key = `${year}|${event}|${session}`
    if (sessKeyRef.current === key) return
    sessKeyRef.current = key
    fetchedRef.current = new Set()
    setLoading(true); setError(null); setAvailable([]); setWeather(null); setCorners(null)

    Promise.all([
      fetchDrivers(year, event, session),
      fetchWeather(year, event, session),
      fetchCorners(year, event, session),
    ]).then(([ds, weath, cors]) => {
      setAvailable(ds)
      setWeather(weath)
      setCorners(cors)

      const cur = useStore.getState().drivers
      if (!cur.length) {
        const pre = window.__preselectedLaps
        if (pre?.length) {
          const unique = [...new Set(pre.map(p=>p.driver))].filter(d=>ds.some(x=>x.driver===d))
          if (unique.length) { setDrivers(unique); window.__preselectedLaps = undefined; return }
        }
        const favHits = favoriteDrivers.filter(f=>ds.some(d=>d.driver===f))
        setDrivers(favHits.length ? favHits : ds.slice(0,5).map(d=>d.driver))
      }
    }).catch(() => setError(`No data for "${event}" — ${SESSION_MAP[session]??session} ${year}.\nPublished ~30 min after each session.`))
    .finally(() => setLoading(false))
  }, [year, event, session])

  // Load driver data
  useEffect(() => {
    if (!available.length) return
    const toLoad = drivers.filter(c => !fetchedRef.current.has(c) && !driverData[c])
    if (!toLoad.length) return
    toLoad.forEach(c => fetchedRef.current.add(c))
    setLoadSet(prev => new Set([...Array.from(prev), ...toLoad]))
    toLoad.forEach(async code => {
      const info = available.find(d=>d.driver===code)
      try {
        const [laps, tel] = await Promise.all([
          fetchLaptimes(year,event,session,code),
          autoSelectFastest ? fetchFastestLapTel(year,event,session,code) : Promise.resolve([])
        ])
        setDriverData(code, {code, team:info?.team??'', color:info?.color??'#888', fn:info?.fn??'', ln:info?.ln??'', photoUrl:info?.url??'', laps, tel, selectedLap:null})
      } catch {}
      finally { setLoadSet(prev => { const n=new Set(Array.from(prev)); n.delete(code); return n }) }
    })
  }, [drivers, available])

  const activeData: DriverData[] = drivers.map(d=>driverData[d]).filter(Boolean)

  const onLapClick = useCallback(async (code:string, lap:LapRow) => {
    const key = `${code}-${lap.lap}`
    setSelLaps(prev => prev.find(l=>l.key===key) ? prev.filter(l=>l.key!==key) : [...prev, {key,driver:code,lap:lap.lap,time:lap.time??0}])
    const tel = await fetchTelemetry(year,event,session,code,lap.lap)
    const ex = useStore.getState().driverData[code]
    if (ex) setDriverData(code, {...ex, tel, selectedLap:lap.lap})
  }, [year,event,session])

  const share = () => {
    const eShort = event.replace(' Grand Prix','')
    const sUrl = session==='FP1'?'P1':session==='FP2'?'P2':session==='FP3'?'P3':session
    const laps = selLaps.map(sl=>`${year}-${eShort.replace(/\s+/g,'-')}-${sUrl}-${sl.driver}-${sl.lap}`).join(',')
    const p = new URLSearchParams({y:String(year),e:eShort,s:sUrl,d:drivers.join(','),mode:mode==='expert'?'2':'1',trackStatus:'true'})
    if (laps) p.set('l', laps)
    navigator.clipboard.writeText(location.origin+'/?'+p).then(()=>alert('Share link copied!'))
  }

  const clearAll = () => { setDrivers([]); fetchedRef.current = new Set() }
  const events = EVENTS_BY_YEAR[year] ?? []

  const handleYear = (y:number) => { const evts=EVENTS_BY_YEAR[y]??[]; setYear(y); setEvent(evts[0]??''); setSession('Q') }
  const handleEvent = (e:string) => { setEvent(e); if (['Pre-Season Testing 1','Pre-Season Testing 2','Pre-Season Testing'].includes(e)) setSession('FP1') }

  return (
    <div className="container mx-auto max-w-screen-2xl px-1 sm:px-2 md:px-4">
      {/* Banner */}
      <div className="text-center text-xs text-base-content/20 py-1.5 select-none">
        Formula 1 Telemetry Analysis & Charts · Download, edit, and share the charts freely — no credits needed 💚
      </div>

      {/* ── SELECTORS ── */}
      <section className="mx-0.5 sm:mx-1 mb-3 relative z-[60]">
        <div className="rounded-xl border border-white/[0.08]" style={{background:'rgba(255,255,255,0.04)',backdropFilter:'blur(16px)'}}>

          {/* Essential / Expert */}
          <div className="flex justify-center pt-3 pb-0">
            <div className="tabs tabs-boxed bg-base-300/40">
              <button onClick={()=>setMode('essential')} className={`tab tab-sm ${mode==='essential'?'tab-active':''}`}>Essential</button>
              <button onClick={()=>setMode('expert')} className={`tab tab-sm ${mode==='expert'?'tab-active':''}`}>
                Expert <span className="badge badge-primary badge-xs ml-1">NEW</span>
              </button>
            </div>
          </div>

          {/* Year */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 z-[50] relative">
            <label className="block text-xs font-semibold text-base-content/50 uppercase tracking-widest mb-1.5">Select Year</label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_YEARS.map(y => (
                <button key={y} onClick={()=>handleYear(y)}
                  className={`btn btn-sm font-mono ${year===y?'btn-primary':'btn-ghost border border-base-300/40 hover:btn-primary hover:btn-outline'}`}>{y}</button>
              ))}
            </div>
          </div>

          {/* Event */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 z-[40] relative">
            <label className="block text-xs font-semibold text-base-content/50 uppercase tracking-widest mb-1.5">Select Event</label>
            <select id="eventSelect" value={event} onChange={e=>handleEvent(e.target.value)} className="ti-select max-w-lg text-sm">
              {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>

          {/* Session */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 z-[30] relative">
            <label className="block text-xs font-semibold text-base-content/50 uppercase tracking-widest mb-1.5">Select Session</label>
            <select id="sessionSelect" value={session} onChange={e=>setSession(e.target.value)} className="ti-select max-w-xs text-sm">
              {SESSION_CODES.map(s => <option key={s} value={s}>{SESSION_MAP[s]}</option>)}
            </select>
          </div>

          {/* Drivers */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 z-[20] relative">
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">Select Drivers</label>
              {loading && <RefreshCw size={11} className="animate-spin text-primary"/>}
              {loadSet.size>0 && <span className="text-[10px] text-base-content/35">{loadSet.size} loading…</span>}
            </div>

            {drivers.length>0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {drivers.map(d => {
                  const info = available.find(a=>a.driver===d)
                  return (
                    <button key={d} onClick={()=>{store.toggleDriver(d);fetchedRef.current.delete(d)}}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-mono font-bold cursor-pointer hover:opacity-70 transition-opacity"
                      style={{borderColor:info?.color??'#888',color:info?.color??'#888',background:(info?.color??'#888')+'18'}}>
                      {info?.url && <img src={info.url} alt={d} className="w-4 h-4 rounded-full object-cover object-top" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>}
                      {d} <X size={9}/>
                    </button>
                  )
                })}
                <button onClick={clearAll} className="inline-flex items-center gap-1 rounded-lg border border-error/30 px-2 py-1 text-[10px] text-error hover:bg-error/10">
                  <X size={9}/> clear all
                </button>
              </div>
            )}

            {available.length>0 && (
              <div id="driversSelect" className="flex flex-wrap gap-1.5">
                {available.map(d => {
                  const active = drivers.includes(d.driver), isLoad = loadSet.has(d.driver)
                  return (
                    <button key={d.driver} title={`${d.fn} ${d.ln} · ${d.team}`}
                      onClick={()=>{store.toggleDriver(d.driver);if(active)fetchedRef.current.delete(d.driver)}}
                      className={`btn btn-xs font-mono gap-1 ${active?'':'btn-ghost border border-base-300/40 opacity-55 hover:opacity-100'}`}
                      style={active?{borderColor:d.color,color:d.color,background:d.color+'22'}:{}}>
                      {isLoad&&<RefreshCw size={9} className="animate-spin"/>} {d.driver}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Favorites */}
          <div className="px-3 sm:px-4 lg:px-6 py-2 z-[10] relative">
            <div className="rounded-xl border border-primary/15 p-3" style={{background:'rgba(255,255,255,0.02)'}}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-1.5">
                  <Star size={10} className="text-warning fill-warning"/> Favorite Drivers
                </span>
                <span className="text-[9px] text-base-content/25">Auto-selected when available</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-5">
                {favoriteDrivers.length===0
                  ? <span id="favoriteDriversHint" className="text-xs text-base-content/15 italic">No favorite drivers saved yet.</span>
                  : <div id="favoriteDriversList" className="flex flex-wrap gap-1.5">{favoriteDrivers.map(d=>(
                    <span key={d} className="badge badge-outline badge-sm gap-1 font-mono">
                      <button onClick={()=>store.toggleDriver(d)} className="hover:text-primary">{d}</button>
                      <button onClick={()=>removeFavorite(d)}><X size={8} className="hover:text-error"/></button>
                    </span>
                  ))}</div>}
              </div>
              <div className="flex gap-1.5">
                <input id="favoriteDriverInput" value={favInput} maxLength={3}
                  onChange={e=>setFavInput(e.target.value.toUpperCase())}
                  onKeyDown={e=>{if(e.key==='Enter'&&favInput.length>=2){addFavorite(favInput);setFavInput('')}}}
                  className="input input-bordered input-xs w-20 font-mono uppercase bg-base-200/40" placeholder="HAM"/>
                <button onClick={()=>{if(favInput.length>=2){addFavorite(favInput);setFavInput('')}}} className="btn btn-primary btn-xs">Add</button>
                <button onClick={clearAll} className="btn btn-ghost btn-xs border border-base-300/30">Clear</button>
              </div>
              <p className="text-[9px] text-base-content/20 mt-1.5">Use 3-letter driver codes like HAM, VER, BOT.</p>
            </div>
          </div>

          {/* Controls */}
          <div id="lapchart-shared-controls" className="border-t border-white/[0.05] px-2 sm:px-4 py-2.5 flex flex-wrap items-center justify-center gap-0.5 sm:gap-1.5">
            {([
              ['autoSelectFastest', autoSelectFastest, 'Auto select fastest lap', <Zap key="z" size={11} className="text-warning"/>],
              ['fuelCorr',          fuelCorr,          'Fuel Correction',         null],
              ['annotateCharts',    annotateCharts,    'Annotate Charts',          null],
              ['hideOutliers',      hideOutliers,      'Hide Outliers(107%)',      null],
              ['smoothChart',       smoothChart,       'Smooth lap chart',         null],
              ['showTrackStatus',   showTrackStatus,   'Show Track Status',        null],
            ] as [string,boolean,string,React.ReactNode][]).map(([id,val,label,icon]) => (
              <label key={id} className="flex items-center gap-1 sm:gap-1.5 px-1 py-1 cursor-pointer select-none hover:scale-105 transition-transform">
                <input id={id} type="checkbox" checked={val} onChange={()=>toggle(id as any)} className="checkbox checkbox-primary checkbox-xs sm:checkbox-sm"/>
                {icon}<span className="text-xs sm:text-sm text-primary">{label}</span>
              </label>
            ))}
            <label className="flex items-center gap-1 sm:gap-1.5 px-1 py-1 cursor-pointer select-none hover:scale-105 transition-transform">
              <input type="checkbox" className="checkbox checkbox-primary checkbox-xs sm:checkbox-sm"/>
              <span className="text-xs sm:text-sm text-primary">Use Time X Axis</span>
              <span className="badge badge-primary badge-xs">NEW</span>
            </label>
            <button onClick={share} className="btn btn-ghost btn-xs gap-1 text-primary ml-auto sm:ml-0">
              <Share2 size={11}/> Share
            </button>
          </div>
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <div id="loadingOverlay" className="fixed inset-0 z-[150] flex flex-col items-center justify-center" style={{background:'rgba(0,10,30,0.85)',backdropFilter:'blur(4px)'}}>
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="animate-spin" style={{animationDuration:'1.2s'}} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--p)/0.15)" strokeWidth="8"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--p))" strokeWidth="8"
                  strokeLinecap="round" strokeDasharray="251" strokeDashoffset="188" transform="rotate(-90 50 50)"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl">⬡</span>
              </div>
            </div>
            <div id="loadingMessage" className="text-primary font-bold text-sm">Loading session data…</div>
            <div id="loadingContext" className="text-base-content/40 text-xs">{event} · {year} {SESSION_MAP[session]??session}</div>
          </div>
        </div>
      )}

      {/* Empty */}
      {!activeData.length && !loading && (
        <div id="noDataMessage" className="flex flex-col items-center justify-center min-h-[60vh] gap-4 select-none">
          <div className="text-6xl opacity-20">🏁</div>
          <div className="text-center">
            <p className="text-xl font-bold text-base-content/30">Select a year, event and session</p>
            <p className="text-sm text-base-content/20 mt-1">Live F1 telemetry · github.com/TracingInsights · Updated ~30min after sessions</p>
          </div>
          {error && <div className="alert alert-warning max-w-md text-sm py-3 rounded-xl whitespace-pre-wrap"><span>{error}</span></div>}
        </div>
      )}

      {/* ── ALL CHARTS ── */}
      {activeData.length > 0 && (<>

        {/* LAP CHART */}
        <section id="chart-container" className="mx-0.5 sm:mx-1 md:mx-2 lg:mx-4 mb-3">
          <div className="rounded-xl border border-white/[0.06] p-2 sm:p-3 lg:p-5 min-h-[36rem]"
            style={{background:'rgba(255,255,255,0.025)',backdropFilter:'blur(8px)'}}>
            <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
              <div>
                <h2 className="text-sm sm:text-xl font-bold text-primary">{event} — {year} {SESSION_MAP[session]??session}</h2>
                <p className="text-xs text-base-content/30 mt-0.5">{hideOutliers&&'Outliers hidden · '}{fuelCorr&&'Fuel corrected · '}Click any dot to load telemetry</p>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {loadSet.size>0&&<RefreshCw size={12} className="animate-spin text-primary"/>}
                {activeData.map(d => (
                  <span key={d.code} className="badge badge-sm font-mono gap-1"
                    style={{borderColor:d.color,color:d.color,background:d.color+'20'}}>
                    {d.photoUrl && <img src={d.photoUrl} alt={d.code} className="w-4 h-4 rounded-full object-cover object-top" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>}
                    {d.code}
                  </span>
                ))}
              </div>
            </div>

            <div id="chart">
              <LapChart drivers={activeData} fuelCorr={fuelCorr} hideOutliers={hideOutliers}
                smooth={smoothChart} showTrackStatus={showTrackStatus}
                onLapClick={onLapClick} selectedLapKeys={selLaps.map(l=>l.key)}/>
            </div>

            {/* Selected lap text list + cards */}
            {selLaps.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/[0.05]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-widest">Selected Laps ({selLaps.length})</h3>
                  <button onClick={()=>setSelLaps([])} className="btn btn-ghost btn-xs text-error text-[10px]">Clear All</button>
                </div>
                {/* Text list (matches TI's selectedLaps section) */}
                <div className="text-xs text-base-content/40 font-mono mb-2 flex flex-wrap gap-2">
                  {selLaps.map(sl => {
                    const info = available.find(d=>d.driver===sl.driver)
                    return (
                      <span key={sl.key} className="cursor-pointer hover:text-error transition-colors"
                        onClick={()=>setSelLaps(p=>p.filter(l=>l.key!==sl.key))}
                        style={{color:info?.color??'#888'}}>
                        {year}-{event.replace(' Grand Prix','').replace(/\s+/g,'-')}-{session}-{sl.driver}-{sl.lap}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* BIG Selected Lap Summary Cards — Image 3 */}
            {selLaps.length > 0 && (
              <SelectedLapCards
                selLaps={selLaps}
                drivers={activeData}
                available={available}
              />
            )}
          </div>
        </section>

        {/* WEATHER TREND — Image 1 shows this right after lap chart */}
        <Section id="weather-trend" title="WEATHER TREND"
          desc="Track temperature, air temperature, humidity and wind speed over the session duration.">
          <WeatherChart weather={weather}/>
        </Section>

        {/* STINT ANALYSIS */}
        <Section id="stint-analysis-section" title="STINT ANALYSIS"
          desc="Explore lap times within each stint. Tyre compound colors highlight performance changes.">
          <StintChart drivers={activeData}/>
        </Section>

        {/* SECTOR ANALYSIS */}
        <Section id="sector-chart-section" title="SECTOR ANALYSIS"
          desc="Analyze sector times (S1, S2, S3) across laps. Toggle sectors to compare specific areas.">
          <SectorChart drivers={activeData}/>
        </Section>

        {/* TYRE STRATEGY */}
        {mode === 'expert' && (
          <Section id="tyre-strategy-chart" title="TYRE STRATEGY"
            desc="Tyre strategy overview — compounds used, stint length, and pit stop timing per driver.">
            <TyreStrategyChart drivers={activeData}/>
          </Section>
        )}

        {/* POSITION CHANGES */}
        <Section id="position-changes-section" title="POSITION CHANGES"
          desc="Race position per lap. P1 at the top. Only available for Race and Sprint sessions.">
          <PositionChart drivers={activeData}/>
        </Section>

        {/* TRACK MAP — Image 4 */}
        <Section id="trackmap" title="TRACK MAP"
          desc="Circuit layout colored by driver telemetry position data. Load telemetry by clicking a lap.">
          <TrackMap drivers={activeData} corners={corners}/>
        </Section>

        {/* LAP TIMES DATA TABLE */}
        {mode === 'expert' && (
          <Section id="data-table-container" title="LAP TIMES DATA TABLE"
            desc="Tabular view of all lap times with sector splits, tyre data and speed traps." defaultOpen={false}>
            <LapDataTable drivers={activeData}/>
          </Section>
        )}

        {/* SPEED TRACE & TELEMETRY — Images 4,5,6 — 12 channels */}
        <Section id="tel-chart-container" title="SPEED TRACE & TELEMETRY"
          desc={activeData.some(d=>d.tel.length>0) ? 'Fastest lap telemetry. Click any lap dot above to compare specific laps.' : 'Click any lap dot on the chart above to load telemetry.'}>
          <TelemetryChart drivers={activeData}/>
        </Section>

        {/* GG PLOT — Expert only */}
        {mode === 'expert' && (
          <Section id="gg-plot" title="GG PLOT"
            desc="Lateral vs longitudinal G-force envelope. Load telemetry first.">
            <GGChart drivers={activeData}/>
          </Section>
        )}
      </>)}
    </div>
  )
}

// Inline data table
function LapDataTable({ drivers }: { drivers: DriverData[] }) {
  const all = drivers.flatMap(d => d.laps.filter(l=>l.time!==null).map(l=>({...l,code:d.code,color:d.color}))).sort((a,b)=>(a.time??0)-(b.time??0))
  const fmtT = (t:number|null) => { if(t==null)return'-'; const m=Math.floor(t/60),s=(t%60).toFixed(3).padStart(6,'0'); return m>0?`${m}:${s}`:(t%60).toFixed(3) }
  const CC: Record<string,string> = {SOFT:'#e8002d',MEDIUM:'#ffd600',HARD:'#f0f0ec',INTER:'#39b54a',WET:'#0067ff',UNKNOWN:'#888'}
  if (!all.length) return <div className="text-center py-8 text-base-content/25 text-sm">No lap data</div>
  return (
    <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg">
      <table className="table table-xs w-full font-mono">
        <thead className="sticky top-0 bg-base-300/95 backdrop-blur">
          <tr className="text-primary/60 text-[10px]">
            <th>Driver</th><th>Lap</th><th>Time</th><th>Tyre</th><th>Life</th><th>S1</th><th>S2</th><th>S3</th><th>Pos</th><th>FL Speed</th>
          </tr>
        </thead>
        <tbody>
          {all.slice(0,300).map((l,i) => (
            <tr key={i} className={`border-base-300/10 ${l.del?'opacity-20':''} ${l.pb?'bg-primary/5':''}`}>
              <td style={{color:(l as any).color}} className="font-bold">{(l as any).code}</td>
              <td className="opacity-50">{l.lap}</td>
              <td className={`font-bold ${l.pb?'text-primary':''}`}>{fmtT(l.time)}</td>
              <td><span className="px-1 rounded text-[9px] font-bold" style={{background:CC[l.compound]+'33',color:CC[l.compound]}}>{l.compound[0]}</span></td>
              <td className="opacity-40">{l.life}</td>
              <td className="opacity-50">{l.s1?.toFixed(3)??'-'}</td>
              <td className="opacity-50">{l.s2?.toFixed(3)??'-'}</td>
              <td className="opacity-50">{l.s3?.toFixed(3)??'-'}</td>
              <td className="opacity-35">{l.pos||'-'}</td>
              <td className="opacity-35">{l.vfl?Math.round(l.vfl):'-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
