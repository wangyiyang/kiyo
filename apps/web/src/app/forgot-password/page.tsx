import { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { getTranslations, getLocale } from 'next-intl/server'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kiyo/ui'

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { AuthGuard } from '@/components/auth/auth-guard'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return {
    title: t('forgotPassword.title'),
  }
}

export default async function ForgotPasswordPage() {
  const locale = await getLocale()

  return (
    <AuthGuard>
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>We&apos;ll send you a link to reset your password</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href={`/${locale}/login`} className="font-medium text-foreground hover:underline">
              Back to log in
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </AuthGuard>
  )
}
