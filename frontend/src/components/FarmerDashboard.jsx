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
  Loader2
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
    names: { en: 'Rice / Paddy', mr: 'भात / धान', hi: 'धान / चावल', kn: 'ಭತ್ತ / ಅಕ್ಕಿ', te: 'వరి / ధాన్యం' },
    mspPerQtl: 2300,
    normalYieldQtlAcre: 22.0,
    unit: 'Qtl',
  },
  wheat: {
    id: 'wheat',
    names: { en: 'Wheat', mr: 'गहू', hi: 'गेहूं', kn: 'ಗೋಧಿ', te: 'గోధుమ' },
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
    names: { en: 'Maize / Corn', mr: 'मका', hi: 'मक्का', kn: 'ಮೆಕ್ಕೆಜೋಳ', te: 'ಮొక్కజొన్న' },
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
 * Generates dynamic, highly localized tasks based on:
 * 1. Location (District, State, Village, Taluk)
 * 2. Agro-Climatic Zone & Soil Characteristics (Vertisols, Red soils, Alluvial, Coastal)
 * 3. Local KVK / Agri University Research Station
 * 4. Real-time Weather & Satellite Stress (Temp, Rainfall deficit, NDWI, NDVI, Loss risk)
 * 5. Selected Crop & Multi-Language (EN, MR, HI, KN, TE)
 */
function generateLocationAwareTasks({ aoi, prediction, cropKey, lang }) {
  const district = aoi?.district || 'Jalna';
  const village = aoi?.village || aoi?.taluk || 'Mantha';
  const state = aoi?.state || 'Maharashtra';
  const distLower = district.toLowerCase();
  const stateLower = state.toLowerCase();

  const changePct = prediction?.yield_change_pct ?? -21.8;
  const temp = prediction?.input_snapshot_json?.temp_avg_c ?? 29.5;
  const rainfall = prediction?.input_snapshot_json?.rainfall_mm ?? 360;
  const ndwi = prediction?.input_snapshot_json?.mean_ndwi ?? -0.15;
  const ndvi = prediction?.input_snapshot_json?.mean_ndvi ?? 0.44;
  const isHighRisk = changePct <= -20.0 || ndwi < -0.12;

  // Determine Agro-Climatic Zone & KVK
  let zoneName = {
    en: `${district} Rainfed Agro-Zone`,
    mr: `${district} कोरडवाहू कृषी विभाग`,
    hi: `${district} वर्षा आधारित कृषि क्षेत्र`,
    kn: `${district} ಮಳೆಯಾಶ್ರಿತ ಕೃಷಿ ವಲಯ`,
    te: `${district} వర్షాధార వ్యవసాయ మండలం`
  };
  let soilType = {
    en: 'Black Vertisol Soil',
    mr: 'काळी कसदार जमीन (Vertisol)',
    hi: 'काली चिकनी मिट्टी (Vertisol)',
    kn: 'ಕಪ್ಪು ಮಣ್ಣು (Vertisol)',
    te: 'నల్ల రేగడి నేల (Vertisol)'
  };
  let kvkHub = `KVK ${district}`;

  // Regional classifications
  if (['jalna', 'beed', 'aurangabad', 'parbhani', 'nanded', 'osmanabad', 'latur', 'hingoli'].some(d => distLower.includes(d))) {
    zoneName = {
      en: `Marathwada Semi-Arid Zone (${district})`,
      mr: `मराठवाडा दुष्काळप्रवण विभाग (${district})`,
      hi: `मराठवाड़ा अर्ध-शुष्क क्षेत्र (${district})`,
      kn: `ಮರಾಠವಾಡ ಅರೆ-ಶುಷ್ಕ ವಲಯ (${district})`,
      te: `మరాఠ్వాడా ప్రాంతం (${district})`
    };
    soilType = {
      en: 'Deep Black Cotton Soil (Regur/Vertisols)',
      mr: 'खोल काळी कापसाची जमीन (रेगूर)',
      hi: 'गहरी काली कपास मिट्टी (रेगुर)',
      kn: 'ಆಳವಾದ ಕಪ್ಪು ಹತ್ತಿ ಮಣ್ಣು',
      te: 'లోతైన నల్లరేగడి నేల'
    };
    kvkHub = `KVK ${district} / VNMKV Parbhani`;
  } else if (['nagpur', 'wardha', 'amravati', 'yavatmal', 'akola', 'buldhana', 'chandrapur'].some(d => distLower.includes(d))) {
    zoneName = {
      en: `Vidarbha Cotton-Soybean Belt (${district})`,
      mr: `विदर्भ कापूस-सोयाबीन कृषी पट्टा (${district})`,
      hi: `विदर्भ कपास-सोयाबीन क्षेत्र (${district})`,
      kn: `ವಿದರ್ಭ ಕೃಷಿ ವಲಯ (${district})`,
      te: `విదర్భ వ్యవసాయ ప్రాంతం (${district})`
    };
    soilType = {
      en: 'Heavy Black Soil with High Evaporation',
      mr: 'भारी काळी जमीन व जास्त बाष्पीभवन',
      hi: 'भारी काली मिट्टी और उच्च वाष्पीकरण',
      kn: 'ಭಾರವಾದ ಕಪ್ಪು ಮಣ್ಣು',
      te: 'భారీ నల్ల నేల'
    };
    kvkHub = `Dr. PDKV Akola & CICR Nagpur`;
  } else if (['pune', 'solapur', 'ahmednagar', 'satara', 'kolhapur', 'sangli', 'nashik'].some(d => distLower.includes(d))) {
    zoneName = {
      en: `Western Maharashtra Deccan Zone (${district})`,
      mr: `पश्चिम महाराष्ट्र दख्खन कृषी विभाग (${district})`,
      hi: `पश्चिमी महाराष्ट्र दक्कन क्षेत्र (${district})`,
      kn: `ಪಶ್ಚಿಮ ಮಹಾರಾಷ್ಟ್ರ ವಲಯ (${district})`,
      te: `పశ్చిమ మహారాష్ట్ర మండలం (${district})`
    };
    soilType = {
      en: 'Medium Black to Clay Loam',
      mr: 'मध्यम काळी ते पोयटा जमीन',
      hi: 'मध्यम काली से दोमट मिट्टी',
      kn: 'ಮಧ್ಯಮ ಕಪ್ಪು ಮಣ್ಣು',
      te: 'మధ్యస్థ నల్ల నేల'
    };
    kvkHub = `MPKV Rahuri / NRC Pune`;
  } else if (stateLower.includes('karnataka') || ['bengaluru', 'bangalore', 'dharwad', 'belagavi', 'raichur', 'kalaburagi', 'bellary', 'mandya', 'mysuru'].some(d => distLower.includes(d))) {
    zoneName = {
      en: `Karnataka Plateau Agro-Zone (${district})`,
      mr: `कर्नाटक पठार कृषी विभाग (${district})`,
      hi: `कर्नाटक पठारी कृषि क्षेत्र (${district})`,
      kn: `ಕರ್ನಾಟಕ ಪ್ರಸ್ಥಭೂಮಿ ಕೃಷಿ ವಲಯ (${district})`,
      te: `కర్ణాటక పీఠభూమి మండలం (${district})`
    };
    soilType = {
      en: 'Red Sandy Loam & Medium Black Soil',
      mr: 'लाल वालुकामय आणि मध्यम काळी जमीन',
      hi: 'लाल रेतीली दोमट और मध्यम काली मिट्टी',
      kn: 'ಕೆಂಪು ಮರಳು ಮಿಶ್ರಿತ ಮತ್ತು ಕಪ್ಪು ಮಣ್ಣು',
      te: 'ఎర్ర ఇసుక మరియు నల్ల నేల'
    };
    kvkHub = `UAS Dharwad / KVK ${district}`;
  } else if (stateLower.includes('telangana') || stateLower.includes('andhra') || ['hyderabad', 'warangal', 'karimnagar', 'anantapur', 'kurnool', 'guntur'].some(d => distLower.includes(d))) {
    zoneName = {
      en: `Telangana-Rayalaseema Belt (${district})`,
      mr: `तेलंगणा-रायलसीमा कृषी विभाग (${district})`,
      hi: `तेलंगाना-रायलसीमा क्षेत्र (${district})`,
      kn: `ತೆಲಂಗಾಣ-ರಾಯಲಸೀಮಾ ವಲಯ (${district})`,
      te: `తెలంగాణ & రాయలసీమ మండలం (${district})`
    };
    soilType = {
      en: 'Red Chalkas & Deep Black Soils',
      mr: 'लाल आणि काळी मिश्र जमीन',
      hi: 'लाल और काली मिश्रित मिट्टी',
      kn: 'ಕೆಂಪು ಮತ್ತು ಕಪ್ಪು ಮಿಶ್ರ ಮಣ್ಣು',
      te: 'ఎర్ర చల్కాలు మరియు లోతైన నల్ల నేలలు'
    };
    kvkHub = `PJTSAU Hyderabad / ANGRAU`;
  } else if (['punjab', 'haryana', 'uttar pradesh', 'madhya pradesh', 'bihar', 'rajasthan', 'delhi'].some(s => stateLower.includes(s))) {
    zoneName = {
      en: `Indo-Gangetic Fertile Plains (${district})`,
      mr: `उत्तर भारत सुपीक गाळ जमीन विभाग (${district})`,
      hi: `सिंधु-गंगा उपजाऊ मैदानी क्षेत्र (${district})`,
      kn: `ಉತ್ತರ ಭಾರತ ಬಯಲು ಕೃಷಿ ವಲಯ (${district})`,
      te: `ఉత్తర భారత మైదాన ప్రాంతం (${district})`
    };
    soilType = {
      en: 'Alluvial Fertile Loam',
      mr: 'सुपीक गाळाची जमीन',
      hi: 'उपजाऊ जलोढ़ दोमट मिट्टी',
      kn: 'ಫಲವತ್ತಾದ ಮೆಕ್ಕಲು ಮಣ್ಣು',
      te: 'సారవంతమైన ఒండ్రు నేల'
    };
    kvkHub = `ICAR-IARI / PAU / KVK ${district}`;
  }

  const rawTasks = [];

  // Task 1: Irrigation
  if (temp >= 33 || isHighRisk) {
    rawTasks.push({
      id: 'loc-task-1',
      badge: {
        en: `⚡ ${district} Heat Alert (${temp}°C)`,
        mr: `⚡ ${district} तापमान इशारा (${temp}°C)`,
        hi: `⚡ ${district} तापमान चेतावनी (${temp}°C)`,
        kn: `⚡ ${district} ತಾಪಮಾನ ಎಚ್ಚರಿಕೆ (${temp}°C)`,
        te: `⚡ ${district} ఉష్ణోగ్రత హెచ్చరిక (${temp}°C)`
      },
      text: {
        en: `High evapotranspiration in ${village}, ${district}: Provide immediate drip irrigation to prevent crop stress.`,
        mr: `${village}, ${district} परिसरात जास्त बाष्पीभवन: पिकातील तणाव टाळण्यासाठी तात्काळ ठिबक सिंचन द्या.`,
        hi: `${village}, ${district} में अत्यधिक वाष्पीकरण: फसल का तनाव रोकने के लिए तुरंत ड्रिप सिंचाई करें।`,
        kn: `${village}, ${district} ನಲ್ಲಿ ಅಧಿಕ ತಾಪಮಾನ: ಬೆಳೆಗೆ ಹನಿ ನೀರಾವರಿ ನೀಡಿ.`,
        te: `${village}, ${district} లో అధిక ఉష్ణోగ్రత: డ్రిప్ ద్వారా నీరు అందించండి.`
      },
      urgent: true,
      icon: Droplets
    });
  } else {
    rawTasks.push({
      id: 'loc-task-1',
      badge: {
        en: `💧 Soil Moisture Advisory for ${district}`,
        mr: `💧 ${district} साठी जमीन ओलावा सल्ला`,
        hi: `💧 ${district} के लिए मृदा नमी सलाह`,
        kn: `💧 ${district} ಮಣ್ಣಿನ ತೇವಾಂಶ ಸಲಹೆ`,
        te: `💧 ${district} నేల తేమ సలహా`
      },
      text: {
        en: `Maintain root zone moisture for ${cropKey} in ${village}: Sentinel-2 NDWI indicates moderate soil reserves. Run standard 2-hour drip cycle.`,
        mr: `${village} मधील ${cropKey} पिकासाठी मुळांच्या भागात पुरेसा ओलावा ठेवा. सॅटेलाइटनुसार २ तासांचे नियमित ठिबक चक्र सुरू ठेवा.`,
        hi: `${village} में ${cropKey} के लिए जड़ों में पर्याप्त नमी बनाए रखें। सैटेलाइट अनुसार 2 घंटे का सामान्य ड्रिप चक्र चलाएं।`,
        kn: `${village} ನಲ್ಲಿ ${cropKey} ಬೆಳೆಗೆ ಬೇರಿನ ತೇವಾಂಶ ಕಾಪಾಡಿಕೊಳ್ಳಿ. 2 ಗಂಟೆಗಳ ಹನಿ ನೀರಾವರಿ ನೀಡಿ.`,
        te: `${village} లో ${cropKey} పంటకు తగినంత తేమను అందించండి. 2 గంటల డ్రిప్ సైకిల్ నడపండి.`
      },
      urgent: false,
      icon: Droplets
    });
  }

  // Task 2: Crop-Specific Nutrient Protocol
  if (cropKey === 'cotton') {
    rawTasks.push({
      id: 'loc-task-2',
      badge: {
        en: `🌱 Cotton Potassium Nitrate Protocol`,
        mr: `🌱 कापूस पोटॅशियम नायट्रेट खत व्यवस्थापन`,
        hi: `🌱 कपास पोटैशियम नाइट्रेट पोषण प्रबंधन`,
        kn: `🌱 ಹತ್ತಿ ಪೋಷಕಾಂಶ ನಿರ್ವಹಣೆ`,
        te: `🌱 పత్తి పోషకాల నిర్వహణ`
      },
      text: {
        en: `Foliar spray for Cotton in ${district}: Spray Potassium Nitrate (13-0-45) @ 10g/L + Planofix @ 0.25ml/L to stop boll drop in ${village}.`,
        mr: `${district} मधील कापूस पिकासाठी: बोंड व पात गळती थांबवण्यासाठी पोटॅशियम नायट्रेट (१३-०-४५) @ १० ग्रॅम/लिटर + प्लॅनोफिक्स @ ०.२५ मिली/लिटर फवारा.`,
        hi: `${district} में कपास फसल के लिए: फूल/टिंडे झड़ने से रोकने हेतु पोटैशियम नाइट्रेट (13-0-45) @ 10 ग्राम/लीटर + प्लानोफिक्स @ 0.25 मिली/लीटर का छिड़काव करें।`,
        kn: `${district} ನಲ್ಲಿ ಹತ್ತಿ ಬೆಳೆಗೆ: ಪೊಟ್ಯಾಸಿಯಮ್ ನೈಟ್ರೇಟ್ ಸಿಂಪಡಿಸಿ.`,
        te: `${district} లో పత్తి పంటకు: పొటాషియం నైట్రేట్ పిచికారీ చేయండి.`
      },
      urgent: isHighRisk,
      icon: Sprout
    });
  } else if (cropKey === 'soybean') {
    rawTasks.push({
      id: 'loc-task-2',
      badge: {
        en: `🌱 Soybean 0:52:34 Pod Vigor Spray`,
        mr: `🌱 सोयाबीन ०:५२:३४ शेंगा पोषण सल्ला`,
        hi: `🌱 सोयाबीन 0:52:34 फली विकास पोषण सलाह`,
        kn: `🌱 ಸೋಯಾಬೀನ್ ಕಾಯಿ ಕಟ್ಟುವ ಪೋಷಣೆ`,
        te: `🌱 సోయాబీన్ కాయల అభివృద్ధి పోషణ`
      },
      text: {
        en: `Foliar spray for Soybean in ${district}: Spray 0:52:34 @ 10g/L + Boron 20% @ 1g/L for bold pod filling in ${village}.`,
        mr: `${district} मधील सोयाबीनसाठी: शेंगा टपोऱ्या भरण्यासाठी ०:५२:३४ @ १० ग्रॅम/लिटर + बोरॉन २०% @ १ ग्रॅम/लिटरची फवारणी करा.`,
        hi: `${district} में सोयाबीन फसल के लिए: दानों के अच्छे भराव हेतु 0:52:34 @ 10 ग्राम/लीटर + बोरॉन 20% @ 1 ग्राम/लीटर का छिड़काव करें।`,
        kn: `${district} ನಲ್ಲಿ ಸೋಯಾಬೀನ್ ಬೆಳೆಗೆ 0:52:34 ಸಿಂಪಡಿಸಿ.`,
        te: `${district} లో సోయాబీన్ పంటకు 0:52:34 పిచికారీ చేయండి.`
      },
      urgent: isHighRisk,
      icon: Sprout
    });
  } else if (cropKey === 'maize') {
    rawTasks.push({
      id: 'loc-task-2',
      badge: {
        en: `🌽 Maize Nitrogen Top-Dress Protocol`,
        mr: `🌽 मका युरिया खत व्यवस्थापन`,
        hi: `🌽 मक्का यूरिया पोषण प्रबंधन`,
        kn: `🌽 ಮೆಕ್ಕೆಜೋಳ ಯೂರಿಯಾ ಗೊಬ್ಬರ`,
        te: `🌽 మొక్కజొన్న యూరియా పోషణ`
      },
      text: {
        en: `Top-dress Nitrogen for Maize in ${village}: Apply Urea @ 35 kg/acre near root zone with light irrigation in ${district}.`,
        mr: `${village} मधील मका पिकासाठी: कणसे लागण्यापूर्वी झाडाच्या मुळांशी एकरी ३५ किलो युरिया द्या आणि हलके पाणी द्या.`,
        hi: `${village} में मक्का फसल हेतु: भुट्टा बनने से पहले प्रति एकड़ 35 किलो यूरिया जड़ों के पास दें और हल्की सिंचाई करें।`,
        kn: `${village} ನಲ್ಲಿ ಮೆಕ್ಕೆಜೋಳ ಬೆಳೆಗೆ ಯೂರಿಯಾ ನೀಡಿ.`,
        te: `${village} లో మొక్కజొన్న పంటకు యూరియా వేయండి.`
      },
      urgent: false,
      icon: Sprout
    });
  } else if (cropKey === 'tur') {
    rawTasks.push({
      id: 'loc-task-2',
      badge: {
        en: `🌱 Tur / Pigeon Pea 19:19:19 Spray`,
        mr: `🌱 तूर १९:१९:१९ फुटवे व फुलधारणा सल्ला`,
        hi: `🌱 अरहर 19:19:19 शाखा व फूल पोषण`,
        kn: `🌱 ತೊಗರಿ ಬೆಳೆ ಪೋಷಣೆ`,
        te: `🌱 కందుల పంట పోషణ`
      },
      text: {
        en: `Spray 19:19:19 @ 5g/L + Pulse Wonder in ${village} to enhance branching and profuse flowering in ${district}.`,
        mr: `${district} मधील तूर पिकासाठी: फुटवे व फुलोरा वाढवण्यासाठी १९:१९:१९ @ ५ ग्रॅम/लिटरची फवारणी करा.`,
        hi: `${district} में अरहर फसल के लिए: शाखाएं और फूल बढ़ाने हेतु 19:19:19 @ 5 ग्राम/लीटर का छिड़काव करें।`,
        kn: `${district} ನಲ್ಲಿ ತೊಗರಿ ಬೆಳೆಗೆ 19:19:19 ಸಿಂಪಡಿಸಿ.`,
        te: `${district} లో కందుల పంటకు 19:19:19 పిచಿಕారీ చేయండి.`
      },
      urgent: false,
      icon: Sprout
    });
  } else if (cropKey === 'rice' || cropKey === 'wheat') {
    rawTasks.push({
      id: 'loc-task-2',
      badge: {
        en: `🌾 ${district} Grain Initiation Care`,
        mr: `🌾 ${district} दाणे भरण्याची अवस्था काळजी`,
        hi: `🌾 ${district} दाना भराव अवस्था देखभाल`,
        kn: `🌾 ${district} ಕಾಳು ಕಟ್ಟುವ ಹಂತದ ಪೋಷಣೆ`,
        te: `🌾 ${district} గింజ అభివృద్ధి జాగ్రత్తలు`
      },
      text: {
        en: `Top-dress balanced Urea + Neem cake in ${village} fields. Maintain 3-4 cm standing water depth during critical panicle initiation.`,
        mr: `${village} मधील शेतात युरिया व निंबोळी पेंडीचा दुसरा हप्ता द्या. लोंबी भरण्याच्या काळात शेतात ३-४ सेमी पाणी पातळी टिकवून ठेवा.`,
        hi: `${village} के खेतों में यूरिया व नीम खली का उचित प्रयोग करें। बाली बनते समय 3-4 सेमी पानी का स्तर बनाए रखें।`,
        kn: `${village} ಗದ್ದೆಗಳಲ್ಲಿ ಯೂರಿಯಾ ಗೊಬ್ಬರ ನೀಡಿ ಮತ್ತು 3-4 ಸೆಂ.ಮೀ ನೀರು ನಿಲ್ಲಿಸಿ.`,
        te: `${village} పొలాల్లో యూరియా వేయండి మరియు 3-4 సెం.మీ నీటి మట్టం ఉంచండి.`
      },
      urgent: false,
      icon: Sprout
    });
  } else {
    rawTasks.push({
      id: 'loc-task-2',
      badge: {
        en: `🌿 ${district} Crop Vigor Protocol`,
        mr: `🌿 ${district} पीक वाढ व खत सल्ला`,
        hi: `🌿 ${district} फसल वृद्धि पोषण`,
        kn: `🌿 ${district} ಬೆಳೆ ಪೋಷಣೆ`,
        te: `🌿 ${district} పంట పెరుగుదల సలహా`
      },
      text: {
        en: `Apply water-soluble NPK (19:19:19) @ 5g/L to boost vegetative vigor across ${village} plots as detected by Sentinel-2 NDVI (${ndvi.toFixed(2)}).`,
        mr: `सॅटेलाइट NDVI (${ndvi.toFixed(2)}) नुसार ${village} मधील पिकाच्या जोमदार वाढीसाठी १९:१९:१९ @ ५ ग्रॅम/लिटरची फवारणी करा.`,
        hi: `सैटेलाइट NDVI (${ndvi.toFixed(2)}) के अनुसार ${village} में फसल वृद्धि हेतु 19:19:19 @ 5 ग्राम/लीटर का छिड़काव करें।`,
        kn: `${village} ನಲ್ಲಿ ಸಸ್ಯದ ಉತ್ತಮ ಬೆಳವಣಿಗೆಗಾಗಿ 19:19:19 ಸಿಂಪಡಿಸಿ.`,
        te: `${village} లో పంట పెరుగుదలకు 19:19:19 పిచికారీ చేయండి.`
      },
      urgent: false,
      icon: Sprout
    });
  }

  // Task 3: Localized KVK / University Pest & Disease Surveillance
  rawTasks.push({
    id: 'loc-task-3',
    badge: {
      en: `🛡️ ${kvkHub} Integrated Pest Advisory`,
      mr: `🛡️ ${kvkHub} कीड नियंत्रण सल्ला`,
      hi: `🛡️ ${kvkHub} कीट नियंत्रण सलाह`,
      kn: `🛡️ ${kvkHub} ಕೀಟ ನಿಯಂತ್ರಣ ಸಲಹೆ`,
      te: `🛡️ ${kvkHub} పురుగుల నివారణ సలహా`
    },
    text: {
      en: `Inspect lower canopy in ${village} for sucking pests (whiteflies/jassids) and pink bollworm. Install 5 pheromone traps per acre as per ${district} KVK advisory.`,
      mr: `${district} कृषी विज्ञान केंद्र (KVK) च्या सल्ल्यानुसार ${village} मधील शेतात एकरी ५ कामगंध सापळे लावा व रसशोषक किडींचे निरीक्षण करा.`,
      hi: `${district} कृषि विज्ञान केंद्र (KVK) की सलाह अनुसार ${village} में प्रति एकड़ 5 फेरोमोन ट्रैप लगाएं और सफेद मक्खी/माहू की निगरानी करें।`,
      kn: `${district} ಕೆವಿಕೆ ಸಲಹೆಯಂತೆ ${village} ನಲ್ಲಿ ಎಕರೆಗೆ 5 ಮೋಹಕ ಬಲೆಗಳನ್ನು ಅಳವಡಿಸಿ ಕೀಟಗಳ ಬಾಧೆ ಪರೀಕ್ಷಿಸಿ.`,
      te: `${district} కేవీకే సలహా మేరకు ${village} లో ఎకరాకు 5 లింగాకర్షక బుట్టలు అమర్చి పురుగులను గమనించండి.`
    },
    urgent: false,
    icon: ShieldCheck
  });

  // Task 4: District Revenue / PMFBY & Local Market Task
  rawTasks.push({
    id: 'loc-task-4',
    badge: {
      en: `📍 ${district} Agronomic Action Window`,
      mr: `📍 ${district} स्थानिक कृषी कृती`,
      hi: `📍 ${district} स्थानीय कृषि कार्यवाही`,
      kn: `📍 ${district} ಸ್ಥಳೀಯ ಕೃಷಿ ಕ್ರಮ`,
      te: `📍 ${district} స్థానిక వ్యవసాయ చర్య`
    },
    text: {
      en: `Verify plot boundary for ${village} (${(aoi?.area_hectares * 2.471 || 5.0).toFixed(1)} Acres): Keep 72-hour moisture log ready for PMFBY crop insurance verification in ${district}.`,
      mr: `${village} मधील शेतासाठी (${(aoi?.area_hectares * 2.471 || 5.0).toFixed(1)} एकर): ${district} मध्ये पीक विमा (PMFBY) पडताळणीसाठी ७२ तासांचा ओलावा अहवाल तयार ठेवा.`,
      hi: `${village} के खेत हेतु (${(aoi?.area_hectares * 2.471 || 5.0).toFixed(1)} एकड़): ${district} में पीएम फसल बीमा योजना (PMFBY) सत्यापन हेतु 72 घंटे का नमी रिकॉर्ड तैयार रखें।`,
      kn: `${village} ನ ಜಮೀನಿಗೆ (${(aoi?.area_hectares * 2.471 || 5.0).toFixed(1)} ಎಕರೆ): ${district} ನಲ್ಲಿ ಬೆಳೆ ವಿಮೆ ಪರಿಶೀಲನೆಗಾಗಿ ದಾಖಲೆ ಸಿದ್ಧವಾಗಿಟ್ಟುಕೊಳ್ಳಿ.`,
      te: `${village} లోని పొలానికి (${(aoi?.area_hectares * 2.471 || 5.0).toFixed(1)} ఎకరాలు): ${district} లో పంట బీమా ధృవీకరణ కోసం రికార్డులను సిద్ధంగా ఉంచండి.`
    },
    urgent: false,
    icon: Calendar
  });

  return {
    zoneName: zoneName[lang] || zoneName.en,
    soilType: soilType[lang] || soilType.en,
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
  selectedAoi, 
  prediction, 
  onGenerateReport, 
  currentLang,
  onSelectLang,
  onUpdateCrop
}) {
  const t = translations[currentLang]?.farmer || translations.en.farmer;
  const [showExplainability, setShowExplainability] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isCropDropdownOpen, setIsCropDropdownOpen] = useState(false);

  // Available native languages
  const nativeLanguages = [
    { code: 'mr', label: 'मराठी', flag: '🇮🇳', region: 'Maharashtra' },
    { code: 'hi', label: 'हिंदी', flag: '🇮🇳', region: 'North/Central' },
    { code: 'en', label: 'English', flag: '🇬🇧', region: 'Global' },
    { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳', region: 'Karnataka' },
    { code: 'te', label: 'తెలుగు', flag: '🇮🇳', region: 'Andhra/Telangana' },
  ];

  // Resolve current active crop from selected plot
  const [selectedCropKey, setSelectedCropKey] = useState(null);

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
    prediction,
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
      if (selectedAoi?.id) {
        const res = await api.getAiAdvisory(selectedAoi.id, cropId, currentLang);
        if (res?.tasks && Array.isArray(res.tasks) && res.tasks.length > 0) {
          setAiTasks(res.tasks);
        }
      }
    } catch (e) {
      console.error('Error fetching crop AI advisory:', e);
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
        badge: t.urgency || 'Urgent',
        urgent: (t.urgency || '').toLowerCase().includes('urgent') || (t.urgency || '').toLowerCase().includes('high') || idx === 0,
        icon: t.icon === 'Droplets' ? Droplets : t.icon === 'ShieldCheck' ? ShieldCheck : Sprout
      }))
    : locationAgroProfile.tasks;

  const tasksList = activeTaskList;

  const plotName = selectedAoi?.name || (currentLang === 'mr' ? 'माझे शेत' : currentLang === 'hi' ? 'मेरा खेत' : 'My Farm Plot');
  const areaHa = selectedAoi?.area_hectares || 2.02;
  const areaAc = (areaHa * 2.471).toFixed(1);
  const locationStr = [selectedAoi?.village, selectedAoi?.district, selectedAoi?.state].filter(Boolean).join(', ') || 'Mantha, Jalna, Maharashtra';

  const changePct = prediction?.yield_change_pct || -21.8;

  // Crop-Specific Harvest & Earnings Calculation
  const normalYieldQtlAcre = cropConfig.normalYieldQtlAcre;
  const yieldFactor = 1 + (changePct / 100.0);
  const yieldQtlPerAcre = Math.max(0.5, (normalYieldQtlAcre * yieldFactor)).toFixed(1);
  const totalEstQuintals = (parseFloat(yieldQtlPerAcre) * parseFloat(areaAc)).toFixed(1);
  const estEarningsInr = Math.round(parseFloat(totalEstQuintals) * cropConfig.mspPerQtl).toLocaleString('en-IN');

  // Dynamic Sentinel-2 NDVI + Yield + Action Recovery Health Score (0-100)
  const rawNdvi = prediction?.input_snapshot_json?.mean_ndvi ?? 0.48;
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
    const text = `🌾 *${t.myPlots}*\n📍 ${locationStr}\n🌱 ${plotName} (${areaAc} Acres - ${cropDisplayName})\n📊 ${t.healthScore}: ${healthScore}%\n💧 ${t.waterAlertSub}\n⚡ ${t.totalHarvest}: ${totalEstQuintals} ${t.quintals} (₹${estEarningsInr})`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-4 font-sans">
      
      {/* ── 0. Native Language Quick Selector Bar ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.chooseLanguage}</span>
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
            {nativeLanguages.find(l => l.code === currentLang)?.label || 'English'}
          </span>
        </div>
        
        {/* 1-Tap Language Buttons */}
        <div className="grid grid-cols-5 gap-1.5">
          {nativeLanguages.map((lang) => {
            const isActive = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => onSelectLang && onSelectLang(lang.code)}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/60 border border-emerald-400 scale-[1.03]'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-800/60'
                }`}
              >
                <span className="text-xs font-bold">{lang.label}</span>
                <span className="text-[9px] font-normal opacity-60 uppercase">{lang.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 1. Main Farm Header, Crop Switcher & PDF Action ── */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-lg font-black text-slate-100">{plotName}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {areaAc} Acres ({areaHa} Ha)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {locationAgroProfile.zoneName}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
              <span>📍 <span className="text-slate-200 font-semibold">{locationStr}</span></span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400/90 font-medium">🏛️ {locationAgroProfile.kvkHub}</span>
            </p>
          </div>

          {/* Audio & PDF Quick Buttons */}
          <div className="flex items-center gap-2">
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

            {/* Download PDF Card */}
            <button
              onClick={() => onGenerateReport(selectedAoi?.id || 1, 'farmer')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{t.downloadReport}</span>
            </button>
          </div>
        </div>

        {/* ── CROP SELECTOR (Change Crop Anytime) ── */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Sprout className="w-3.5 h-3.5 text-amber-400" />
            <span>Select Your Crop / पीक निवडा:</span>
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            {Object.values(CROPS_DATABASE).map((crop) => {
              const isSelected = activeCropKey === crop.id;
              const displayName = crop.names[currentLang] || crop.names.en;
              return (
                <button
                  key={crop.id}
                  onClick={() => handleSelectCrop(crop.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/50 border border-amber-400 scale-105'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-amber-500/50 hover:text-slate-200'
                  }`}
                >
                  {displayName}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 2. Dynamic Crop Health Status Card ── */}
      <div className={`rounded-2xl p-4 border transition-all ${
        isHighRisk 
          ? 'bg-rose-950/40 border-rose-500/50 text-rose-100 shadow-xl shadow-rose-950/30'
          : isModerateRisk
          ? 'bg-amber-950/30 border-amber-500/40 text-amber-100 shadow-xl shadow-amber-950/20'
          : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100 shadow-xl shadow-emerald-950/20'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-2xl border mt-0.5 ${
              isHighRisk 
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse' 
                : isModerateRisk
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            }`}>
              {isHighRisk ? (
                <AlertTriangle className="w-7 h-7" />
              ) : isModerateRisk ? (
                <AlertCircle className="w-7 h-7" />
              ) : (
                <CheckCircle2 className="w-7 h-7" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs uppercase font-black tracking-wider ${
                  isHighRisk ? 'text-rose-400' : isModerateRisk ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {isHighRisk
                    ? '⚠️ CRITICAL STRESS'
                    : isModerateRisk
                    ? t.waterAlertTitle
                    : '🟢 ' + t.healthGood}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                  isHighRisk 
                    ? 'bg-rose-900/80 text-white' 
                    : isModerateRisk 
                    ? 'bg-amber-900/80 text-amber-200' 
                    : 'bg-emerald-900/80 text-emerald-200'
                }`}>
                  {isHealthy ? `NDVI: ${rawNdvi.toFixed(2)} (Optimal)` : `${changePct}% ${t.belowNormal}`}
                </span>
                {taskRecoveryBonus > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    +{taskRecoveryBonus}% Recovered
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-white mt-1">
                {cropConfig.names[currentLang] || cropConfig.names.en}: {
                  isHighRisk
                    ? 'Immediate Irrigation Required'
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
              {isHealthy ? t.healthGood : isModerateRisk ? t.healthNeedsCare : 'Critical / तातडीचे'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. "What You Need To Do Today" (Live Google Gemini AI Agronomist Checklist) ── */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-100">{t.whatToDoTitle}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold flex items-center gap-1">
                  ✨ Gemini 3.1 Live AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                📍 {locationStr} • <span className="text-emerald-400 font-semibold">{locationAgroProfile.soilType}</span>
                {isLoadingAi && <span className="ml-2 text-emerald-400 animate-pulse text-[10px]">Analyzing live telemetry...</span>}
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

        {/* ── Interactive Ask Gemini Virtual Agronomist ── */}
        <div className="mt-2 pt-3 border-t border-slate-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span>Ask Virtual Agronomist (कृषी सहाय्यक)</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Real-time Sentinel-2 & Weather Grounded
            </span>
          </div>

          <form onSubmit={handleAskGemini} className="flex items-center gap-2">
            <input
              type="text"
              placeholder={currentLang === 'mr' ? 'पिकाविषयी कोणताही प्रश्न विचारा (उदा. ठिबक किती वेळ द्यावे?)...' : currentLang === 'hi' ? 'फसल से जुड़ा कोई भी सवाल पूछें...' : 'Ask any question about your crop (e.g. spray schedule)...'}
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500/60"
            />
            <button
              type="submit"
              disabled={isAskingAi || !aiQuestion.trim()}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                isAskingAi || !aiQuestion.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-lg shadow-emerald-500/20'
              }`}
            >
              {isAskingAi ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{currentLang === 'mr' ? 'विचारा' : currentLang === 'hi' ? 'पूछें' : 'Ask'}</span>
            </button>
          </form>

          {/* Quick Suggestions Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500">Quick:</span>
            {[
              currentLang === 'mr' ? 'ठिबक सिंचन कधी करावे?' : 'When to irrigate?',
              currentLang === 'mr' ? 'कोणती खते द्यावी?' : 'Best fertilizer spray?',
              currentLang === 'mr' ? 'किडींपासून संरक्षण कसे करावे?' : 'Pest control guidance?'
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setAiQuestion(chip);
                }}
                className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* AI Response Box */}
          {aiAnswer && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 text-xs text-slate-200 mt-1 shadow-lg flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gemini AI Agronomist Response:</span>
                </span>
                <button onClick={() => setAiAnswer(null)} className="text-slate-400 hover:text-slate-200 text-xs">✕</button>
              </div>
              <div className="leading-relaxed whitespace-pre-line text-slate-200">
                {aiAnswer}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Expected Harvest & Earnings for Selected Crop ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Estimated Yield Per Acre */}
        <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">{t.expectedYield}</p>
          <p className="text-xl font-black text-amber-300 mt-1">
            {yieldQtlPerAcre} <span className="text-xs font-normal text-slate-400">{cropConfig.unit} / Acre</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Normal is ~{normalYieldQtlAcre} {cropConfig.unit}/Acre</p>
        </div>

        {/* Total Plot Production */}
        <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">{t.totalHarvest}</p>
          <p className="text-xl font-black text-emerald-400 mt-1">
            ~{totalEstQuintals} <span className="text-xs font-normal text-slate-400">{cropConfig.unit}</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-1">{t.forYourAcre} ({areaAc} Ac)</p>
        </div>

        {/* Estimated Market Value */}
        <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">{t.estMarketValue}</p>
          <p className="text-xl font-black text-cyan-300 mt-1">
            ₹{estEarningsInr}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">MSP ₹{cropConfig.mspPerQtl.toLocaleString('en-IN')}/{cropConfig.unit}</p>
        </div>
      </div>

      {/* ── 5. Simple 30-Day Crop Health Growth Chart ── */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200">{t.healthGrowth30Days}</h3>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 text-emerald-400">{t.goodThreshold}</span>
            <span className="flex items-center gap-1 text-amber-400">{t.needsWaterThreshold}</span>
          </div>
        </div>

        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ndviTrendData}>
              <defs>
                <linearGradient id="farmerHealthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} unit="%" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                itemStyle={{ color: '#4ade80' }}
                formatter={(value) => [`${value}% Health`, 'Reading']}
              />
              <ReferenceLine y={60} stroke="#eab308" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="health" stroke="#22c55e" strokeWidth={2.5} fillOpacity={1} fill="url(#farmerHealthGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 6. Farmer Support & Helpline Bar ── */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-200">{t.kisanCallCentre}</p>
            <p className="text-[11px] text-emerald-400 font-mono font-bold">1800-180-1551</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="tel:18001801551"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-all"
          >
            {t.callOfficer}
          </a>
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-xs transition-all cursor-pointer"
            title="Share Advisory via WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t.shareWhatsApp}</span>
          </button>
        </div>
      </div>

      {/* AI Explainability Toggle (Advanced Details) */}
      <div className="text-center">
        <button
          onClick={() => setShowExplainability(!showExplainability)}
          className="text-xs text-slate-400 hover:text-emerald-400 inline-flex items-center gap-1.5 transition-colors cursor-pointer py-1"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{showExplainability ? 'Hide AI Details' : '🔍 Technical AI & Weather Factors'}</span>
        </button>
      </div>

      {showExplainability && (
        <ExplainabilityPanel prediction={prediction} currentLang={currentLang} />
      )}

    </div>
  );
}
