export interface User {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  role: 'USER' | 'MODERATOR' | 'ADMIN'
  is_active?: boolean
  is_mfa_enabled?: boolean
  created_at?: string | null
}

export interface LoginResult {
  user?: User
  mfaRequired: boolean
  mfaToken?: string
}


export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH'
export type ApproachTraffic = 'CLEAR' | 'CONGESTED' | 'PEDESTRIAN_ONLY'
export type BarricadeDistance = 'DIRECT' | 'MODERATE' | 'LONG_CIRCUIT'
export type CrowdTrend = 'SURGING' | 'STEADY' | 'COOLING'

export interface HourlyPatternPoint {
  hour: number
  label: string
  rush_percent: number
  rush_level: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME'
  wait_minutes: number
  is_quiet_window: boolean
}

export interface GroupDestination {
  pandalId: string
  name: string
  latitude: number
  longitude: number
  address: string
  theme?: string | null
  crowdLevel?: string | null
  setBy?: string
  setAt?: string
}

export interface TripCheckpoint {
  id: string
  name: string
  latitude?: number | null
  longitude?: number | null
  scheduledTime?: string | null
  pandalId?: string | null
  isCompleted: boolean
  createdAt?: string
}

export interface TripMessage {
  id: string
  userId: string
  userName: string
  message: string
  emoji?: string | null
  createdAt: string
}

export interface TripAlert {
  id: string
  type: 'IM_LOST' | 'MEET_HERE' | 'CROWD_RUSH' | 'ARRIVAL'
  userId: string
  userName: string
  coords?: { latitude: number; longitude: number } | null
  data?: any
  createdAt: string
}

export interface MeetHerePin {
  latitude: number
  longitude: number
  title?: string
  description?: string
  setBy?: string
  setAt?: string
}

export interface GroupMember {
  userId?: string
  name: string
  avatarUrl: string
  role?: 'HOST' | 'CO_HOST' | 'MEMBER'
  sharingLocation?: boolean
  latitude: number | null
  longitude: number | null
  accuracy?: number | null
  heading: number
  speed: number
  status?: 'MOVING' | 'STALLED' | 'ARRIVED' | 'ON_BREAK' | 'LEAVING' | 'OFFLINE' | 'LOCATION_OFF'
  lastUpdated: string | null
  isOnline?: boolean
  etaMinutes?: number
  distanceToDestination?: number | null
  joinedAt?: string
}

export interface GroupTripState {
  groupId: string
  groupName: string
  joinCode: string
  inviteToken?: string | null
  createdBy: string
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startsAt?: string | null
  endsAt?: string | null
  maxMembers?: number
  isPrivate?: boolean
  destination: GroupDestination
  routePandals?: GroupDestination[]
  checkpoints?: TripCheckpoint[]
  meetHerePin?: MeetHerePin | null
  members: Record<string, GroupMember>
  messages?: TripMessage[]
  alerts?: TripAlert[]
  createdAt: string
  updatedAt?: string
}

export interface Pandal {
  id: number
  name: string
  address: string
  locality: string | null
  latitude: number | null
  longitude: number | null
  theme: string | null
  description: string | null
  opening_time: string | null
  closing_time: string | null
  dates?: string | null
  accessibility_tags?: string | null
  official_links?: string | null
  is_verified_by_admin?: boolean
  created_at?: string | null
  updated_at?: string | null
  avg_rating: number | null
  review_count: number
  crowd_level: CrowdLevel | null
  waiting_time_minutes: number | null
  crowd_updated_at: string | null
  confidence: number | null
  confidence_label?: 'HIGH' | 'MODERATE' | 'PRELIMINARY' | 'STALE' | null
  fresh_count: number
  distinct_reporters_count?: number
  is_stale: boolean
  crowd_trend?: CrowdTrend | null
  approach_traffic?: ApproachTraffic | null
  barricade_distance?: BarricadeDistance | null
  comfort_tags?: string[]
  hourly_pattern?: HourlyPatternPoint[]
  open_now: boolean | null
  cover_image: string | null
  distance_km: number | null
}

export interface ImageItem {
  id: number
  pandal_id: number
  user_id: number | null
  image_url: string
  caption: string | null
  created_at: string | null
}

export interface CrowdUpdate {
  type: 'crowd_update'
  pandal_id: number
  crowd_level: CrowdLevel | null
  waiting_time_minutes: number | null
  crowd_updated_at?: string | null
  crowd_trend?: CrowdTrend | null
  approach_traffic?: ApproachTraffic | null
  barricade_distance?: BarricadeDistance | null
  comfort_tags?: string[]
  reported: CrowdLevel
  comment: string | null
  pandal_name?: string
  fresh_count: number
  simulated?: boolean
  ts: string
}

export interface CrowdSnapshotEstimate {
  pandal_id: number
  pandal_name?: string | null
  crowd_level: CrowdLevel | null
  waiting_time_minutes: number | null
  crowd_updated_at: string | null
}

export interface CrowdSnapshot {
  type: 'crowd_snapshot'
  estimates: CrowdSnapshotEstimate[]
}

export interface MomentItem {
  id: number
  user_id: number
  user_name: string
  image_url: string
  caption: string | null
  created_at: string | null
  avg_rating: number | null
  vote_count: number
  my_rating: number | null
}

export interface ContentBlock {
  id: number
  key: string
  title: string
  body: string
  updated_at: string | null
}

export interface ReportItem {
  id: number
  user_id: number | null
  pandal_id: number | null
  review_id: number | null
  reason: string | null
  description: string | null
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'REJECTED'
}

export interface Review {
  id: number
  rating: number
  comment: string | null
  created_at: string | null
  user: User
}

export interface CrowdReport {
  id: number
  crowd_level: CrowdLevel
  waiting_time_minutes: number | null
  approach_traffic?: ApproachTraffic | null
  barricade_distance?: BarricadeDistance | null
  comfort_tags?: string[]
  comment: string | null
  created_at: string | null
}

export interface EventItem {
  id: number
  pandal_id: number
  title: string
  description: string | null
  event_date: string
  start_time: string
  end_time: string
  event_type: string
}

export interface AdminStats {
  total_users: number
  total_pandals: number
  active_pandals?: number
  total_events: number
  total_reviews: number
  total_crowd_reports: number
  total_moments?: number
  pending_reports_count?: number
}

export interface PandalAdminOut {
  id: number
  name: string
  address: string
  locality: string | null
  latitude: number | null
  longitude: number | null
  theme: string | null
  description: string | null
  opening_time: string | null
  closing_time: string | null
  dates: string | null
  accessibility_tags: string | null
  official_links: string | null
  parking_info: string | null
  metro_info: string | null
  route_tips: string | null
  is_verified_by_admin: boolean
  is_published: boolean
  is_active: boolean
  deleted_at: string | null
  created_at: string | null
  updated_at: string | null
  avg_rating: number | null
  review_count: number
  photo_count: number
}

export interface ReviewModerationItem {
  id: number
  pandal_id: number
  pandal_name: string
  user_id: number
  user_name: string
  user_email: string | null
  rating: number
  comment: string | null
  is_approved: boolean
  created_at: string | null
  flag_count: number
}

export interface MomentModerationItem {
  id: number
  user_id: number
  user_name: string
  user_email: string | null
  image_url: string
  caption: string | null
  is_approved: boolean
  created_at: string | null
}

export interface AuditLogEntry {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  entity_type: string | null
  entity_id: number | null
  details: string | null
  ip_address: string | null
  created_at: string | null
}

export interface HourlyCrowdPoint {
  hour: number
  report_count: number
  low_count: number
  moderate_count: number
  high_count: number
  avg_waiting_time_minutes: number | null
}

export interface PeakHour {
  hour: number
  report_count: number
}

export interface TopPandalTrend {
  pandal_id: number
  pandal_name: string
  report_count: number
  avg_waiting_time_minutes: number | null
  latest_crowd_level: string | null
}

export interface AdminAnalytics {
  hourly_crowd: HourlyCrowdPoint[]
  peak_hours: PeakHour[]
  top_pandals: TopPandalTrend[]
}

export interface RouteLeg {
  from_index: number
  to_index: number
  distance_km: number
  travel_minutes: number
}

export interface RouteStop {
  step_number: number
  pandal: Pandal
  queue_wait_minutes: number
  recommended_dwell_minutes: number
  leg_from_previous: RouteLeg | null
  cumulative_travel_minutes: number
  cumulative_queue_minutes: number
  cumulative_total_minutes: number
  google_maps_nav_url: string
}

export interface OptimizedRouteResponse {
  mode: 'walking' | 'driving'
  total_stops: number
  total_distance_km: number
  total_travel_minutes: number
  total_queue_minutes: number
  total_dwell_minutes: number
  total_circuit_minutes: number
  bottleneck_warnings: string[]
  google_maps_multi_stop_url: string
  stops: RouteStop[]
}

export interface CuratedTrail {
  id: string
  title: string
  subtitle: string
  icon: string
  badge: string
  description: string
  theme_focus: string
  best_time: string
  default_mode: 'walking' | 'driving'
  pandal_names: string[]
  pandal_ids: number[]
}

export interface OptimizeRouteRequest {
  pandal_ids: number[]
  start_lat?: number | null
  start_lng?: number | null
  start_label?: string | null
  mode: 'walking' | 'driving'
  optimize: boolean
}

