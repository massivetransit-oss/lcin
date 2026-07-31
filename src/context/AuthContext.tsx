import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { getSession, loginOrSignup, clearSession } from '../lib/auth'
import type { Session } from '../lib/auth'

type AuthContextValue = {
  session: Session | null
  login: (name: string, pin: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(getSession())

  async function login(name: string, pin: string) {
    const newSession = await loginOrSignup(name, pin)
    setSession(newSession)
  }

  function logout() {
    clearSession()
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
