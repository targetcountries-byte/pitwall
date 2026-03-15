import Link from 'next/link'
import { ANALYSIS_PAGES } from '@/lib/constants'
export default function AnalysisPage() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">Your one-stop home for unparalleled F1 insights</h1>
        <p className="text-sm text-base-content/50 mb-8">All analysis powered by live telemetry data from <a href="https://github.com/TracingInsights" target="_blank" className="text-primary hover:underline">github.com/TracingInsights</a></p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ANALYSIS_PAGES.map(p => (
            <Link key={p.slug} href={`/analysis/${p.slug}`}
              className="bg-base-200/50 rounded-xl border border-white/5 p-4 hover:border-primary/50 hover:bg-base-200/80 transition-all group">
              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{p.label}</h3>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
