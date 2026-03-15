export default function Page({params}:{params:{year:string}}) {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-4">
      <div className="bg-base-100/30 backdrop-blur-md rounded-xl border border-white/10 p-6">
        <h1 className="text-2xl font-bold text-primary mb-2">F3 {params.year} Schedule</h1>
        <p className="text-base-content/50">Schedule data coming soon.</p>
      </div>
    </div>
  )
}
