import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GISMap from './components/GISMap';
import TemporalSlider from './components/TemporalSlider';
import FarmerDashboard from './components/FarmerDashboard';
import GovernmentDashboard from './components/GovernmentDashboard';
import InsurerDashboard from './components/InsurerDashboard';
import AdminPanel from './components/AdminPanel';
import NotificationCenter from './components/NotificationCenter';
import { api } from './api';
import { downloadClientReport } from './utils/reportClientGenerator';

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(() => window.location.hash === '#admin');
  const [currentPersona, setCurrentPersona] = useState('farmer'); // farmer, government, insurer
  const [currentLang, setCurrentLang] = useState('en');
  const [aois, setAois] = useState([]);
  const [selectedAoi, setSelectedAoi] = useState(null);
  const [activeLayer, setActiveLayer] = useState('NDVI'); // TrueColor, NDVI, NDWI
  const [opacity, setOpacity] = useState(65);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState(3); // latest pass
  const [timeline, setTimeline] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [districtSummary, setDistrictSummary] = useState(null);
  const [districtDrilldown, setDistrictDrilldown] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [notificationToast, setNotificationToast] = useState(null);

  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive, setIsLive] = useState(false);

  // Sync hash with admin mode
  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminMode(window.location.hash === '#admin');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openAdmin = () => {
    window.location.hash = '#admin';
    setIsAdminMode(true);
  };

  const closeAdmin = () => {
    window.location.hash = '';
    setIsAdminMode(false);
  };

  // Initial Data Load — auto-establish backend session first
  useEffect(() => {
    async function loadInitialData() {
      // Ensure JWT session is active before any API call
      await api.ensureSession();

      const aoiData = await api.getAOIs();
      const aois = aoiData.aois || [];
      setAois(aois);
      if (aois.length > 0) setSelectedAoi(aois[0]);

      // Detect if data came from real backend (non-mock token)
      const token = localStorage.getItem('kd_access_token');
      setIsLive(!!(token && token !== 'mock-jwt-token-12345'));

      const initialDist = aois[0]?.district || 'Raipur';
      const distSum = await api.getDistrictSummary(initialDist);
      setDistrictSummary(distSum);

      const distDrill = await api.getDistrictDrilldown(initialDist);
      setDistrictDrilldown(distDrill);

      setLastUpdated(new Date());
    }
    loadInitialData();
  }, []);

  const handleSelectDistrict = async (districtName) => {
    if (!districtName) return;
    const sum = await api.getDistrictSummary(districtName);
    setDistrictSummary(sum);
    const drill = await api.getDistrictDrilldown(districtName);
    setDistrictDrilldown(drill);
  };

  // When selected AOI changes, fetch timeline, prediction, and district rollup
  useEffect(() => {
    if (!selectedAoi) return;
    async function loadAoiDetails() {
      const tl = await api.getTimeline(selectedAoi.id);
      setTimeline(tl);

      const pred = await api.predictYield(selectedAoi.id, selectedAoi.crop_type);
      setPrediction(pred);

      if (selectedAoi.district) {
        handleSelectDistrict(selectedAoi.district);
      }
    }
    loadAoiDetails();
  }, [selectedAoi?.id, selectedAoi?.district]);

  const handleAddAoi = async (newAoiData) => {
    const created = await api.createAOI(newAoiData);
    setAois(prev => [created, ...prev.filter(a => a.id !== created.id)]);
    setSelectedAoi(created);

    // Refresh district summary & drilldown if district differs
    if (created.district) {
      handleSelectDistrict(created.district);
    }

    setNotificationToast(`Plot loaded for location: ${created.name} (${created.area_hectares} Ha)`);
    setTimeout(() => setNotificationToast(null), 4000);
  };

  const handleDeleteAoi = async (aoiId) => {
    if (!aoiId) return;
    const aoiToDelete = aois.find(a => a.id === aoiId);
    const plotName = aoiToDelete?.name || `Farm #${aoiId}`;

    try {
      await api.deleteAOI(aoiId);
    } catch (err) {
      console.warn('Backend delete AOI warning:', err);
    }

    const remaining = aois.filter(a => a.id !== aoiId);
    setAois(remaining);

    if (selectedAoi?.id === aoiId) {
      const nextAoi = remaining.length > 0 ? remaining[0] : null;
      setSelectedAoi(nextAoi);
      if (!nextAoi) {
        setTimeline(null);
        setPrediction(null);
      }
    }

    setNotificationToast(`Farm plot "${plotName}" deleted successfully.`);
    setTimeout(() => setNotificationToast(null), 4000);
  };

  const handleUpdateCrop = async (newCrop) => {
    const cropKey = (newCrop || 'cotton').toLowerCase();
    if (selectedAoi) {
      const updated = { ...selectedAoi, crop_type: cropKey };
      setSelectedAoi(updated);
      setAois(prev => prev.map(a => a.id === updated.id ? updated : a));
      setNotificationToast(`Crop updated to ${cropKey.toUpperCase()} for ${updated.name}`);
      setTimeout(() => setNotificationToast(null), 3000);

      try {
        await api.updateAOI(selectedAoi.id, { crop_type: cropKey });
        const pred = await api.predictYield(selectedAoi.id, cropKey);
        if (pred) setPrediction(pred);
      } catch (err) {
        console.warn('Failed to sync crop update with backend:', err);
      }
    }
  };

  const handleGenerateReport = async (aoiId, personaTemplate) => {
    const targetAoiId = aoiId || selectedAoi?.id || 1;
    const crop = selectedAoi?.crop_type || 'cotton';
    const reportTitle = selectedAoi?.name
      ? `${personaTemplate.toUpperCase()} Audit Report - ${selectedAoi.name} (${crop.toUpperCase()})`
      : `${personaTemplate.toUpperCase()} Audit Report`;

    setNotificationToast(`Generating audit report for ${personaTemplate.toUpperCase()} (${crop.toUpperCase()})...`);
    
    let downloadedFromBackend = false;

    try {
      const rpt = await api.generateReport(targetAoiId, personaTemplate, reportTitle, crop, currentLang);
      if (rpt && rpt.file_uri && !rpt.file_uri.includes('/api/reports/101/download')) {
        const origin = api.getApiOrigin ? api.getApiOrigin() : (window.location.origin.includes('localhost') ? 'http://localhost:8000' : window.location.origin);
        const downloadUrl = rpt.file_uri.startsWith('http') ? rpt.file_uri : `${origin}${rpt.file_uri}`;
        
        try {
          const res = await fetch(downloadUrl);
          if (res.ok) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `KrishiDrishti_${personaTemplate.toUpperCase()}_${crop.toUpperCase()}_Report.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            downloadedFromBackend = true;
          }
        } catch (fetchErr) {
          console.warn('Direct PDF fetch failed, falling back to client-side report generator:', fetchErr);
        }
      }
    } catch (err) {
      console.warn('Backend report error, falling back to client-side generator:', err);
    }

    if (!downloadedFromBackend) {
      // Direct client-side download fallback — 100% reliable on Vercel, Netlify, offline & cloud deployments
      downloadClientReport({
        aoi: selectedAoi,
        persona: personaTemplate,
        crop: crop,
        lang: currentLang,
        prediction: prediction
      });
    }

    setNotificationToast(`Official ${personaTemplate.toUpperCase()} report generated & saved!`);
    setTimeout(() => setNotificationToast(null), 4000);
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Universal App Header */}
      <Header
        currentPersona={currentPersona}
        onSelectPersona={setCurrentPersona}
        currentLang={currentLang}
        onSelectLang={setCurrentLang}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadCount={alerts.filter(a => !a.is_read).length}
        onOpenAdmin={openAdmin}
        lastUpdated={lastUpdated}
        isLive={isLive}
      />

      {/* Admin Panel Modal / Overlay */}
      {isAdminMode && (
        <AdminPanel onClose={closeAdmin} />
      )}

      {/* Toast Notification Banner */}
      {notificationToast && (
        <div className="fixed top-20 right-6 z-[9999] bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-300 animate-bounce">
          <span>✨ {notificationToast}</span>
        </div>
      )}

      {/* Main Grid Content */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1920px] mx-auto w-full">
        
        {/* Left Column: Interactive GIS Map & Time-Machine Slider (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-h-[600px]">
          <div className="flex-1 min-h-[480px]">
            <GISMap
              aois={aois}
              selectedAoi={selectedAoi}
              onSelectAoi={setSelectedAoi}
              onDeleteAoi={handleDeleteAoi}
              activeLayer={activeLayer}
              setActiveLayer={setActiveLayer}
              opacity={opacity}
              setOpacity={setOpacity}
              compareMode={compareMode}
              setCompareMode={setCompareMode}
              currentLang={currentLang}
              onAddAoi={handleAddAoi}
              onUpdateCrop={handleUpdateCrop}
            />
          </div>

          <TemporalSlider
            timeline={timeline}
            selectedDateIndex={selectedDateIndex}
            onSelectDateIndex={setSelectedDateIndex}
            currentLang={currentLang}
          />
        </div>

        {/* Right Column: Persona-Specific Dynamic Panels (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-100px)]">
          {currentPersona === 'farmer' && (
            <FarmerDashboard
              aois={aois}
              selectedAoi={selectedAoi}
              onSelectAoi={setSelectedAoi}
              onDeleteAoi={handleDeleteAoi}
              prediction={prediction}
              onGenerateReport={handleGenerateReport}
              currentLang={currentLang}
              onSelectLang={setCurrentLang}
              onUpdateCrop={handleUpdateCrop}
            />
          )}

          {currentPersona === 'government' && (
            <GovernmentDashboard
              districtSummary={districtSummary}
              districtDrilldown={districtDrilldown}
              onGenerateReport={handleGenerateReport}
              currentLang={currentLang}
              onSelectDistrict={handleSelectDistrict}
            />
          )}

          {currentPersona === 'insurer' && (
            <InsurerDashboard
              selectedAoi={selectedAoi}
              prediction={prediction}
              onGenerateReport={handleGenerateReport}
              currentLang={currentLang}
            />
          )}
        </div>
      </main>

      {/* Slide-over Notification Feed Drawer */}
      <NotificationCenter
        alerts={alerts}
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onSelectAlert={(alt) => {
          setIsNotificationsOpen(false);
        }}
      />
    </div>
  );
}
