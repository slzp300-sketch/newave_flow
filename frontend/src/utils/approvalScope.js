// Keep follow-up actions bound to the account that approved the teacher.
export function approvalScope(state) {
  return JSON.stringify([state.apiEnvironment, state.user?.id, state.user?.role, state.authIdentity?.sessionId])
}
