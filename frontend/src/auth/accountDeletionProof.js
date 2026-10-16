import { loginEnvironment } from './reviewEnvironment.js'

export const publicDeletionEnvironment = credentials => credentials?.appleFlowId ? 'production' : loginEnvironment(credentials?.email)

// Obtain fresh proof only after the person has confirmed their deletion request.
export async function deletionCredentials(method, { password, beginApple, email, publicRequest = false }) {
  if (method === 'PASSWORD') {
    if (typeof password !== 'string' || !password) throw new Error('현재 앱 비밀번호를 입력해 주세요.')
    if (publicRequest && (typeof email !== 'string' || !email.trim())) throw new Error('가입한 이메일을 입력해 주세요.')
    return { ...(publicRequest ? { email: email.trim() } : {}), password }
  }
  if (method !== 'APPLE') throw new Error('본인 확인 방법을 확인하지 못했습니다. 화면을 다시 열어 주세요.')
  const proof = await beginApple(publicRequest ? 'DELETE_PUBLIC' : 'DELETE')
  if (![proof?.appleFlowId, proof?.appleTicket, proof?.appleVerifier].every(value => typeof value === 'string' && value)) {
    throw new Error('Apple 본인 확인을 완료하지 못했습니다. 다시 시도해 주세요.')
  }
  return { appleFlowId: proof.appleFlowId, appleTicket: proof.appleTicket, appleVerifier: proof.appleVerifier }
}
