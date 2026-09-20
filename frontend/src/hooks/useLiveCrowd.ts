import { useEffect, useRef, useState } from 'react'
import type { CrowdSnapshot, CrowdUpdate } from '../types'

/**
 * Live crowd updates over WebSocket.
 *
 * - Server sends a `crowd_snapshot` immediately on connect → fresh data with
 *   zero wait, then `crowd_update` pushes the instant anyone reports.
 * - Auto-reconnects with exponential backoff; falls back to 10 s REST polling
 *   if the socket can't connect.
 * - Sends a lightweight ping every 25 s to keep the connection warm.
 */
export function useLiveCrowd(channel: string | number) {
  const [lastUpdate, setLastUpdate] = useState<CrowdUpdate | null>(null)
  const [snapshot, setSnapshot] = useState<CrowdSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [pollTick, setPollTick] = useState(0)
  const updateCount = useRef(0)

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry = 0
    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let pingTimer: ReturnType<typeof setInterval> | undefined

    function connect() {
      if (cancelled) return
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      try {
        ws = new WebSocket(`${proto}://${window.location.host}/ws/crowd/${channel}`)
      } catch {
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        retry = 0
        setConnected(true)
        // Keep the connection warm through sleepy proxies
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send('ping')
        }, 25000)
      }
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.type === 'crowd_update') {
            updateCount.current += 1
            setLastUpdate(msg as CrowdUpdate)
          } else if (msg.type === 'crowd_snapshot') {
            setSnapshot(msg as CrowdSnapshot)
          }
        } catch {
          /* ignore malformed messages */
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (pingTimer) clearInterval(pingTimer)
        scheduleReconnect()
      }
      ws.onerror = () => ws?.close()
    }

    function scheduleReconnect() {
      if (cancelled) return
      retry += 1
      reconnectTimer = setTimeout(connect, Math.min(1000 * 2 ** retry, 15000))
    }

    connect()

    // Safety-net: poll the REST API every 10 s while the socket is down
    const poll = setInterval(() => {
      setPollTick((t) => t + 1)
    }, 10000)

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pingTimer) clearInterval(pingTimer)
      clearInterval(poll)
      ws?.close()
    }
  }, [channel])

  return { lastUpdate, snapshot, connected, updateCount: updateCount.current, pollTick }
}
