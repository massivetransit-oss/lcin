import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(name, pin)
      navigate('/')
    } catch (err) {
      if (err instanceof Error && err.message === 'PIN_MISMATCH') {
        setError('이름 또는 PIN이 올바르지 않습니다')
      } else {
        setError('로그인에 실패했습니다')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>초등학교정복자</h1>
      <label>
        이름
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        PIN (4자리)
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">시작하기</button>
    </form>
  )
}
