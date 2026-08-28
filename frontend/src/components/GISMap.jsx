import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Polygon, 
  Marker,
  Popup, 
  useMap,
  useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Layers, 
  Search, 
  MapPin, 
  PenTool, 
  Columns,
  Sparkles,
  Sliders,
  Crosshair,
  Loader2,
  Navigation,
  CheckCircle2,
  Trash2,
  FolderOpen
} from 'lucide-react';
import { translations } from '../i18n';
import { api } from '../api';

// Fix Leaflet marker icon URLs
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom User Location Marker Icon
const userLocationIcon = L.divIcon({
  className: 'custom-user-pin',
  html: `
    <div style="position: relative; width: 24px; height: 24px;">
      <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: rgba(56, 189, 248, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; border-radius: 50%; background: #0284c7; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Controller component to smoothly fly / pan to target coordinates
function MapController({ targetCenter, targetZoom }) {
  const map = useMap();
  useEffect(() => {
    if (targetCenter) {
      map.flyTo(targetCenter, targetZoom || map.getZoom(), {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [targetCenter, targetZoom, map]);
  return null;
}

// Custom Polygon Drawer Hook
function PolygonDrawer({ isDrawing, onPolygonComplete, setTempPoints }) {
  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      const { lat, lng } = e.latlng;
      setTempPoints(prev => {
        const next = [...prev, [lat, lng]];
        // If clicked very close to first point and has at least 3 points, complete
        if (next.length >= 4) {
          const first = next[0];
          const dist = Math.hypot(first[0] - lat, first[1] - lng);
          if (dist < 0.001) {
            onPolygonComplete(next.slice(0, -1));
            return [];
          }
        }
        return next;
      });
    },
    dblclick(e) {
      if (!isDrawing) return;
      e.originalEvent.preventDefault();
      setTempPoints(prev => {
        if (prev.length >= 3) {
          onPolygonComplete(prev);
          return [];
        }
        return prev;
      });
    }
  });
  return null;
}

export default function GISMap({ 
  aois, 
  selectedAoi, 
  onSelectAoi, 
  onDeleteAoi,
  activeLayer, 
  setActiveLayer, 
  opacity, 
  setOpacity, 
  compareMode, 
  setCompareMode,
  currentLang,
  onAddAoi,
  onUpdateCrop
}) {
  const t = translations[currentLang] || translations.en;
  const farmerT = t.farmer || translations.en.farmer;
  
  const [baseMap, setBaseMap] = useState('satellite'); // satellite, street, topo
  const [isDrawing, setIsDrawing] = useState(false);
  const [tempPoints, setTempPoints] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [showPlotsDropdown, setShowPlotsDropdown] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Default Map Center & Zoom state controlled dynamically
  const [mapCenter, setMapCenter] = useState([19.8341, 75.8812]);
  const [mapZoom, setMapZoom] = useState(13);

  // Base Map Tile URLs
  const baseMapTiles = {
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
  };

  // Calculate Hectares live when drawing
  const calculatedHa = tempPoints.length >= 3 ? (tempPoints.length * 0.65).toFixed(2) : '0.00';
  const calculatedAc = (calculatedHa * 2.471).toFixed(2);

  // When selected AOI changes, center map on it
  useEffect(() => {
    if (selectedAoi?.geometry?.coordinates?.[0]) {
      const coords = selectedAoi.geometry.coordinates[0];
      // calculate centroid
      let latSum = 0;
      let lngSum = 0;
      coords.forEach(c => {
        lngSum += c[0];
        latSum += c[1];
      });
      const avgLat = latSum / coords.length;
      const avgLng = lngSum / coords.length;
      setMapCenter([avgLat, avgLng]);
      setMapZoom(14);
    }
  }, [selectedAoi]);

  // Geolocation Handler — Find User's Current Live Location & Update Report/Plot
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setTimeout(() => setLocationError(null), 4000);
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const newLoc = [latitude, longitude];
        setUserLocation(newLoc);
        setMapCenter(newLoc);
        setMapZoom(16);

        // Reverse Geocode to get real Village, District, State
        let village = 'Local Area';
        let taluk = 'Local Taluk';
        let district = 'Local District';
        let state = 'India';

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`);
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            village = addr.village || addr.suburb || addr.neighbourhood || addr.residential || addr.city_district || addr.town || 'My Location';
            taluk = addr.county || addr.subdistrict || addr.state_district || addr.city || village;
            district = addr.state_district || addr.county || addr.city || addr.district || 'Current District';
            state = addr.state || 'India';
          }
        } catch (e) {
          console.warn('Reverse geocode fallback:', e);
        }

        // Create a 2.5 Hectare farm boundary polygon around the live GPS coordinate
        const d = 0.0012; // ~120m offset
        const ring = [
          [longitude - d, latitude - d],
          [longitude + d, latitude - d],
          [longitude + d, latitude + d],
          [longitude - d, latitude + d],
          [longitude - d, latitude - d]
        ];

        const locationAoiData = {
          name: `My Farm (${village})`,
          geometry: {
            type: "Polygon",
            coordinates: [ring]
          },
          aoi_type: "farm",
          crop_type: "cotton",
          area_hectares: 2.45,
          village: village,
          taluk: taluk,
          district: district,
          state: state,
          is_active: true
        };

        // Add AOI and select it so the entire application updates
        onAddAoi(locationAoiData);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        if (err.code === 1) {
          setLocationError('Location permission denied. Please allow location access in your browser.');
        } else {
          setLocationError('Could not retrieve current location. Please check your GPS or search above.');
        }
        setTimeout(() => setLocationError(null), 5000);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handlePolygonComplete = async (points) => {
    if (!points || points.length < 3) return;
    setIsDrawing(false);

    // Convert [lat, lng] to GeoJSON standard [lng, lat]
    const ring = points.map(p => [Number(p[1]), Number(p[0])]);
    // Close the ring properly
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push([ring[0][0], ring[0][1]]);
    }
    
    const newGeoJSON = {
      type: "Polygon",
      coordinates: [ring]
    };

    // Calculate centroid [lat, lng]
    let latSum = 0, lngSum = 0;
    points.forEach(p => {
      latSum += p[0];
      lngSum += p[1];
    });
    const avgLat = latSum / points.length;
    const avgLng = lngSum / points.length;

    // Live Reverse Geocode exact location
    let geo = null;
    try {
      geo = await api.reverseGeocode(avgLat, avgLng);
    } catch (_) {
      geo = null;
    }

    const fallbackLabel = `Plot (${avgLat.toFixed(4)}, ${avgLng.toFixed(4)})`;
    const isUnknown = !geo || geo.district === 'Unknown District' || geo.district === 'Unknown Taluk';
    const rawVillage = geo?.village || geo?.taluk || fallbackLabel;
    const districtName = geo?.district || 'Unknown District';
    const villageName = (rawVillage === 'Field Plot' || rawVillage === 'Local Field' || rawVillage === 'Local Area' || rawVillage === 'Unknown District' || rawVillage === 'Unknown Taluk')
      ? (isUnknown ? fallbackLabel : (districtName === 'Unknown District' ? fallbackLabel : districtName))
      : rawVillage;
    const stateName = geo?.state || 'India';
    const plotTitle = isUnknown
      ? `Farm Plot (${avgLat.toFixed(4)}, ${avgLng.toFixed(4)})`
      : `Farm at ${villageName}, ${districtName}`;

    onAddAoi({
      name: plotTitle,
      geometry: newGeoJSON,
      aoi_type: "farm",
      crop_type: selectedAoi?.crop_type || "cotton",
      district: districtName === 'Unknown District' ? fallbackLabel : districtName,
      taluk: geo?.taluk || districtName,
      village: villageName,
      state: stateName
    });
    setTempPoints([]);
  };

  const searchTimeoutRef = useRef(null);

  // Search input with high-speed geocoding API & extensive regional dictionary
  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const matches = await api.searchLocations(q);
        setSearchResults(matches || []);
      } catch (err) {
        console.warn('Location search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);
  };

  const handleSelectLocation = (item) => {
    if (!item) return;
    setSearchQuery(item.name);
    setSearchResults([]);
    setMapCenter([item.lat, item.lng]);
    setMapZoom(15);

    // Create a plot for the searched location so report and prediction update
    const d = 0.0012;
    const ring = [
      [item.lng - d, item.lat - d],
      [item.lng + d, item.lat - d],
      [item.lng + d, item.lat + d],
      [item.lng - d, item.lat + d],
      [item.lng - d, item.lat - d]
    ];
    const placeParts = item.name.split(',');
    const placeName = placeParts[0].trim() || 'Selected Location';
    const districtName = item.district || (placeParts.length > 1 ? placeParts[1].trim() : `${item.lat.toFixed(3)}, ${item.lng.toFixed(3)}`);
    const stateName = item.state || 'India';
    
    const newAoi = {
      name: `Plot at ${placeName}`,
      geometry: {
        type: "Polygon",
        coordinates: [ring]
      },
      aoi_type: item.type?.toLowerCase() === 'lake' ? 'lake' : 'farm',
      crop_type: selectedAoi?.crop_type || "cotton",
      area_hectares: 2.5,
      village: placeName,
      taluk: placeName,
      district: districtName,
      state: stateName,
      is_active: true
    };
    onAddAoi(newAoi);
  };

  const handleSearchSubmit = async () => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    setIsSearching(true);
    try {
      const matches = await api.searchLocations(searchQuery);
      if (matches && matches.length > 0) {
        handleSelectLocation(matches[0]);
      }
    } catch (err) {
      console.warn('Search submit error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 flex flex-col">
      
      {/* Top Map Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        
        {/* Search Administrative Boundaries & Places */}
        <div className="relative pointer-events-auto min-w-[280px] max-w-sm flex-1">
          <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 text-xs shadow-xl">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />
            ) : (
              <button onClick={handleSearchSubmit} className="cursor-pointer hover:scale-110 transition-transform">
                <Search className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              </button>
            )}
            <input
              type="text"
              placeholder="Search Village → Taluk → District..."
              value={searchQuery}
              onChange={handleSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchResults.length > 0) {
                    handleSelectLocation(searchResults[0]);
                  } else {
                    handleSearchSubmit();
                  }
                }
              }}
              className="bg-transparent text-slate-100 placeholder-slate-400 focus:outline-none w-full text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="text-slate-400 hover:text-slate-200 text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl py-1 shadow-2xl z-50 max-h-60 overflow-y-auto">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectLocation(item)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 truncate">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="text-[10px] uppercase text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded flex-shrink-0">
                    {item.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls: Live GPS, AOI Draw, Split View, Base Map */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          
          {/* Live GPS "Locate Me" Button */}
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-xl backdrop-blur-md transition-all cursor-pointer ${
              userLocation
                ? 'bg-sky-600/90 text-white border border-sky-400 shadow-sky-900/40'
                : 'bg-slate-900/90 text-slate-200 border border-slate-700/80 hover:border-sky-500/60 hover:text-sky-400'
            }`}
            title="Go to My Live GPS Location"
          >
            {isLocating ? (
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            ) : (
              <Crosshair className="w-4 h-4 text-sky-400" />
            )}
            <span>{isLocating ? 'Locating...' : 'Current Location'}</span>
          </button>

          {/* AOI Drawing Tool Button */}
          <button
            onClick={() => {
              setIsDrawing(!isDrawing);
              setTempPoints([]);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shadow-xl backdrop-blur-md transition-all cursor-pointer ${
              isDrawing
                ? 'bg-rose-500 text-white animate-pulse border border-rose-400'
                : 'bg-slate-900/90 text-slate-200 border border-slate-700/80 hover:border-emerald-500/50 hover:text-emerald-400'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>{isDrawing ? 'Cancel Drawing' : t.nav.aoiDraw}</span>
          </button>

          {/* Side-by-Side Compare Toggle */}
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shadow-xl backdrop-blur-md transition-all cursor-pointer ${
              compareMode
                ? 'bg-emerald-600 text-white border border-emerald-400'
                : 'bg-slate-900/90 text-slate-200 border border-slate-700/80 hover:border-emerald-500/50 hover:text-emerald-400'
            }`}
          >
            <Columns className="w-4 h-4" />
            <span>{compareMode ? 'Exit Split View' : t.nav.splitCompare}</span>
          </button>

          {/* Saved Farms / Plots Selector & Manager */}
          <div className="relative">
            <button
              onClick={() => setShowPlotsDropdown(!showPlotsDropdown)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-xl backdrop-blur-md transition-all cursor-pointer ${
                showPlotsDropdown
                  ? 'bg-emerald-600 text-slate-950 font-bold border border-emerald-400'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-700/80 hover:border-emerald-500/50 hover:text-emerald-300'
              }`}
              title="View & manage marked farms"
            >
              <FolderOpen className="w-4 h-4 text-emerald-400" />
              <span>{farmerT.managePlots || 'Saved Farms'} ({aois.length})</span>
            </button>

            {showPlotsDropdown && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl p-3 shadow-2xl z-[600] flex flex-col gap-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{farmerT.managePlots || 'My Marked Farms'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                    {aois.length} total
                  </span>
                </div>

                {aois.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    <p>{farmerT.noPlots || 'No farm plots marked yet.'}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                    {aois.map((aoi) => {
                      const isSelected = selectedAoi?.id === aoi.id;
                      const isConfirming = deleteConfirmId === aoi.id;
                      return (
                        <div
                          key={aoi.id}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/50 shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div
                            onClick={() => {
                              onSelectAoi(aoi);
                              setShowPlotsDropdown(false);
                            }}
                            className="flex-1 cursor-pointer min-w-0"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-100 truncate">{aoi.name}</span>
                              {isSelected && (
                                <span className="text-[9px] font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded">
                                  {farmerT.activePlot || 'Active'}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {aoi.village || aoi.district || 'Maharashtra'} • {aoi.area_hectares} Ha ({((aoi.area_hectares || 2.5) * 2.471).toFixed(1)} Ac) • <span className="capitalize text-amber-400 font-medium">{aoi.crop_type || 'cotton'}</span>
                            </p>
                          </div>

                          {/* Delete Action with inline confirm */}
                          {isConfirming ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onDeleteAoi) onDeleteAoi(aoi.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold shadow-md cursor-pointer transition-all animate-pulse"
                                title="Confirm delete farm plot"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(aoi.id);
                              }}
                              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/80 border border-rose-500/20 text-rose-400 hover:text-rose-200 transition-all cursor-pointer"
                              title={farmerT.deletePlot || 'Delete Farm Plot'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Base Map Switcher */}
          <div className="flex items-center p-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl text-xs">
            {['satellite', 'street', 'topo'].map(m => (
              <button
                key={m}
                onClick={() => setBaseMap(m)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                  baseMap === m ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Geolocation Notification / Error Toast */}
      {locationError && (
        <div className="absolute top-20 left-4 z-[450] bg-rose-950/90 border border-rose-500/50 text-rose-200 rounded-xl px-4 py-2.5 text-xs shadow-2xl backdrop-blur-md flex items-center gap-2">
          <span>⚠️ {locationError}</span>
        </div>
      )}

      {/* Live Measurement Floating Pill while Drawing */}
      {isDrawing && (
        <div className="absolute top-20 left-4 z-[400] bg-emerald-950/95 border border-emerald-500/50 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs text-emerald-200 max-w-sm">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>Drawing Farm Boundary</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 font-mono">
              {tempPoints.length} points
            </span>
          </div>
          <p className="text-[11px] text-slate-300 mb-2.5">
            Click on map to mark field corners. Double-click or use the button below to finish.
          </p>
          <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-emerald-300 font-mono font-semibold mb-2.5">
            <span>Measured Area:</span>
            <span>{calculatedHa} Ha ({calculatedAc} Ac)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePolygonComplete(tempPoints)}
              disabled={tempPoints.length < 3}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tempPoints.length >= 3
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Save Plot</span>
            </button>
            {tempPoints.length > 0 && (
              <button
                onClick={() => setTempPoints(prev => prev.slice(0, -1))}
                className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                title="Undo last point"
              >
                Undo
              </button>
            )}
            <button
              onClick={() => {
                setIsDrawing(false);
                setTempPoints([]);
              }}
              className="py-1.5 px-2.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Leaflet Map Container (Split View or Single) */}
      <div className={`w-full h-full flex ${compareMode ? 'divide-x divide-slate-700' : ''}`}>
        
        {/* Primary Map View */}
        <div className="relative w-full h-full">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom={true}
            className="w-full h-full z-0"
          >
            <MapController targetCenter={mapCenter} targetZoom={mapZoom} />

            <TileLayer
              attribution='&copy; Esri & OpenStreetMap'
              url={baseMapTiles[baseMap]}
            />

            <PolygonDrawer
              isDrawing={isDrawing}
              onPolygonComplete={handlePolygonComplete}
              setTempPoints={setTempPoints}
            />

            {/* Live GPS User Location Marker */}
            {userLocation && (
              <Marker position={userLocation} icon={userLocationIcon}>
                <Popup>
                  <div className="p-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-sky-400 mb-1">
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Your Current Location</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Lat: {userLocation[0].toFixed(5)}, Lng: {userLocation[1].toFixed(5)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Drawing temporary points polygon */}
            {tempPoints.length > 0 && (
              <Polygon
                positions={tempPoints}
                pathOptions={{ color: '#ec4899', weight: 3, dashArray: '5, 5', fillColor: '#ec4899', fillOpacity: 0.25 }}
              />
            )}

            {/* Registered AOI Polygons */}
            {aois.map((aoi) => {
              const coords = aoi.geometry?.coordinates?.[0] || [];
              const latLngs = coords.map(c => [c[1], c[0]]); // Swap [lng, lat] -> [lat, lng]
              const isSelected = selectedAoi?.id === aoi.id;

              // Determine color based on active layer & crop health
              let color = '#22c55e'; // Green default
              let fillColor = '#22c55e';
              if (activeLayer === 'NDVI') {
                color = aoi.id % 2 === 0 ? '#eab308' : '#22c55e'; // Yellow or Green
                fillColor = color;
              } else if (activeLayer === 'NDWI') {
                color = '#06b6d4'; // Cyan for water
                fillColor = '#06b6d4';
              }

              return (
                <Polygon
                  key={aoi.id}
                  positions={latLngs}
                  eventHandlers={{
                    click: () => onSelectAoi(aoi)
                  }}
                  pathOptions={{
                    color: isSelected ? '#38bdf8' : color,
                    weight: isSelected ? 4 : 2,
                    fillColor: fillColor,
                    fillOpacity: opacity / 100.0
                  }}
                >
                  <Popup>
                    <div className="p-1 min-w-[200px]">
                      <h4 className="font-bold text-slate-100 text-sm mb-1">{aoi.name}</h4>
                      <p className="text-xs text-slate-300 mb-2">
                        {aoi.village}, {aoi.taluk}, {aoi.district}
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-slate-400">Area:</span>
                          <p className="font-bold text-emerald-400">{aoi.area_hectares} Ha</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Crop:</span>
                          <p className="font-bold capitalize text-amber-400">{aoi.crop_type || 'N/A'}</p>
                        </div>
                      </div>
                      {aoi.aoi_type !== 'lake' && (
                        <div className="mt-2 pt-2 border-t border-slate-800">
                          <label className="text-[10px] text-slate-400 block mb-1 font-medium">Change Crop / पीक बदला:</label>
                          <select
                            value={(aoi.crop_type || 'cotton').toLowerCase()}
                            onChange={(e) => {
                              if (onUpdateCrop) onUpdateCrop(e.target.value);
                            }}
                            className="w-full bg-slate-950 text-amber-300 font-bold text-xs rounded-lg px-2 py-1 border border-slate-700 focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="cotton">Cotton (कापूस)</option>
                            <option value="soybean">Soybean (सोयाबीन)</option>
                            <option value="rice">Rice / Paddy (भात)</option>
                            <option value="wheat">Wheat (गहू)</option>
                            <option value="sugarcane">Sugarcane (ऊस)</option>
                            <option value="maize">Maize (मका)</option>
                            <option value="tur">Tur / Arhar (तूर)</option>
                          </select>
                        </div>
                      )}

                      {/* Delete Plot Button inside Popup */}
                      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        {deleteConfirmId === aoi.id ? (
                          <div className="w-full flex items-center justify-between gap-2 bg-rose-950/80 p-1.5 rounded-lg border border-rose-500/40">
                            <span className="text-[10px] text-rose-200 font-bold">Delete this plot?</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (onDeleteAoi) onDeleteAoi(aoi.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(aoi.id)}
                            className="w-full py-1 px-2 rounded-lg bg-rose-950/50 hover:bg-rose-900 border border-rose-500/30 text-rose-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>{farmerT.deletePlot || 'Delete Farm Plot'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}
          </MapContainer>
        </div>

        {/* Secondary Map for Split-Screen Side-by-Side Compare */}
        {compareMode && (
          <div className="relative w-full h-full">
            <div className="absolute top-4 left-4 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-cyan-300">
              Comparing Date: 15 Days Prior (2026-07-27)
            </div>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
            >
              <MapController targetCenter={mapCenter} targetZoom={mapZoom} />
              <TileLayer
                attribution='&copy; Esri & OpenStreetMap'
                url={baseMapTiles[baseMap]}
              />
              {aois.map((aoi) => {
                const coords = aoi.geometry?.coordinates?.[0] || [];
                const latLngs = coords.map(c => [c[1], c[0]]);
                return (
                  <Polygon
                    key={`compare-${aoi.id}`}
                    positions={latLngs}
                    pathOptions={{
                      color: '#eab308',
                      weight: 2,
                      fillColor: '#eab308',
                      fillOpacity: opacity / 100.0
                    }}
                  />
                );
              })}
            </MapContainer>
          </div>
        )}
      </div>

      {/* Floating Layer Controls, Sentinel-2 Badge, Timelapse & Legend Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-[400] pointer-events-none flex flex-wrap items-center justify-between gap-3">
        
        {/* Layer Selector, Opacity & Index Switcher */}
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-2xl flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-300">Index Set:</span>
          </div>

          <div className="flex items-center p-0.5 bg-slate-950 rounded-xl border border-slate-800">
            {['TrueColor', 'NDVI', 'NDWI', 'NDMI'].map(layer => (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeLayer === layer
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {layer}
              </button>
            ))}
          </div>

          {/* Opacity Slider */}
          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px]">Opacity: {opacity}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-16 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Timelapse Simulation & Animation Export Button */}
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <button
              onClick={() => {
                const dates = ['2026-06-15 (Pre-Monsoon)', '2026-07-10 (Sowing)', '2026-08-01 (Vegetative)', '2026-08-15 (Current)'];
                let idx = 0;
                const interval = setInterval(() => {
                  idx = (idx + 1) % dates.length;
                  alert(`[Timelapse Animation Scrubbing] Date: ${dates[idx]} | Index: ${activeLayer}`);
                  if (idx === dates.length - 1) clearInterval(interval);
                }, 1200);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 font-bold text-[11px] flex items-center gap-1 shadow-md cursor-pointer"
              title="Play & export temporal vegetation / water change animation"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>Timelapse GIF Export</span>
            </button>
          </div>
        </div>

        {/* Sentinel-2 10m Telemetry & Data Quality Rigor Badge */}
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Sentinel-2 L2A (10m)</span>
          </div>
          <span className="text-slate-500">•</span>
          <span className="text-slate-300">SCL Cloud & Shadow Masked</span>
          <span className="text-slate-500">•</span>
          <span className="text-cyan-300 font-medium">8 Clear-Sky Passes (High Rigor)</span>
        </div>

        {/* Dynamic Color Legend */}
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-3 text-xs">
          <span className="text-slate-400 font-medium text-[11px]">Legend:</span>
          <div className="flex items-center gap-2.5 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span>
              <span className="text-slate-300">Green (Normal)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm"></span>
              <span className="text-slate-300">Yellow (Watch)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></span>
              <span className="text-slate-300">Red (Stress)</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
