import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kiyo/ui'

import { LoginForm } from '@/components/auth/login-form'
import { AuthGuard } from '@/components/auth/auth-guard'
import { SiteHeader } from '@/components/site-header'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return {
    title: t('login.title'),
  }
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string }
}) {
  return (
    <>
      <SiteHeader />
      <AuthGuard redirectTo={searchParams.redirectTo ?? '/'}>
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">Log in to Kiyo</CardTitle>
              <CardDescription>Welcome back</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    </>
  )
}
