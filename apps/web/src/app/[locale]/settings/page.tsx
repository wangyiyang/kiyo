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
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <SiteHeader />
      <RequireAuth redirectTo="/login?redirectTo=/settings">
        <div className="container mx-auto max-w-2xl px-4 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">
              {(await getTranslations('settings'))('title')}
            </h1>
            {user?.email && (
              <p className="mt-1 text-muted-foreground">{user.email}</p>
            )}
          </div>

          <div className="space-y-6">
            <SettingsSection
              title={(await getTranslations('settings'))('emailSection.title')}
              description={(await getTranslations('settings'))('emailSection.description')}
            >
              <UpdateEmailForm />
            </SettingsSection>

            <SettingsSection
              title={(await getTranslations('settings'))('passwordSection.title')}
              description={(await getTranslations('settings'))('passwordSection.description')}
            >
              <ChangePasswordForm />
            </SettingsSection>

            <SettingsSection
              title={(await getTranslations('settings'))('dangerZone.title')}
              description={(await getTranslations('settings'))('dangerZone.description')}
              variant="danger"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-red-600 dark:text-red-400">
                    {(await getTranslations('settings'))('dangerZone.deleteAccount.title')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(await getTranslations('settings'))('dangerZone.deleteAccount.description')}
                  </p>
                </div>
                {user?.email && <DeleteAccountDialog userEmail={user.email} />}
              </div>
            </SettingsSection>
          </div>
        </div>
      </RequireAuth>
    </>
  )
}
