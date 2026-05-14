"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
	Music2,
	Plus,
	PenLine,
	Home,
	Music,
	Mic2,
	Disc,
	Settings,
	LogOut,
	Menu,
	X,
} from "lucide-react";
import { cn } from "@kiyo/ui";
import { createBrowserClient } from "@kiyo/supabase";

const sidebarNavItems = [
	{ href: "/", icon: Home, label: "home" },
	{ href: "/songs", icon: Music, label: "songs" },
	{ href: "/lyrics", icon: Mic2, label: "lyrics" },
	{ href: "/albums", icon: Disc, label: "albums" },
] as const;

const bottomNavItems = [
	{ href: "/settings", icon: Settings, label: "settings" },
] as const;

interface DashboardSidebarProps {
	children: React.ReactNode;
}

export function DashboardSidebar({ children }: DashboardSidebarProps) {
	const pathname = usePathname();
	const router = useRouter();
	const tNav = useTranslations("nav");
	const [mobileOpen, setMobileOpen] = React.useState(false);
	const [isAuthenticated, setIsAuthenticated] = React.useState(false);

	React.useEffect(() => {
		const supabase = createBrowserClient();
		supabase.auth.getUser().then(({ data }) => {
			setIsAuthenticated(!!data.user);
		});
	}, []);

	const handleSignOut = async () => {
		const supabase = createBrowserClient();
		await supabase.auth.signOut();
		router.push("/");
	};

	const isActive = (href: string) => {
		if (href === "/") return pathname === "/";
		return pathname.startsWith(href);
	};

	return (
		<div className="flex min-h-screen">
			{/* Desktop Sidebar */}
			<aside className="hidden md:flex md:w-60 md:flex-col border-r border-border bg-card">
				<SidebarContent
					isActive={isActive}
					onSignOut={handleSignOut}
					isAuthenticated={isAuthenticated}
				/>
			</aside>

			{/* Mobile Sidebar Overlay */}
			{mobileOpen && (
				<div
					className="fixed inset-0 z-40 bg-black/50 md:hidden"
					onClick={() => setMobileOpen(false)}
				/>
			)}

			{/* Mobile Sidebar */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border transform transition-transform duration-300 ease-in-out md:hidden",
					mobileOpen ? "translate-x-0" : "-translate-x-full",
				)}
			>
				<SidebarContent
					isActive={isActive}
					onSignOut={handleSignOut}
					isAuthenticated={isAuthenticated}
					onClose={() => setMobileOpen(false)}
				/>
			</aside>

			{/* Main Content */}
			<div className="flex-1 flex flex-col min-h-screen">
				{/* Mobile Header with Hamburger */}
				<header className="md:hidden sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-xl px-4">
					<button
						onClick={() => setMobileOpen(true)}
						className="p-2 rounded-lg hover:bg-muted"
						aria-label={tNav('openMenu')}
					>
						<Menu className="h-5 w-5" />
					</button>
					<Link href="/" className="flex items-center gap-2 font-semibold">
						<Music2 className="h-5 w-5 text-kiyo-purple" />
						<span>Kiyo</span>
					</Link>
				</header>

				<main className="flex-1">{children}</main>
			</div>
		</div>
	);
}

interface SidebarContentProps {
	isActive: (href: string) => boolean;
	onSignOut: () => void;
	isAuthenticated: boolean;
	onClose?: () => void;
}

function SidebarContent({
	isActive,
	onSignOut,
	isAuthenticated,
	onClose,
}: SidebarContentProps) {
	const tNav = useTranslations("nav");
	return (
		<div className="flex h-full flex-col">
			{/* Logo */}
			<div className="flex h-16 items-center gap-2 border-b border-border px-4">
				<Link href="/" className="flex items-center gap-2" onClick={onClose}>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-kiyo-purple to-kiyo-cyan text-white shadow-[0_0_30px_-8px_hsl(var(--kiyo-purple)/0.7)]">
						<Music2 className="h-4 w-4" />
					</span>
					<span className="font-semibold tracking-tight">Kiyo</span>
				</Link>
				{onClose && (
					<button
						onClick={onClose}
						className="ml-auto p-2 rounded-lg hover:bg-muted"
						aria-label={tNav('closeMenu')}
					>
						<X className="h-5 w-5" />
					</button>
				)}
			</div>

			{/* Quick Actions */}
			<div className="p-3">
				<div className="rounded-xl border border-kiyo-purple/20 bg-gradient-to-br from-kiyo-purple/10 to-kiyo-cyan/5 p-3 space-y-2">
					<Link
						href="/songs/new"
						onClick={onClose}
						className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/50 dark:hover:bg-black/10"
					>
						<Plus className="h-4 w-4 text-kiyo-purple" />
						<span>{tNav('newSong')}</span>
					</Link>
					<Link
						href="/lyrics/new"
						onClick={onClose}
						className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/50 dark:hover:bg-black/10"
					>
						<PenLine className="h-4 w-4 text-kiyo-cyan" />
						<span>{tNav('newLyric')}</span>
					</Link>
				</div>
			</div>

			{/* Navigation */}
			<nav className="flex-1 px-3 py-2">
				<div className="space-y-1">
					{sidebarNavItems.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							onClick={onClose}
							className={cn(
								"flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
								isActive(item.href)
									? "bg-kiyo-purple/10 text-kiyo-purple border-l-[3px] border-kiyo-purple -ml-[3px]"
									: "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
							)}
						>
							<item.icon className="h-4 w-4" />
							<span>{tNav(item.label)}</span>
						</Link>
					))}
				</div>
			</nav>

			{/* Bottom Navigation */}
			<div className="border-t border-border p-3">
				<div className="space-y-1">
					{bottomNavItems.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							onClick={onClose}
							className={cn(
								"flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
								isActive(item.href)
									? "bg-kiyo-purple/10 text-kiyo-purple border-l-[3px] border-kiyo-purple -ml-[3px]"
									: "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
							)}
						>
							<item.icon className="h-4 w-4" />
							<span>{tNav(item.label)}</span>
						</Link>
					))}
					{isAuthenticated && (
						<button
							onClick={() => {
								onSignOut();
								onClose?.();
							}}
							className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
						>
							<LogOut className="h-4 w-4" />
							<span>{tNav('logout')}</span>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
