import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import type { Pandal } from '../types'

// Fix default marker icons when using bundlers
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const KOLKATA: [number, number] = [22.5726, 88.3639]

export default function MapView({
  pandals,
  center,
  zoom = 12,
  height = 480,
}: {
  pandals: Pandal[]
  center?: [number, number]
  zoom?: number
  height?: number
}) {
  const withCoords = pandals.filter((p) => p.latitude != null && p.longitude != null)

  return (
    <MapContainer
      center={center ?? KOLKATA}
      zoom={zoom}
      style={{ height, width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {withCoords.map((p) => (
        <Marker key={p.id} position={[p.latitude!, p.longitude!]}>
          <Popup>
            <strong>{p.name}</strong>
            <br />
            {p.locality}
            {p.crowd_level && (
              <>
                <br />
                Crowd: {p.crowd_level}
                {p.waiting_time_minutes != null ? ` (~${p.waiting_time_minutes} min)` : ''}
              </>
            )}
            <br />
            <a href={`/pandals/${p.id}`}>View details →</a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
