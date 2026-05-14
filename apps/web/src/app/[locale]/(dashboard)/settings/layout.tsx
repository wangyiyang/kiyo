import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default function SettingsLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return <DashboardSidebar>{children}</DashboardSidebar>
}
