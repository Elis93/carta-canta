import type { MetadataRoute } from 'next'

// ============================================================
// /sitemap.xml — le pagine PUBBLICHE che vogliamo su Google.
//
// Solo marketing e legali: le pagine con token (/p/, /r/) sono
// noindex per privacy, quelle dell'app sono dietro login.
// /professionisti è la directory pubblica del marketplace.
// ============================================================

const BASE = 'https://cartacanta.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/prova`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/professionisti`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/signup`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/login`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/termini`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/cancella-account`, changeFrequency: 'monthly', priority: 0.1 },
  ]
}
