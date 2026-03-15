'use client'
import { useEffect, useState } from 'react'
import { fetchDriverStandings, fetchConstructorStandings } from '@/lib/api'
import { TEAM_COLORS } from '@/lib/constants'
import { RefreshCw } from 'lucide-react'

export default function ChampionshipPage() {
  const [year, setYear] = useState(2025)
  const [tab, setTab] = useState<'drivers'|'constructors'>('drivers')
  const [drivers, setDrivers] = useState<any[]>([])
  const [constructors, setConstructors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [round, setRound] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchDriverStandings(year), fetchConstructorStandings(year)])
      .then(([d,c]) => { setDrivers(d); setConstructors(c); if(d[0]?.round) setRound(`After Round ${d[0].round}`) })
      .finally(() => setLoading(false))
  }, [year])

  const maxD = +drivers[0]?.points || 1
  const maxC = +constructors[0]?.points || 1

  return (
    <div className="container mx-auto max-w-screen-xl px-2 sm:px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-4 sm:p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">Championship Standings</h1>
            <p className="text-sm text-base-content/50 mt-1">{round || 'World Drivers\' & Constructors\' Championship'} · Via Jolpica/Ergast</p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <RefreshCw size={14} className="animate-spin text-primary"/>}
            <select value={year} onChange={e=>setYear(+e.target.value)} className="select select-bordered select-sm select-primary bg-base-200/50">
              {[2026,2025,2024,2023,2022,2021,2020].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="tabs tabs-boxed bg-base-300/30 mb-6 w-fit">
          <button onClick={()=>setTab('drivers')} className={`tab ${tab==='drivers'?'tab-active':''}`}>Drivers</button>
          <button onClick={()=>setTab('constructors')} className={`tab ${tab==='constructors'?'tab-active':''}`}>Constructors</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary"/></div>
        ) : tab==='drivers' ? (
          <div className="space-y-1.5">
            {drivers.map((s,i) => {
              const color = TEAM_COLORS[s.Constructors?.[0]?.name] ?? '#888'
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-base-200/40 hover:bg-base-200/70 transition-all">
                  <span className="text-xl font-bold text-base-content/20 w-8 text-right shrink-0">{s.position}</span>
                  <div className="w-1 h-10 rounded-full shrink-0" style={{background:color}}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{s.Driver.givenName} {s.Driver.familyName}</span>
                      <span className="badge badge-xs font-mono opacity-40">{s.Driver.code}</span>
                    </div>
                    <div className="text-xs text-base-content/40">{s.Constructors?.[0]?.name}</div>
                    <div className="mt-1.5 h-1 rounded-full bg-base-300/50 max-w-xs">
                      <div className="h-1 rounded-full transition-all duration-500" style={{width:`${(+s.points/maxD)*100}%`,background:color}}/>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-lg text-primary">{s.points}</div>
                    <div className="text-xs text-base-content/40">{s.wins}W</div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {constructors.map((s,i) => {
              const color = TEAM_COLORS[s.Constructor?.name] ?? '#888'
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-base-200/40 hover:bg-base-200/70 transition-all">
                  <span className="text-xl font-bold text-base-content/20 w-8 text-right shrink-0">{s.position}</span>
                  <div className="w-1 h-10 rounded-full shrink-0" style={{background:color}}/>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{s.Constructor?.name}</div>
                    <div className="mt-1.5 h-1 rounded-full bg-base-300/50 max-w-sm">
                      <div className="h-1 rounded-full transition-all duration-500" style={{width:`${(+s.points/maxC)*100}%`,background:color}}/>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-lg text-primary">{s.points}</div>
                    <div className="text-xs text-base-content/40">{s.wins}W</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
