"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Mail, MessageSquare } from "lucide-react";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Button,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
	toast,
} from "@kiyo/ui";

import { submitFeedback } from "@/app/actions/feedback";
import { feedbackSchema, type FeedbackInput } from "@/lib/schemas/feedback";

interface FaqItem {
	question: string;
	answer: string;
}

const typeOptions = ["bug", "suggestion", "other"] as const;

export default function ContactPage() {
	const t = useTranslations("contact");
	const faqItems = t.raw("faq.items") as FaqItem[];
	const feedbackT = useTranslations("feedback");
	const [pending, startTransition] = React.useTransition();

	const form = useForm<FeedbackInput>({
		resolver: zodResolver(feedbackSchema),
		defaultValues: { type: undefined, description: "", contact: "" },
		mode: "onSubmit",
	});

	const onSubmit = (values: FeedbackInput) => {
		startTransition(async () => {
			const result = await submitFeedback(values);
			if (result.ok) {
				toast.success(feedbackT("success"));
				form.reset();
				return;
			}

			toast.error(result.message);
		});
	};

	return (
		<div className="container mx-auto max-w-2xl px-4 py-16">
			{/* Header */}
			<div className="mb-12 text-center">
				<h1 className="mb-4 text-4xl font-bold">{t("title")}</h1>
				<p className="text-lg text-muted-foreground">{t("subtitle")}</p>
			</div>

			{/* Contact Email */}
			<div className="mb-12 flex items-center justify-center gap-3 rounded-lg border bg-card p-6">
				<Mail className="h-6 w-6 text-primary" />
				<a
					href="mailto:wangyiyang.kk@gmail.com"
					className="text-lg font-medium hover:underline"
				>
					wangyiyang.kk@gmail.com
				</a>
			</div>

			{/* Feedback Form */}
			<div className="mb-16">
				<h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
					<MessageSquare className="h-6 w-6" />
					{feedbackT("type.label")}
				</h2>
				<div className="rounded-lg border bg-card p-6">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
							<FormField
								control={form.control}
								name="type"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{feedbackT("type.label")}</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue
														placeholder={feedbackT("type.placeholder")}
													/>
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{typeOptions.map((type) => (
													<SelectItem key={type} value={type}>
														{feedbackT(`type.options.${type}`)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{feedbackT("description.label")}</FormLabel>
										<FormControl>
											<Textarea
												placeholder={feedbackT("description.placeholder")}
												rows={4}
												disabled={pending}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="contact"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{feedbackT("contact.label")}</FormLabel>
										<FormControl>
											<Input
												placeholder={feedbackT("contact.placeholder")}
												disabled={pending}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="flex justify-end">
								<Button type="submit" disabled={pending}>
									{pending ? feedbackT("submitting") : feedbackT("submit")}
								</Button>
							</div>
						</form>
					</Form>
				</div>
			</div>

			{/* FAQ */}
			<div className="w-full">
				<h2 className="mb-6 text-2xl font-bold">{t("faq.title")}</h2>
				<Accordion type="single" collapsible className="w-full">
					{faqItems.map((faq, index) => (
						<AccordionItem key={index} value={`item-${index}`}>
							<AccordionTrigger className="text-left">
								{faq.question}
							</AccordionTrigger>
							<AccordionContent className="text-muted-foreground">
								{faq.answer}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
		</div>
	);
}
