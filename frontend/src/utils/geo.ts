/** Geolocation helper — resolves coords or navigates with a friendly error param. */
import type { NavigateFunction } from 'react-router-dom'

export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    })
  })
}

/** Straight-line (great-circle) distance between two coordinates, in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Try to navigate to "pandals near me"; on failure land on home with an error flag. */
export async function goNearMe(navigate: NavigateFunction) {
  try {
    const pos = await getPosition()
    const { latitude, longitude } = pos.coords
    navigate(`/?lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}`)
  } catch {
    navigate('/?near=error')
  }
}
