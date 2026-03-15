import Link from 'next/link'
export default function BlogPage() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">Blog</h1>
        <p className="text-base-content/50 mb-6">F1 race analysis articles and insights.</p>
        <div className="bg-base-200/40 rounded-xl border border-white/5 p-8 text-center">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-base-content/50 mb-4">Read the latest F1 analysis articles on the official TracingInsights blog.</p>
          <a href="https://tracinginsights.com/blog/" target="_blank" className="btn btn-primary">Visit Blog ↗</a>
        </div>
        <div className="mt-4">
          <Link href="/" className="btn btn-ghost btn-sm">← Back to Dashboard</Link>
        </div>
      </div>
    </div>
  )
}
