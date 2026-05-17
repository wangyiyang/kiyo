import "./globals.css";

import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { getTranslations } from "next-intl/server";

import { Toaster } from "@kiyo/ui";

import { defaultLocale, type Locale } from "@/i18n/config";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { Providers } from "./providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kiyo.ai";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations({ locale: defaultLocale, namespace: "metadata" });

	const ogLocaleMap: Record<Locale, string> = {
		en: "en_US",
		zh: "zh_CN",
	};

	return {
		metadataBase: new URL(siteUrl),
		title: {
			default: t("title"),
			template: `%s · ${t("applicationName")}`,
		},
		description: t("description"),
		applicationName: t("applicationName"),
		openGraph: {
			type: "website",
			title: t("title"),
			description: t("description"),
			siteName: t("applicationName"),
			locale: ogLocaleMap[defaultLocale] ?? "en_US",
			images: [{ url: "/og-default.png", width: 1200, height: 630 }],
		},
		twitter: {
			card: "summary_large_image",
			site: "@kiyo",
			title: t("title"),
			description: t("description"),
		},
		alternates: {
			canonical: "/",
		},
	};
}

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
	],
	width: "device-width",
	initialScale: 1,
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			lang={defaultLocale}
			suppressHydrationWarning
			className={`${GeistSans.variable} ${GeistMono.variable}`}
		>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased">
				<Providers>
					{children}
					<Toaster richColors closeButton position="top-center" />
				</Providers>
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
