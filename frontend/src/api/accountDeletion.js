import { registerPlugin } from '@capacitor/core'
import client from './client'
import { isNativeApp } from '../native/platform'
import { createSecureStorage } from '../native/secureStorage'
import { createDeletionReceiptStore } from '../auth/deletionReceipt'
import { publicDeletionEnvironment } from '../auth/accountDeletionProof'

// Receipt persistence failures are shown on this page, so the user can keep the receipt manually.
const storage = isNativeApp ? createSecureStorage(registerPlugin('NewaveSecureStorage')) : localStorage
export const deletionReceiptStore = createDeletionReceiptStore(storage)
export const accountDeletionApi = {
  current: () => client.get('/account-deletion').then(r => r.data),
  submit: credentials => client.post('/account-deletion', { ...credentials, confirmed: true }).then(r => r.data),
  submitPublic: credentials => client.post('/auth/account-deletion', { ...credentials, confirmed: true },
    { skipAuth: true, apiEnvironment: publicDeletionEnvironment(credentials) }).then(r => r.data),
  status: receipt => client.post('/auth/account-deletion/status', { receiptToken: receipt.receiptToken },
    { skipAuth: true, apiEnvironment: receipt.apiEnvironment }).then(r => r.data),
}
