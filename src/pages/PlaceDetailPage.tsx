import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPlaceById } from '../lib/places'
import type { Place } from '../lib/places'
import { createVisit, fetchVisitsByPlace } from '../lib/visits'
import type { Visit } from '../lib/visits'
import { distanceMeters, getCurrentPosition, VISIT_RADIUS_METERS } from '../lib/geolocation'
import { useAuth } from '../context/AuthContext'
import { NavBar } from '../components/NavBar'

export function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const [place, setPlace] = useState<Place | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [distance, setDistance] = useState<number | null>(null)
  const [locationError, setLocationError] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [comment, setComment] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const alreadyVisited = session ? visits.some((v) => v.user_id === session.id) : false

  async function loadPlaceAndVisits(placeId: string) {
    const [placeData, visitData] = await Promise.all([
      fetchPlaceById(placeId),
      fetchVisitsByPlace(placeId),
    ])
    setPlace(placeData)
    setVisits(visitData)
  }

  useEffect(() => {
    if (!id) return
    loadPlaceAndVisits(id).catch((err) =>
      setError(err instanceof Error ? err.message : '장소를 불러오지 못했습니다'),
    )
  }, [id])

  useEffect(() => {
    if (!place) return
    getCurrentPosition()
      .then((pos) => setDistance(distanceMeters(pos, place)))
      .catch((err) => {
        if (err instanceof Error && err.message === 'GEOLOCATION_DENIED') {
          setLocationError('위치 정보를 허용해주세요')
        } else {
          setLocationError('위치 정보를 사용할 수 없습니다')
        }
      })
  }, [place])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session || !id || !photo) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await createVisit({ userId: session.id, placeId: id, photo, comment })
      await loadPlaceAndVisits(id)
      setPhoto(null)
      setComment('')
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_VISITED') {
        setSubmitError('이미 인증한 장소입니다')
      } else {
        setSubmitError('업로드에 실패했습니다. 다시 시도해주세요')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <p role="alert">{error}</p>
  if (!place) return <p>불러오는 중...</p>

  const withinRange = distance !== null && distance <= VISIT_RADIUS_METERS

  return (
    <div>
      <NavBar />
      <h1>{place.name}</h1>
      <p>{place.description}</p>
      <p>{place.address}</p>

      {alreadyVisited && <p>이미 인증 완료</p>}

      {!alreadyVisited && locationError && <p role="alert">{locationError}</p>}

      {!alreadyVisited && !locationError && distance !== null && !withinRange && (
        <p>
          장소 근처에서만 인증 가능합니다 (남은 거리: 약{' '}
          {Math.round(distance - VISIT_RADIUS_METERS)}m)
        </p>
      )}

      {!alreadyVisited && withinRange && (
        <form onSubmit={handleSubmit}>
          <label>
            인증사진
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              required
            />
          </label>
          <label>
            코멘트
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          {submitError && <p role="alert">{submitError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? '등록 중...' : '인증하기'}
          </button>
        </form>
      )}

      <h2>다녀간 사람들</h2>
      <ul>
        {visits.map((v) => (
          <li key={v.id}>
            <p>{v.users.name}</p>
            <img src={v.photo_url} alt={`${v.users.name}의 인증사진`} width={120} />
            <p>{v.comment}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
