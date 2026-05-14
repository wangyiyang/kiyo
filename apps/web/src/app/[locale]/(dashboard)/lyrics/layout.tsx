import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default function LyricsLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return <DashboardSidebar>{children}</DashboardSidebar>
}
