import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Remove somente os dados e caches do antigo ambiente de demonstração.
try {
  const hadLocalData = localStorage.getItem('soultech_local_db_v1') !== null
    || localStorage.getItem('soultech_local_session') !== null
  localStorage.removeItem('soultech_local_db_v1')
  localStorage.removeItem('soultech_local_session')
  if (hadLocalData) {
    sessionStorage.removeItem('soultech_empresa_cache')
    sessionStorage.removeItem('soultech_whatsapp_status')
  }
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('pending_')) sessionStorage.removeItem(key)
  }
} catch {
  // O navegador pode bloquear o armazenamento; não há banco local alternativo.
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
