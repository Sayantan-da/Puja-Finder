import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'
import type { GroupDestination, GroupMember, GroupTripState, Pandal, TripCheckpoint, TripMessage } from '../types'

// Configure Leaflet default icons
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const KOLKATA: [number, number] = [22.5726, 88.3639]

// Helper for custom Leaflet HTML avatars & markers
function createMemberIcon(member: GroupMember, isCurrentUser: boolean) {
  const isStalled = member.status === 'STALLED'
  const isArrived = member.status === 'ARRIVED'
  const isOffline = member.status === 'OFFLINE' || member.status === 'LOCATION_OFF'

  let ringColor = 'border-emerald-500 bg-emerald-50'
  let dotClass = 'bg-emerald-500 animate-pulse'
  if (isStalled) {
    ringColor = 'border-amber-500 bg-amber-50'
    dotClass = 'bg-amber-500'
  } else if (isArrived) {
    ringColor = 'border-blue-500 bg-blue-50'
    dotClass = 'bg-blue-500'
  } else if (isOffline) {
    ringColor = 'border-stone-400 bg-stone-100 opacity-60'
    dotClass = 'bg-stone-400'
  }

  const html = `
    <div class="relative flex flex-col items-center group cursor-pointer">
      <div class="w-10 h-10 rounded-full border-2 ${ringColor} shadow-lg overflow-hidden flex items-center justify-center p-0.5 transition-transform hover:scale-110">
        <img src="${member.avatarUrl}" alt="${member.name}" class="w-full h-full object-cover rounded-full" />
      </div>
      <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${dotClass}"></span>
      <div class="mt-1 px-2 py-0.5 bg-stone-900/85 backdrop-blur text-white text-[11px] font-bold rounded-md whitespace-nowrap shadow">
        ${member.name}${isCurrentUser ? ' (You)' : ''}
      </div>
    </div>
  `
  return L.divIcon({
    html,
    className: 'custom-member-marker',
    iconSize: [40, 56],
    iconAnchor: [20, 48],
  })
}

function createMeetHereIcon() {
  const html = `
    <div class="relative flex flex-col items-center animate-bounce">
      <div class="w-10 h-10 rounded-2xl bg-amber-500 border-2 border-white shadow-xl flex items-center justify-center text-xl text-white">
        📍
      </div>
      <div class="mt-1 px-2 py-0.5 bg-amber-900 text-amber-100 text-[10px] font-black rounded-md uppercase tracking-wider shadow">
        Meet Here!
      </div>
    </div>
  `
  return L.divIcon({
    html,
    className: 'custom-meet-marker',
    iconSize: [40, 56],
    iconAnchor: [20, 48],
  })
}

function createCheckpointIcon(index: number) {
  const html = `
    <div class="w-7 h-7 rounded-full bg-red-600 border-2 border-white text-white font-black text-xs flex items-center justify-center shadow-md">
      ${index + 1}
    </div>
  `
  return L.divIcon({
    html,
    className: 'custom-cp-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// Map center adjustment component
function MapAutoFitter({ bounds }: { bounds: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    }
  }, [bounds, map])
  return null
}

export default function GroupTripPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  // Active view tab
  const [activeTab, setActiveTab] = useState<'live' | 'trips' | 'create' | 'join'>('live')

  // Group state
  const [group, setGroup] = useState<GroupTripState | null>(null)
  const [myTrips, setMyTrips] = useState<{ active: GroupTripState[]; upcoming: GroupTripState[]; completed: GroupTripState[] }>({
    active: [],
    upcoming: [],
    completed: [],
  })

  // Form states
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [createName, setCreateName] = useState('North Kolkata Pandal Trail')
  const [createMaxMembers, setCreateMaxMembers] = useState(10)
  const [selectedDestinationPandal, setSelectedDestinationPandal] = useState<Pandal | null>(null)
  const [selectedRoutePandals, setSelectedRoutePandals] = useState<Pandal[]>([])
  const [pandalsList, setPandalsList] = useState<Pandal[]>([])

  // Live Location & GPS state
  const [isSharingLocation, setIsSharingLocation] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastSentCoordsRef = useRef<{ lat: number; lng: number; time: number } | null>(null)

  // Modals & Drawers
  const [showChatDrawer, setShowChatDrawer] = useState(false)
  const [showMembersSheet, setShowMembersSheet] = useState(false)
  const [showCheckpointsSheet, setShowCheckpointsSheet] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [checkpointNameInput, setCheckpointNameInput] = useState('')
  const [checkpointTimeInput, setCheckpointTimeInput] = useState('')

  // UI status helpers
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  // Current user's member object in the active trip
  const currentMember = useMemo(() => {
    if (!group || !user) return null
    return group.members[String(user.id)] || null
  }, [group, user])

  const isHost = group && user && String(group.createdBy) === String(user.id)
  const isCoHost = currentMember?.role === 'CO_HOST' || isHost

  // Load available pandals for create / route selection
  useEffect(() => {
    api.get<Pandal[]>('/pandals').then((res) => {
      setPandalsList(res.data)
      if (res.data.length > 0) {
        setSelectedDestinationPandal(res.data[0])
      }
    }).catch(() => {})
  }, [])

  // Load user trips on mount / tab switch
  const fetchMyTrips = async () => {
    if (!user) return
    try {
      const res = await api.get('/groups/my-trips')
      setMyTrips(res.data)
      if (res.data.active.length > 0 && !group) {
        setGroup(res.data.active[0])
      }
    } catch {}
  }

  useEffect(() => {
    fetchMyTrips()
  }, [user, activeTab])

  // Handle URL join queries (e.g. /group-trip?join=CODE or ?token=TOKEN)
  useEffect(() => {
    const code = searchParams.get('join')
    const token = searchParams.get('token')
    if (code) {
      setJoinCodeInput(code.toUpperCase())
      setActiveTab('join')
    } else if (token) {
      handleJoinWithToken(token)
    }
  }, [searchParams])

  // WebSocket Connection for Active Group
  useEffect(() => {
    if (!group?.groupId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/groups/${group.groupId}`
    let ws: WebSocket | null = null
    let pollInterval: any = null

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setWsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'group_snapshot' || data.snapshot) {
            setGroup(data.group || data.snapshot)
          } else if (data.type === 'CHAT_MESSAGE' && data.message) {
            setGroup((prev) => prev ? { ...prev, messages: [...(prev.messages || []), data.message] } : null)
          } else if (data.type === 'EMERGENCY_ALERT' && data.alert) {
            setGroup((prev) => prev ? { ...prev, alerts: [...(prev.alerts || []), data.alert] } : null)
            setSuccessMsg(`🚨 Alert: ${data.alert.userName} sent an 'I am Lost' alert!`)
          } else if (data.type === 'LOCATION_UPDATE' && data.member && data.userId) {
            setGroup((prev) => {
              if (!prev) return null
              return {
                ...prev,
                members: { ...prev.members, [data.userId]: data.member },
              }
            })
          }
        } catch {}
      }

      ws.onclose = () => {
        setWsConnected(false)
      }
    } catch {
      setWsConnected(false)
    }

    // Fallback polling every 12s in case of congested network
    pollInterval = setInterval(async () => {
      try {
        const res = await api.get<GroupTripState>(`/groups/${group.groupId}`)
        setGroup(res.data)
      } catch {}
    }, 12000)

    return () => {
      if (ws) ws.close()
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [group?.groupId])

  // Battery-Safe Geolocation Tracking
  useEffect(() => {
    if (!isSharingLocation || !group?.groupId || !user) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.')
      return
    }

    const sendLocationUpdate = async (lat: number, lng: number, accuracy: number, heading = 0, speed = 0) => {
      const now = Date.now()
      const last = lastSentCoordsRef.current

      // Movement threshold: only send if moved > 15m or > 20s elapsed
      if (last) {
        const dist = L.latLng(last.lat, last.lng).distanceTo(L.latLng(lat, lng))
        const elapsed = (now - last.time) / 1000
        if (dist < 15 && elapsed < 20) {
          return
        }
      }

      lastSentCoordsRef.current = { lat, lng, time: now }
      setCurrentCoords({ lat, lng, accuracy })

      try {
        await api.post(`/groups/${group.groupId}/location`, {
          latitude: lat,
          longitude: lng,
          accuracy,
          heading,
          speed,
        })
      } catch {}
    }

    // Track visibility to reduce battery usage when tab is hidden
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      } else if (document.visibilityState === 'visible' && isSharingLocation && watchIdRef.current === null) {
        startWatcher()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    const startWatcher = () => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsError(null)
          sendLocationUpdate(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
            pos.coords.heading || 0,
            pos.coords.speed || 0,
          )
        },
        (err) => {
          setGpsError(`GPS Error: ${err.message}. Please ensure Location Permissions are enabled.`)
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      )
    }

    startWatcher()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isSharingLocation, group?.groupId, user])

  // Actions
  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      setErrorMsg('Please sign in to create a trip.')
      return
    }
    setBusy(true)
    setErrorMsg(null)

    try {
      const destData = selectedDestinationPandal ? {
        pandalId: String(selectedDestinationPandal.id),
        name: selectedDestinationPandal.name,
        latitude: selectedDestinationPandal.latitude!,
        longitude: selectedDestinationPandal.longitude!,
        address: selectedDestinationPandal.address,
        theme: selectedDestinationPandal.theme || '',
        crowdLevel: selectedDestinationPandal.crowd_level || '',
      } : undefined

      const routeData = selectedRoutePandals.map((p) => ({
        pandalId: String(p.id),
        name: p.name,
        latitude: p.latitude!,
        longitude: p.longitude!,
        address: p.address,
        theme: p.theme || '',
        crowdLevel: p.crowd_level || '',
      }))

      const res = await api.post<GroupTripState>('/groups/create', {
        groupName: createName.trim() || 'Kolkata Pandal Hop',
        initialDestination: destData,
        routePandals: routeData,
        maxMembers: createMaxMembers,
        isPrivate: true,
      })

      setGroup(res.data)
      setActiveTab('live')
      setSuccessMsg(`🎉 Trip "${res.data.groupName}" created! Share code: ${res.data.joinCode}`)
      fetchMyTrips()
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to create group trip.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoinWithCode(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      setErrorMsg('Please sign in before joining a trip.')
      return
    }
    const code = joinCodeInput.trim().toUpperCase()
    if (!code) return

    setBusy(true)
    setErrorMsg(null)
    try {
      const res = await api.post<GroupTripState>('/groups/join', { joinCode: code })
      setGroup(res.data)
      setActiveTab('live')
      setSuccessMsg(`Joined ${res.data.groupName}!`)
      fetchMyTrips()
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Invalid or expired join code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoinWithToken(token: string) {
    if (!user) return
    setBusy(true)
    try {
      const res = await api.post<GroupTripState>('/groups/join', { inviteToken: token })
      setGroup(res.data)
      setActiveTab('live')
      setSuccessMsg(`Joined ${res.data.groupName} via invite link!`)
      fetchMyTrips()
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Invalid invite link.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleSharing() {
    if (!group) return
    const nextState = !isSharingLocation
    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/toggle-sharing`, {
        sharing: nextState,
      })
      setIsSharingLocation(nextState)
      setGroup(res.data)
      if (nextState) {
        setSuccessMsg('📍 Live location sharing is now active.')
      } else {
        setSuccessMsg('🔒 Live location sharing stopped.')
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Could not update location sharing.')
    }
  }

  async function handleSetStatus(newStatus: 'MOVING' | 'ARRIVED' | 'ON_BREAK' | 'LEAVING') {
    if (!group) return
    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/status`, { status: newStatus })
      setGroup(res.data)
      setSuccessMsg(`Status set to ${newStatus.replace('_', ' ')}`)
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to update status.')
    }
  }

  async function handleSendEmergencyLost() {
    if (!group) return
    const confirmed = window.confirm("Broadcast 'I am Lost' emergency alert to all friends in this trip?")
    if (!confirmed) return

    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/alert/lost`, {
        latitude: currentCoords?.lat,
        longitude: currentCoords?.lng,
      })
      setGroup(res.data)
      setSuccessMsg("🚨 'I am Lost' alert broadcasted to your group members!")
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to broadcast alert.')
    }
  }

  async function handleDropMeetHerePin() {
    if (!group || !isCoHost) return
    if (!currentCoords) {
      alert('Please enable GPS or tap on map to drop pin.')
      return
    }

    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/meet-here`, {
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        title: 'Meet here with group!',
      })
      setGroup(res.data)
      setSuccessMsg('📍 "Meet Here" pin dropped for your friends!')
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Only Host or Co-host can drop Meet Here pin.')
    }
  }

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault()
    if (!group || !chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput('')

    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/chat`, {
        message: msg,
      })
      setGroup(res.data)
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to send message.')
    }
  }

  async function handleSendEmoji(emoji: string) {
    if (!group) return
    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/chat`, {
        message: emoji,
        emoji,
      })
      setGroup(res.data)
    } catch {}
  }

  async function handleAddCheckpoint(e: React.FormEvent) {
    e.preventDefault()
    if (!group || !checkpointNameInput.trim()) return
    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/checkpoint`, {
        name: checkpointNameInput.trim(),
        scheduledTime: checkpointTimeInput || undefined,
        latitude: currentCoords?.lat || KOLKATA[0],
        longitude: currentCoords?.lng || KOLKATA[1],
      })
      setGroup(res.data)
      setCheckpointNameInput('')
      setCheckpointTimeInput('')
      setSuccessMsg('Checkpoint added!')
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to add checkpoint.')
    }
  }

  async function handleToggleCheckpoint(cpId: string) {
    if (!group) return
    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/checkpoint/${cpId}/toggle`, {})
      setGroup(res.data)
    } catch {}
  }

  async function handlePromoteMember(targetUid: string, currentRole: string) {
    if (!group || !isHost) return
    const nextRole = currentRole === 'CO_HOST' ? 'MEMBER' : 'CO_HOST'
    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/members/${targetUid}/role`, {
        role: nextRole,
      })
      setGroup(res.data)
      setSuccessMsg(`Role updated to ${nextRole}`)
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to change member role.')
    }
  }

  async function handleRemoveMember(targetUid: string) {
    if (!group) return
    const isSelf = String(user?.id) === String(targetUid)
    const confirmed = window.confirm(isSelf ? 'Leave this group trip?' : 'Remove this member from trip?')
    if (!confirmed) return

    try {
      const res = await api.delete<GroupTripState>(`/groups/${group.groupId}/members/${targetUid}`)
      if (isSelf) {
        setGroup(null)
        setActiveTab('trips')
        setSuccessMsg('You left the group trip.')
      } else {
        setGroup(res.data)
        setSuccessMsg('Member removed.')
      }
      fetchMyTrips()
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to remove member.')
    }
  }

  async function handleEndTrip() {
    if (!group || !isHost) return
    const confirmed = window.confirm('End this trip? All live location sharing will stop and traces will be cleared for privacy.')
    if (!confirmed) return

    try {
      const res = await api.post<GroupTripState>(`/groups/${group.groupId}/end`, {})
      setGroup(res.data)
      setIsSharingLocation(false)
      setShowSummaryModal(true)
      fetchMyTrips()
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to end trip.')
    }
  }

  // Calculate map bounds
  const mapBounds = useMemo(() => {
    const pts: [number, number][] = []
    if (group?.destination?.latitude && group?.destination?.longitude) {
      pts.push([group.destination.latitude, group.destination.longitude])
    }
    if (group?.meetHerePin?.latitude && group?.meetHerePin?.longitude) {
      pts.push([group.meetHerePin.latitude, group.meetHerePin.longitude])
    }
    if (group?.members) {
      Object.values(group.members).forEach((m) => {
        if (m.latitude && m.longitude) pts.push([m.latitude, m.longitude])
      })
    }
    return pts
  }, [group])

  const routePolyline = useMemo(() => {
    if (!group?.routePandals || group.routePandals.length < 2) return []
    return group.routePandals.filter((p) => p.latitude && p.longitude).map((p) => [p.latitude, p.longitude] as [number, number])
  }, [group])

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col bg-stone-950 text-stone-100">
      {/* Top Bar Navigation Tabs */}
      <header className="sticky top-0 z-30 bg-stone-900/95 backdrop-blur border-b border-stone-800 px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👥</span>
            <span className="font-cinzel font-black text-lg tracking-tight text-amber-400">
              Group Trip
            </span>
            {group && group.status === 'ACTIVE' && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live: {group.groupName}
              </span>
            )}
          </div>

          <nav className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'live' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
              }`}
            >
              🗺️ Map
            </button>
            <button
              onClick={() => setActiveTab('trips')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'trips' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
              }`}
            >
              📋 Trips
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'create' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
              }`}
            >
              ➕ Create
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'join' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
              }`}
            >
              🔑 Join
            </button>
          </nav>
        </div>
      </header>

      {/* Global Alerts / Notices */}
      {errorMsg && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 px-4 py-2 text-xs flex items-center justify-between font-semibold">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-950/90 border-b border-emerald-800 text-emerald-200 px-4 py-2 text-xs flex items-center justify-between font-semibold">
          <span>✨ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}
      {gpsError && (
        <div className="bg-amber-950/90 border-b border-amber-800 text-amber-200 px-4 py-2 text-xs flex items-center justify-between font-semibold">
          <span>🛰️ {gpsError}</span>
          <button onClick={() => setGpsError(null)} className="text-amber-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* TAB 1: LIVE TRIP MAP VIEW */}
      {activeTab === 'live' && (
        <div className="flex-1 relative flex flex-col h-[calc(100vh-7rem)]">
          {!group ? (
            /* Empty State when user has no active group */
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-8 shadow-2xl">
                <span className="text-5xl mb-4 inline-block">🪔</span>
                <h2 className="text-2xl font-black font-cinzel text-amber-400 mb-2">No Active Group Trip</h2>
                <p className="text-stone-400 text-sm mb-6 leading-relaxed">
                  Pandal hopping is better together! Create a temporary group or enter your friend's invite code to see each other live on the map.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setActiveTab('create')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-sm shadow-md hover:scale-[1.02] transition"
                  >
                    ➕ Create Trip
                  </button>
                  <button
                    onClick={() => setActiveTab('join')}
                    className="w-full py-3 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 font-bold text-sm hover:bg-stone-700 transition"
                  >
                    🔑 Join with Code
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Active Group Trip UI */
            <>
              {/* Top Trip Info Header */}
              <div className="bg-stone-900/90 backdrop-blur border-b border-stone-800 px-4 py-2 z-10 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="font-bold text-stone-200 truncate max-w-[180px] sm:max-w-xs">
                    {group.groupName}
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold border border-amber-500/30">
                    {group.joinCode}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(group.joinCode)
                      setSuccessMsg(`Copied join code: ${group.joinCode}`)
                    }}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 font-bold hover:bg-stone-700 flex items-center gap-1 text-[11px]"
                  >
                    📋 Copy Code
                  </button>
                  <button
                    onClick={() => setShowMembersSheet(true)}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 font-bold hover:bg-stone-700 flex items-center gap-1 text-[11px]"
                  >
                    👥 {Object.keys(group.members || {}).length} Friends
                  </button>
                </div>
              </div>

              {/* Leaflet Map Full Viewport */}
              <div className="flex-1 w-full relative z-0">
                <MapContainer
                  center={KOLKATA}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {mapBounds.length > 0 && <MapAutoFitter bounds={mapBounds} />}

                  {/* Route Polyline */}
                  {routePolyline.length > 1 && (
                    <Polyline positions={routePolyline} color="#f59e0b" weight={4} dashArray="6, 8" />
                  )}

                  {/* Destination Marker */}
                  {group.destination?.latitude && group.destination?.longitude && (
                    <>
                      <Circle
                        center={[group.destination.latitude, group.destination.longitude]}
                        radius={50}
                        pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.15 }}
                      />
                      <Marker position={[group.destination.latitude, group.destination.longitude]}>
                        <Popup>
                          <div className="text-stone-900 text-xs">
                            <strong className="text-sm font-bold text-red-700">🎯 Destination</strong>
                            <p className="font-bold">{group.destination.name}</p>
                            <p className="text-stone-600">{group.destination.address}</p>
                            {group.destination.crowdLevel && (
                              <p className="mt-1 font-semibold text-amber-700">Rush: {group.destination.crowdLevel}</p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    </>
                  )}

                  {/* Checkpoints Markers */}
                  {group.checkpoints?.map((cp, idx) => (
                    cp.latitude && cp.longitude && (
                      <Marker
                        key={cp.id}
                        position={[cp.latitude, cp.longitude]}
                        icon={createCheckpointIcon(idx)}
                      >
                        <Popup>
                          <div className="text-stone-900 text-xs">
                            <strong className="text-sm font-bold">Checkpoint {idx + 1}</strong>
                            <p className="font-semibold">{cp.name}</p>
                            {cp.scheduledTime && <p className="text-stone-600">Time: {cp.scheduledTime}</p>}
                            <p className="text-[11px] mt-1 text-emerald-700">
                              {cp.isCompleted ? '✅ Completed' : '⏳ Pending'}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  ))}

                  {/* Meet Here Pin */}
                  {group.meetHerePin?.latitude && group.meetHerePin?.longitude && (
                    <Marker
                      position={[group.meetHerePin.latitude, group.meetHerePin.longitude]}
                      icon={createMeetHereIcon()}
                    >
                      <Popup>
                        <div className="text-stone-900 text-xs">
                          <strong className="text-sm font-bold text-amber-600">📍 Group Rendezvous Point</strong>
                          <p>{group.meetHerePin.title || 'Meet here with group!'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Members Live Markers */}
                  {Object.entries(group.members || {}).map(([uid, mem]) => {
                    if (!mem.latitude || !mem.longitude || !mem.sharingLocation) return null
                    const isSelf = String(user?.id) === String(uid)

                    return (
                      <Marker
                        key={uid}
                        position={[mem.latitude, mem.longitude]}
                        icon={createMemberIcon(mem, isSelf)}
                      >
                        <Popup>
                          <div className="text-stone-900 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-sm">
                              <span>{mem.name}</span>
                              {isSelf && <span className="text-[10px] bg-red-100 text-red-800 px-1 rounded">You</span>}
                            </div>
                            <p className="text-[11px] font-semibold text-stone-600">
                              Status: <span className="text-amber-700">{mem.status || 'MOVING'}</span>
                            </p>
                            {mem.distanceToDestination != null && (
                              <p className="text-[11px] text-stone-600">
                                Distance to target: <strong>{mem.distanceToDestination}m</strong> (~{mem.etaMinutes} mins walk)
                              </p>
                            )}
                            {mem.lastUpdated && (
                              <p className="text-[10px] text-stone-400">
                                Last seen: {new Date(mem.lastUpdated).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    )
                  })}
                </MapContainer>

                {/* Floating HUD: Action Controls (Mobile-First 1-Handed) */}
                <div className="absolute bottom-4 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
                  {/* Top quick-action pills */}
                  <div className="flex items-center justify-between gap-2 pointer-events-auto">
                    {/* Share Location Consent Toggle */}
                    <button
                      onClick={toggleSharing}
                      className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xl border transition-all ${
                        isSharingLocation
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-600/30 animate-pulse'
                          : 'bg-stone-900/90 backdrop-blur text-stone-300 border-stone-700 hover:bg-stone-800'
                      }`}
                    >
                      <span>{isSharingLocation ? '📡' : '🛡️'}</span>
                      <span>{isSharingLocation ? 'Sharing GPS (ON)' : 'Share My Live Location'}</span>
                    </button>

                    {/* Emergency Lost Button */}
                    <button
                      onClick={handleSendEmergencyLost}
                      className="py-3 px-4 rounded-2xl font-bold text-xs bg-red-600/90 backdrop-blur text-white border border-red-500 shadow-xl hover:bg-red-500 transition flex items-center gap-1.5"
                    >
                      <span>🚨</span>
                      <span className="hidden sm:inline">I'm Lost</span>
                    </button>
                  </div>

                  {/* Secondary Quick Action Bar */}
                  <div className="bg-stone-900/95 backdrop-blur p-2 rounded-2xl border border-stone-800 shadow-2xl flex items-center justify-around gap-1 pointer-events-auto text-xs">
                    {/* Status dropdown/selector */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSetStatus('MOVING')}
                        title="Moving"
                        className="p-2 rounded-xl hover:bg-stone-800 text-sm"
                      >
                        🚶
                      </button>
                      <button
                        onClick={() => handleSetStatus('ARRIVED')}
                        title="Arrived at Pandal"
                        className="p-2 rounded-xl hover:bg-stone-800 text-sm"
                      >
                        🎯
                      </button>
                      <button
                        onClick={() => handleSetStatus('ON_BREAK')}
                        title="Snack / Rest Break"
                        className="p-2 rounded-xl hover:bg-stone-800 text-sm"
                      >
                        ☕
                      </button>
                      <button
                        onClick={() => handleSetStatus('LEAVING')}
                        title="Leaving Soon"
                        className="p-2 rounded-xl hover:bg-stone-800 text-sm"
                      >
                        👋
                      </button>
                    </div>

                    <div className="h-4 w-px bg-stone-700" />

                    {/* Meet Here Pin (Host / Co-host) */}
                    {isCoHost && (
                      <button
                        onClick={handleDropMeetHerePin}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 font-bold flex items-center gap-1 text-[11px]"
                      >
                        <span>📍</span>
                        <span>Meet Here</span>
                      </button>
                    )}

                    {/* Checkpoints */}
                    <button
                      onClick={() => setShowCheckpointsSheet(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold flex items-center gap-1 text-[11px]"
                    >
                      <span>🎯</span>
                      <span>Stops ({group.checkpoints?.length || 0})</span>
                    </button>

                    {/* Chat with badge */}
                    <button
                      onClick={() => setShowChatDrawer(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 text-stone-950 font-bold flex items-center gap-1.5 text-[11px] relative shadow"
                    >
                      <span>💬</span>
                      <span>Chat</span>
                      {group.messages && group.messages.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: MY TRIPS DASHBOARD & HISTORY */}
      {activeTab === 'trips' && (
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-8">
          {/* Active Trips */}
          <div>
            <h2 className="text-xl font-black font-cinzel text-amber-400 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Trips
            </h2>
            {myTrips.active.length === 0 ? (
              <p className="text-stone-500 text-sm bg-stone-900 border border-stone-800 rounded-2xl p-5">
                No active trip right now. Create one or join with an invite code!
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {myTrips.active.map((t) => (
                  <div
                    key={t.groupId}
                    className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-xl hover:border-amber-500/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                          {t.joinCode}
                        </span>
                        <span className="text-xs text-stone-400">
                          {Object.keys(t.members || {}).length} members
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">{t.groupName}</h3>
                      {t.destination?.name && (
                        <p className="text-xs text-stone-400 mb-3">Target: {t.destination.name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setGroup(t)
                        setActiveTab('live')
                      }}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-xs shadow-md hover:scale-[1.01] transition"
                    >
                      Resume Live Map →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Trips */}
          {myTrips.upcoming.length > 0 && (
            <div>
              <h2 className="text-xl font-black font-cinzel text-stone-200 mb-4 flex items-center gap-2">
                <span>⏳</span> Scheduled Trips
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {myTrips.upcoming.map((t) => (
                  <div key={t.groupId} className="bg-stone-900 border border-stone-800 rounded-3xl p-5">
                    <h3 className="font-bold text-white mb-1">{t.groupName}</h3>
                    <p className="text-xs text-stone-400 font-mono mb-3">Code: {t.joinCode}</p>
                    <button
                      onClick={() => {
                        setGroup(t)
                        setActiveTab('live')
                      }}
                      className="text-xs font-bold text-amber-400 hover:underline"
                    >
                      Open Trip Room →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Trips History */}
          <div>
            <h2 className="text-xl font-black font-cinzel text-stone-300 mb-4 flex items-center gap-2">
              <span>📜</span> Completed Trip History
            </h2>
            {myTrips.completed.length === 0 ? (
              <p className="text-stone-500 text-sm bg-stone-900 border border-stone-800 rounded-2xl p-5">
                Completed trips will appear here with your visited pandals and checkpoints (location traces are purged for privacy).
              </p>
            ) : (
              <div className="space-y-3">
                {myTrips.completed.map((t) => (
                  <div
                    key={t.groupId}
                    className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center justify-between text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-stone-200 text-sm">{t.groupName}</h4>
                      <p className="text-stone-500 mt-0.5">
                        {t.routePandals?.length || 1} pandals visited • {Object.keys(t.members || {}).length} friends
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-stone-800 text-stone-400 font-semibold text-[11px]">
                      Completed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CREATE TRIP */}
      {activeTab === 'create' && (
        <div className="max-w-xl mx-auto w-full p-4 sm:p-6">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="text-center mb-6">
              <span className="text-4xl mb-2 inline-block">🪔</span>
              <h2 className="text-2xl font-black font-cinzel text-amber-400">Create a Group Trip</h2>
              <p className="text-xs text-stone-400 mt-1">
                Set up a shared pandal hop for your friends with live tracking and meet points.
              </p>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5">Trip Name</label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-100 outline-none focus:border-amber-500 font-medium"
                  placeholder="e.g. South Kolkata Night Hop"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5">Destination Pandal</label>
                <select
                  value={selectedDestinationPandal?.id || ''}
                  onChange={(e) => {
                    const p = pandalsList.find((item) => String(item.id) === e.target.value)
                    if (p) setSelectedDestinationPandal(p)
                  }}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-100 outline-none focus:border-amber-500 font-medium"
                >
                  {pandalsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.locality || 'Kolkata'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5">
                  Max Member Capacity ({createMaxMembers})
                </label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={createMaxMembers}
                  onChange={(e) => setCreateMaxMembers(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-bold text-sm shadow-xl hover:scale-[1.01] transition disabled:opacity-50"
              >
                {busy ? 'Creating Trip…' : 'Start Group Trip 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: JOIN TRIP */}
      {activeTab === 'join' && (
        <div className="max-w-md mx-auto w-full p-4 sm:p-6">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <span className="text-4xl mb-2 inline-block">🔑</span>
            <h2 className="text-2xl font-black font-cinzel text-amber-400 mb-1">Join Group Trip</h2>
            <p className="text-xs text-stone-400 mb-6">
              Enter the 6-character code shared by your friend or Host.
            </p>

            <form onSubmit={handleJoinWithCode} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-4 py-3.5 text-center text-2xl font-mono font-black text-amber-400 tracking-widest outline-none focus:border-amber-500 uppercase placeholder:text-stone-700"
                  placeholder="PUJA24"
                />
              </div>

              <button
                type="submit"
                disabled={busy || !joinCodeInput.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-sm shadow-xl hover:scale-[1.01] transition disabled:opacity-50"
              >
                {busy ? 'Joining…' : 'Enter Trip Room'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* IN-TRIP CHAT DRAWER */}
      {showChatDrawer && group && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-sm bg-stone-900 h-full flex flex-col border-l border-stone-800 shadow-2xl">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950">
              <h3 className="font-cinzel font-black text-amber-400 text-base">In-Trip Chat</h3>
              <button onClick={() => setShowChatDrawer(false)} className="text-stone-400 hover:text-white font-bold">✕</button>
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {(group.messages || []).length === 0 ? (
                <p className="text-center text-stone-500 py-10">No messages yet. Send a greeting or emoji!</p>
              ) : (
                group.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-2xl max-w-[85%] ${
                      String(msg.userId) === String(user?.id)
                        ? 'ml-auto bg-amber-500 text-stone-950 font-medium'
                        : 'bg-stone-800 text-stone-200'
                    }`}
                  >
                    <p className="text-[10px] font-bold opacity-75 mb-0.5">{msg.userName}</p>
                    <p className="text-sm font-semibold">{msg.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Quick Emoji Bar */}
            <div className="px-4 py-2 border-t border-stone-800 bg-stone-950 flex justify-between gap-1 text-lg">
              {['👋', '🪔', '🥤', '🚶', '📍', '🆘'].map((em) => (
                <button
                  key={em}
                  onClick={() => handleSendEmoji(em)}
                  className="p-1.5 hover:scale-125 transition-transform"
                >
                  {em}
                </button>
              ))}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendChat} className="p-3 border-t border-stone-800 bg-stone-950 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type message…"
                className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 text-stone-950 font-bold rounded-xl text-xs hover:bg-amber-400"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CHECKPOINTS SHEET */}
      {showCheckpointsSheet && group && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-cinzel font-black text-amber-400 text-lg">Trip Checkpoints & Stops</h3>
              <button onClick={() => setShowCheckpointsSheet(false)} className="text-stone-400 hover:text-white font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {(group.checkpoints || []).length === 0 ? (
                <p className="text-center text-stone-500 text-xs py-6">No scheduled stops added yet.</p>
              ) : (
                group.checkpoints?.map((cp, idx) => (
                  <div
                    key={cp.id}
                    className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <div>
                        <p className={`font-bold ${cp.isCompleted ? 'line-through text-stone-500' : 'text-stone-200'}`}>
                          {cp.name}
                        </p>
                        {cp.scheduledTime && <p className="text-[11px] text-stone-500">{cp.scheduledTime}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleCheckpoint(cp.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        cp.isCompleted ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      {cp.isCompleted ? 'Done' : 'Mark Done'}
                    </button>
                  </div>
                ))
              )}

              {/* Add Checkpoint Form */}
              <form onSubmit={handleAddCheckpoint} className="mt-4 pt-4 border-t border-stone-800 space-y-3">
                <h4 className="text-xs font-bold text-stone-300">Add Checkpoint</h4>
                <input
                  type="text"
                  required
                  value={checkpointNameInput}
                  onChange={(e) => setCheckpointNameInput(e.target.value)}
                  placeholder="e.g. College Square Gate 1"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={checkpointTimeInput}
                  onChange={(e) => setCheckpointTimeInput(e.target.value)}
                  placeholder="e.g. 7:30 PM"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 text-stone-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition"
                >
                  + Add Checkpoint
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MEMBERS & HOST SHEET */}
      {showMembersSheet && group && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-cinzel font-black text-amber-400 text-lg">Group Members</h3>
              <button onClick={() => setShowMembersSheet(false)} className="text-stone-400 hover:text-white font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {Object.entries(group.members || {}).map(([uid, mem]) => {
                const isSelf = String(user?.id) === String(uid)
                const isMemberHost = String(group.createdBy) === String(uid)

                return (
                  <div
                    key={uid}
                    className="p-3 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <img src={mem.avatarUrl} alt={mem.name} className="w-9 h-9 rounded-full bg-stone-800" />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-stone-200">
                          <span>{mem.name}</span>
                          {isMemberHost && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 rounded font-mono">HOST</span>}
                          {mem.role === 'CO_HOST' && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded font-mono">CO-HOST</span>}
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Status: <strong className="text-amber-400">{mem.status || 'OFFLINE'}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isHost && !isSelf && (
                        <>
                          <button
                            onClick={() => handlePromoteMember(uid, mem.role || 'MEMBER')}
                            className="px-2 py-1 bg-stone-800 hover:bg-stone-700 rounded-lg text-[10px] font-bold text-stone-300"
                          >
                            {mem.role === 'CO_HOST' ? 'Demote' : 'Promote'}
                          </button>
                          <button
                            onClick={() => handleRemoveMember(uid)}
                            className="px-2 py-1 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded-lg text-[10px] font-bold text-red-300"
                          >
                            Remove
                          </button>
                        </>
                      )}
                      {isSelf && !isMemberHost && (
                        <button
                          onClick={() => handleRemoveMember(uid)}
                          className="px-2 py-1 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded-lg text-[10px] font-bold text-red-300"
                        >
                          Leave Trip
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Host Actions Footer */}
            {isHost && (
              <div className="pt-3 border-t border-stone-800 space-y-2">
                <button
                  onClick={handleEndTrip}
                  className="w-full py-2.5 rounded-xl bg-red-600/90 text-white font-bold text-xs hover:bg-red-500 transition shadow"
                >
                  End Group Trip (Purge Location Traces)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRIP SUMMARY MODAL */}
      {showSummaryModal && group && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-stone-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
            <span className="text-5xl mb-3 inline-block">🏆</span>
            <h2 className="text-2xl font-black font-cinzel text-amber-400 mb-1">Trip Completed!</h2>
            <p className="text-stone-300 text-xs mb-6">
              Thank you for exploring Kolkata Durga Puja together with PujaFinder!
            </p>

            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 text-xs text-left space-y-2 mb-6">
              <div className="flex justify-between text-stone-400">
                <span>Trip:</span>
                <strong className="text-stone-200">{group.groupName}</strong>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Total Companions:</span>
                <strong className="text-stone-200">{Object.keys(group.members || {}).length} friends</strong>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Privacy Protection:</span>
                <span className="text-emerald-400 font-bold">✅ Location traces purged</span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowSummaryModal(false)
                setGroup(null)
                setActiveTab('trips')
              }}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg hover:scale-[1.01] transition"
            >
              Back to My Trips
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
