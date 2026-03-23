function formatBytes(size: number) {
  const i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024))
  return (
    +(size / Math.pow(1024, i)).toFixed(2) * 1 +
    ['B', 'kB', 'MB', 'GB', 'TB'][i]
  )
}

export default function Progress({
  text,
  percentage,
  total,
}: {
  text: string
  percentage?: number
  total?: number
}) {
  percentage ??= 0
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-700 text-left rounded-lg overflow-hidden mb-0.5">
      <div
        className="px-1 text-sm bg-blue-400 whitespace-nowrap"
        style={{ width: `${percentage}%` }}
      >
        {text} ({percentage.toFixed(2)}%
        {isNaN(total as number) ? '' : ` of ${formatBytes(total as number)}`})
      </div>
    </div>
  )
}
