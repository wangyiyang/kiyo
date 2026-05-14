"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
	LogOut,
	Settings,
	Music,
	Disc,
	FileText,
	MessageSquare,
	LayoutDashboard,
} from "lucide-react";

import { useFeedback } from "@/lib/feedback-context";

import {
	Avatar,
	AvatarFallback,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@kiyo/ui";

import { createBrowserClient } from "@kiyo/supabase";

interface UserMenuProps {
	user: {
		email: string;
	} | null;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function UserMenu({ user, open, onOpenChange }: UserMenuProps) {
	const t = useTranslations("auth");
	const { show: showFeedback } = useFeedback();

	const handleLogout = async () => {
		const supabase = createBrowserClient();
		await supabase.auth.signOut();
		// 强制导航到首页以确保 Server Component 重新获取最新状态
		// 避免 router.refresh() 因缓存导致仍展示旧登录状态 (gh-194)
		window.location.href = "/";
	};

	if (!user) {
		return (
			<Button size="sm" asChild>
				<Link href="/login">{t("userMenu.login")}</Link>
			</Button>
		);
	}

	const initials = user.email.slice(0, 2).toUpperCase();

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-8 w-8 rounded-full">
					<Avatar className="h-8 w-8">
						<AvatarFallback className="bg-primary text-primary-foreground text-xs">
							{initials}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end" forceMount>
				<div className="flex items-center justify-start gap-2 p-2">
					<div className="flex flex-col space-y-0.5">
						<p className="text-sm font-medium text-muted-foreground">
							{user.email}
						</p>
					</div>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/songs">
						<Music className="mr-2 h-4 w-4" />
						{t("userMenu.mySongs")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href="/albums">
						<Disc className="mr-2 h-4 w-4" />
						{t("userMenu.myAlbums")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href="/lyrics">
						<FileText className="mr-2 h-4 w-4" />
						{t("userMenu.myLyrics")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/dashboard">
						<LayoutDashboard className="mr-2 h-4 w-4" />
						{t("userMenu.dashboard")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={showFeedback}>
					<MessageSquare className="mr-2 h-4 w-4" />
					{t("userMenu.feedback")}
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href="/settings">
						<Settings className="mr-2 h-4 w-4" />
						{t("userMenu.settings")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handleLogout}>
					<LogOut className="mr-2 h-4 w-4" />
					{t("userMenu.logout")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
