import { z } from "zod";

export const feedbackSchema = z.object({
	type: z.enum(["bug", "suggestion", "other"], {
		required_error: "请选择反馈类型",
	}),
	description: z
		.string()
		.min(10, "请至少输入 10 个字符")
		.max(2000, "反馈内容不能超过 2000 字符"),
	contact: z.string().max(254, "联系方式过长").optional().or(z.literal("")),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
