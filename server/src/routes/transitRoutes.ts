import { Router } from 'express'
import {
  getPandalTransit,
  getSchedules,
  getTrafficAndParking,
  voteParking,
} from '../controllers/transitController'

const router = Router()

// Pandal Transit Info: nearest metro station, exit gate, walking distance, crowd status
router.get('/pandals/:id/transit', getPandalTransit)

// Crowdsourced parking availability vote: [YES / NO] (full / available)
router.post('/parking/:id/vote', voteParking)

// Schedules for Metro and Special Night Buses
router.get('/transit/schedules', getSchedules)

// Traffic restrictions (pedestrian-only GeoJSON zones) and parking lots
router.get('/transit/traffic-parking', getTrafficAndParking)

export default router
