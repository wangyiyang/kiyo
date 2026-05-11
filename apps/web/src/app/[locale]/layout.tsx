import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { FeedbackDialog } from "@/components/feedback-dialog";
import { GlobalPlayer } from "@/components/global-player";
import { WaitlistDialog } from "@/components/waitlist-dialog";
import { locales, type Locale } from "@/i18n/config";

type LocaleLayoutProps = {
	children: React.ReactNode;
	params: {
		locale: string;
	};
};

export default async function LocaleLayout({
	children,
	params,
}: LocaleLayoutProps) {
	if (!hasLocale(locales, params.locale)) {
		notFound();
	}

	const locale = params.locale as Locale;
	setRequestLocale(locale);
	const messages = await getMessages({ locale });

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			{children}
			<GlobalPlayer />
			<WaitlistDialog />
			<FeedbackDialog />
		</NextIntlClientProvider>
	);
}
