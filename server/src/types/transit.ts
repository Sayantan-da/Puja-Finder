export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export type MetroLineColor = 'Blue' | 'Green' | 'Purple' | 'Orange'

export type StationCrowdStatus = 'Normal' | 'Busy' | 'Overcrowded'

export type PujaDay = 'Saptami' | 'Ashtami' | 'Nabami' | 'Dashami'

export type TransitTimeSlot = 'All' | 'Day' | 'Midnight' | 'Night Special (1 AM - 4 AM)'

export type ParkingStatus = 'Available' | 'Filling Fast' | 'Full'

export interface CrowdsourcedVotes {
  available: number
  full: number
}

export interface NearestParkingSummary {
  parkingSpotId: string
  locationName: string
  walkingDistanceMeters: number
  availableCapacity: number
  status: ParkingStatus
}

export interface PandalTransitInfo {
  pandalId: number | string
  pandalName: string
  metroStationName: string
  lineColor: MetroLineColor
  lineName: string
  gateNumber: string | number
  gateDescription: string
  walkingDistanceMeters: number
  estimatedWalkTimeMinutes: number
  stationCrowdStatus: StationCrowdStatus
  interchangeStation?: boolean
  lastNightTrainTime?: string
  nearestParking?: NearestParkingSummary
}

export interface MetroTimetable {
  id: string
  line: string
  lineColor: MetroLineColor
  pujaDay: PujaDay
  direction: string
  firstTrainTime: string
  lastTrainTime: string
  peakFrequencyMinutes: number
  nightFrequencyMinutes?: number
  timeSlot: 'Day' | 'Midnight' | 'Night Special (1 AM - 4 AM)'
  isAllNightSpecial: boolean
  specialNotes?: string
}

export interface BusRoute {
  id: string
  routeNumber: string
  origin: string
  destination: string
  is24HourSpecial: boolean
  keyPassThroughPandals: string[]
  operatingHours: string
  frequencyMinutes: number
  acType: 'AC' | 'Non-AC' | 'Special Electric'
}

export interface TrafficRestriction {
  id: string
  zoneName: string
  isPedestrianOnly: boolean
  restrictedVehicleTypes: string[]
  effectiveHours: string
  landmarkNear: string
  policeDivision: string
  helplineNumber: string
  geoFencePolygon: GeoJSONPolygon
}

export interface ParkingSpot {
  parkingSpotId: string
  locationName: string
  landmark: string
  totalCapacity: number
  availableCapacity: number
  status: ParkingStatus
  lastUpdated: string
  crowdsourcedVotes: CrowdsourcedVotes
  userVote?: 'available' | 'full'
  coordinates: [number, number]
  hourlyRate: string
  walkingToPandals: string[]
}
