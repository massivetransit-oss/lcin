import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPlaceById } from '../lib/places'
import type { Place } from '../lib/places'

export function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [place, setPlace] = useState<Place | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetchPlaceById(id)
      .then(setPlace)
      .catch((err) => setError(err instanceof Error ? err.message : '장소를 불러오지 못했습니다'))
  }, [id])

  if (error) return <p role="alert">{error}</p>
  if (!place) return <p>불러오는 중...</p>

  return (
    <div>
      <h1>{place.name}</h1>
      <p>{place.description}</p>
      <p>{place.address}</p>
    </div>
  )
}
