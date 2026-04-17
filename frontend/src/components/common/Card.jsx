import { motion } from 'framer-motion'

export default function Card({ children, className = '', onClick }) {
  const base = 'glass-card rounded-2xl p-4 overflow-hidden relative'
  const interactive = onClick
    ? 'cursor-pointer'
    : ''

  return (
    <motion.div 
      whileHover={onClick ? { scale: 1.02, y: -2, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      className={`${base} ${interactive} ${className}`} 
      onClick={onClick}
    >
      {/* Subtle shine effect for interactive cards */}
      {onClick && (
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}
      {children}
    </motion.div>
  )
}
