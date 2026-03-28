export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-96 bg-gray-200 rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="h-96 bg-gray-200 rounded animate-pulse" />
    </div>
  )
}
