export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent mx-auto" style={{ borderColor: "#5BC0F8", borderTopColor: "transparent" }}></div>
        <p className="mt-4 text-slate-600 font-medium">Loading...</p>
      </div>
    </div>
  )
}
