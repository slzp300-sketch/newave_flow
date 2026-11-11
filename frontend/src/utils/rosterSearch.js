export const rosterSearchKey = value => String(value || '').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR')
export const matchesRosterName = (name, search) => rosterSearchKey(name).includes(rosterSearchKey(search))

export function familyRosterStage(person, sunday) {
  if (person.classId || person.decision === 'READY' || person.assignmentRequested) return 'handoff'
  if (person.enrolledOn) return 'course'
  return person.firstVisit >= sunday ? 'first' : 'undecided'
}
export function filterFamilyRoster(people, { tab, search, stage, sunday }) {
  return people.filter(person => (tab !== 'handoff' || person.decision === 'READY') &&
    matchesRosterName(person.profile.name,search) && (stage === 'all' || familyRosterStage(person,sunday) === stage))
}
