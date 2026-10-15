export const DELETION_RECEIPT_KEY = 'newave-deletion-receipt'

export function parseDeletionReceipt(value) {
  try {
    const receipt = typeof value === 'string' ? JSON.parse(value) : value
    if (!receipt || !/^[A-Za-z0-9_-]{43}$/.test(receipt.receiptToken)
      || !['production', 'review'].includes(receipt.apiEnvironment)) return null
    return { receiptToken: receipt.receiptToken, apiEnvironment: receipt.apiEnvironment,
      requestId: typeof receipt.requestId === 'string' ? receipt.requestId.slice(0, 36) : null,
      savedAt: Number.isFinite(receipt.savedAt) ? receipt.savedAt : 0 }
  } catch { return null }
}

// Keep the receipt separate from authentication: logout must not remove the only way to see completion.
export function createDeletionReceiptStore(storage) {
  return {
    async read() { return parseDeletionReceipt(await storage.getItem(DELETION_RECEIPT_KEY)) },
    async save(value) {
      const receipt = parseDeletionReceipt(value)
      if (!receipt) throw new Error('접수증 형식이 올바르지 않습니다.')
      await storage.setItem(DELETION_RECEIPT_KEY, JSON.stringify(receipt))
      await storage.flush?.()
      return receipt
    },
    async clear() { await storage.removeItem(DELETION_RECEIPT_KEY); await storage.flush?.() },
  }
}

export function deletionStatusLabel(status) {
  return { REQUESTED: '삭제 요청 접수됨', COMPLETED: '계정 삭제 완료' }[status] || '처리 상태 확인 중'
}
