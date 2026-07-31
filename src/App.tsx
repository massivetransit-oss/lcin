import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { MapPage } from './pages/MapPage'
import { PlaceDetailPage } from './pages/PlaceDetailPage'
import { StampBookPage } from './pages/StampBookPage'
import { RequireAuth } from './routes/RequireAuth'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <MapPage />
          </RequireAuth>
        }
      />
      <Route
        path="/places/:id"
        element={
          <RequireAuth>
            <PlaceDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/stampbook"
        element={
          <RequireAuth>
            <StampBookPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
