const variants = {
  primary:   'bg-primary-600 text-white active:bg-primary-700 shadow-md shadow-primary-100',
  secondary: 'bg-white text-primary-600 border border-primary-200 active:bg-primary-50',
  danger:    'bg-red-500 text-white active:bg-red-600',
  ghost:     'bg-transparent text-gray-600 active:bg-gray-100',
}

const sizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'w-full px-4 py-4 text-lg font-bold',
}

export default function Button({
  children, variant = 'primary', size = 'md',
  className = '', loading = false, ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        rounded-xl font-semibold transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  )
}
