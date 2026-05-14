import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default function SongsLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return <DashboardSidebar>{children}</DashboardSidebar>
}
