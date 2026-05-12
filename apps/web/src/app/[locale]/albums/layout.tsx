import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default function AlbumsLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return <DashboardSidebar>{children}</DashboardSidebar>
}
