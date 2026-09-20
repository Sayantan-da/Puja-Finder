import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'
import type { GroupMember, GroupTripState } from '../types'

const defaultDestination = {
  pandalId: 'p-101',
  name: 'Sova Bagan',
  latitude: 22.5726,
  longitude: 88.3639,
  address: 'Sova Bagan, Kolkata',
}

const emptyGroupState: GroupTripState | null = null

function formatEta(member: GroupMember) {
  if (member.etaMinutes === 0) return 'Arrived 🎯'
  if (member.etaMinutes >= 999) return 'Offline'
  return `${member.etaMinutes} mins`
}

export default function GroupTripPage() {
  const { user } = useAuth()
  const [group, setGroup] = useState<GroupTripState | null>(emptyGroupState)
  const [joinCode, setJoinCode] = useState('')
  const [groupName, setGroupName] = useState('North Kolkata Pandal Rush')
  const [reconnecting, setReconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('group_trip_state')
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as GroupTripState
      setGroup(parsed)
      setJoinCode(parsed.joinCode)
    } catch {
      sessionStorage.removeItem('group_trip_state')
    }
  }, [])

  useEffect(() => {
    if (!group) return
    sessionStorage.setItem('group_trip_state', JSON.stringify(group))
  }, [group])

  const orderedMembers = useMemo(
    () =>
      group
        ? Object.entries(group.members).sort(([, a], [, b]) => {
            const aEta = a.etaMinutes ?? 999
            const bEta = b.etaMinutes ?? 999
            return aEta - bEta
          })
        : [],
    [group],
  )

  async function refreshGroup(groupId: string) {
    const { data } = await api.get<GroupTripState>(`/groups/${groupId}`)
    setGroup(data)
  }

  async function handleCreateGroup() {
    if (!user) {
      setError('Please log in before creating a group trip.')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const { data } = await api.post<GroupTripState>('/groups/create', {
        groupName: groupName.trim() || 'North Kolkata Pandal Rush',
        initialDestination: {
          ...defaultDestination,
          pandalId: `p-${Date.now()}`,
          name: 'Sova Bagan',
        },
      })
      setGroup(data)
      setJoinCode(data.joinCode)
      setReconnecting(false)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to create group trip right now.')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoinGroup() {
    if (!user) {
      setError('Please log in before joining a group trip.')
      return
    }

    const code = joinCode.trim().toUpperCase()
    if (!code) {
      setError('Enter a valid 6-character join code.')
      return
    }

    setJoining(true)
    setError(null)
    try {
      const { data } = await api.post<GroupTripState>('/groups/join', { joinCode: code })
      setGroup(data)
      setJoinCode(data.joinCode)
      setReconnecting(false)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to join this group trip.')
    } finally {
      setJoining(false)
    }
  }

  async function handleCopyCode() {
    if (!group) return
    try {
      await navigator.clipboard.writeText(group.joinCode)
      setError(null)
    } catch {
      setError('Copy failed. Please copy the code manually.')
    }
  }

  if (!group) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-lg">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-red-500">Group Trip</div>
          <h1 className="mb-2 text-3xl font-black text-stone-800">Start a shared pandal hop</h1>
          <p className="mb-6 text-sm text-stone-600">
            Create a trip or join an existing one with a 6-digit code.
          </p>

          {!user && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Please log in first to create or join a group trip.
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-stone-500">
                Trip name
              </label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-stone-800 outline-none focus:border-red-400"
                placeholder="North Kolkata Pandal Rush"
              />
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={creating || !user}
              className="w-full rounded-xl bg-gradient-to-r from-red-600 to-amber-500 px-4 py-3 text-sm font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Creating group...' : 'Create group trip'}
            </button>

            <div className="grid gap-3 pt-2 md:grid-cols-[1fr_auto]">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-3 text-center text-lg font-black tracking-[0.3em] text-stone-800 outline-none focus:border-red-400"
                placeholder="6-digit code"
                maxLength={6}
              />
              <button
                onClick={handleJoinGroup}
                disabled={joining || !user}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joining ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="rounded-3xl overflow-hidden border border-red-200 bg-white shadow-lg">
        <div className="relative h-[560px] bg-[radial-gradient(circle_at_top,_#fff7ed,_#fef2f2_40%,_#fff)]">
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
            <div className="rounded-2xl border border-white/80 bg-white/85 backdrop-blur-md px-3 py-2 shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.24em] text-red-500 font-bold">Group Trip</div>
              <div className="text-lg font-black text-stone-800">{group.groupName}</div>
            </div>
            <div className="rounded-2xl border border-red-200 bg-white/85 backdrop-blur-md px-3 py-2 text-right shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Share code</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-[0.28em] text-red-700">{group.joinCode}</span>
                <button onClick={handleCopyCode} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-[72%] w-[80%] rounded-[32px] border border-dashed border-red-300 bg-white/30 shadow-inner" />
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="rounded-full border-4 border-red-500 bg-red-100 px-5 py-3 text-center shadow-xl">
              <div className="text-[10px] uppercase tracking-[0.2em] text-red-600">Destination</div>
              <div className="font-black text-red-700">{group.destination.name}</div>
            </div>
          </div>

          {orderedMembers.map(([memberId, member], index) => {
            const x = 18 + (index % 4) * 18
            const y = 32 + (index % 3) * 18 + (memberId === 'me' ? 2 : 0)
            const ring = member.isOnline ? (memberId === 'me' ? 'ring-4 ring-blue-400' : 'ring-4 ring-emerald-400') : 'ring-4 ring-slate-400'
            const isMe = memberId === 'me'

            return (
              <div key={memberId} className="absolute z-20" style={{ left: `${x}%`, top: `${y}%` }}>
                <div className={`relative flex items-center gap-2 ${isMe ? 'scale-110' : ''}`}>
                  <div className={`relative h-12 w-12 rounded-full border-2 border-white bg-gradient-to-br ${isMe ? 'from-blue-500 to-cyan-500' : member.isOnline ? 'from-emerald-500 to-green-500' : 'from-slate-300 to-slate-500'} shadow-lg ${ring}`}>
                    <img src={member.avatarUrl} alt={member.name} className="h-full w-full rounded-full object-cover" />
                  </div>
                  <div className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-stone-700 shadow-sm">
                    {member.name}
                  </div>
                </div>
              </div>
            )
          })}

          <div className="absolute bottom-4 left-4 right-4 z-30">
            <div className="rounded-3xl border border-stone-200 bg-white/90 p-4 shadow-2xl backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Your route</div>
                  <div className="text-lg font-black text-stone-800">{group.destination.name}</div>
                </div>
                <button
                  onClick={() => refreshGroup(group.groupId)}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                >
                  Refresh
                </button>
              </div>

              <div className="space-y-3">
                {orderedMembers.map(([memberId, member]) => (
                  <div key={memberId} className="flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <img src={member.avatarUrl} alt={member.name} className="h-9 w-9 rounded-full border border-white shadow-sm" />
                      <div>
                        <div className="text-sm font-bold text-stone-800">{member.name}</div>
                        <div className="text-[11px] text-stone-500">{member.isOnline ? 'Live' : 'Stale'} • {member.speed.toFixed(1)} m/s</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-stone-800">{formatEta(member)}</div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">ETA</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {reconnecting && (
            <div className="absolute right-4 top-24 z-30 rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm">
              Reconnecting...
            </div>
          )}
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Join existing group</div>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-center text-lg font-black tracking-[0.3em] text-stone-800 outline-none focus:border-red-400"
              placeholder="6-digit code"
            />
            <button
              onClick={handleJoinGroup}
              disabled={joining || !user}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? 'Joining...' : 'Join'}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Create group</div>
          <button
            onClick={handleCreateGroup}
            disabled={creating || !user}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-amber-500 px-4 py-3 text-sm font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Creating...' : 'New group trip'}
          </button>
        </div>
      </section>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </main>
  )
}
