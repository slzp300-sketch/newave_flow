const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
  secondary: 'bg-white text-primary-700 border border-primary-200 active:bg-primary-50',
  outline: 'bg-white text-primary-700 border border-primary-200 active:bg-primary-50',
  danger: 'bg-red-600 text-white active:bg-red-700',
  ghost: 'bg-transparent text-gray-600 active:bg-gray-100',
}
const sizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'w-full px-4 py-3.5 text-base',
}
export default function Button({ children, variant = 'primary', size = 'md', className = '', loading = false, disabled = false, ...props }) {
  return (
    <button {...props} disabled={loading || disabled} aria-busy={loading || undefined}
      className={`motion-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
      {loading && <svg aria-hidden="true" className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>}
      {children}
    </button>
  )
}
