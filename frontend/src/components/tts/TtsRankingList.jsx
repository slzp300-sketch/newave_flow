import { ChevronRight } from 'lucide-react'
import { quarterScore, quarterStatusLabel } from '../../utils/ttsQuarterAssessment'
import './TtsStats.css'
import './QuarterAssessment.css'

// Teacher and administrator lists share the same compact row and semantic colors.
export default function TtsRankingList({ people, assessment, onSelect, mineKey, scoreOf = quarterScore, children }) {
  return <div className="tts-ranking-records" aria-label="분기 순위 목록">
    {people.map((person, index) => {
      const score = scoreOf(person)
      return <button key={person.key ?? `unidentified-${index}`} type="button" disabled={!person.key}
        title={!person.key ? '연결 정보를 새로 불러온 후 확인해 주세요.' : undefined}
        aria-label={`${person.name} 체크 기록 보기`} onClick={() => onSelect(person)}
        className={`tts-ranking-row tts-quarter-${assessment.status(score)}${person.key && person.key === mineKey ? ' tts-ranking-is-me' : ''}`}>
        <span className="tts-ranking-rank">{person.rank ?? '—'}</span>
        <span className="tts-ranking-name">{person.name}{person.key && person.key === mineKey && <span className="tts-ranking-me">나</span>}</span>
        <span className="tts-ranking-row-end"><span className="tts-ranking-score">{score == null ? '—' : `${score}점`}</span><RankingStatus person={person} assessment={assessment} scoreOf={scoreOf} /></span>
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    })}
    {children}
  </div>
}

export function RankingStatus({ person, assessment, scoreOf = quarterScore }) {
  const status = assessment.status(scoreOf(person))
  return <span className={`tts-ranking-status tts-ranking-status-${status}`}>{quarterStatusLabel(status)}</span>
}
