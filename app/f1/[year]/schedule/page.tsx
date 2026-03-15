import { RACE_SCHEDULE_2025, RACE_SCHEDULE_2026, getFlag } from '@/lib/constants'
import Link from 'next/link'

const fmt = (d:string) => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
const daysTo = (d:string) => Math.ceil((new Date(d+'T12:00:00').getTime()-Date.now())/86400000)

export default function F1Schedule({params}:{params:{year:string}}) {
  const yr = parseInt(params.year)||2026
  const sched = yr===2026?RACE_SCHEDULE_2026:RACE_SCHEDULE_2025
  const now = new Date()
  const upcoming = sched.filter(r=>new Date(r.r+'T23:59:59')>=now)

  return (
    <div className="container mx-auto max-w-screen-xl px-2 sm:px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-4 sm:p-6 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">F1 {yr} Schedule</h1>
            <p className="text-sm text-base-content/50 mt-1">{sched.filter(r=>!(r as any).testing).length} races · {sched.filter(r=>r.sprint).length} sprint weekends</p>
          </div>
          <div className="flex gap-2">
            {[2025,2026].map(y=><Link key={y} href={`/f1/${y}/schedule`} className={`btn btn-sm ${y===yr?'btn-primary':'btn-ghost border border-base-300/50'}`}>{y}</Link>)}
          </div>
        </div>
      </div>

      {upcoming.length>0 && (
        <div className="mb-4">
          <h2 className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-3 px-1">Upcoming — {upcoming.length} remaining</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
            {upcoming.slice(0,8).map(race=>{
              const days=daysTo(race.r), isNext=days>=0&&days<=10
              return (
                <div key={`${race.round}-${race.name}`} className={`bg-base-100/30 backdrop-blur-md rounded-xl border p-4 hover:border-primary/50 transition-all ${isNext?'border-primary/40 shadow-lg shadow-primary/10':'border-white/5'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono text-base-content/30">{(race as any).testing?'TESTING':`RD ${race.round}`}</span>
                    {isNext&&<span className={`badge badge-xs ${days===0?'badge-error':days<=2?'badge-warning':'badge-primary'}`}>{days===0?'TODAY':days===1?'Tomorrow':`${days}d`}</span>}
                  </div>
                  <h3 className="font-bold text-sm mb-0.5">{getFlag(race.country)} {race.name}</h3>
                  <p className="text-xs text-base-content/40 mb-2">{race.loc}</p>
                  <div className="text-xs text-primary font-semibold font-mono mb-3">{fmt(race.r)}</div>
                  <div className="flex items-center justify-between">
                    <div>{race.sprint&&<span className="badge badge-warning badge-outline badge-xs">Sprint</span>}{(race as any).testing&&<span className="badge badge-info badge-outline badge-xs">Test</span>}</div>
                    <Link href={`/?y=${yr}&e=${encodeURIComponent(race.name)}&s=${(race as any).testing?'FP1':'Q'}`} className="btn btn-primary btn-xs">Analyse →</Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10"><h2 className="text-xs font-bold text-primary/60 uppercase tracking-widest">Full F1 {yr} Calendar</h2></div>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead><tr className="border-base-300/20 bg-base-300/20 text-primary/60">
              <th className="text-xs w-10">Rd</th><th className="text-xs">Grand Prix</th>
              <th className="text-xs hidden sm:table-cell">Location</th>
              <th className="text-xs">Race</th>
              <th className="text-xs hidden sm:table-cell">Format</th>
              <th className="text-xs">Analysis</th>
            </tr></thead>
            <tbody>
              {sched.map(race=>{
                const isPast=new Date(race.r+'T23:59:59')<now, days=daysTo(race.r), isNext=days>=0&&days<=10
                return (
                  <tr key={`${race.round}-${race.name}`} className={`border-base-300/10 hover:bg-base-300/20 transition-colors ${isPast?'opacity-40':''}${isNext?' bg-primary/5':''}`}>
                    <td className="font-mono text-xs text-base-content/30">{(race as any).testing?'T':race.round}</td>
                    <td><span className="font-semibold text-sm">{getFlag(race.country)} {race.name.replace(' Grand Prix',' GP')}</span></td>
                    <td className="text-xs text-base-content/40 hidden sm:table-cell">{race.loc}</td>
                    <td className="font-mono text-xs">{fmt(race.r)}</td>
                    <td className="hidden sm:table-cell">{race.sprint&&<span className="badge badge-warning badge-outline badge-xs">Sprint</span>}{(race as any).testing&&<span className="badge badge-info badge-outline badge-xs">Test</span>}</td>
                    <td className="flex gap-1">
                      {!(race as any).testing&&<Link href={`/?y=${yr}&e=${encodeURIComponent(race.name)}&s=Q`} className="btn btn-ghost btn-xs text-primary font-mono">Q</Link>}
                      {!(race as any).testing&&<Link href={`/?y=${yr}&e=${encodeURIComponent(race.name)}&s=R`} className="btn btn-ghost btn-xs text-primary font-mono">R</Link>}
                      {(race as any).testing&&<Link href={`/?y=${yr}&e=${encodeURIComponent(race.name)}&s=FP1`} className="btn btn-ghost btn-xs text-primary font-mono">FP1</Link>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
