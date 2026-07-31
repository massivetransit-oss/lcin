import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPlaces } from '../lib/places'
import type { Place } from '../lib/places'
import { fetchVisitedPlaceIds } from '../lib/visits'
import { useAuth } from '../context/AuthContext'
import { NavBar } from '../components/NavBar'

export function StampBookPage() {
  const { session } = useAuth()
  const [places, setPlaces] = useState<Place[]>([])
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    Promise.all([fetchPlaces(), fetchVisitedPlaceIds(session.id)])
      .then(([placeList, visited]) => {
        setPlaces(placeList)
        setVisitedIds(visited)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '불러오지 못했습니다'))
  }, [session])

  if (error) return <p role="alert">{error}</p>

  const allCollected = places.length > 0 && places.every((p) => visitedIds.has(p.id))

  if (allCollected) {
    return (
      <div>
        <NavBar />
        <h1>모든 스탬프를 모았습니다!</h1>
        <Link to="/">지도로 돌아가기</Link>
      </div>
    )
  }

  return (
    <div>
      <NavBar />
      <h1>스탬프북</h1>
      <p>
        {visitedIds.size} / {places.length} 수집
      </p>
      <ul>
        {places.map((place) => (
          <li key={place.id}>
            <Link to={`/places/${place.id}`}>
              {place.name} {visitedIds.has(place.id) ? '✅' : '⬜'}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
