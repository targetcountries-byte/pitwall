import Link from 'next/link'
export default function Page() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">Laptimes Delta</h1>
        <p className="text-base-content/50 mb-6">Use the main dashboard to load session data, then this analysis will show here.</p>
        <Link href="/" className="btn btn-primary">← Go to Lap Times Dashboard</Link>
      </div>
    </div>
  )
}
