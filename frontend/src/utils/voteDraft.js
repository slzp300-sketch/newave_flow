export function prayerFormFromVote(vote) {
  return { status: vote?.status || null,
    micAvailable: !vote?.status || vote.status === 'ABSENT' ? null : !vote.reason,
    reason: vote?.status === 'ABSENT' ? vote.reason || '' : '',
    micReason: vote?.status && vote.status !== 'ABSENT' ? vote.reason || '' : '' }
}

export function meetingFormFromVote(vote) {
  return { status: vote?.status || null, reason: vote?.reason || '' }
}
