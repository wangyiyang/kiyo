import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { createServerClient } from "@kiyo/supabase/server";

import { Features } from "@/components/sections/features";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Showcase } from "@/components/sections/showcase";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kiyo.ai";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("metadata");

	return {
		title: t("title"),
		description: t("description"),
		openGraph: {
			title: "Kiyo — AI Music Creation Platform",
			description: t("description"),
			images: [{ url: "/og-home.png", width: 1200, height: 630 }],
		},
	};
}

export default async function HomePage() {
	const supabase = await createServerClient();
	const { data: { user } } = await supabase.auth.getUser();
	const isAuthenticated = !!user;
	const jsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Organization",
				"@id": `${siteUrl}/#organization`,
				name: "Kiyo",
				url: siteUrl,
				logo: {
					"@type": "ImageObject",
					url: `${siteUrl}/logo.png`,
				},
			},
			{
				"@type": "SoftwareApplication",
				"@id": `${siteUrl}/#software`,
				name: "Kiyo",
				applicationCategory: "MultimediaDesignApplication",
				operatingSystem: "Web",
				offers: {
					"@type": "Offer",
					price: "0",
					priceCurrency: "USD",
					availability: "https://schema.org/PreOrder",
				},
				description: "",
			},
		],
	};

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<div className="flex min-h-screen flex-col">
				<SiteHeader />
				<main className="flex-1">
					<Hero isAuthenticated={isAuthenticated} />
					<Features />
					<HowItWorks />
					<Showcase />
					<FinalCta isAuthenticated={isAuthenticated} />
				</main>
				<SiteFooter />
			</div>
		</>
	);
}
