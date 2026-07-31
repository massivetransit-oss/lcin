import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RequireAuth } from './routes/RequireAuth'
import { useAuth } from './context/AuthContext'

function HomePlaceholder() {
  const { session, logout } = useAuth()
  return (
    <div>
      <p>환영합니다, {session?.name}님</p>
      <button onClick={logout}>로그아웃</button>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePlaceholder />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
