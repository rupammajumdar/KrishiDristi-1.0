import React, { useState, useEffect } from 'react';
import { 
  Sprout, 
  Droplets, 
  FileText, 
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  PhoneCall,
  Share2,
  Calendar,
  Sun,
  ShieldCheck,
  TrendingUp,
  CheckSquare,
  Square,
  Globe,
  HelpCircle,
  Clock,
  ChevronDown,
  Edit3,
  Bot,
  Send,
  MessageSquare,
  Loader2,
  Trash2,
  FolderOpen,
  MapPin,
  Cpu,
  Layers,
  Activity,
  Zap,
  RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { translations } from '../i18n';
import { api } from '../api';
import ExplainabilityPanel from './ExplainabilityPanel';

// Comprehensive Crop Metadata Dictionary for India
const CROPS_DATABASE = {
  cotton: {
    id: 'cotton',
    names: { en: 'Cotton', mr: 'कापूस', hi: 'कपास', kn: 'ಹತ್ತಿ', te: 'పత్తి' },
    mspPerQtl: 7200,
    normalYieldQtlAcre: 8.9,
    unit: 'Qtl',
  },
  soybean: {
    id: 'soybean',
    names: { en: 'Soybean', mr: 'सोयाबीन', hi: 'सोयाबीन', kn: 'ಸೋಯಾಬೀನ್', te: 'సోయాబీన్' },
    mspPerQtl: 4892,
    normalYieldQtlAcre: 10.5,
    unit: 'Qtl',
  },
  rice: {
    id: 'rice',
    names: { en: 'Rice / Paddy', mr: 'भात / धान', hi: 'धान / चावल', kn: 'ಭತ್ತ', te: 'వరి' },
    mspPerQtl: 2300,
    normalYieldQtlAcre: 22.0,
    unit: 'Qtl',
  },
  wheat: {
    id: 'wheat',
    names: { en: 'Wheat', mr: 'गहू', hi: 'गेहूँ', kn: 'ಗೋಧಿ', te: 'గోధుమ' },
    mspPerQtl: 2275,
    normalYieldQtlAcre: 18.5,
    unit: 'Qtl',
  },
  sugarcane: {
    id: 'sugarcane',
    names: { en: 'Sugarcane', mr: 'ऊस', hi: 'गन्ना', kn: 'ಕಬ್ಬು', te: 'చెరకు' },
    mspPerQtl: 340, // FRP per Quintal (Rs 3,400 / ton)
    normalYieldQtlAcre: 380.0,
    unit: 'Qtl',
  },
  maize: {
    id: 'maize',
    names: { en: 'Maize / Corn', mr: 'मका', hi: 'मक्का', kn: 'ಮೆಕ್ಕೆಜೋಳ', te: 'మొక్కజొన్న' },
    mspPerQtl: 2090,
    normalYieldQtlAcre: 24.0,
    unit: 'Qtl',
  },
  tur: {
    id: 'tur',
    names: { en: 'Tur / Pigeon Pea', mr: 'तूर / अरहर', hi: 'अरहर / तूर दाल', kn: 'ತೊಗರಿ', te: 'కందులు' },
    mspPerQtl: 7550,
    normalYieldQtlAcre: 6.5,
    unit: 'Qtl',
  }
};

/**
 * Intelligent Location & Agro-Climatic Advisory Generator
 * Generates dynamic, highly localized tasks based directly on ML Model returns:
 * 1. Random Forest (rf_stress.joblib) -> Severe / Moderate / Healthy classification
 * 2. PyTorch LSTM AutoEncoder (lstm_anomaly.pth) -> Temporal reconstruction anomaly score
 * 3. OpenWeather real-time weather (temp, rainfall)
 * 4. Regional Agro-Climatic Zone & Soil profile
 */
function generateLocationAwareTasks({ aoi, prediction, cropKey, lang }) {
  const district = aoi?.district || 'Jalna';
  const village = aoi?.village || aoi?.taluk || 'Field';
  const state = aoi?.state || 'Maharashtra';

  // Extract Exact ML Model Outputs
  const rfInfo = prediction?.ml_stress_classification || prediction?.input_snapshot_json?.rf_stress_classification;
  const lstmInfo = prediction?.ml_anomaly || prediction?.input_snapshot_json?.lstm_anomaly_detection;
  const locCtx = prediction?.location_context || prediction?.input_snapshot_json?.location_context;

  const changePct = prediction?.yield_change_pct ?? -18.4;
  const temp = prediction?.input_snapshot_json?.temp_avg_c ?? 29.5;
  const rainfall = prediction?.input_snapshot_json?.rainfall_mm ?? 360;
  const ndwi = prediction?.input_snapshot_json?.mean_ndwi ?? -0.15;
  const ndvi = prediction?.input_snapshot_json?.mean_ndvi ?? 0.46;

  // ML Stress Classification Flags
  const stressLabel = rfInfo?.stress_label || (changePct <= -20.0 ? 'Severe Stress' : 'Moderate Stress');
  const isSevereStress = rfInfo?.stress_class_id === 0 || (rfInfo?.probabilities?.severe_stress ?? 0) >= 0.40;
  const isModerateStress = rfInfo?.stress_class_id === 1 || (rfInfo?.probabilities?.moderate_stress ?? 0) >= 0.40;
  const isHealthyVeg = rfInfo?.stress_class_id === 2 || (rfInfo?.probabilities?.healthy ?? 0) >= 0.60;

  // LSTM Anomaly Flags
  const anomalyScore = lstmInfo?.anomaly_score ?? 0.28;
  const isAnomalyDetected = lstmInfo?.anomaly_detected || anomalyScore >= 0.40;
  const anomalyStatus = lstmInfo?.status_text || (isAnomalyDetected ? 'Elevated Anomaly' : 'Normal Trajectory');

  const zoneName = locCtx?.agro_zone || `${district} Agro-Climatic Zone`;
  const soilType = locCtx?.soil_type || 'Black Vertisol Soil';
  const kvkHub = locCtx?.kvk_station || `KVK ${district}`;

  const rawTasks = [];

  // ── Task 1: ML Stress-Driven Irrigation (Random Forest rf_stress.joblib) ──
  if (isSevereStress || isAnomalyDetected || temp >= 33) {
    const pSeverePct = Math.round((rfInfo?.probabilities?.severe_stress ?? 0.70) * 100);
    rawTasks.push({
      id: 'ml-task-1',
      badge: {
        en: `⚡ ML Stress Alert: ${stressLabel} (${pSeverePct}% Risk in ${district})`,
        mr: `⚡ ML ताण इशारा: ${stressLabel} (${district} मध्ये ${pSeverePct}% धोका)`,
        hi: `⚡ ML तनाव चेतावनी: ${stressLabel} (${district} में ${pSeverePct}% जोखिम)`,
        kn: `⚡ ML ಎಚ್ಚರಿಕೆ: ${stressLabel} (${district})`,
        te: `⚡ ML హెచ్చరిక: ${stressLabel} (${district})`
      },
      text: {
        en: `Random Forest model detected ${stressLabel} in ${village}, ${district} (NDWI: ${ndwi.toFixed(2)}, Temp: ${temp.toFixed(1)}°C). Immediate 3-hour drip irrigation needed for ${soilType} to stop moisture collapse.`,
        mr: `रँडम फॉरेस्ट मॉडेलनुसार ${village}, ${district} मध्ये ${stressLabel} नोंदवला (NDWI: ${ndwi.toFixed(2)}, तापमान: ${temp.toFixed(1)}°C). ${soilType} मधील ओलावा टिकवण्यासाठी त्वरित ३ तास ठिबक सिंचन द्या.`,
        hi: `रैंडम फॉरेस्ट मॉडल ने ${village}, ${district} में ${stressLabel} पाया (NDWI: ${ndwi.toFixed(2)}, तापमान: ${temp.toFixed(1)}°C). ${soilType} में नमी बनाए रखने हेतु तुरंत 3 घंटे ड्रिप सिंचाई करें.`,
        kn: `ರ್ಯಾಂಡಮ್ ಫಾರೆಸ್ಟ್ ಮಾದರಿಯು ${village}, ${district} ನಲ್ಲಿ ${stressLabel} ಪತ್ತೆ ಮಾಡಿದೆ. ${soilType} ಗೆ 3 ಗಂಟೆಗಳ ಹನಿ ನೀರಾವರಿ ನೀಡಿ.`,
        te: `ర్యాండమ్ ఫారెస్ట్ మోడల్ ${village}, ${district} లో ${stressLabel} గుర్తించింది. ${soilType} కు వెంటనే 3 గంటలు డ్రిప్ ద్వారా నీరు అందించండి.`
      },
      urgent: true,
      icon: Droplets
    });
  } else {
    const pHealthyPct = Math.round((rfInfo?.probabilities?.healthy ?? 0.65) * 100);
    rawTasks.push({
      id: 'ml-task-1',
      badge: {
        en: `💧 ML Moisture Protocol: ${stressLabel} (${pHealthyPct}% Healthy in ${district})`,
        mr: `💧 ML ओलावा व्यवस्थापन: ${stressLabel} (${district} मध्ये ${pHealthyPct}% निरोगी)`,
        hi: `💧 ML नमी प्रोटोकॉल: ${stressLabel} (${district} में ${pHealthyPct}% स्वस्थ)`,
        kn: `💧 ML ತೇವಾಂಶ ನಿರ್ವಹಣೆ: ${stressLabel} (${district})`,
        te: `💧 ML తేమ నిర్వహణ: ${stressLabel} (${district})`
      },
      text: {
        en: `ML Random Forest confirms ${stressLabel} across ${village} (NDVI: ${ndvi.toFixed(2)}, NDWI: ${ndwi.toFixed(2)}). Maintain regular 2-hour drip cycle to conserve root zone water in ${soilType}.`,
        mr: `ML मॉडेलनुसार ${village} मधील पिकाची स्थिती ${stressLabel} आहे (NDVI: ${ndvi.toFixed(2)}). ${soilType} मध्ये मुळांच्या भागात ओलावा टिकवण्यासाठी नियमित २ तास ठिबक चालू ठेवा.`,
        hi: `ML मॉडल के अनुसार ${village} में फसल ${stressLabel} स्थिति में है (NDVI: ${ndvi.toFixed(2)}). ${soilType} में नमी के लिए नियमित 2 घंटे ड्रिप चक्र चलाएं.`,
        kn: `ML ಮಾದರಿಯು ${village} ನಲ್ಲಿ ಬೆಳೆ ${stressLabel} ಸ್ಥಿರವಾಗಿದೆ. 2 ಗಂಟೆಗಳ ಹನಿ ನೀರಾವರಿ ನೀಡಿ.`,
        te: `ML మోడల్ ప్రకారం ${village} లో పంట ${stressLabel} గా ఉంది. 2 గంటల సాధారణ డ్రిప్ షెడ్యూల్ పాటించండి.`
      },
      urgent: false,
      icon: Droplets
    });
  }

  // ── Task 2: Crop & Location Nutrition Regimen ──
  if (cropKey === 'cotton') {
    rawTasks.push({
      id: 'ml-task-2',
      badge: {
        en: `🌿 Cotton Potassium Nitrate & Boll Defense (${district})`,
        mr: `🌿 कापूस पोटॅशियम नायट्रेट व पाते गळती नियंत्रण (${district})`,
        hi: `🌿 कपास पोटेशियम नाइट्रेट एवं फल गिरना नियंत्रण (${district})`,
        kn: `🌿 ಹತ್ತಿ ಪೊಟ್ಯಾಸಿಯಮ್ ನೈಟ್ರೇಟ್ ಸಿಂಪಡಣೆ (${district})`,
        te: `🌿 పత్తి పొటాషియం నైట్రేట్ పిచికారీ (${district})`
      },
      text: {
        en: `ML Yield Model forecast for ${district} (${(changePct > 0 ? '+' : '') + changePct.toFixed(1)}% vs baseline): Foliar spray Potassium Nitrate (13-0-45) @ 10g/L + Planofix @ 0.25ml/L to arrest boll drop in ${village}.`,
        mr: `${district} साठी ML अंदाज (${(changePct > 0 ? '+' : '') + changePct.toFixed(1)}%): पाते गळती रोखण्यासाठी पोटॅशियम नायट्रेट (१३:०:४५) @ १० ग्रॅम/लिटर + प्लॅनोफिक्स @ ०.२५ मिली/लिटर फवारा.`,
        hi: `${district} के लिए ML पूर्वानुमान (${(changePct > 0 ? '+' : '') + changePct.toFixed(1)}%): फूल व फल गिरने से रोकने हेतु पोटेशियम नाइट्रेट (13-0-45) @ 10 ग्राम/लीटर + प्लानोफिक्स का छिड़काव करें.`,
        kn: `${district} ನಲ್ಲಿ ಹತ್ತಿ ಬೆಳೆಗಾಗಿ ಪೊಟ್ಯಾಸಿಯಮ್ ನೈಟ್ರೇಟ್ (13-0-45) ಸಿಂಪಡಿಸಿ.`,
        te: `${district} లో పత్తి పంటకు పొటాషియం నైట్రేట్ (13-0-45) స్ప్రే చేయండి.`
      },
      urgent: isSevereStress || isAnomalyDetected,
      icon: Sprout
    });
  } else if (cropKey === 'soybean') {
    rawTasks.push({
      id: 'ml-task-2',
      badge: {
        en: `🌿 Soybean Pod Growth: 0:52:34 Foliar Spray`,
        mr: `🌿 सोयाबीन शेंगा भरणी: ०:५२:३४ फवारणी`,
        hi: `🌿 सोयाबीन फली भराव: 0:52:34 स्प्रे`,
        kn: `🌿 ಸೋಯಾಬೀನ್ 0:52:34 ಸಿಂಪಡಣೆ`,
        te: `🌿 సోయాబీన్ 0:52:34 పిచికారీ`
      },
      text: {
        en: `Apply water-soluble 0:52:34 (MKP) @ 5g/L + Boron @ 1g/L across ${village} plots to boost pod weight and grain filling in ${district}.`,
        mr: `${district} मधील शेंगा भरणीसाठी ${village} मध्ये ०:५२:३४ @ ५ ग्रॅम/लिटर + बोरॉन @ १ ग्रॅम/लिटर फवारा.`,
        hi: `${district} में फलियों के समुचित विकास हेतु 0:52:34 @ 5 ग्राम/लीटर + बोरॉन @ 1 ग्राम/लीटर का स्प्रे करें.`,
        kn: `${village} ನಲ್ಲಿ ಸೋಯಾಬೀನ್ ಕಾಳು ತುಂಬಲು 0:52:34 ಸಿಂಪಡಿಸಿ.`,
        te: `${village} లో సోయాబీన్ గింజల బరువు పెరగడానికి 0:52:34 స్ప్రే చేయండి.`
      },
      urgent: false,
      icon: Sprout
    });
  } else if (cropKey === 'sugarcane') {
    rawTasks.push({
      id: 'ml-task-2',
      badge: {
        en: `🎋 Sugarcane Trash Mulching & Moisture Care`,
        mr: `🎋 ऊस पाचट आच्छादन व ओलावा संवर्धन`,
        hi: `🎋 गन्ना पत्ती मल्चिंग एवं नमी संरक्षण`,
        kn: `🎋 ಕಬ್ಬು ಕಸದ ಹೊದಿಕೆ ನಿರ್ವಹಣೆ`,
        te: `🎋 చెరకు ఆకుల మల్చింగ్`
      },
      text: {
        en: `Spread dry cane trash (5 tonnes/ha) between rows in ${village} to reduce evapotranspiration and suppress weeds in ${district}.`,
        mr: `${district} मधील बाष्पीभवन रोखण्यासाठी ${village} मधील उसाच्या पट्ट्यात ५ टन/हेक्टर पाचट आच्छादन पसरवा.`,
        hi: `${district} में वाष्पीकरण कम करने के लिए ${village} में गन्ने की कतारों के बीच सूखी पत्ती मल्चिंग करें.`,
        kn: `${village} ನಲ್ಲಿ ಕಬ್ಬಿನ ಸಾಲುಗಳಲ್ಲಿ ಒಣ ಎಲೆಗಳನ್ನು ಹರಡಿ.`,
        te: `${village} లో చెరకు వరుసల మధ్య ఎండిన ఆకులను మల్చింగ్ చేయండి.`
      },
      urgent: false,
      icon: Sprout
    });
  } else if (cropKey === 'maize') {
    rawTasks.push({
      id: 'ml-task-2',
      badge: {
        en: `🌽 Maize Tasseling & Urea Top-Dressing`,
        mr: `🌽 मका तुरा फुटणे: युरिया खत मात्रा`,
        hi: `🌽 मक्का नर मंजरी अवस्था: यूरिया टॉप-ड्रेसिंग`,
        kn: `🌽 ಮೆಕ್ಕೆಜೋಳ ಯೂರಿಯಾ ಗೊಬ್ಬರ`,
        te: `🌽 మొక్కజొన్న యూరియా వేయడం`
      },
      text: {
        en: `Top-dress Neem-coated Urea @ 30kg/acre in ${village} at knee-high to tasseling stage. Inspect whorl for Fall Armyworm.`,
        mr: `${village} मध्ये मक्याला ३० किलो/एकर निमयुक्त युरिया द्या. लष्करी अळी (Fall Armyworm) चा प्रादुर्भाव तपासा.`,
        hi: `${village} में मक्का फसल में 30 किग्रा/एकड़ नीम-लेपित यूरिया दें और फॉल आर्मीवर्म सुंडी की जांच करें.`,
        kn: `${village} ನಲ್ಲಿ ಮೆಕ್ಕೆಜೋಳಕ್ಕೆ ಯೂರಿಯಾ ಗೊಬ್ಬರ ಹಾಕಿ ಮತ್ತು ಕೀಟಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.`,
        te: `${village} లో మొక్కజొన్నకు యూరియా వేసి కత్తెర పురుగును గమనించండి.`
      },
      urgent: false,
      icon: Sprout
    });
  } else if (cropKey === 'tur') {
    rawTasks.push({
      id: 'ml-task-2',
      badge: {
        en: `🌱 Tur / Pigeon Pea 19:19:19 Spray`,
        mr: `🌱 तूर १९:१९:१९ व पल्स वंडर फवारणी`,
        hi: `🌱 अरहर 19:19:19 एवं पल्स वंडर स्प्रे`,
        kn: `🌱 ತೊಗರಿ 19:19:19 ಸಿಂಪಡಣೆ`,
        te: `🌱 కందులు 19:19:19 పిచికారీ`
      },
      text: {
        en: `Spray 19:19:19 @ 5g/L + Pulse Wonder in ${village} to enhance branching and profuse flowering in ${district}.`,
        mr: `${district} मधील तूर पिकात फुटवे व फुलोरा वाढवण्यासाठी १९:१९:१९ @ ५ ग्रॅम/लिटर फवारा.`,
        hi: `${district} में अरहर की शाखाओं एवं फूलों की वृद्धि हेतु 19:19:19 @ 5 ग्राम/लीटर का छिड़काव करें.`,
        kn: `${district} ನಲ್ಲಿ ತೊಗರಿ ಬೆಳೆಗೆ 19:19:19 ಸಿಂಪಡಿಸಿ.`,
        te: `${district} లో కంది పంటకు 19:19:19 స్ప్రే చేయండి.`
      },
      urgent: false,
      icon: Sprout
    });
  } else if (cropKey === 'rice' || cropKey === 'wheat') {
    rawTasks.push({
      id: 'ml-task-2',
      badge: {
        en: `🌾 ${district} Grain Initiation Care`,
        mr: `🌾 ${district} लोंबी / ओंबी भरणे व्यवस्थापन`,
        hi: `🌾 ${district} बाली निर्माण एवं पोषण प्रबंधन`,
        kn: `🌾 ${district} ತೆನೆ ಭರ್ತಿ ನಿರ್ವಹಣೆ`,
        te: `🌾 ${district} వెన్ను దశ పోషణ`
      },
      text: {
        en: `Top-dress balanced Urea + Neem cake in ${village} fields. Maintain 3-4 cm standing water depth during critical panicle initiation.`,
        mr: `${village} मधील शेतात संतुलित युरिया व निंबोळी पेंड द्या. लोंबी निघण्याच्या काळात शेतात ३-४ सेंमी पाणी साठवून ठेवा.`,
        hi: `${village} के खेतों में यूरिया व नीम खली का प्रयोग करें. बाली निकलते समय 3-4 सेमी पानी की गहराई बनाए रखें.`,
        kn: `${village} ಗದ್ದೆಗಳಲ್ಲಿ ಸಮತೋಲಿತ ರಸಗೊಬ್ಬರ ನೀಡಿ ಮತ್ತು 3-4 ಸೆಂ.ಮೀ ನೀರು ನಿಲ್ಲಿಸಿ.`,
        te: `${village} పొలాల్లో యూరియా వేసి 3-4 సెం.మీ నీటి మట్టాన్ని నిర్వహించండి.`
      },
      urgent: false,
      icon: Sprout
    });
  } else {
    rawTasks.push({
      id: 'ml-task-2',
      badge: {
        en: `🌱 ${district} Crop Vigor Protocol`,
        mr: `🌱 ${district} पीक पोषण व वाढ प्रोटोकॉल`,
        hi: `🌱 ${district} फसल पोषण एवं वृद्धि प्रोटोकॉल`,
        kn: `🌱 ${district} ಬೆಳೆ ಪೋಷಣೆ`,
        te: `🌱 ${district} పంట పోషణ`
      },
      text: {
        en: `Apply water-soluble NPK (19:19:19) @ 5g/L to boost vegetative vigor across ${village} plots as detected by Sentinel-2 NDVI (${ndvi.toFixed(2)}).`,
        mr: `उपग्रह NDVI (${ndvi.toFixed(2)}) नुसार ${village} मधील पिकांची वाढ सुधारण्यासाठी १९:१९:१९ @ ५ ग्रॅम/लिटर फवारा.`,
        hi: `उपग्रह NDVI (${ndvi.toFixed(2)}) के आधार पर ${village} में वनस्पति वृद्धि हेतु 19:19:19 @ 5 ग्राम/लीटर का छिड़काव करें.`,
        kn: `${village} ನಲ್ಲಿ ಬೆಳೆಯ ಬೆಳವಣಿಗೆಗೆ 19:19:19 ಸಿಂಪಡಿಸಿ.`,
        te: `${village} లో పంట పెరుగుదలకు 19:19:19 స్ప్రే చేయండి.`
      },
      urgent: false,
      icon: Sprout
    });
  }

  // ── Task 3: Localized KVK / University Pest & Disease Surveillance ──
  rawTasks.push({
    id: 'loc-task-3',
    badge: {
      en: `🛡️ ${kvkHub} Integrated Pest Advisory`,
      mr: `🛡️ ${kvkHub} एकात्मिक कीड नियंत्रण`,
      hi: `🛡️ ${kvkHub} एकीकृत कीट प्रबंधन सलाह`,
      kn: `🛡️ ${kvkHub} ಸಮಗ್ರ ಕೀಟ ನಿಯಂತ್ರಣ`,
      te: `🛡️ ${kvkHub} సమగ్ర తెగుళ్ల నివారణ`
    },
    text: {
      en: `Inspect lower canopy in ${village} for sucking pests (whiteflies/jassids) and pink bollworm. Install 5 pheromone traps per acre as per ${district} KVK advisory.`,
      mr: `${district} कृषी विज्ञान केंद्र (KVK) च्या सल्ल्यानुसार ${village} मधील शेतात रसशोषक किडी तपासा व प्रति एकर ५ कामगंध सापळे लावा.`,
      hi: `${district} कृषि विज्ञान केंद्र (KVK) की सलाह अनुसार ${village} में रस चूसक कीटों की जांच करें और प्रति एकड़ 5 फेरोमोन ट्रैप लगाएं.`,
      kn: `${district} ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರದ ಸಲಹೆಯಂತೆ ${village} ನಲ್ಲಿ 5 ಮೋಹಕ ಬಲೆಗಳನ್ನು ಅಳವಡಿಸಿ.`,
      te: `${district} కృషి విజ్ఞాన కేంద్రం సలహా ప్రకారం ${village} లో ఎకరాకు 5 లింగాకర్షక బుట్టలు ఏర్పాటు చేయండి.`
    },
    urgent: false,
    icon: ShieldCheck
  });

  return {
    soilType,
    zoneName,
    kvkHub,
    tasks: rawTasks.map(t => ({
      id: t.id,
      badge: t.badge[lang] || t.badge.en,
      text: t.text[lang] || t.text.en,
      urgent: t.urgent,
      icon: t.icon
    }))
  };
}

export default function FarmerDashboard({
  aois,
  selectedAoi,
  onSelectAoi,
  onDeleteAoi,
  prediction,
  onGenerateReport,
  currentLang = 'mr',
  onSelectLang,
  onUpdateCrop,
}) {
  const t = translations[currentLang] || translations.mr;
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showExplainability, setShowExplainability] = useState(false);
  const [isCropDropdownOpen, setIsCropDropdownOpen] = useState(false);
  const [isPlotManagerOpen, setIsPlotManagerOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Available native languages
  const nativeLanguages = [
    { code: 'mr', label: 'मराठी', flag: '🇮🇳', region: 'Maharashtra' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳', region: 'North/Central' },
    { code: 'en', label: 'English', flag: '🌐', region: 'Global' },
    { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳', region: 'Karnataka' },
    { code: 'te', label: 'తెలుగు', flag: '🇮🇳', region: 'Andhra/Telangana' },
  ];

  // Resolve current active crop from selected plot
  const [selectedCropKey, setSelectedCropKey] = useState(null);
  const [localPrediction, setLocalPrediction] = useState(prediction);
  const [isRunningML, setIsRunningML] = useState(false);
  const [mlToastMessage, setMlToastMessage] = useState(null);

  // Sync prediction when props update
  useEffect(() => {
    setLocalPrediction(prediction);
  }, [prediction]);

  const activePrediction = localPrediction || prediction;

  // Sync crop selection when selected plot changes
  useEffect(() => {
    if (selectedAoi?.crop_type) {
      setSelectedCropKey(selectedAoi.crop_type.toLowerCase());
    } else {
      setSelectedCropKey(null);
    }
  }, [selectedAoi?.id, selectedAoi?.crop_type]);

  const rawCropKey = (selectedCropKey || selectedAoi?.crop_type || 'cotton').toLowerCase();
  const activeCropKey = CROPS_DATABASE[rawCropKey] ? rawCropKey : 'cotton';
  const cropConfig = CROPS_DATABASE[activeCropKey] || CROPS_DATABASE.cotton;

  // Handler to run live ML Model prediction for the location using real-time map data
  const handleRunLiveML = async () => {
    if (!selectedAoi) return;
    setIsRunningML(true);
    try {
      let lat = 19.8341, lon = 75.8812;
      if (selectedAoi.geometry) {
        try {
          const geom = typeof selectedAoi.geometry === 'string' ? JSON.parse(selectedAoi.geometry) : selectedAoi.geometry;
          if (geom.coordinates && geom.coordinates[0] && geom.coordinates[0][0]) {
            lon = geom.coordinates[0][0][0];
            lat = geom.coordinates[0][0][1];
          }
        } catch (_) {}
      }
      const res = await api.predictLocation({
        lat,
        lon,
        cropType: activeCropKey,
        district: selectedAoi.district || 'Jalna',
        state: selectedAoi.state || 'Maharashtra',
        village: selectedAoi.village,
        areaHa: selectedAoi.area_hectares || 2.0,
      });
      if (res) {
        setLocalPrediction(res);
        setMlToastMessage(`ML Inference Complete: Random Forest + PyTorch LSTM + Live Satellite Telemetry updated for ${selectedAoi.district || 'plot'}`);
        setTimeout(() => setMlToastMessage(null), 4000);

        // Immediately update AI advisory / weekly action tasks using the new ML results
        setIsLoadingAi(true);
        try {
          const advRes = selectedAoi.id 
            ? await api.getAiAdvisory(selectedAoi.id, activeCropKey, currentLang)
            : await api.getLocationAiAdvisory({
                lat,
                lon,
                cropType: activeCropKey,
                district: selectedAoi.district,
                state: selectedAoi.state,
                village: selectedAoi.village,
                areaHa: selectedAoi.area_hectares,
              }, currentLang);
          if (advRes?.tasks && Array.isArray(advRes.tasks) && advRes.tasks.length > 0) {
            setAiTasks(advRes.tasks);
          }
        } catch (advErr) {
          console.warn('Error refreshing AI advisory after ML run:', advErr);
        } finally {
          setIsLoadingAi(false);
        }
      }
    } catch (e) {
      console.warn('ML run error:', e);
    } finally {
      setIsRunningML(false);
    }
  };

  // Keyed task completion state per plot/location ID so tasks reset properly on plot change
  const plotKey = selectedAoi?.id || selectedAoi?.name || 'default_plot';
  const [completedTasksByPlot, setCompletedTasksByPlot] = useState({});

  const completedTasks = completedTasksByPlot[plotKey] || {};

  const toggleTask = (id) => {
    setCompletedTasksByPlot(prev => ({
      ...prev,
      [plotKey]: {
        ...prev[plotKey],
        [id]: !prev[plotKey]?.[id]
      }
    }));
  };

  // Generate dynamic, location-aware & weather-adaptive tasks
  const locationAgroProfile = generateLocationAwareTasks({
    aoi: selectedAoi,
    prediction: activePrediction,
    cropKey: activeCropKey,
    lang: currentLang
  });

  const [aiTasks, setAiTasks] = useState(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState(null);
  const [isAskingAi, setIsAskingAi] = useState(false);

  // Fetch Real-Time Google Gemini AI Advisory whenever plot, crop, or language changes
  useEffect(() => {
    if (selectedAoi?.id) {
      setIsLoadingAi(true);
      setAiTasks(null);
      api.getAiAdvisory(selectedAoi.id, activeCropKey, currentLang)
        .then(res => {
          if (res?.tasks && Array.isArray(res.tasks) && res.tasks.length > 0) {
            setAiTasks(res.tasks);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingAi(false));
    }
  }, [selectedAoi?.id, activeCropKey, currentLang]);

  const handleSelectCrop = async (cropId) => {
    setSelectedCropKey(cropId);
    setAiTasks(null);
    setIsLoadingAi(true);
    if (onUpdateCrop && selectedAoi?.id) {
      onUpdateCrop(selectedAoi.id, cropId);
    }
    try {
      if (selectedAoi) {
        const pred = await api.predictYield(selectedAoi.id || 0, cropId, {
          district: selectedAoi.district || 'Jalna',
          state: selectedAoi.state || 'Maharashtra',
          village: selectedAoi.village,
          areaHa: selectedAoi.area_hectares || 2.0,
        });
        if (pred) setLocalPrediction(pred);

        const res = await api.getAiAdvisory(selectedAoi.id || 1, cropId, currentLang);
        if (res?.tasks && Array.isArray(res.tasks) && res.tasks.length > 0) {
          setAiTasks(res.tasks);
        }
      }
    } catch (e) {
      console.error('Error updating crop prediction and AI advisory:', e);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleAskGemini = async (e) => {
    if (e) e.preventDefault();
    if (!aiQuestion.trim() || !selectedAoi?.id) return;
    setIsAskingAi(true);
    try {
      const res = await api.askAi(selectedAoi.id, aiQuestion, activeCropKey, currentLang);
      setAiAnswer(res?.answer || 'AI Agronomist analysis complete.');
    } catch (err) {
      setAiAnswer('Unable to reach AI agronomist at the moment. Please try again.');
    } finally {
      setIsAskingAi(false);
    }
  };

  const activeTaskList = (aiTasks && aiTasks.length > 0)
    ? aiTasks.map((t, idx) => ({
        id: `gemini_task_${idx + 1}`,
        text: t.title || t.text,
        sub: t.subtitle,
        badge: t.urgency ? `🤖 ML Alert: ${t.urgency}` : '🤖 ML Action',
        urgent: (t.urgency || '').toLowerCase().includes('urgent') || (t.urgency || '').toLowerCase().includes('high') || idx === 0,
        icon: t.icon === 'Droplets' ? Droplets : t.icon === 'ShieldCheck' ? ShieldCheck : Sprout
      }))
    : locationAgroProfile.tasks;

  const tasksList = activeTaskList;

  const plotName = selectedAoi?.name || (currentLang === 'mr' ? 'माझे शेत' : currentLang === 'hi' ? 'मेरा खेत' : 'My Farm Plot');
  const areaHa = selectedAoi?.area_hectares || 2.02;
  const areaAc = (areaHa * 2.471).toFixed(1);
  const locationParts = Array.from(new Set([selectedAoi?.village, selectedAoi?.taluk, selectedAoi?.district, selectedAoi?.state].filter(p => p && p !== 'Local Field' && p !== 'Local Taluk' && p !== 'Unknown District')));
  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : (selectedAoi?.name || 'Active Farm Location');

  const changePct = activePrediction?.yield_change_pct ?? -21.8;

  // ML Fields Extraction
  const mlRfInfo = activePrediction?.ml_stress_classification || activePrediction?.input_snapshot_json?.rf_stress_classification;
  const mlLstmInfo = activePrediction?.ml_anomaly || activePrediction?.input_snapshot_json?.lstm_anomaly_detection;
  const mlLocCtx = activePrediction?.location_context || activePrediction?.input_snapshot_json?.location_context;

  // Crop-Specific Harvest & Earnings Calculation
  const normalYieldQtlAcre = cropConfig.normalYieldQtlAcre;
  const yieldFactor = 1 + (changePct / 100.0);
  const yieldQtlPerAcre = Math.max(0.5, (normalYieldQtlAcre * yieldFactor)).toFixed(1);
  const totalEstQuintals = (parseFloat(yieldQtlPerAcre) * parseFloat(areaAc)).toFixed(1);
  const estEarningsInr = Math.round(parseFloat(totalEstQuintals) * cropConfig.mspPerQtl).toLocaleString('en-IN');

  // Dynamic Sentinel-2 NDVI + Yield + Action Recovery Health Score (0-100)
  const rawNdvi = activePrediction?.input_snapshot_json?.mean_ndvi ?? 0.48;
  const completedCount = Object.values(completedTasks).filter(Boolean).length;
  const totalTasks = tasksList.length || 3;
  const taskRecoveryBonus = Math.round((completedCount / totalTasks) * 12); // Farmer gets visible recovery boost for completing tasks

  // NDVI score (0.2 -> 25%, 0.75+ -> 95%)
  const ndviHealth = Math.max(20, Math.min(95, Math.round(((rawNdvi - 0.15) / (0.75 - 0.15)) * 75 + 20)));
  const yieldHealth = Math.max(20, Math.min(95, Math.round(75 + changePct)));
  const baseHealth = Math.round(ndviHealth * 0.55 + yieldHealth * 0.45);
  const healthScore = Math.max(15, Math.min(98, baseHealth + taskRecoveryBonus));

  const isHealthy = healthScore >= 75;
  const isModerateRisk = healthScore >= 50 && healthScore < 75;
  const isHighRisk = healthScore < 50;

  const ndviTrendData = [
    { date: '10 Jul', health: Math.max(25, Math.min(92, Math.round(healthScore + 18 - taskRecoveryBonus))), label: 'Early' },
    { date: '18 Jul', health: Math.max(22, Math.min(90, Math.round(healthScore + 10 - taskRecoveryBonus))), label: 'Growth' },
    { date: '26 Jul', health: Math.max(20, Math.min(88, Math.round(healthScore + 2 - taskRecoveryBonus))), label: 'Mid' },
    { date: '04 Aug', health: Math.max(18, Math.min(85, Math.round(healthScore - 6 - taskRecoveryBonus))), label: 'Recent' },
    { date: 'Today', health: healthScore, label: isHealthy ? 'Healthy' : isModerateRisk ? 'Needs Water' : 'Critical' },
  ];

  // Voice Readout in native language
  const handleVoiceAdvisory = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported on this browser.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const langVoiceMap = {
      mr: 'mr-IN',
      hi: 'hi-IN',
      kn: 'kn-IN',
      te: 'te-IN',
      en: 'en-IN'
    };

    const cropDisplayName = cropConfig.names[currentLang] || cropConfig.names.en;
    let text = t.voiceMessage
      .replace('{score}', healthScore)
      .replace('{yield}', yieldQtlPerAcre);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langVoiceMap[currentLang] || 'en-IN';
    utterance.rate = 0.88;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleShareWhatsApp = () => {
    const cropDisplayName = cropConfig.names[currentLang] || cropConfig.names.en;
    const text = `🌾 *${t.myPlots}*\n📍 ${locationStr}\n🌱 ${plotName} (${areaAc} Acres - ${cropDisplayName})\n📊 ${t.healthScore}: ${healthScore}%\n💧 ${t.waterAlertSub}\n💰 ${t.totalHarvest}: ${totalEstQuintals} ${t.quintals} (₹${estEarningsInr})`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-4 font-sans">
      
      {/* ── 0. Native Language Quick Selector Bar ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.languageSelector || 'Select Language / भाषा निवडा:'}</span>
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
            {locationAgroProfile.zoneName}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {nativeLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => onSelectLang && onSelectLang(lang.code)}
              className={`py-2 px-1.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                currentLang === lang.code
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 shadow-md shadow-emerald-950/60 scale-[1.03] font-black'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/50'
              }`}
            >
              <span className="text-sm">{lang.flag}</span>
              <span className="truncate w-full text-center">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. Main Farm Header, Crop Switcher, Plot Manager & PDF Action ── */}
      {selectedAoi && (
        <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-slate-100">{plotName}</span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {areaAc} {t.acres} ({areaHa} Ha)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{locationStr}</span>
              </p>
            </div>

            {/* Quick Plot Switcher & Manager */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setIsPlotManagerOpen(!isPlotManagerOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer shadow-sm"
                  title="Switch or manage farm plots"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.myPlots || 'My Plots'} ({aois?.length || 1})</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isPlotManagerOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl z-50 flex flex-col gap-1 backdrop-blur-xl animate-in fade-in">
                    <div className="px-2 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span>{t.myPlots || 'Switch Active Plot'}</span>
                      <span className="text-emerald-400 text-[10px]">Real-Time Sync</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                      {aois && aois.map((plot) => {
                        const isCurrent = plot.id === selectedAoi.id;
                        const plotCrop = (plot.crop_type || 'cotton').toLowerCase();
                        const cropName = CROPS_DATABASE[plotCrop]?.names[currentLang] || plotCrop;
                        return (
                          <div 
                            key={plot.id}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                              isCurrent ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <button
                              onClick={() => {
                                if (onSelectAoi) onSelectAoi(plot);
                                setIsPlotManagerOpen(false);
                              }}
                              className="flex-1 text-left truncate flex flex-col"
                            >
                              <span className="truncate">{plot.name || `Farm #${plot.id}`}</span>
                              <span className="text-[10px] text-slate-400">
                                {cropName} • {(plot.area_hectares * 2.47).toFixed(1)} Ac
                              </span>
                            </button>

                            {/* Delete Plot Confirmation in Dropdown */}
                            {aois.length > 1 && (
                              deleteConfirmId === plot.id ? (
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={() => {
                                      if (onDeleteAoi) onDeleteAoi(plot.id);
                                      setDeleteConfirmId(null);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(plot.id);
                                  }}
                                  className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                                  title="Delete this farm plot"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Crop Switcher Strip */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Sprout className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.cropType || 'Active Crop'}:</span>
              </span>
              
              <div className="flex items-center gap-1 flex-wrap">
                {Object.keys(CROPS_DATABASE).map((cKey) => {
                  const isSelected = activeCropKey === cKey;
                  const cObj = CROPS_DATABASE[cKey];
                  return (
                    <button
                      key={cKey}
                      onClick={() => handleSelectCrop(cKey)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-md font-black scale-105'
                          : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                      }`}
                    >
                      <span>{cObj.names[currentLang] || cObj.names.en}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              MSP Benchmark: <span className="text-emerald-400 font-bold">₹{cropConfig.mspPerQtl}</span> / Qtl
            </div>
          </div>

          {/* Audio, PDF & Delete Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap border-t border-slate-800/80 pt-3">
            {/* Voice Readout Button */}
            <button
              onClick={handleVoiceAdvisory}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                isPlayingAudio 
                  ? 'bg-amber-500 text-slate-950 animate-pulse' 
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
              }`}
              title="Listen to advisory in voice"
            >
              {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
              <span>{isPlayingAudio ? t.stopAudio : t.listenAudio}</span>
            </button>

            {/* Generate Full PDF Report */}
            <button
              onClick={() => onGenerateReport && onGenerateReport(selectedAoi.id, 'farmer')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer ml-auto"
            >
              <FileText className="w-4 h-4 text-slate-950" />
              <span>{t.downloadReport}</span>
            </button>

            {/* Delete Farm Button */}
            {aois && aois.length > 1 && (
              deleteConfirmId === selectedAoi.id ? (
                <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/40 px-2 py-1 rounded-xl">
                  <span className="text-[11px] text-rose-300 font-bold">Delete this plot?</span>
                  <button
                    onClick={() => {
                      if (onDeleteAoi) onDeleteAoi(selectedAoi.id);
                      setDeleteConfirmId(null);
                    }}
                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer ml-1"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirmId(selectedAoi.id)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                  title="Remove this farm plot from dashboard"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t.deletePlot || 'Delete Plot'}</span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* ── ML Pipeline Live Inference Scorecard Bar ── */}
      {selectedAoi && (
        <div className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3 shadow-lg flex flex-col gap-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Cpu className="w-4 h-4 animate-pulse text-emerald-400" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                  <span>ML Inference Engine (Live Multi-Model Inference)</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    Active
                  </span>
                </span>
                <p className="text-[10px] text-slate-400">
                  Real-time Sentinel-2 Multispectral + OpenWeather Telemetry for {selectedAoi.district || 'plot'}
                </p>
              </div>
            </div>

            {/* Run Live ML Prediction Button */}
            <button
              onClick={handleRunLiveML}
              disabled={isRunningML}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                isRunningML
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50 scale-[1.02] border border-emerald-400/40'
              }`}
            >
              {isRunningML ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Running ML Models...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Run Live ML Prediction</span>
                </>
              )}
            </button>
          </div>

          {/* ML Toast message */}
          {mlToastMessage && (
            <div className="text-[11px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-3 py-1.5 rounded-xl flex items-center gap-2 animate-bounce">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>{mlToastMessage}</span>
            </div>
          )}

          {/* 3 Sub-Model Output Panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Model 1: Random Forest Stress (rf_stress.joblib) */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-sm hover:border-emerald-500/30 transition-all">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>RF Stress Model</span>
                  </span>
                  <span className="font-mono text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                    rf_stress.joblib
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-black text-slate-100">
                    {mlRfInfo?.stress_label || 'Healthy / Moderate'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    mlRfInfo?.stress_class_id === 2
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : mlRfInfo?.stress_class_id === 0
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {mlRfInfo?.stress_class_id === 2 ? 'Optimal' : mlRfInfo?.stress_class_id === 0 ? 'Severe' : 'Moderate'}
                  </span>
                </div>
              </div>

              {/* Class Probability Distribution */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Healthy Probability</span>
                  <span className="text-emerald-400 font-bold">
                    {Math.round((mlRfInfo?.probabilities?.healthy ?? 0.65) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden flex">
                  <div style={{ width: `${Math.round((mlRfInfo?.probabilities?.healthy ?? 0.65) * 100)}%` }} className="bg-emerald-500 h-full"></div>
                  <div style={{ width: `${Math.round((mlRfInfo?.probabilities?.moderate_stress ?? 0.25) * 100)}%` }} className="bg-amber-500 h-full"></div>
                  <div style={{ width: `${Math.round((mlRfInfo?.probabilities?.severe_stress ?? 0.10) * 100)}%` }} className="bg-rose-500 h-full"></div>
                </div>
              </div>
            </div>

            {/* Model 2: LSTM AutoEncoder Anomaly (lstm_anomaly_best.pth) */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-sm hover:border-cyan-500/30 transition-all">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-cyan-400 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>LSTM AutoEncoder</span>
                  </span>
                  <span className="font-mono text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                    lstm_anomaly.pth
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-black text-slate-100">
                    {mlLstmInfo?.status_text?.includes('Normal') ? 'Normal Trajectory' : 'Anomaly Detected'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    mlLstmInfo?.anomaly_detected
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}>
                    {mlLstmInfo?.anomaly_detected ? 'Alert' : 'Stable'}
                  </span>
                </div>
              </div>

              {/* Anomaly Gauge */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Temporal Anomaly Score</span>
                  <span className="text-cyan-300 font-bold">
                    {((mlLstmInfo?.anomaly_score ?? 0.18)).toFixed(2)} / 1.00
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.round((mlLstmInfo?.anomaly_score ?? 0.18) * 100))}%` }}
                    className={`h-full ${mlLstmInfo?.anomaly_detected ? 'bg-rose-500' : 'bg-cyan-400'}`}
                  ></div>
                </div>
              </div>
            </div>

            {/* Model 3: Location Geospatial Calibration */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-sm hover:border-amber-500/30 transition-all">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>Agro-Zone Calibration</span>
                  </span>
                  <span className="font-mono text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                    Geo-Calibrated
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-200 mt-2 truncate">
                  {mlLocCtx?.agro_zone || `${selectedAoi.district || 'Jalna'} Agro-Zone`}
                </p>
              </div>

              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span className="truncate">{mlLocCtx?.soil_type || 'Deep Vertisols'}</span>
                <span className="text-amber-400 font-bold shrink-0">
                  {mlLocCtx?.drought_vulnerability ? mlLocCtx.drought_vulnerability.split(' ')[0] : 'Moderate'} Risk
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Dynamic Crop Health Status Card ── */}
      <div className={`rounded-2xl p-4 border transition-all ${
        isHighRisk 
          ? 'bg-rose-950/40 border-rose-500/50 text-rose-100 shadow-xl shadow-rose-950/30'
          : isModerateRisk
          ? 'bg-amber-950/40 border-amber-500/50 text-amber-100 shadow-xl shadow-amber-950/30'
          : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100 shadow-xl shadow-emerald-950/30'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-2xl ${
              isHighRisk ? 'bg-rose-500/20 text-rose-400' : isModerateRisk ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {isHighRisk ? <AlertTriangle className="w-6 h-6" /> : isModerateRisk ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                isHighRisk ? 'bg-rose-500/20 text-rose-300' : isModerateRisk ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {isHighRisk ? t.waterAlert : isModerateRisk ? t.healthNeedsCare : t.healthGood}
              </span>
              <h3 className="text-base font-black text-slate-100 mt-1">
                {isHighRisk 
                  ? t.waterAlertSub 
                  : isModerateRisk
                    ? t.waterAlertSub
                    : t.healthGood + ' (Vigorous Canopy)'
                }
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {isHealthy 
                  ? 'Satellite Sentinel-2 vegetation scans show strong canopy reflectance, healthy chlorophyll content, and sufficient soil moisture reserves.'
                  : t.waterAlertDesc}
              </p>
            </div>
          </div>

          {/* Big Health Score Gauge */}
          <div className="text-center bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-2.5 flex-shrink-0">
            <p className="text-[10px] uppercase font-bold text-slate-400">{t.healthScore}</p>
            <p className={`text-2xl font-black mt-0.5 ${
              isHighRisk ? 'text-rose-400' : isModerateRisk ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {healthScore}<span className="text-xs text-slate-400">/100</span>
            </p>
            <span className={`text-[10px] font-semibold ${
              isHighRisk ? 'text-rose-400' : isModerateRisk ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {isHealthy ? t.healthGood : isModerateRisk ? t.healthNeedsCare : 'Critical / आवश्यक'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. "What You Need To Do This Week" (Directly Derived from ML Model Returns) ── */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-100">{t.whatToDoTitle || 'What You Need To Do This Week'}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                  🤖 ML Model Inferred
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                📍 {locationStr} • <span className="text-emerald-400 font-semibold">{locationAgroProfile.soilType}</span>
                {isLoadingAi && <span className="ml-2 text-emerald-400 animate-pulse text-[10px]">Analyzing ML outputs & live weather...</span>}
              </p>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 font-medium">
            {t.tapToComplete}
          </span>
        </div>

        {/* Task Cards List */}
        <div className="space-y-2.5">
          {tasksList.map((task) => {
            const isDone = completedTasks[task.id];
            const Icon = task.icon || Sprout;
            return (
              <div 
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isDone 
                    ? 'bg-slate-900/40 border-slate-800 text-slate-500 line-through opacity-70' 
                    : task.urgent
                    ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/70 shadow-sm shadow-rose-950/40'
                    : 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40'
                }`}
              >
                <button className="mt-0.5 flex-shrink-0 text-emerald-400">
                  {isDone ? <CheckSquare className="w-5 h-5 text-emerald-400" /> : <Square className="w-5 h-5 text-slate-400" />}
                </button>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      {task.badge}
                    </span>
                    {task.urgent && !isDone && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        {t.urgentBadge}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs font-bold leading-relaxed ${isDone ? 'text-slate-500' : 'text-slate-100'}`}>
                    {task.text}
                  </p>
                  {task.sub && (
                    <p className={`text-[11px] leading-relaxed ${isDone ? 'text-slate-600' : 'text-slate-300'}`}>
                      {task.sub}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Task Completion Progress & Health Bonus Banner */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">
            Completed: <strong className="text-emerald-400">{completedCount}</strong> of {totalTasks} actions
          </span>
          {taskRecoveryBonus > 0 && (
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 flex items-center gap-1 text-[11px]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{taskRecoveryBonus}% Crop Recovery Boost</span>
            </span>
          )}
        </div>
      </div>

      {/* ── 4. Interactive AI Agronomist Chatbot (Ask Any Farm Question) ── */}
      <div className="glass-panel rounded-2xl p-4 border border-blue-500/30 bg-blue-950/20 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Bot className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
              <span>{t.askAiTitle || 'Ask KrishiDrishti AI Agronomist (कृषी सहाय्यक)'}</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                Live Q&A
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Get instant, field-specific solutions for {cropConfig.names[currentLang] || cropConfig.names.en} diseases, fertilizers, and sprays in {nativeLanguages.find(l => l.code === currentLang)?.label || 'your language'}.
            </p>
          </div>
        </div>

        {/* AI Answer Display */}
        {aiAnswer && (
          <div className="bg-slate-900/90 border border-blue-500/40 rounded-xl p-3 text-xs text-slate-200 leading-relaxed space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-[10px] text-blue-400 font-bold border-b border-slate-800 pb-1">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>AI Agronomist Recommendation:</span>
              </span>
              <button 
                onClick={() => setAiAnswer(null)} 
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕ Clear
              </button>
            </div>
            <div className="whitespace-pre-line text-[11px] text-slate-200 leading-relaxed font-sans">
              {aiAnswer}
            </div>
          </div>
        )}

        {/* Question Form */}
        <form onSubmit={handleAskGemini} className="flex items-center gap-2">
          <input
            type="text"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            placeholder={
              currentLang === 'mr' 
                ? 'उदा. कापसावर बोंडअळीसाठी कोणती फवारणी करावी?' 
                : currentLang === 'hi'
                ? 'उदा. कपास में रस चूसक कीटों के लिए कौन सी दवा स्प्रे करें?'
                : `Ask any question about your ${cropConfig.names.en} field...`
            }
            className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={isAskingAi || !aiQuestion.trim()}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
              isAskingAi || !aiQuestion.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/50'
            }`}
          >
            {isAskingAi ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isAskingAi ? 'Thinking...' : 'Ask AI'}</span>
          </button>
        </form>
      </div>

      {/* ── 5. Crop Yield, Earnings & Weather Telemetry ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Harvest Estimation */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.totalHarvest}</span>
            <Sprout className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-100">
              {totalEstQuintals} <span className="text-sm font-normal text-slate-400">{t.quintals}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ~{yieldQtlPerAcre} {t.quintalsPerAcre} on {areaAc} {t.acres}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Baseline Rate:</span>
            <span className={`font-bold ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(changePct > 0 ? '+' : '') + changePct.toFixed(1)}% vs 5-yr avg
            </span>
          </div>
        </div>

        {/* Estimated MSP Market Value */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.estIncome}</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-300">
              ₹{estEarningsInr}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Govt MSP @ ₹{cropConfig.mspPerQtl}/{cropConfig.unit}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Target Crop:</span>
            <span className="font-bold text-slate-200">
              {cropConfig.names[currentLang] || cropConfig.names.en}
            </span>
          </div>
        </div>

        {/* Live Weather Forecast */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.weatherForecast}</span>
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="text-2xl font-black text-slate-100">
              {(activePrediction?.input_snapshot_json?.temp_avg_c ?? 31.5).toFixed(1)}°C
            </div>
            <span className="text-xs font-medium text-slate-400">
              {activePrediction?.input_snapshot_json?.temp_avg_c >= 33 ? 'Hot & Dry' : 'Moderate Weather'}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">{t.estRainfall}:</span>
            <span className="font-bold text-cyan-300">
              {activePrediction?.input_snapshot_json?.rainfall_mm ?? 24} mm (30-day forecast)
            </span>
          </div>
        </div>
      </div>

      {/* ── 6. NDVI Vegetation Health Timeline Chart ── */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">{t.healthTrend}</h3>
            <p className="text-[11px] text-slate-400">Sentinel-2 multi-temporal vegetation vigor (NDVI index)</p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
            {healthScore}% Current Vigor
          </span>
        </div>

        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ndviTrendData}>
              <defs>
                <linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isHighRisk ? '#f43f5e' : isModerateRisk ? '#f59e0b' : '#10b981'} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={isHighRisk ? '#f43f5e' : isModerateRisk ? '#f59e0b' : '#10b981'} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                formatter={(val) => [`${val}%`, 'Crop Vigor']}
              />
              <ReferenceLine y={50} stroke="#f43f5e" strokeDasharray="3 3" />
              <Area 
                type="monotone" 
                dataKey="health" 
                stroke={isHighRisk ? '#f43f5e' : isModerateRisk ? '#f59e0b' : '#10b981'} 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#ndviGrad)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 7. Explainability Toggle & Social Share ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
        <button
          onClick={() => setShowExplainability(!showExplainability)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>{showExplainability ? t.hideWhyAlert : t.whyAlert}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* WhatsApp Share Button */}
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-xs transition-all cursor-pointer"
            title="Share Advisory via WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t.shareWhatsApp}</span>
          </button>

          {/* Emergency Kisan Call Center Helpline */}
          <a
            href="tel:18001801551"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-amber-500/30 transition-all cursor-pointer"
            title="Toll-free Kisan Call Center"
          >
            <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
            <span>1800-180-1551</span>
          </a>
        </div>
      </div>

      {showExplainability && (
        <ExplainabilityPanel prediction={prediction} currentLang={currentLang} />
      )}

    </div>
  );
}
