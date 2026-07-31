import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function NavBar() {
  const { session, logout } = useAuth()
  return (
    <nav>
      <Link to="/">지도</Link>
      {' | '}
      <Link to="/stampbook">스탬프북</Link>
      {session && <span> · {session.name}님</span>}
      <button onClick={logout}>로그아웃</button>
    </nav>
  )
}
