declare global {
  interface Window {
    kakao: any
  }
}

let loadPromise: Promise<void> | null = null

export function loadKakaoMapsSdk(): Promise<void> {
  if (window.kakao?.maps) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const appKey = import.meta.env.VITE_KAKAO_MAP_KEY
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.onload = () => {
      window.kakao.maps.load(() => resolve())
    }
    script.onerror = () => reject(new Error('카카오맵 SDK를 불러오지 못했습니다'))
    document.head.appendChild(script)
  })

  return loadPromise
}
