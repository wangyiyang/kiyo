import "./globals.css";

import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { Toaster } from "@kiyo/ui";

import { defaultLocale } from "@/i18n/config";

import { Providers } from "./providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kiyo.ai";

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	applicationName: "Kiyo",
	openGraph: {
		type: "website",
		siteName: "Kiyo",
		images: [{ url: "/og-default.png", width: 1200, height: 630 }],
	},
	twitter: {
		card: "summary_large_image",
		site: "@kiyo",
	},
};

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
	const messages = await getMessages({ locale: defaultLocale });

	return (
		<html
			lang={defaultLocale}
			suppressHydrationWarning
			className={`${GeistSans.variable} ${GeistMono.variable}`}
		>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased">
				<NextIntlClientProvider locale={defaultLocale} messages={messages}>
					<Providers>
						{children}
						<Toaster richColors closeButton position="top-center" />
					</Providers>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
