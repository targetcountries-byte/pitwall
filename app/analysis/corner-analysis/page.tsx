import Link from 'next/link'
import { ANALYSIS_PAGES } from '@/lib/constants'
export default function Page() {
  const label = ANALYSIS_PAGES.find(p => p.slug === 'corner-analysis')?.label ?? 'Corner Analysis'
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">{label}</h1>
            <p className="text-sm text-base-content/50 mt-1">Select a year, event and session on the dashboard to view this analysis</p>
          </div>
          <Link href="/" className="btn btn-primary">Open Dashboard →</Link>
        </div>
        <div className="bg-base-200/40 rounded-xl border border-white/5 p-6 text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-base-content/50 mb-4">This analysis is available on the main dashboard after loading session data.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link href="/?y=2026&e=Australian%20Grand%20Prix&s=Q" className="btn btn-primary btn-sm">2026 Australian GP Q</Link>
            <Link href="/?y=2026&e=Chinese%20Grand%20Prix&s=SQ" className="btn btn-outline btn-primary btn-sm">2026 Chinese GP Sprint Q</Link>
            <Link href="/?y=2025&e=Chinese%20Grand%20Prix&s=Q" className="btn btn-outline btn-primary btn-sm">2025 Chinese GP Q</Link>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {ANALYSIS_PAGES.filter(p => p.slug !== 'corner-analysis').slice(0,8).map(p => (
            <Link key={p.slug} href={'/analysis/' + p.slug}
              className="text-xs p-2 rounded-lg bg-base-200/40 hover:bg-base-200/70 border border-white/5 hover:border-primary/30 transition-all text-base-content/60 hover:text-primary">
              {p.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
