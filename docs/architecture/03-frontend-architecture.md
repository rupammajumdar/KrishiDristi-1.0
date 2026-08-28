# 03 — Frontend Architecture

React 18 single-page application built with Vite 5 + Tailwind CSS. All API
communication is centralized in `frontend/src/api.js`, which wraps `fetch` and provides
**fallback/mock data** whenever the backend is offline.

## 1. Component / File Map

```
frontend/src/
├── main.jsx                 Entry point, ReactDOM render
├── App.jsx                  Root: auth + role routing + global state
├── api.js                   Central fetch wrapper + offline fallbacks
├── i18n.js                  Multilingual strings (en/mr/hi/kn/te)
├── index.css                Tailwind base
└── components/
    ├── Header.jsx                  Top nav / role switcher
    ├── FarmerDashboard.jsx         ★ Core farmer view
    ├── GISMap.jsx                  Leaflet map, AOI draw/search/geocode
    ├── GovernmentDashboard.jsx     District aggregation view
    ├── InsurerDashboard.jsx        Claims / audit view
    ├── AdminPanel.jsx / AdminConsole.jsx   Ops / model registry
    ├── NotificationCenter.jsx      Alerts & SMS status
    ├── ExplainabilityPanel.jsx     Feature-importance widget
    ├── TemporalSlider.jsx          Time-series NDVI playback
    └── utils/reportClientGenerator.js   Client-side PDF render helper
```

## 2. Component Tree (High Level)

```
<App>
 ├─ <Header/>
 ├─ role === 'farmer'
 │    └─ <FarmerDashboard>
 │         ├─ <GISMap>                       (select/draw AOI → onSelectAoi)
 │         ├─ Health Score gauge (Recharts)
 │         ├─ Location context strip (village, district, state, KVK)
 │         ├─ Advisory <tasksList>           (score-aligned tasks)
 │         ├─ Gemini advisory tasks (aiTasks)
 │         ├─ Krishi Sahayak Q&A box         (ask-ai)
 │         ├─ NDVI/Temporal trend (TemporalSlider)
 │         └─ ExplainabilityPanel
 ├─ role === 'government' └─ <GovernmentDashboard>
 ├─ role === 'insurer'    └─ <InsurerDashboard>
 └─ role === 'admin'      └─ <AdminPanel> / <AdminConsole>
```

## 3. State Management

Lifted state lives in `App.jsx`; plot-scoped state lives in `FarmerDashboard.jsx`.

| State | Location | Purpose |
|-------|----------|---------|
| `aois`, `selectedAoi` | App | Plot list + active plot |
| `activePrediction` | FarmerDashboard | Current ML prediction result |
| `activeCropKey` | FarmerDashboard | Selected crop (cotton/soybean/…) |
| `completedTasksByPlot` | FarmerDashboard | Task check-off, keyed by plot id |
| `healthScore / risk level` | FarmerDashboard | Derived from NDVI + yield (0–100) |
| `aiTasks`, `aiAnswer` | FarmerDashboard | Gemini advisory + Q&A |
| `currentLang` | App | Active language (en/mr/hi/kn/te) |

## 4. Key Data Flows

### 4.1 Plot Selection → Exact-Location Prediction
```
Plot switch → App.loadAoiDetails(selectedAoi)
   ├─ getAoiCentroid()          → lat/lon from AOI geometry
   └─ buildLocationContext()    → lat, lon, village, district, state, crop
        └─ api.predictYield(aoiId, { location_context })   [api.js:389 area]
             └─ backend returns exact ml_stress + snapshot
```

### 4.2 Offline Fallback (`api.js`)
When the backend is unreachable:
- `createAOI` derives a coordinate label (`Plot (19.xx, 75.xx)`) — never a hardcoded
  default district.
- `reverseGeocode` returns `Plot (lat, lon)` / `Unknown District` for points outside
  known regions — never "nearest Jalna".
- `predictYield` builds a `location_context` from the real `lat/lon`, a state-aware
  `soil_type` + `kvk_station`, and an exact `full_location`.

## 5. Score ⇄ Task Consistency (FarmerDashboard)

```
healthScore = 0.55×ndviHealth + 0.45×yieldHealth (+ task recovery bonus)
isHealthy   = score ≥ 75   → "Optimal Vigor / maintenance"
isModerate  = 50–74        → "Moderate → 2h drip"
isHighRisk  = < 50         → "Severe → urgent 3h drip"

generateLocationAwareTasks({ ... , healthScore })   [driven by SAME score]
```

The task generator's risk level is derived from the **same `healthScore` shown on the
gauge**, so advisory text always matches the displayed number.

## 6. API Surface Used by Frontend (`api.js`)
- `createAOI`, `getAOIs`, `getAoiDetails`
- `predictYield`, `predictLocation`
- `getAiAdvisory`, `getLocationAiAdvisory`, `askAi`
- `reverseGeocode`
- `getDistrictSummary`, report endpoints

## 7. Build & Tooling
- Dev server: `vite --port 3000`
- Build: `vite build`
- Lint: `eslint . --ext js,jsx --max-warnings 0`
- Dependencies: React 18, react-leaflet 4, Leaflet, Recharts, lucide-react, Tailwind.
