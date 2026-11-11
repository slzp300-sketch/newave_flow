// Only the first screenful enters in sequence; later rows are immediately usable.
export function listMotionTiming(index, reduced = false, disabled = false) {
  const enter = !reduced && !disabled && Number.isInteger(index) && index >= 0 && index < 6
  return { enter, delay: enter ? index * 0.025 : 0, duration: reduced ? 0 : 0.22 }
}
