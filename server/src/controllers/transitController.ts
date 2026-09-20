import { Request, Response } from 'express'
import {
  mockBusRoutes,
  mockMetroTimetables,
  mockPandalTransitMap,
  mockParkingSpots,
  mockTrafficRestrictions,
} from '../data/mockTransitData'
import {
  PandalTransitInfo,
  ParkingSpot,
  PujaDay,
  TransitTimeSlot,
} from '../types/transit'

// In-memory store of parking spots for crowdsourced voting mutations
const parkingStore: Map<string, ParkingSpot> = new Map(
  mockParkingSpots.map((spot) => [spot.parkingSpotId, { ...spot }])
)

/**
 * GET /api/v1/pandals/:id/transit
 * Returns nearest Metro station, exit gate, walking distance, estimated walk time,
 * live crowd status, and nearest available parking spots.
 */
export const getPandalTransit = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    if (!id || id === 'undefined') {
      res.status(400).json({ success: false, message: 'Pandal ID is required' })
      return
    }

    const transitInfo = mockPandalTransitMap[id]

    if (!transitInfo) {
      // Graceful fallback for non-seeded pandals
      const defaultInfo: PandalTransitInfo = {
        pandalId: id,
        pandalName: `Pandal #${id}`,
        metroStationName: 'Kalighat Metro Station',
        lineColor: 'Blue',
        lineName: 'Blue Line (North-South Corridor)',
        gateNumber: 'Gate 2',
        gateDescription: 'Main Festival Access Exit',
        walkingDistanceMeters: 450,
        estimatedWalkTimeMinutes: 6,
        stationCrowdStatus: 'Normal',
        interchangeStation: false,
        lastNightTrainTime: '04:00 AM (Puja Night Special)',
        nearestParking: {
          parkingSpotId: 'park-kalighat-01',
          locationName: 'Kalighat Park Municipal Ground Lot',
          walkingDistanceMeters: 500,
          availableCapacity: 45,
          status: 'Filling Fast',
        },
      }
      res.status(200).json({
        success: true,
        data: defaultInfo,
        message: 'Default nearest transit estimate provided',
      })
      return
    }

    res.status(200).json({
      success: true,
      data: transitInfo,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pandal transit data',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/v1/parking/:id/vote
 * Handles crowdsourced parking availability updates.
 * Request body: { vote: 'available' | 'full' }
 */
export const voteParking = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { vote } = req.body as { vote?: 'available' | 'full' }

    if (!id || id === 'undefined') {
      res.status(400).json({ success: false, message: 'Parking Spot ID is required' })
      return
    }

    if (vote !== 'available' && vote !== 'full') {
      res.status(400).json({
        success: false,
        message: "Vote must be either 'available' or 'full'",
      })
      return
    }

    let spot = parkingStore.get(id)
    if (!spot) {
      res.status(404).json({ success: false, message: `Parking spot with id '${id}' not found` })
      return
    }

    // Apply crowdsourced vote
    if (vote === 'available') {
      spot.crowdsourcedVotes.available += 1
      // Modulate available capacity upward if feasible
      if (spot.availableCapacity < spot.totalCapacity) {
        spot.availableCapacity = Math.min(spot.totalCapacity, spot.availableCapacity + 1)
      }
    } else {
      spot.crowdsourcedVotes.full += 1
      // Modulate available capacity downward
      if (spot.availableCapacity > 0) {
        spot.availableCapacity = Math.max(0, spot.availableCapacity - 1)
      }
    }

    // Recalculate status based on live capacity ratio and votes
    const ratio = spot.availableCapacity / spot.totalCapacity
    if (spot.availableCapacity === 0 || ratio < 0.1) {
      spot.status = 'Full'
    } else if (ratio <= 0.35) {
      spot.status = 'Filling Fast'
    } else {
      spot.status = 'Available'
    }

    spot.lastUpdated = 'Just now (Verified by user)'
    spot.userVote = vote
    parkingStore.set(id, spot)

    res.status(200).json({
      success: true,
      data: spot,
      message: `Vote recorded successfully. Spot marked as ${spot.status}.`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to submit crowdsourced parking vote',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/v1/transit/schedules
 * Filter schedules by Puja Day and Time Slot, with search for key pandals
 */
export const getSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { day, slot, search } = req.query as {
      day?: PujaDay
      slot?: TransitTimeSlot
      search?: string
    }

    let metro = [...mockMetroTimetables]
    let buses = [...mockBusRoutes]

    if (day) {
      metro = metro.filter((m) => m.pujaDay.toLowerCase() === day.toLowerCase())
    }

    if (slot && slot !== 'All') {
      metro = metro.filter((m) => m.timeSlot === slot)
    }

    if (search && search.trim().length > 0) {
      const q = search.toLowerCase()
      buses = buses.filter(
        (b) =>
          b.routeNumber.toLowerCase().includes(q) ||
          b.origin.toLowerCase().includes(q) ||
          b.destination.toLowerCase().includes(q) ||
          b.keyPassThroughPandals.some((p) => p.toLowerCase().includes(q))
      )
    }

    res.status(200).json({
      success: true,
      data: {
        metroTimetables: metro,
        busRoutes: buses,
        totalMetroServices: metro.length,
        totalBusRoutes: buses.length,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transit schedules',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/v1/transit/traffic-parking
 * Returns pedestrian no-entry zones (with GeoJSON) and parking spots
 */
export const getTrafficAndParking = async (_req: Request, res: Response): Promise<void> => {
  try {
    const spots = Array.from(parkingStore.values())
    res.status(200).json({
      success: true,
      data: {
        restrictions: mockTrafficRestrictions,
        parkingSpots: spots,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve traffic and parking data',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
