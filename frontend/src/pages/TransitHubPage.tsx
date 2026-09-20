import { useState } from 'react'
import MetroBusScheduleViewer from '../components/transit/MetroBusScheduleViewer'
import TrafficParkingStatusList from '../components/transit/TrafficParkingStatusList'

export default function TransitHubPage() {
  const [activeSection, setActiveSection] = useState<'schedules' | 'traffic'>('schedules')

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero Banner with Reference Photo (Maa Durga Mandala & Dhak Plumes) */}
      <div className="relative overflow-hidden rounded-3xl border border-red-200 bg-white p-6 sm:p-8 shadow-lg mb-8">
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-amber-400 to-red-600 absolute top-0 left-0 right-0" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-red-100 border border-red-300 text-red-800 text-xs font-extrabold uppercase tracking-wider">
                🪔 শারদীয়া ২০২৬ ট্রানজিট গাইড
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                KMRC &amp; Kolkata Police Advisory
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-100 border border-blue-300 text-blue-900 text-xs font-semibold flex items-center gap-1">
                ℹ️ Indicative Schedules (Subject to Police Directives)
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Festival Transport &amp; <span className="sindoor-text">Kolkata Metro Guide</span>
            </h1>
            <p className="text-stone-600 text-sm sm:text-base max-w-2xl leading-relaxed font-medium">
              Navigate night-long Metro trains running till 4:30 AM, 24-hour festival special buses,
              police pedestrian-only zones, and live crowdsourced parking availability.
            </p>
            <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>
                <strong>Advisory:</strong> Timings and parking lots are based on published guidelines. Always follow on-duty Kolkata Traffic Police instructions during peak Saptami–Navami rush.
              </span>
            </div>
          </div>

          {/* Reference Image Badge & Metrics */}
          <div className="flex items-center gap-4 bg-red-50/70 p-3.5 rounded-2xl border border-red-200 shadow-xs">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-red-400 shadow-sm shrink-0">
              <img
                src="/assets/maa-durga-mandala-dhak.jpg"
                alt="Divine Durga & Dhak"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <span className="text-[11px] text-red-700 block font-bold">Night Metro Service</span>
              <span className="text-lg font-black text-stone-900 font-mono">Till 4:30 AM</span>
              <span className="text-[10px] text-stone-500 block">Kolkata Police: 1073</span>
            </div>
          </div>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="mt-8 pt-6 border-t border-red-100 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveSection('schedules')}
            className={`px-5 py-3 rounded-2xl font-bold text-sm transition flex items-center gap-2.5 shadow-sm ${
              activeSection === 'schedules'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white border border-red-200 text-stone-700 hover:bg-red-50 hover:text-red-700'
            }`}
            aria-pressed={activeSection === 'schedules'}
          >
            <span className="text-lg">🚇</span>
            <span>Metro &amp; Bus Timetables</span>
          </button>

          <button
            onClick={() => setActiveSection('traffic')}
            className={`px-5 py-3 rounded-2xl font-bold text-sm transition flex items-center gap-2.5 shadow-sm ${
              activeSection === 'traffic'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white border border-red-200 text-stone-700 hover:bg-red-50 hover:text-red-700'
            }`}
            aria-pressed={activeSection === 'traffic'}
          >
            <span className="text-lg">⛔</span>
            <span>Traffic Zones &amp; Parking Center</span>
          </button>
        </div>
      </div>

      {/* Section Content */}
      <div className="transition-all">
        {activeSection === 'schedules' ? (
          <MetroBusScheduleViewer />
        ) : (
          <TrafficParkingStatusList />
        )}
      </div>

      {/* Emergency & Hopping Tips Footer */}
      <section className="mt-12 rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-black text-red-700 uppercase tracking-wider mb-3">
          💡 Essential Puja Hopping Transit Tips
        </h3>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-600">
          <li className="p-4 rounded-xl bg-red-50/50 border border-red-100">
            <strong className="text-stone-900 block mb-1">🎫 Metro QR &amp; Smart Cards:</strong>
            Recharge your metro card or use the Kolkata Metro Ride official app QR to bypass token queues during Saptami–Nabami rush hours.
          </li>
          <li className="p-4 rounded-xl bg-red-50/50 border border-red-100">
            <strong className="text-stone-900 block mb-1">🚷 Respect Pedestrian Zones:</strong>
            Police barricades around Chetla, Rashbehari, and Bagbazar are strictly enforced for pedestrian safety. No vehicles are allowed within 500m.
          </li>
          <li className="p-4 rounded-xl bg-red-50/50 border border-red-100">
            <strong className="text-stone-900 block mb-1">🚌 All-Night Bus Services:</strong>
            WBTC operates night special circular buses from Howrah &amp; Sealdah stations connecting North, South, and Salt Lake pandal clusters.
          </li>
        </ul>
      </section>
    </main>
  )
}
