import { z } from 'zod'

export const getLoginSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t('errors.invalidEmail')),
    password: z.string().min(6, t('errors.passwordMin')),
    rememberMe: z.boolean().optional(),
  })

export type LoginInput = z.infer<ReturnType<typeof getLoginSchema>>

export const getMagicLinkSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t('errors.invalidEmail')),
  })

export type MagicLinkInput = z.infer<ReturnType<typeof getMagicLinkSchema>>

export const getRegisterSchema = (t: (key: string) => string) =>
  z
    .object({
      email: z.string().email(t('errors.invalidEmail')),
      password: z.string().min(6, t('errors.passwordMin')),
      confirmPassword: z.string().min(6, t('errors.passwordMin')),
      termsAccepted: z.boolean().refine((val) => val === true, {
        message: t('errors.termsRequired'),
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('errors.passwordMatch'),
      path: ['confirmPassword'],
    })

export type RegisterInput = z.infer<ReturnType<typeof getRegisterSchema>>

export const getForgotPasswordSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t('errors.invalidEmail')),
  })

export type ForgotPasswordInput = z.infer<ReturnType<typeof getForgotPasswordSchema>>

export const getResetPasswordSchema = (t: (key: string) => string) =>
  z
    .object({
      password: z.string().min(6, t('errors.passwordMin')),
      confirmPassword: z.string().min(6, t('errors.passwordMin')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('errors.passwordMatch'),
      path: ['confirmPassword'],
    })

export type ResetPasswordInput = z.infer<ReturnType<typeof getResetPasswordSchema>>
