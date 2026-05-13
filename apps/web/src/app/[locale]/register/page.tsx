import { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kiyo/ui'

import { RegisterForm } from '@/components/auth/register-form'
import { AuthGuard } from '@/components/auth/auth-guard'
import { SiteHeader } from '@/components/site-header'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return {
    title: t('register.title'),
  }
}

export default async function RegisterPage() {
  const t = await getTranslations('auth')
  return (
    <>
      <SiteHeader />
      <AuthGuard>
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
              <CardDescription>{t('register.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <RegisterForm />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {t('register.hasAccount')}{' '}
                <Link href="/login" className="font-medium text-foreground hover:underline">
                  {t('register.loginLink')}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    </>
  )
}
