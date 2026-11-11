import {Link} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import useAuthStore from '../../store/authStore'
import {intercessionApi} from '../../api/intercession'
import './intercession.css'
export default function PrayerMeetingLinks({week}){
 const user=useAuthStore(s=>s.user)
 const query=useQuery({queryKey:['intercession',user?.id,week],queryFn:()=>intercessionApi.state(week),enabled:!!user,refetchInterval:30000})
 return <section className="it-meeting-links">
  <div className="it-row"><strong>화·목 기도모임</strong><Link to={'/intercession?week='+week}>기도제목·모임 ›</Link></div>
  {query.isPending?<span className="it-meta">불러오는 중…</span>:query.isError?<button className="it-text-button" onClick={()=>query.refetch()}>모임 다시 확인</button>:<div className="it-meetings">{query.data.meetings.map((m,i)=><div key={m.date}><strong>{i===0?'화요일':'목요일'} 21:30</strong><span className="it-meta">{m.hostName}</span>{m.canceled&&<span className="it-cancel-note">모임 없음{m.cancellationReason?' · '+m.cancellationReason:''}</span>}</div>)}</div>}
  <p className="it-meta">Zoom 링크는 카톡으로 공유해요.</p>
 </section>
}
