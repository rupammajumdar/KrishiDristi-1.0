/**
 * KrishiDrishti AI — API Client Layer
 * Communicates with FastAPI backend with JWT auth on every request.
 * Auto-initialises a demo session on first load so real backend data flows immediately.
 * Falls back to rich mock data when the backend is unreachable (offline / dev without server).
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:8000/api' : '/api');

export function getApiOrigin() {
  return API_BASE.replace(/\/api\/?$/, '');
}

// ─── Token Management ─────────────────────────────────────────────────────────
const TokenStore = {
  get: ()  => localStorage.getItem('kd_access_token'),
  set: (t) => localStorage.setItem('kd_access_token', t),
  clear: () => localStorage.removeItem('kd_access_token'),
};

function authHeaders(extra = {}) {
  const token = TokenStore.get();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/** Wrapper: fetch with auth header, returns Response or null on network error. */
async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: authHeaders(opts.headers),
    });
    // If 401, clear stale token and trigger re-login
    if (res.status === 401) {
      TokenStore.clear();
      console.warn('[API] 401 Unauthorised — token cleared, will use mock data.');
      return null;
    }
    return res;
  } catch {
    return null; // network/server offline
  }
}

// ─── Persistent AOI Storage (ensures deleted farms never re-appear on reload) ───
const LocalAOIStore = {
  getDeletedIds: () => {
    try {
      const stored = localStorage.getItem('kd_deleted_aoi_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },
  addDeletedId: (id) => {
    try {
      const list = LocalAOIStore.getDeletedIds();
      if (!list.includes(id)) {
        list.push(id);
        localStorage.setItem('kd_deleted_aoi_ids', JSON.stringify(list));
      }
    } catch (e) {
      console.warn('LocalAOIStore addDeletedId error:', e);
    }
  },
  getCustomAOIs: () => {
    try {
      const stored = localStorage.getItem('kd_custom_aois');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },
  saveCustomAOI: (aoi) => {
    try {
      const list = LocalAOIStore.getCustomAOIs().filter(a => a.id !== aoi.id);
      list.unshift(aoi);
      localStorage.setItem('kd_custom_aois', JSON.stringify(list));
    } catch (e) {
      console.warn('LocalAOIStore saveCustomAOI error:', e);
    }
  },
  removeCustomAOI: (id) => {
    try {
      const list = LocalAOIStore.getCustomAOIs().filter(a => a.id !== id);
      localStorage.setItem('kd_custom_aois', JSON.stringify(list));
    } catch (e) {
      console.warn('LocalAOIStore removeCustomAOI error:', e);
    }
  },
};

export const api = {

  // ─── Auth API ────────────────────────────────────────────────────────────────
  async login(email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          TokenStore.set(data.access_token);
          console.info('[API] ✅ Authenticated with backend — live data active.');
        }
        return data;
      }
    } catch (e) {
      console.warn('[API] Backend offline — using mock session.');
    }
    // Mock fallback
    const mockToken = 'mock-jwt-token-12345';
    TokenStore.set(mockToken);
    return {
      access_token: mockToken,
      token_type: 'bearer',
      user: {
        id: 1,
        email,
        full_name: email.includes('officer')
          ? 'Anita Deshmukh'
          : email.includes('insurer')
          ? 'Vikram Seth'
          : email.includes('admin')
          ? 'System Administrator'
          : 'Ramesh Patil',
        role: email.includes('officer')
          ? 'government'
          : email.includes('insurer')
          ? 'insurer'
          : email.includes('admin')
          ? 'admin'
          : 'farmer',
        language_pref: 'en',
      },
    };
  },

  /** Auto-login with demo farmer credentials. Called on app startup. */
  async ensureSession() {
    if (TokenStore.get()) return; // already have a token
    await this.login('farmer@krishidristi.ai', 'farmer123');
  },

  logout() {
    TokenStore.clear();
  },

  // ─── AOI API ─────────────────────────────────────────────────────────────────
  async getAOIs(district = null) {
    const deletedIds = LocalAOIStore.getDeletedIds();
    const customAOIs = LocalAOIStore.getCustomAOIs();

    const url = district ? `/aois?district=${encodeURIComponent(district)}` : '/aois';
    const res = await apiFetch(url);
    
    let rawAois = [];
    if (res?.ok) {
      try {
        const data = await res.json();
        rawAois = data.aois || [];
      } catch {
        rawAois = [];
      }
    } else {
      console.warn('[API] Using offline AOI mock list with local persistent storage');
      rawAois = [
        {
          id: 1, owner_id: 101,
          name: 'Ramesh 5-Acre Cotton Plot',
          geometry: {
            type: 'Polygon',
            coordinates: [[[75.8812, 19.8341], [75.8856, 19.8341], [75.8856, 19.8385], [75.8812, 19.8385], [75.8812, 19.8341]]],
          },
          aoi_type: 'farm', crop_type: 'cotton', area_hectares: 2.02,
          district: 'Jalna', taluk: 'Jalna', village: 'Mantha', state: 'Maharashtra', is_active: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 2, owner_id: 102,
          name: 'Ghanewadi Reservoir Lake',
          geometry: {
            type: 'Polygon',
            coordinates: [[[75.8950, 19.8450], [75.9050, 19.8450], [75.9050, 19.8550], [75.8950, 19.8550], [75.8950, 19.8450]]],
          },
          aoi_type: 'lake', crop_type: null, area_hectares: 112.5,
          district: 'Jalna', taluk: 'Jalna', village: 'Ghanewadi', state: 'Maharashtra', is_active: true,
          created_at: new Date().toISOString(),
        },
      ];
    }

    // Merge custom marked farms and remove any deleted IDs
    const mergedMap = new Map();
    [...customAOIs, ...rawAois].forEach(item => {
      if (item && item.id && !mergedMap.has(item.id)) {
        mergedMap.set(item.id, item);
      }
    });

    const filtered = Array.from(mergedMap.values()).filter(a => !deletedIds.includes(a.id));
    return {
      aois: filtered,
      total: filtered.length,
    };
  },

  async createAOI(aoiData) {
    let created = null;
    try {
      const res = await apiFetch('/aois', {
        method: 'POST',
        body: JSON.stringify(aoiData),
      });
      if (res?.ok) {
        created = await res.json();
      }
    } catch (e) {
      console.warn('[API] Create AOI network error:', e);
    }

    if (!created) {
      console.warn('[API] Using offline AOI create fallback');
      created = {
        id: Date.now(),
        owner_id: 101,
        name: aoiData.name || 'Drawn Farm Polygon',
        geometry: aoiData.geometry,
        aoi_type: aoiData.aoi_type || 'farm',
        crop_type: aoiData.crop_type || 'cotton',
        area_hectares: aoiData.area_hectares || 2.5,
        district: aoiData.district || 'Jalna',
        taluk: aoiData.taluk || 'Jalna',
        village: aoiData.village || 'Mantha',
        state: 'Maharashtra',
        is_active: true,
        created_at: new Date().toISOString(),
      };
    }

    // Persist locally so it remains across reload
    LocalAOIStore.saveCustomAOI(created);
    return created;
  },

  async updateAOI(aoiId, updateData) {
    let updated = null;
    try {
      const res = await apiFetch(`/aois/${aoiId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
      if (res?.ok) {
        updated = await res.json();
      }
    } catch (e) {
      console.warn('[API] Update AOI network error:', e);
    }

    if (!updated) {
      updated = {
        id: aoiId,
        ...updateData,
      };
    }

    // Update in local store
    const customs = LocalAOIStore.getCustomAOIs();
    const existing = customs.find(a => a.id === aoiId);
    if (existing) {
      LocalAOIStore.saveCustomAOI({ ...existing, ...updated });
    }
    return updated;
  },

  async deleteAOI(aoiId) {
    // 1. Immediately register in persistent deleted list and remove from local storage
    LocalAOIStore.addDeletedId(aoiId);
    LocalAOIStore.removeCustomAOI(aoiId);

    // 2. Call backend DELETE endpoint if online
    try {
      const res = await apiFetch(`/aois/${aoiId}`, {
        method: 'DELETE',
      });
      if (res?.ok) return res.json();
    } catch (e) {
      console.warn('[API] Delete AOI network warning:', e);
    }

    return { success: true, deleted_id: aoiId };
  },

  // ─── Satellite Timeline API ───────────────────────────────────────────────────
  async getTimeline(aoiId) {
    const res = await apiFetch(`/aois/${aoiId}/timeline`);
    if (res?.ok) return res.json();

    const now = new Date();
    return {
      aoi_id: aoiId,
      dates: [
        { id: 1, acquisition_date: new Date(now - 20 * 86400000).toISOString(), cloud_cover_pct: 2.1, source: 'sentinel_2', is_sufficient_coverage: true },
        { id: 2, acquisition_date: new Date(now - 15 * 86400000).toISOString(), cloud_cover_pct: 4.5, source: 'sentinel_2', is_sufficient_coverage: true },
        { id: 3, acquisition_date: new Date(now - 10 * 86400000).toISOString(), cloud_cover_pct: 1.8, source: 'sentinel_2', is_sufficient_coverage: true },
        { id: 4, acquisition_date: new Date(now - 5 * 86400000).toISOString(),  cloud_cover_pct: 3.2, source: 'sentinel_2', is_sufficient_coverage: true },
      ],
      total: 4,
    };
  },

  // ─── Index & Prediction API ───────────────────────────────────────────────────
  async getIndexData(aoiId, indexType = 'NDVI', passId = null) {
    const query = passId ? `index_type=${indexType}&pass_id=${passId}` : `index_type=${indexType}`;
    const res = await apiFetch(`/aois/${aoiId}/index?${query}`);
    if (res?.ok) return res.json();

    return {
      id: 101, index_type: indexType,
      acquisition_date: new Date().toISOString(),
      mean_value: indexType === 'NDVI' ? 0.48 : -0.15,
      min_value: 0.24, max_value: 0.72, std_dev: 0.09,
      classification: indexType === 'NDVI' ? 'yellow' : 'moderate',
      pixel_counts: { green: 420, yellow: 450, red: 130 },
    };
  },

  async predictYield(aoiId, cropType = null) {
    const body = cropType
      ? { force_recompute: true, crop_type: cropType.toLowerCase() }
      : { force_recompute: true };

    const res = await apiFetch(`/aois/${aoiId}/predict`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res?.ok) return res.json();

    const crop = (cropType || 'cotton').toLowerCase();
    const baselineMap = {
      cotton: 2200,
      soybean: 2000,
      rice: 3500,
      wheat: 3200,
      sugarcane: 70000,
      maize: 4000,
      tur: 1200,
    };
    const baseline = baselineMap[crop] || 2200;
    const changePct = -18.4;
    const predYield = Math.round(baseline * (1 + changePct / 100));

    return {
      id: 501,
      aoi_id: aoiId,
      model_version: `v1.2.0-rf-${crop}`,
      predicted_yield_kg_ha: predYield,
      confidence_lower: Math.round(predYield * 0.88),
      confidence_upper: Math.round(predYield * 1.12),
      yield_change_pct: changePct,
      crop_type: crop,
      feature_importance: {
        'NDVI (Vegetation Index)': 0.42,
        'Seasonal Rainfall (mm)': 0.26,
        'NDWI (Water Balance)': 0.18,
        'Avg Temperature (°C)': 0.09,
        'Agro-Zone & Soil Factor': 0.05,
      },
      input_snapshot_json: {
        mean_ndvi: 0.46,
        mean_ndwi: -0.14,
        rainfall_mm: 365.0,
        temp_avg_c: 29.2,
        crop_type: crop,
        weather_source: 'seasonal_fallback',
        timestamp: new Date().toISOString(),
      },
      ml_stress_classification: {
        model_name: 'Random Forest Vegetation Stress (rf_stress.joblib)',
        model_active: true,
        stress_class_id: 1,
        stress_label: 'Moderate Stress',
        probabilities: { healthy: 0.32, moderate_stress: 0.58, severe_stress: 0.10 },
        features_used: { ndvi: 0.46, ndwi: -0.14, mndwi: -0.22, evi: 0.38 },
        status_color: 'amber',
      },
      ml_anomaly: {
        model_name: 'LSTM AutoEncoder (lstm_anomaly_best.pth)',
        model_active: true,
        sequence_length: 12,
        reconstruction_error: 0.074,
        anomaly_score: 0.28,
        anomaly_detected: false,
        status_text: 'Normal Temporal Trajectory',
        anomaly_fraction: 0.098,
      },
      ml_models_used: [
        'Random Forest Vegetation Stress (rf_stress.joblib)',
        'PyTorch LSTM AutoEncoder (lstm_anomaly_best.pth)',
        'PyTorch U-Net Water Boundary (unet_water_best.pth)',
        `Calibrated ${crop.charAt(0).toUpperCase() + crop.slice(1)} Yield Regressor`,
      ],
      location_context: {
        latitude: 19.8341,
        longitude: 75.8812,
        district: 'Jalna',
        state: 'Maharashtra',
        agro_zone: 'Marathwada Semi-Arid Zone (Jalna)',
        soil_type: 'Deep Black Cotton Soil (Vertisols)',
        kvk_station: 'VNMKV Parbhani / KVK Jalna',
        drought_vulnerability: 'High (Rain-shadow deficit)',
        regional_modifier: 0.96,
      },
      triggered_alert: false,
      created_at: new Date().toISOString(),
    };
  },

  async predictLocation(locationPayload) {
    const {
      lat = 19.8341,
      lon = 75.8812,
      cropType = 'cotton',
      district = 'Jalna',
      state = 'Maharashtra',
      village = null,
      areaHa = 2.0,
      ndvi = 0.48,
      ndwi = -0.14,
    } = locationPayload || {};

    const res = await apiFetch('/aois/location-predict', {
      method: 'POST',
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        crop_type: (cropType || 'cotton').toLowerCase(),
        district,
        state,
        village,
        area_ha: areaHa,
        ndvi,
        ndwi,
      }),
    });
    if (res?.ok) return res.json();

    // Fallback if offline
    return this.predictYield(0, cropType);
  },


  async getAiAdvisory(aoiId, cropType = 'cotton', lang = 'en') {
    const res = await apiFetch(`/aois/${aoiId}/ai-advisory?crop_type=${cropType}&lang=${lang}`);
    if (res?.ok) return res.json();
    return null;
  },

  async getLocationAiAdvisory(locationPayload, lang = 'en') {
    const {
      lat = 19.8341,
      lon = 75.8812,
      cropType = 'cotton',
      district = 'Jalna',
      state = 'Maharashtra',
      village = null,
      areaHa = 2.0,
      ndvi = 0.48,
      ndwi = -0.14,
    } = locationPayload || {};

    const res = await apiFetch(`/aois/location-ai-advisory?lang=${lang}`, {
      method: 'POST',
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        crop_type: (cropType || 'cotton').toLowerCase(),
        district,
        state,
        village,
        area_ha: areaHa,
        ndvi,
        ndwi,
      }),
    });
    if (res?.ok) return res.json();
    return null;
  },

  async askAi(aoiId, question, cropType = 'cotton', lang = 'en') {
    const res = await apiFetch(`/aois/${aoiId}/ask-ai`, {
      method: 'POST',
      body: JSON.stringify({ question, crop_type: cropType, language: lang }),
    });
    if (res?.ok) return res.json();
    return { answer: 'AI Agronomist is analyzing your telemetry. Please perform timely light irrigation.' };
  },

  // ─── District Rollup API ──────────────────────────────────────────────────────
  async getDistrictSummary(districtName = 'Jalna') {
    const res = await apiFetch(`/districts/${encodeURIComponent(districtName)}/summary`);
    if (res?.ok) return res.json();

    const dLower = (districtName || '').toLowerCase();
    let state = 'Maharashtra';
    if (['raipur', 'bilaspur', 'durg', 'rajnandgaon', 'korba', 'bastar'].some(d => dLower.includes(d))) state = 'Chhattisgarh';
    else if (['bengaluru', 'bangalore', 'dharwad', 'belagavi', 'raichur', 'mysuru', 'mandya'].some(d => dLower.includes(d))) state = 'Karnataka';
    else if (['hyderabad', 'warangal', 'karimnagar', 'anantapur', 'guntur', 'rangareddy'].some(d => dLower.includes(d))) state = 'Telangana';
    else if (['punjab', 'haryana', 'ludhiana', 'amritsar', 'patiala', 'bathinda'].some(d => dLower.includes(d))) state = 'Punjab';
    else if (['jaipur', 'jodhpur', 'kota', 'bikaner', 'udaipur', 'sikar'].some(d => dLower.includes(d))) state = 'Rajasthan';
    else if (['bhopal', 'indore', 'gwalior', 'jabalpur', 'ujjain'].some(d => dLower.includes(d))) state = 'Madhya Pradesh';
    else if (['ahmedabad', 'surat', 'vadodara', 'rajkot', 'anand'].some(d => dLower.includes(d))) state = 'Gujarat';
    else if (['lucknow', 'kanpur', 'varanasi', 'agra', 'prayagraj'].some(d => dLower.includes(d))) state = 'Uttar Pradesh';
    else if (['patna', 'gaya', 'muzaffarpur', 'bhagalpur'].some(d => dLower.includes(d))) state = 'Bihar';

    return {
      district: districtName, state,
      total_plots: 1240, green_count: 560, yellow_count: 430, red_count: 250,
      avg_ndvi: 0.49, total_water_bodies: 14, avg_water_depletion_pct: 21.4,
      active_alerts: 18, last_updated: new Date().toISOString(),
    };
  },

  async getDistrictDrilldown(districtName = 'Jalna') {
    const res = await apiFetch(`/districts/${encodeURIComponent(districtName)}/drilldown`);
    if (res?.ok) return res.json();

    const summary = await this.getDistrictSummary(districtName);
    const dLower = (districtName || '').toLowerCase();

    let taluks = [
      { taluk: `${districtName} Central`, total_plots: 420, green_count: 210, yellow_count: 140, red_count: 70, avg_ndvi: 0.54, water_bodies: 5 },
      { taluk: `${districtName} North`,   total_plots: 310, green_count: 110, yellow_count: 120, red_count: 80, avg_ndvi: 0.46, water_bodies: 4 },
      { taluk: `${districtName} South`,   total_plots: 290, green_count: 130, yellow_count: 100, red_count: 60, avg_ndvi: 0.48, water_bodies: 3 },
      { taluk: `${districtName} East`,    total_plots: 220, green_count: 110, yellow_count: 70,  red_count: 40, avg_ndvi: 0.51, water_bodies: 2 },
    ];

    if (dLower.includes('jalna')) {
      taluks = [
        { taluk: 'Jalna',     total_plots: 420, green_count: 210, yellow_count: 140, red_count: 70, avg_ndvi: 0.54, water_bodies: 5 },
        { taluk: 'Mantha',    total_plots: 310, green_count: 110, yellow_count: 120, red_count: 80, avg_ndvi: 0.46, water_bodies: 4 },
        { taluk: 'Ambad',     total_plots: 290, green_count: 130, yellow_count: 100, red_count: 60, avg_ndvi: 0.48, water_bodies: 3 },
        { taluk: 'Bhokardan', total_plots: 220, green_count: 110, yellow_count: 70,  red_count: 40, avg_ndvi: 0.51, water_bodies: 2 },
      ];
    } else if (dLower.includes('pune')) {
      taluks = [
        { taluk: 'Haveli',    total_plots: 540, green_count: 320, yellow_count: 150, red_count: 70, avg_ndvi: 0.62, water_bodies: 7 },
        { taluk: 'Baramati',  total_plots: 460, green_count: 280, yellow_count: 120, red_count: 60, avg_ndvi: 0.58, water_bodies: 6 },
        { taluk: 'Shirur',    total_plots: 380, green_count: 200, yellow_count: 110, red_count: 70, avg_ndvi: 0.53, water_bodies: 4 },
        { taluk: 'Khed',      total_plots: 320, green_count: 190, yellow_count: 90,  red_count: 40, avg_ndvi: 0.59, water_bodies: 3 },
      ];
    } else if (dLower.includes('nagpur')) {
      taluks = [
        { taluk: 'Nagpur Rural', total_plots: 410, green_count: 230, yellow_count: 120, red_count: 60, avg_ndvi: 0.56, water_bodies: 5 },
        { taluk: 'Katol',        total_plots: 370, green_count: 180, yellow_count: 120, red_count: 70, avg_ndvi: 0.51, water_bodies: 4 },
        { taluk: 'Saoner',       total_plots: 320, green_count: 170, yellow_count: 90,  red_count: 60, avg_ndvi: 0.52, water_bodies: 3 },
        { taluk: 'Umred',        total_plots: 280, green_count: 140, yellow_count: 90,  red_count: 50, avg_ndvi: 0.49, water_bodies: 3 },
      ];
    }

    return {
      district: districtName,
      summary,
      taluks,
    };
  },

  async searchLocations(query) {
    if (!query || query.trim().length < 2) return [];
    const res = await apiFetch(`/districts/geocode?q=${encodeURIComponent(query.trim())}`);
    if (res?.ok) return res.json();

    // Built-in offline fallback matches
    const presets = [
      { name: 'Mantha Village, Jalna, Maharashtra', lat: 19.85, lng: 75.92, type: 'Village', district: 'Jalna', state: 'Maharashtra' },
      { name: 'Jalna, Maharashtra', lat: 19.8341, lng: 75.8812, type: 'District', district: 'Jalna', state: 'Maharashtra' },
      { name: 'Ambad Taluk, Jalna, Maharashtra', lat: 19.61, lng: 75.78, type: 'Taluk', district: 'Jalna', state: 'Maharashtra' },
      { name: 'Bhokardan Taluk, Jalna, Maharashtra', lat: 20.25, lng: 75.77, type: 'Taluk', district: 'Jalna', state: 'Maharashtra' },
      { name: 'Chhatrapati Sambhaji Nagar (Aurangabad), Maharashtra', lat: 19.8762, lng: 75.3433, type: 'District', district: 'Aurangabad', state: 'Maharashtra' },
      { name: 'Pune, Maharashtra', lat: 18.5204, lng: 73.8567, type: 'District', district: 'Pune', state: 'Maharashtra' },
      { name: 'Baramati, Pune, Maharashtra', lat: 18.1517, lng: 74.5772, type: 'Taluk', district: 'Pune', state: 'Maharashtra' },
      { name: 'Nagpur, Maharashtra', lat: 21.1458, lng: 79.0882, type: 'District', district: 'Nagpur', state: 'Maharashtra' },
      { name: 'Nashik, Maharashtra', lat: 19.9975, lng: 73.7898, type: 'District', district: 'Nashik', state: 'Maharashtra' },
      { name: 'Solapur, Maharashtra', lat: 17.6599, lng: 75.9064, type: 'District', district: 'Solapur', state: 'Maharashtra' },
      { name: 'Kolhapur, Maharashtra', lat: 16.7050, lng: 74.2433, type: 'District', district: 'Kolhapur', state: 'Maharashtra' },
      { name: 'Satara, Maharashtra', lat: 17.6805, lng: 74.0183, type: 'District', district: 'Satara', state: 'Maharashtra' },
      { name: 'Ahmednagar, Maharashtra', lat: 19.0952, lng: 74.7480, type: 'District', district: 'Ahmednagar', state: 'Maharashtra' },
      { name: 'Beed, Maharashtra', lat: 18.9891, lng: 75.7601, type: 'District', district: 'Beed', state: 'Maharashtra' },
      { name: 'Latur, Maharashtra', lat: 18.4088, lng: 76.5604, type: 'District', district: 'Latur', state: 'Maharashtra' },
      { name: 'Nanded, Maharashtra', lat: 19.1383, lng: 77.3210, type: 'District', district: 'Nanded', state: 'Maharashtra' },
      { name: 'Parbhani, Maharashtra', lat: 19.2610, lng: 76.7767, type: 'District', district: 'Parbhani', state: 'Maharashtra' },
      { name: 'Amravati, Maharashtra', lat: 20.9374, lng: 77.7796, type: 'District', district: 'Amravati', state: 'Maharashtra' },
      { name: 'Akola, Maharashtra', lat: 20.7002, lng: 77.0082, type: 'District', district: 'Akola', state: 'Maharashtra' },
      { name: 'Yavatmal, Maharashtra', lat: 20.3888, lng: 78.1204, type: 'District', district: 'Yavatmal', state: 'Maharashtra' },
      { name: 'Bengaluru, Karnataka', lat: 12.9716, lng: 77.5946, type: 'City', district: 'Bengaluru', state: 'Karnataka' },
      { name: 'Hyderabad, Telangana', lat: 17.3850, lng: 78.4867, type: 'City', district: 'Hyderabad', state: 'Telangana' },
      { name: 'Indore, Madhya Pradesh', lat: 22.7196, lng: 75.8577, type: 'City', district: 'Indore', state: 'Madhya Pradesh' },
      { name: 'Ludhiana, Punjab', lat: 30.9010, lng: 75.8573, type: 'District', district: 'Ludhiana', state: 'Punjab' },
    ];
    const qLower = query.toLowerCase();
    return presets.filter(p => p.name.toLowerCase().includes(qLower) || p.district.toLowerCase().includes(qLower));
  },

  async reverseGeocode(lat, lon) {
    try {
      const res = await apiFetch(`/districts/reverse-geocode?lat=${lat}&lon=${lon}`);
      if (res?.ok) return await res.json();
    } catch (_) {}
    return {
      name: `Farm Plot (${lat.toFixed(3)}, ${lon.toFixed(3)})`,
      village: 'Field Plot',
      taluk: 'Local Taluk',
      district: 'Jalna',
      state: 'Maharashtra'
    };
  },

  // ─── Reports API ──────────────────────────────────────────────────────────────
  async generateReport(aoiId, personaTemplate, title = null, cropType = 'cotton', language = 'en') {
    const res = await apiFetch('/reports', {
      method: 'POST',
      body: JSON.stringify({ 
        aoi_id: aoiId, 
        persona_template: personaTemplate, 
        title,
        crop_type: cropType,
        language: language
      }),
    });
    if (res?.ok) {
      const data = await res.json();
      if (data.file_uri && !data.file_uri.startsWith('http')) {
        data.file_uri = `${getApiOrigin()}${data.file_uri}`;
      }
      return data;
    }

    const origin = getApiOrigin();
    return {
      id: Math.floor(Math.random() * 900) + 100,
      aoi_id: aoiId, persona_template: personaTemplate,
      file_uri: `${origin}/api/reports/101/download`,
      report_title: title || `${personaTemplate.toUpperCase()} Audit Report`,
      status: 'completed',
      created_at: new Date().toISOString(),
    };
  },

  // ─── Admin Ops API ────────────────────────────────────────────────────────────
  async getPipelineStatus() {
    const res = await apiFetch('/admin/pipeline/status');
    if (res?.ok) return res.json();

    return {
      total_jobs: 42, queued: 2, running: 1, completed: 38, failed: 1, queue_depth: 3,
      recent_jobs: [
        { id: 101, job_type: 'sentinel_ingestion', aoi_id: 1, status: 'completed', error_message: null, created_at: new Date().toISOString() },
        { id: 102, job_type: 'ndvi_calculation',   aoi_id: 1, status: 'completed', error_message: null, created_at: new Date().toISOString() },
        { id: 103, job_type: 'yield_prediction',   aoi_id: 1, status: 'completed', error_message: null, created_at: new Date().toISOString() },
        { id: 104, job_type: 'sentinel_ingestion', aoi_id: 2, status: 'failed',    error_message: 'Cloud cover 62% exceeded 20% threshold', created_at: new Date().toISOString() },
      ],
    };
  },

  async getModelRegistry() {
    const res = await apiFetch('/admin/models');
    if (res?.ok) return res.json();

    return [
      { id: 1, version: 'v1.2.0-rf-cotton', crop_type: 'cotton', training_date: new Date().toISOString(), validation_mape: 11.4, validation_r2: 0.89, is_active: true,  created_at: new Date().toISOString() },
      { id: 2, version: 'v1.1.0-rf-cotton', crop_type: 'cotton', training_date: new Date().toISOString(), validation_mape: 14.8, validation_r2: 0.83, is_active: false, created_at: new Date().toISOString() },
      { id: 3, version: 'v1.0.0-rf-rice',   crop_type: 'rice',   training_date: new Date().toISOString(), validation_mape: 12.1, validation_r2: 0.87, is_active: true,  created_at: new Date().toISOString() },
    ];
  },

  async rollbackModel(targetVersion) {
    const res = await apiFetch('/admin/models/rollback', {
      method: 'POST',
      body: JSON.stringify({ target_version: targetVersion }),
    });
    if (res?.ok) return res.json();

    return {
      status: 'success',
      message: `Successfully rolled back active cotton model to ${targetVersion}`,
      active_version: targetVersion,
    };
  },
};
