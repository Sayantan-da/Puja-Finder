import React, { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { getTrafficAndParking, submitParkingVote } from '../../services/transitService'
import type { ParkingSpot, ParkingStatus, TrafficRestriction } from '../../types/transit'

const KOLKATA_CENTER: [number, number] = [22.56, 88.36]

// Custom colored markers for parking
function createParkingIcon(status: ParkingStatus) {
  const color =
    status === 'Available'
      ? '#10b981'
      : status === 'Filling Fast'
      ? '#f59e0b'
      : '#ef4444'

  return L.divIcon({
    className: 'custom-parking-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 10px ${color}88, 0 2px 4px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 13px;
        color: #ffffff;
      ">
        P
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

const STATUS_GAUGE_CONFIG: Record<
  ParkingStatus,
  {
    label: string
    color: string
    bgPill: string
    textClass: string
    barClass: string
    icon: string
  }
> = {
  Available: {
    label: 'Available',
    color: '#10b981',
    bgPill: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300',
    textClass: 'text-emerald-400',
    barClass: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    icon: '🟢',
  },
  'Filling Fast': {
    label: 'Filling Fast',
    color: '#f59e0b',
    bgPill: 'bg-amber-950/80 border-amber-500/50 text-amber-300',
    textClass: 'text-amber-400',
    barClass: 'bg-gradient-to-r from-amber-500 to-orange-400',
    icon: '🟡',
  },
  Full: {
    label: 'Full (Lot Sealed)',
    color: '#ef4444',
    bgPill: 'bg-rose-950/90 border-rose-500/60 text-rose-300 font-bold',
    textClass: 'text-rose-400',
    barClass: 'bg-rose-500',
    icon: '🔴',
  },
}

export const TrafficParkingStatusList: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [restrictions, setRestrictions] = useState<TrafficRestriction[]>([])
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([])
  const [loading, setLoading] = useState(true)
  const [voteFeedback, setVoteFeedback] = useState<Record<string, string>>({})
  const [activeFilter, setActiveFilter] = useState<'all' | 'available' | 'restricted'>('all')

  useEffect(() => {
    let mounted = true
    setLoading(true)

    getTrafficAndParking()
      .then((res) => {
        if (mounted) {
          setRestrictions(res.restrictions)
          setParkingSpots(res.parkingSpots)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  // Handle 1-Tap User Verification Vote
  const handleVote = async (parkingSpotId: string, isFullVote: boolean) => {
    const voteType = isFullVote ? 'full' : 'available'
    const updatedSpot = await submitParkingVote(parkingSpotId, voteType)

    // Update in local state
    setParkingSpots((prev) =>
      prev.map((spot) => (spot.parkingSpotId === parkingSpotId ? updatedSpot : spot))
    )

    setVoteFeedback((prev) => ({
      ...prev,
      [parkingSpotId]: isFullVote ? 'Reported as Full' : 'Confirmed as Available',
    }))

    // Clear feedback after 4 seconds
    setTimeout(() => {
      setVoteFeedback((prev) => {
        const next = { ...prev }
        delete next[parkingSpotId]
        return next
      })
    }, 4000)
  }

  // Convert restrictions GeoJSON to FeatureCollection for Leaflet
  const geoJsonFeatureCollection = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: restrictions.map((r) => ({
        type: 'Feature' as const,
        properties: {
          id: r.id,
          name: r.zoneName,
          hours: r.effectiveHours,
          restricted: r.restrictedVehicleTypes.join(', '),
          helpline: r.helplineNumber,
        },
        geometry: r.geoFencePolygon,
      })),
    }
  }, [restrictions])

  return (
    <div className="w-full space-y-6">
      {/* Top Header & View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-extrabold tracking-wider text-red-400 bg-red-950/60 border border-red-500/30 px-2 py-0.5 rounded">
              Kolkata Police Advisory
            </span>
            <span className="text-xs text-stone-400">Live Traffic & Parking Intelligence</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Pedestrian Zones & Real-time Parking
          </h2>
        </div>

        {/* List / Map Toggle Switch */}
        <div className="flex items-center gap-1 bg-stone-900/90 p-1 rounded-xl border border-stone-800">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'list'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
            aria-label="Switch to List View"
            aria-pressed={viewMode === 'list'}
          >
            <span>📋</span>
            <span>List View</span>
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'map'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
            aria-label="Switch to Interactive Map View"
            aria-pressed={viewMode === 'map'}
          >
            <span>🗺️</span>
            <span>Map & GeoFence</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-44 rounded-2xl bg-stone-900/60 border border-stone-800" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 rounded-2xl bg-stone-900/60 border border-stone-800" />
            <div className="h-48 rounded-2xl bg-stone-900/60 border border-stone-800" />
          </div>
        </div>
      )}

      {/* MAP VIEW: Interactive GeoJSON Polygons + Parking Markers */}
      {!loading && viewMode === 'map' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-stone-900/70 p-3 rounded-xl border border-stone-800">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-bold text-red-400">
                <span className="inline-block w-3 h-3 bg-red-500/40 border border-red-500 rounded" />
                Pedestrian No-Entry GeoFence
              </span>
              <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                <span className="inline-block w-3 h-3 bg-emerald-500 rounded-full" />
                Available Parking
              </span>
              <span className="flex items-center gap-1.5 font-bold text-rose-400">
                <span className="inline-block w-3 h-3 bg-rose-500 rounded-full" />
                Full Lot
              </span>
            </div>
            <span className="text-stone-400 font-mono">GeoJSON Coordinates Rendered</span>
          </div>

          <div className="rounded-2xl overflow-hidden border border-stone-800 shadow-2xl h-[520px] relative">
            <MapContainer
              center={KOLKATA_CENTER}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* GeoJSON Pedestrian Restriction Polygons */}
              <GeoJSON
                data={geoJsonFeatureCollection as any}
                style={() => ({
                  color: '#dc2626',
                  weight: 2.5,
                  opacity: 0.9,
                  fillColor: '#ef4444',
                  fillOpacity: 0.25,
                  dashArray: '6, 6',
                })}
                onEachFeature={(feature, layer) => {
                  layer.bindPopup(`
                    <div style="font-family: inherit; font-size: 13px; color: #1c1917; max-width: 240px;">
                      <strong style="color: #b91c1c; font-size: 14px;">⛔ No Vehicles (Pedestrians Only)</strong><br/>
                      <strong>${feature.properties.name}</strong><br/>
                      <span style="font-size: 11px; color: #44403c;">⏰ ${feature.properties.hours}</span><br/>
                      <hr style="margin: 6px 0; border: none; border-top: 1px solid #e7e5e4;" />
                      <strong style="font-size: 11px;">Restricted:</strong> ${feature.properties.restricted}<br/>
                      <strong style="font-size: 11px;">Police Helpline:</strong> ${feature.properties.helpline}
                    </div>
                  `)
                }}
              />

              {/* Parking Spot Markers */}
              {parkingSpots.map((spot) => (
                <Marker
                  key={spot.parkingSpotId}
                  position={spot.coordinates}
                  icon={createParkingIcon(spot.status)}
                >
                  <Popup>
                    <div style={{ fontSize: '13px', color: '#1c1917', minWidth: '180px' }}>
                      <strong style={{ fontSize: '14px' }}>🅿️ {spot.locationName}</strong>
                      <br />
                      <span style={{ fontSize: '11px', color: '#57534e' }}>{spot.landmark}</span>
                      <br />
                      <div style={{ marginTop: '6px', fontWeight: 'bold' }}>
                        Capacity: {spot.availableCapacity} / {spot.totalCapacity} available
                      </div>
                      <div style={{ fontSize: '11px', color: '#047857' }}>{spot.hourlyRate}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {!loading && viewMode === 'list' && (
        <div className="space-y-8">
          {/* Section 1: Kolkata Police Pedestrian No-Entry Zones */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>⛔ Kolkata Police Pedestrian No-Entry Zones</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-500/40 font-mono">
                  {restrictions.length} Active Zones
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {restrictions.map((restriction) => (
                <div
                  key={restriction.id}
                  className="rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-950/40 via-stone-900/90 to-stone-950 p-5 shadow-xl relative overflow-hidden flex flex-col justify-between"
                >
                  {/* Decorative Red Highlight Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-950"
                        role="status"
                        aria-label="Strict pedestrian only zone, all vehicular traffic prohibited"
                      >
                        <span>⛔</span>
                        <span>No Vehicles (Pedestrians Only)</span>
                      </span>

                      <span className="text-[10px] font-mono text-stone-400 bg-stone-950 px-2 py-1 rounded border border-stone-800">
                        GeoFence Active
                      </span>
                    </div>

                    <h4 className="text-lg font-extrabold text-white tracking-tight mb-1">
                      {restriction.zoneName}
                    </h4>

                    <p className="text-xs text-stone-300 mb-3 flex items-center gap-1">
                      <span>📍 Near:</span>
                      <span className="text-amber-400 font-semibold">{restriction.landmarkNear}</span>
                    </p>

                    {/* Effective Timing */}
                    <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 mb-3">
                      <span className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider block">
                        Effective Barricade Hours
                      </span>
                      <span className="text-sm font-bold text-red-300">
                        ⏰ {restriction.effectiveHours}
                      </span>
                    </div>

                    {/* Restricted Vehicle Types */}
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider block mb-1.5">
                        Restricted Vehicles:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {restriction.restrictedVehicleTypes.map((v, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2.5 py-0.5 rounded-lg bg-red-950/80 border border-red-500/30 text-red-200 font-medium"
                          >
                            🚫 {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Division & Helpline */}
                  <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400">
                    <span>👮 {restriction.policeDivision}</span>
                    <a
                      href={`tel:${restriction.helplineNumber.split('/')[0].trim()}`}
                      className="text-amber-400 hover:text-amber-300 font-bold"
                    >
                      📞 Helpline: {restriction.helplineNumber}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Real-time Crowdsourced Parking Status Cards */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>🅿️ Crowdsourced Parking Status Center</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono">
                    {parkingSpots.length} Authorized Locations
                  </span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Live availability gauges verified in real-time by puja hoppers on the ground.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-lg font-semibold transition border ${
                    activeFilter === 'all'
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                      : 'border-stone-800 bg-stone-900 text-stone-400'
                  }`}
                >
                  All ({parkingSpots.length})
                </button>
                <button
                  onClick={() => setActiveFilter('available')}
                  className={`px-3 py-1 rounded-lg font-semibold transition border ${
                    activeFilter === 'available'
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-stone-800 bg-stone-900 text-stone-400'
                  }`}
                >
                  Has Space (
                  {parkingSpots.filter((s) => s.status !== 'Full').length}
                  )
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parkingSpots
                .filter((spot) => (activeFilter === 'available' ? spot.status !== 'Full' : true))
                .map((spot) => {
                  const gauge = STATUS_GAUGE_CONFIG[spot.status] || STATUS_GAUGE_CONFIG.Available
                  const fillPercentage = Math.round(
                    ((spot.totalCapacity - spot.availableCapacity) / spot.totalCapacity) * 100
                  )
                  const feedback = voteFeedback[spot.parkingSpotId]

                  return (
                    <div
                      key={spot.parkingSpotId}
                      className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 shadow-xl flex flex-col justify-between transition hover:border-stone-700"
                      role="region"
                      aria-label={`Parking at ${spot.locationName}`}
                    >
                      <div>
                        {/* Header: Location & Live Status Badge */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                              Authorized Festival Lot
                            </span>
                            <h4 className="text-base font-extrabold text-white tracking-tight">
                              {spot.locationName}
                            </h4>
                            <p className="text-xs text-stone-400 mt-0.5">{spot.landmark}</p>
                          </div>

                          {/* Real-Time Availability Gauge Pill */}
                          <div
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-wide whitespace-nowrap shadow-sm ${gauge.bgPill}`}
                            role="status"
                            aria-live="polite"
                          >
                            <span>{gauge.icon}</span>
                            <span>{gauge.label}</span>
                          </div>
                        </div>

                        {/* Availability Gauge Meter */}
                        <div className="my-3 p-3.5 rounded-xl bg-stone-950/90 border border-stone-800/90">
                          <div className="flex items-baseline justify-between mb-1.5">
                            <span className="text-xs font-bold text-stone-300">
                              Available Capacity
                            </span>
                            <span className="text-xs font-mono">
                              <strong className={`text-base font-black ${gauge.textClass}`}>
                                {spot.availableCapacity}
                              </strong>
                              <span className="text-stone-400"> / {spot.totalCapacity} spots</span>
                            </span>
                          </div>

                          {/* Progress Gauge Bar */}
                          <div
                            className="w-full h-3 rounded-full bg-stone-800 overflow-hidden relative"
                            role="progressbar"
                            aria-valuenow={spot.availableCapacity}
                            aria-valuemin={0}
                            aria-valuemax={spot.totalCapacity}
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${gauge.barClass}`}
                              style={{ width: `${Math.max(5, (spot.availableCapacity / spot.totalCapacity) * 100)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-stone-400 mt-2">
                            <span>Occupancy: {fillPercentage}%</span>
                            <span className="text-amber-400 font-medium">{spot.hourlyRate}</span>
                          </div>
                        </div>

                        {/* Walking proximity to Pandals */}
                        <div className="mb-4">
                          <span className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider block mb-1">
                            Walking distance to nearby pandals:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {spot.walkingToPandals.map((pandal, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700/60"
                              >
                                🚶 {pandal}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 1-Tap User Verification Prompt */}
                      <div className="pt-3 border-t border-stone-800/90 bg-stone-950/60 -mx-5 -mb-5 p-4 rounded-b-2xl">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                          <div>
                            <span className="text-xs font-extrabold text-amber-400 block">
                              Is this parking spot full right now?
                            </span>
                            <span className="text-[10px] text-stone-400">
                              Updated {spot.lastUpdated} • {spot.crowdsourcedVotes.available} said Available, {spot.crowdsourcedVotes.full} said Full
                            </span>
                          </div>

                          {/* 1-Tap YES / NO Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleVote(spot.parkingSpotId, true)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wide border transition flex items-center gap-1 ${
                                spot.userVote === 'full'
                                  ? 'bg-rose-600 border-rose-500 text-white ring-2 ring-rose-500/40'
                                  : 'bg-stone-900 hover:bg-rose-950/60 border-stone-700 text-rose-300 hover:border-rose-500'
                              }`}
                              aria-label={`Vote YES, ${spot.locationName} is full`}
                            >
                              <span>🚫 YES (Full)</span>
                            </button>

                            <button
                              onClick={() => handleVote(spot.parkingSpotId, false)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wide border transition flex items-center gap-1 ${
                                spot.userVote === 'available'
                                  ? 'bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-500/40'
                                  : 'bg-stone-900 hover:bg-emerald-950/60 border-stone-700 text-emerald-300 hover:border-emerald-500'
                              }`}
                              aria-label={`Vote NO, ${spot.locationName} has space available`}
                            >
                              <span>✅ NO (Available)</span>
                            </button>
                          </div>
                        </div>

                        {/* Confirmation Toast */}
                        {feedback && (
                          <div
                            className="mt-2 text-xs font-semibold text-emerald-400 animate-fadeIn"
                            role="alert"
                          >
                            ✓ Thank you for verifying! Your vote was recorded live.
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrafficParkingStatusList
