import { supabase } from './supabaseClient'

export type Session = {
  id: string
  name: string
}

const SESSION_KEY = 'stamp-tour-session'

export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  return JSON.parse(raw) as Session
}

function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export async function loginOrSignup(name: string, pin: string): Promise<Session> {
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('id, name, pin')
    .eq('name', name)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)

  if (existing) {
    if (existing.pin !== pin) {
      throw new Error('PIN_MISMATCH')
    }
    const session = { id: existing.id, name: existing.name }
    saveSession(session)
    return session
  }

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert({ name, pin })
    .select('id, name')
    .single()

  if (insertError) throw new Error(insertError.message)

  const session = { id: created.id, name: created.name }
  saveSession(session)
  return session
}
