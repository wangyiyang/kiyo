import { createClient } from "@supabase/supabase-js";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "../scroll-reveal";
import { ShowcaseCard } from "./showcase-card";

interface FeaturedTrack {
	id: string;
	title: string;
	genre: string | null;
	mood: string | null;
	cover_url: string | null;
	audio_url: string | null;
	duration: number | null;
}

export const trackGradients = [
	"from-indigo-500 to-cyan-400",
	"from-amber-400 to-pink-400",
	"from-rose-500 to-violet-500",
	"from-sky-500 to-emerald-400",
	"from-fuchsia-500 to-orange-400",
	"from-purple-400 to-pink-300",
];

async function getFeaturedTracks(): Promise<FeaturedTrack[]> {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseKey =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseKey) {
		console.error("Missing Supabase env vars");
		return [];
	}

	const supabase = createClient(supabaseUrl, supabaseKey);

	const { data, error } = await supabase
		.from("songs")
		.select("id, title, genre, mood, cover_url, audio_url, duration")
		.eq("is_featured", true)
		.order("created_at", { ascending: false });

	if (error) {
		console.error("Failed to fetch featured tracks:", error);
		return [];
	}

	// Sort: songs with cover first, then by created_at desc
	const sorted =
		(data as FeaturedTrack[])?.sort((a, b) => {
			const aHasCover = a.cover_url ? 1 : 0;
			const bHasCover = b.cover_url ? 1 : 0;
			return bHasCover - aHasCover;
		}) ?? [];

	return sorted.slice(0, 6);
}

export async function Showcase() {
	const t = await getTranslations("showcase");
	const tracks = await getFeaturedTracks();

	if (!tracks || tracks.length === 0) {
		return null;
	}

	return (
		<section id="showcase" className="py-20 md:py-28">
			<div className="container mx-auto px-4">
				<ScrollReveal className="mx-auto max-w-2xl text-center">
					<p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
						Featured Works
					</p>
					<h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
						Created with Kiyo
					</h2>
					<p className="mt-4 text-muted-foreground">
						Discover what creators are making with AI-powered music generation.
					</p>
				</ScrollReveal>

				<div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{tracks.map((track, idx) => (
						<ScrollReveal key={track.id} delay={(idx % 3) * 0.08}>
							<ShowcaseCard
								track={track}
								index={idx}
								playlist={tracks}
								gradient={trackGradients[idx % trackGradients.length]}
							/>
						</ScrollReveal>
					))}
				</div>

				<div className="mt-10 text-center">
					<Link
						href="/explore"
						className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-accent"
					>
						{t("viewAll")}
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>
			</div>
		</section>
	);
}
