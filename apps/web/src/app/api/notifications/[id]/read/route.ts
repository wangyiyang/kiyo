import { createServerClient } from '@kiyo/supabase/server'
import { createUnauthorizedResponse, createErrorResponse } from '@/lib/api-utils'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return createErrorResponse(error.message)
  }

  return new Response(null, { status: 200 })
}
