import { createServiceRoleClient } from '@kiyo/supabase/server'

const GENERATION_WORKER_FUNCTION = 'process-generation-task'

export function triggerGenerationWorker() {
  try {
    const supabase = createServiceRoleClient()

    void supabase.functions
      .invoke(GENERATION_WORKER_FUNCTION)
      .then(({ error }) => {
        if (error) {
          console.error('Failed to trigger generation worker:', error)
        }
      })
      .catch((err) => {
        console.error('Failed to trigger generation worker:', err)
      })
  } catch (err) {
    console.error('Failed to trigger generation worker:', err)
  }
}
