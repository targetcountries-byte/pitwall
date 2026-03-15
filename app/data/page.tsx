import Link from 'next/link'
const REPOS = [
  { name:'2026', desc:'Live 2026 season — Chinese GP (Q+SQ+SR+FP1), Australian GP (Q+R), Pre-Season Testing 1 & 2', y:2026, e:'Chinese%20Grand%20Prix' },
  { name:'2025', desc:'Complete 2025 season — all 24 races + Pre-Season Testing. Full lap/tel data.', y:2025, e:'Chinese%20Grand%20Prix' },
  { name:'2024', desc:'Complete 2024 season — all 24 races with telemetry data.', y:2024, e:'Chinese%20Grand%20Prix' },
  { name:'2023', desc:'Complete 2023 season — 23 races + Pre-Season Testing.', y:2023, e:'Bahrain%20Grand%20Prix' },
  { name:'2022', desc:'Complete 2022 season — 23 races + Pre-Season Test.', y:2022, e:'Bahrain%20Grand%20Prix' },
]
export default function DataPage() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">Data</h1>
        <p className="text-sm text-base-content/50 mb-1">
          All data from <a href="https://github.com/TracingInsights" target="_blank" className="text-primary hover:underline font-mono">github.com/TracingInsights</a> — free, Apache 2.0 licensed.
        </p>
        <p className="text-xs text-base-content/30 mb-8">
          Served via <span className="font-mono text-primary">cdn.jsdelivr.net/gh/TracingInsights/&lt;year&gt;@main/</span> CDN. Updated ~30 min after each session ends.
        </p>
        <div className="space-y-3 mb-6">
          {REPOS.map(r => (
            <div key={r.name} className="bg-base-200/40 rounded-xl border border-white/5 p-4 hover:border-primary/30 transition-all">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-bold text-primary text-lg font-mono">{r.name}</h3>
                  <p className="text-sm text-base-content/50 mt-0.5">{r.desc}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={`https://github.com/TracingInsights/${r.name}`} target="_blank" className="btn btn-ghost btn-sm border border-base-300/50 font-mono">GitHub ↗</a>
                  <Link href={`/?y=${r.y}&e=${r.e}&s=Q`} className="btn btn-primary btn-sm">Analyse →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-base-200/30 rounded-xl p-4 border border-white/5">
          <h2 className="font-bold text-sm text-primary/70 uppercase tracking-widest mb-2">Data Schema</h2>
          <p className="text-xs text-base-content/40 mb-1">Each session folder contains:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {['drivers.json — driver info + colors','laptimes.json — 40+ fields per lap','{lap}_tel.json — telemetry data','corners.json — track corner positions','weather.json — track/air conditions','rcm.json — race control messages'].map(f => (
              <div key={f} className="text-[10px] font-mono bg-base-300/30 rounded p-1.5 text-base-content/50">{f}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
