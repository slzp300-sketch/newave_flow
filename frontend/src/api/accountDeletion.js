import { registerPlugin } from '@capacitor/core'
import client from './client'
import { isNativeApp } from '../native/platform'
import { createSecureStorage } from '../native/secureStorage'
import { createDeletionReceiptStore } from '../auth/deletionReceipt'

// Receipt persistence failures are shown on this page, so the user can keep the receipt manually.
const storage = isNativeApp ? createSecureStorage(registerPlugin('NewaveSecureStorage')) : localStorage
export const deletionReceiptStore = createDeletionReceiptStore(storage)
export const accountDeletionApi = {
  current: () => client.get('/account-deletion').then(r => r.data),
  submit: password => client.post('/account-deletion', { password, confirmed: true }).then(r => r.data),
  status: receipt => client.post('/auth/account-deletion/status', { receiptToken: receipt.receiptToken },
    { skipAuth: true, apiEnvironment: receipt.apiEnvironment }).then(r => r.data),
}
