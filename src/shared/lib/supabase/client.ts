import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/shared/lib/supabase/database.types"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill in the real values."
  )
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey
)
