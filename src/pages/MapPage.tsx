import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { loadKakaoMapsSdk } from '../lib/kakaoMap'
import { fetchPlaces } from '../lib/places'
import { fetchVisitedPlaceIds } from '../lib/visits'
import { useAuth } from '../context/AuthContext'

export function MapPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const mapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function setup() {
      try {
        const [places, visitedIds] = await Promise.all([
          fetchPlaces(),
          session ? fetchVisitedPlaceIds(session.id) : Promise.resolve(new Set<string>()),
        ])

        if (cancelled) return
        await loadKakaoMapsSdk()
        if (cancelled || !mapRef.current) return

        const kakao = window.kakao
        const center =
          places.length > 0
            ? new kakao.maps.LatLng(places[0].lat, places[0].lng)
            : new kakao.maps.LatLng(37.4893, 126.7241)
        const map = new kakao.maps.Map(mapRef.current, { center, level: 4 })

        places.forEach((place) => {
          const position = new kakao.maps.LatLng(place.lat, place.lng)
          const marker = new kakao.maps.Marker({ position, map })
          const visited = visitedIds.has(place.id)
          const overlay = new kakao.maps.CustomOverlay({
            position,
            yAnchor: 2.2,
            content: `<div style="padding:2px 6px;border-radius:4px;font-size:12px;background:${
              visited ? '#2f9e44' : '#495057'
            };color:white;">${place.name}</div>`,
          })
          overlay.setMap(map)
          kakao.maps.event.addListener(marker, 'click', () => {
            navigate(`/places/${place.id}`)
          })
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '지도를 불러오지 못했습니다')
        }
      }
    }

    setup()
    return () => {
      cancelled = true
    }
  }, [session, navigate])

  return (
    <div>
      <NavBar />
      <h1>초등학교정복자</h1>
      {error && <p role="alert">{error}</p>}
      <div ref={mapRef} style={{ width: '100%', height: '70vh' }} />
    </div>
  )
}
