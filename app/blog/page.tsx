import Link from 'next/link'
export default function Page() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 p-6">
        <h1 className="text-2xl font-bold text-primary mb-2">Blog</h1>
        <p className="text-base-content/50 mb-4">Visit <a href="https://tracinginsights.com/blog/" target="_blank" className="text-primary hover:underline">tracinginsights.com/blog</a> for the full experience.</p>
        <Link href="/" className="btn btn-primary btn-sm">← Back to Dashboard</Link>
      </div>
    </div>
  )
}
