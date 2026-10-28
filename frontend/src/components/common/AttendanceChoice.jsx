import { Check } from 'lucide-react'

const choices = [
  { value: 'PRESENT', label: '참석', tone: 'present' },
  { value: 'PARTIAL', label: '부분참석', tone: 'partial' },
  { value: 'ABSENT', label: '불참', tone: 'absence' },
]

export default function AttendanceChoice({ label, value, onChange, multiDay = false }) {
  return <div role="group" aria-label={label} data-multi={!!multiDay} className="attendance-choice">
    {choices.filter(choice => multiDay || choice.value !== 'PARTIAL').map(choice => (
      <button key={choice.value} type="button" data-tone={choice.tone}
        aria-label={`${label} ${choice.label}`} aria-pressed={value === choice.value}
        onClick={() => onChange(choice.value)}>
        <span className="attendance-choice-mark" aria-hidden="true">{value === choice.value && <Check size={14} strokeWidth={3} />}</span>
        {choice.label}
      </button>
    ))}
  </div>
}
