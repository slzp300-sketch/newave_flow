import useManagementMenuGroups from '../hooks/useManagementMenuGroups'
import AdminOverview from './AdminOverview'
import useAuthStore from '../store/authStore'
import Header from '../components/layout/Header'
import ManagementMenu from '../components/common/ManagementMenu'

export default function AdminDashboard() {
  const user = useAuthStore(s => s.user)
  const groups = useManagementMenuGroups()
  return <div className="flex min-h-screen flex-col bg-gray-50/50 pb-10">
    <Header title="관리" showBack />
    <div className="flex flex-col gap-5 px-4 py-5">
      {['ADMIN', 'PASTOR'].includes(user?.role) && <AdminOverview />}
      <ManagementMenu groups={groups} />
    </div>
  </div>
}
