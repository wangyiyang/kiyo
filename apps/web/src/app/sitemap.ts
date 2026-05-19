import { MetadataRoute } from "next";
import { locales } from "@/i18n/config";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kiyo.ai";

export default function sitemap(): MetadataRoute.Sitemap {
	const paths = ["/", "/explore", "/privacy", "/terms"];

	return paths.flatMap((path) => {
		const url = `${siteUrl}${path}`;
		const alternates: Record<string, string> = {};
		for (const locale of locales) {
			alternates[locale] = `${siteUrl}/${locale}${path}`;
		}

		return {
			url,
			lastModified: new Date(),
			changeFrequency: "weekly" as const,
			priority: path === "/" ? 1 : 0.8,
			alternates: {
				languages: alternates,
			},
		};
	});
}
