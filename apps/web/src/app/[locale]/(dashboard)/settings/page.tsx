import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { createServerClient } from '@kiyo/supabase/server'

import { SettingsSection } from '@/components/settings/settings-section'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { UpdateEmailForm } from '@/components/settings/update-email-form'
import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog'
import { RequireAuth } from '@/components/auth/require-auth'
import { SiteHeader } from '@/components/site-header'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return {
    title: t('title'),
  }
}

export default async function SettingsPage() {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/settings">
      <SettingsPageContent />
    </RequireAuth>
  )
}

async function SettingsPageContent() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const t = await getTranslations('settings')

  return (
    <>
      <SiteHeader />
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          {user?.email && (
            <p className="mt-1 text-muted-foreground">{user.email}</p>
          )}
        </div>

        <div className="space-y-6">
          <SettingsSection
            title={t('emailSection.title')}
            description={t('emailSection.description')}
          >
            <UpdateEmailForm />
          </SettingsSection>

          <SettingsSection
            title={t('passwordSection.title')}
            description={t('passwordSection.description')}
          >
            <ChangePasswordForm />
          </SettingsSection>

          <SettingsSection
            title={t('dangerZone.title')}
            description={t('dangerZone.description')}
            variant="danger"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-red-600 dark:text-red-400">
                  {t('dangerZone.deleteAccount.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('dangerZone.deleteAccount.description')}
                </p>
              </div>
              {user?.email && <DeleteAccountDialog userEmail={user.email} />}
            </div>
          </SettingsSection>
        </div>
      </div>
    </>
  )
}
