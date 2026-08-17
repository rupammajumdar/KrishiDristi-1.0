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

    setNotificationToast(`Generating audit PDF report for ${personaTemplate.toUpperCase()} (${crop.toUpperCase()})...`);
    const rpt = await api.generateReport(targetAoiId, personaTemplate, reportTitle, crop, currentLang);

    if (rpt && rpt.file_uri) {
      const downloadUrl = rpt.file_uri.startsWith('http') ? rpt.file_uri : `http://localhost:8000${rpt.file_uri}`;
      setNotificationToast(`Report ready! Starting download...`);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.download = `KrishiDrishti_${personaTemplate}_${crop}_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setTimeout(() => setNotificationToast(null), 4000);
  };

  // If in Admin Mode, show full-screen dedicated Admin Console
  if (isAdminMode) {
    return <AdminPanel onExitAdmin={closeAdmin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Header */}
      <Header
        currentPersona={currentPersona}
        onSelectPersona={setCurrentPersona}
        currentLang={currentLang}
        onSelectLang={setCurrentLang}
        alertCount={2}
        onToggleNotifications={() => setIsNotificationsOpen(!isNotificationsOpen)}
        onOpenAdmin={openAdmin}
      />

      {/* Live / Offline data source badge */}
      <div
        className={`fixed bottom-4 left-4 z-[1100] px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg ${
          isLive
            ? 'bg-emerald-900/80 border border-emerald-500/40 text-emerald-300'
            : 'bg-slate-800/80 border border-slate-600/40 text-slate-400'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
        {isLive ? 'Live Data' : 'Demo Mode'}
        {lastUpdated && (
          <span className="opacity-60 ml-1">
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Notification Toast */}
      {notificationToast && (
        <div className="fixed top-16 right-6 z-[1100] bg-emerald-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-in slide-in-from-top duration-200">
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
              selectedAoi={selectedAoi}
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
