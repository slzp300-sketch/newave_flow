import useOfficerAccess from './useOfficerAccess'
import useAuthStore from '../store/authStore'
import { managementMenuGroups } from '../utils/menuGroups'

export default function useManagementMenuGroups() {
  const user = useAuthStore(s => s.user)
  const access = useOfficerAccess()
  return managementMenuGroups(user?.role, !access.isError && !!user && access.data?.canNewFamily === true,
    !access.isError && !!user && access.data?.canReport === true,
    !access.isError && !!user && access.data?.canPraise === true,
    !access.isError && !!user && access.data?.canIntercession === true,
    !access.isError && !!user && access.data?.canWorship === true)
}
