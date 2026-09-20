import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { ContentBlock } from '../types'

export default function AboutPage() {
  const { user } = useAuth()
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<ContentBlock[]>('/content')
      .then((r) => setBlocks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* ── Heritage Banner with Reference Photo (Thakurdalan & Kash Phool) ── */}
      <div className="rounded-3xl border border-red-200 bg-white p-6 sm:p-8 mb-8 shadow-lg relative overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-amber-400 to-red-600 absolute top-0 left-0 right-0" />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 border border-red-300 text-red-800 text-xs font-bangla font-semibold mb-3">
              <span>🌾</span> ইউনেস্কো মানবতার আবহমান সাংস্কৃতিক ঐতিহ্য ✦ UNESCO Intangible Cultural Heritage
            </div>
            <h1
              className="text-3xl sm:text-4xl font-extrabold text-stone-900 leading-tight"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              The Grand Heritage of <span className="sindoor-text">Durga Puja</span>
            </h1>
            <p className="mt-3 text-stone-600 text-sm sm:text-base leading-relaxed">
              From historic bonedi bari thakurdalans to avant-garde public theme art, explore the cultural soul, rituals, dhak rhythms, and dhunuchi dance of Kolkata’s greatest celebration.
            </p>
          </div>

          <div className="md:col-span-4 flex justify-center">
            <div className="w-48 h-48 rounded-2xl overflow-hidden border-2 border-red-200 shadow-md transform rotate-1 hover:rotate-0 transition duration-300">
              <img
                src="/assets/archway-dhunuchi-kash.jpg"
                alt="Traditional Durga Puja Archway with Dhunuchi Dancer & Kash Phool"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {user?.role === 'ADMIN' && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 font-medium">
          You are an admin — <Link to="/admin" className="underline font-bold hover:text-red-900">edit this page content</Link>.
        </div>
      )}

      {/* Cultural Heritage Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-xs flex flex-col items-center text-center">
          <span className="text-3xl mb-2">🥁</span>
          <h3 className="font-bold text-stone-900 font-bangla text-base">ঢাকের বাদ্য ও কাশফুল</h3>
          <p className="text-xs text-stone-600 mt-1">The resonant beats of Dhak mark the arrival of Maa Durga in the autumn breeze.</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-xs flex flex-col items-center text-center">
          <span className="text-3xl mb-2">🪔</span>
          <h3 className="font-bold text-stone-900 font-bangla text-base">ধুনুচি নাচ ও আরতি</h3>
          <p className="text-xs text-stone-600 mt-1">Traditional rhythmic dance with smoking clay burners during Sandhi Puja.</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-xs flex flex-col items-center text-center">
          <span className="text-3xl mb-2">🔴</span>
          <h3 className="font-bold text-stone-900 font-bangla text-base">লাল-সাদা শাড়ি ও সিঁদুরখেলা</h3>
          <p className="text-xs text-stone-600 mt-1">The iconic red-bordered white Garad saree and celebratory Dashami Sindoor Khela.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-stone-500 text-center py-8">Loading cultural insights…</p>
      ) : blocks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-red-100 p-8 text-center text-stone-600">
          <p className="font-semibold">Curated Durga Puja guides coming soon.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {blocks.map((b) => (
            <section key={b.id} className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-3 text-stone-900" style={{ fontFamily: "'Cinzel', serif" }}>
                {b.title}
              </h2>
              <div className="space-y-3">
                {b.body.split('\n').map((line, i) =>
                  line.trim() === '' ? (
                    <div key={i} className="h-1" />
                  ) : (
                    <p key={i} className="text-stone-700 leading-relaxed text-[15px]">
                      {line}
                    </p>
                  ),
                )}
              </div>
              {b.updated_at && (
                <p className="text-xs text-stone-400 mt-4">
                  Last updated {new Date(b.updated_at).toLocaleDateString()}
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
