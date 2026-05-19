import { createServiceRoleClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServiceRoleClient()

  try {
    const { data, error } = await supabase.functions.invoke('process-generation-task')

    if (error) {
      return NextResponse.json(
        { error: 'Edge function failed', details: error.message },
        { status: 502 }
      )
    }

    return NextResponse.json(data ?? { processed: 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Invocation failed', details: message },
      { status: 500 }
    )
  }
}
