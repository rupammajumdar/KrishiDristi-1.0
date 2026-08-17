/**
 * KrishiDrishti AI — Multi-Language i18n Localization Dictionary
 * Supports English (en), Hindi (hi), Kannada (kn), Telugu (te), and Marathi (mr).
 */

export const translations = {
  en: {
    appTitle: "KrishiDrishti AI",
    subTitle: "Geospatial Satellite & ML Intelligence Platform",
    personas: {
      farmer: "Farmer View",
      government: "Government Officer",
      insurer: "Insurer Claims",
      admin: "Admin Ops Console"
    },
    nav: {
      aoiDraw: "Draw Farm Boundary",
      layerToggle: "Satellite Layers",
      timeSlider: "Temporal Scrubbing",
      districtRollup: "District Overview",
      alerts: "Early Warning Feed",
      downloadReport: "Download PDF Report",
      splitCompare: "Side-by-Side Compare"
    },
    farmer: {
      chooseLanguage: "Choose Language / भाषा निवडा",
      myPlots: "Registered Farm Plot",
      healthScore: "Health Score",
      healthNeedsCare: "Needs Care",
      healthGood: "Healthy Crop",
      waterAlertTitle: "⚠️ WATER STRESS ALERT",
      waterAlertSub: "Crop Needs Water in 48 Hours",
      waterAlertDesc: "Satellite scans show dry soil around this plot. Providing moisture now will protect flowering and stop boll dropping.",
      whatToDoTitle: "⚡ What You Need To Do This Week",
      tapToComplete: "Tap to mark complete",
      task1: "Give drip irrigation within 48 hours to prevent boll drop",
      task2: "Spray Potassium Nitrate (13-0-45) @ 10g/liter for plant strength",
      task3: "Check for whitefly / sucking pest under leaf canopy this week",
      urgentBadge: "Urgent",
      expectedYield: "Expected Yield",
      qtlPerAcre: "Qtl / Acre",
      normalIs: "Normal is ~8.9 Qtl/Acre",
      totalHarvest: "Total Harvest",
      quintals: "Quintals",
      forYourAcre: "For your plot area",
      estMarketValue: "Est. Market Value",
      basedOnMsp: "Based on MSP ₹7,200/Qtl",
      healthGrowth30Days: "Crop Health Growth (Past 30 Days)",
      goodThreshold: "🟢 Good (>70%)",
      needsWaterThreshold: "🟡 Needs Water",
      kisanCallCentre: "Kisan Call Centre (Toll-Free)",
      callOfficer: "Call Officer",
      shareWhatsApp: "WhatsApp",
      listenAudio: "🔊 Listen",
      stopAudio: "Stop Audio",
      downloadReport: "Download Report",
      belowNormal: "Below Normal",
      voiceMessage: "Namaste Farmer brother. For your farm plot. Your crop health score is {score} percent. Action required: Please give drip irrigation within forty-eight hours to protect your crop and avoid yield loss. Expected harvest is {yield} quintals per acre."
    },
    government: {
      districtSummary: "District Drought & Water Monitoring",
      monitoredPlots: "Total Monitored Plots",
      waterDepletion: "Reservoir Surface Area",
      stressBreakdown: "Plot Health Breakdown",
      talukDrilldown: "Taluk & Village Drill-down",
      exportEvidence: "Export Official Drought Report"
    },
    insurer: {
      claimVerification: "Insurance Claim Audit Trail",
      historicalTimeSeries: "Satellite Time-Series Log",
      modelProvenance: "ML Model Provenance",
      inputSnapshot: "Input Feature Snapshot (JSON)",
      earlyWarningCheck: "Early Warning Cooldown Check"
    },
    admin: {
      pipelineHealth: "Ingestion Pipeline Health",
      queueDepth: "Celery Queue Depth",
      failedTasks: "Failed Job Alerts",
      modelRegistry: "ML Model Registry",
      rollbackButton: "1-Click Rollback Version"
    }
  },

  mr: {
    appTitle: "कृषिदृष्टी AI",
    subTitle: "उपग्रह आणि AI शेती सल्लागार प्लॅटफॉर्म",
    personas: {
      farmer: "शेतकरी दृश्य",
      government: "शासकीय अधिकारी",
      insurer: "विमा दावा पथक",
      admin: "ॲडमिन कन्सोल"
    },
    nav: {
      aoiDraw: "शेताची हद्द आखा",
      layerToggle: "सॅटेलाइट लेयर्स",
      timeSlider: "वेळ स्लायडर",
      districtRollup: "जिल्हा आढावा",
      alerts: "पूर्वसूचना फीड",
      downloadReport: "अहवाल डाउनलोड करा",
      splitCompare: "तुलना मोड"
    },
    farmer: {
      chooseLanguage: "भाषा निवडा / Choose Language",
      myPlots: "नोंदणीकृत शेतजमीन",
      healthScore: "आरोग्य स्कोअर",
      healthNeedsCare: "काळजी आवश्यक",
      healthGood: "उत्कृष्ट पीक",
      waterAlertTitle: "⚠️ पाणी टंचाई पूर्वसूचना",
      waterAlertSub: "पिकाला ४८ तासांत पाण्याची तातडीची गरज",
      waterAlertDesc: "सॅटेलाइट स्कॅननुसार शेतातील जमिनीत ओलावा कमी आहे. आता पाणी दिल्यास बोंड गळती थांबेल आणि उत्पादनाचे नुकसान टळेल.",
      whatToDoTitle: "⚡ या आठवड्यात काय करावे (कृती सूची)",
      tapToComplete: "पूर्ण झाल्यावर टिक करा",
      task1: "बोंड गळती रोखण्यासाठी ४८ तासांत ठिबक सिंचनाने पाणी द्या",
      task2: "पिकाच्या मजबुतीसाठी पोटॅशियम नायट्रेट (१३-०-४५) @ १० ग्रॅम/लिटर फवारा",
      task3: "या आठवड्यात पानांखाली पांढरी माशी किंवा रसशोषक किडी तपासा",
      urgentBadge: "तातडीचे",
      expectedYield: "अपेक्षित उत्पादन",
      qtlPerAcre: "क्विंटल / एकर",
      normalIs: "नेहमीचे उत्पादन ~८.९ क्विंटल/एकर",
      totalHarvest: "एकूण उत्पादन",
      quintals: "क्विंटल",
      forYourAcre: "तुमच्या शेत क्षेत्रासाठी",
      estMarketValue: "अंदाजे बाजार मूल्य",
      basedOnMsp: "हमीभाव ₹७,२००/क्विंटल नुसार",
      healthGrowth30Days: "पीक आरोग्य वाढ (मागील ३० दिवस)",
      goodThreshold: "🟢 चांगले (>७०%)",
      needsWaterThreshold: "🟡 पाणी आवश्यक",
      kisanCallCentre: "किसान कॉल सेंटर (टोल-फ्री)",
      callOfficer: "अधिकाऱ्यांना कॉल करा",
      shareWhatsApp: "व्हॉट्सॲप",
      listenAudio: "🔊 ऑडिओ ऐका",
      stopAudio: "ऑडिओ थांबवा",
      downloadReport: "अहवाल डाउनलोड",
      belowNormal: "सरासरीपेक्षा कमी",
      voiceMessage: "नमस्कार शेतकरी बंधू. तुमच्या शेताचा आरोग्य स्कोअर {score} टक्के आहे. तातडीचा सल्ला: बोंड गळती थांबवण्यासाठी पुढील ४८ तासांत पिकाला पाणी द्या. अपेक्षित उत्पादन {yield} क्विंटल प्रति एकर आहे."
    },
    government: {
      districtSummary: "जिल्हा दुष्काळ व पाणी देखरेख",
      monitoredPlots: "एकूण देखरेख शेतजमीन",
      waterDepletion: "जलाशय पृष्ठभाग क्षेत्रफळ",
      stressBreakdown: "आरोग्य विभागणी",
      talukDrilldown: "तालुका व गाव तपशील",
      exportEvidence: "दुष्काळ अहवाल निर्यात"
    },
    insurer: {
      claimVerification: "विमा दावा पडताळणी",
      historicalTimeSeries: "ऐतिहासिक उपग्रह डेटा",
      modelProvenance: "मॉडेल आवृत्ती तपशील",
      inputSnapshot: "इनपुट स्नॅपशॉट",
      earlyWarningCheck: "सूचना पडताळणी"
    },
    admin: {
      pipelineHealth: "पायपलाईन आरोग्य",
      queueDepth: "क्यू क्षमता",
      failedTasks: "अपयशी टास्क",
      modelRegistry: "ML मॉडेल नोंदणी",
      rollbackButton: "१-क्लिक रोलबॅक"
    }
  },

  hi: {
    appTitle: "कृषिदृष्टि AI",
    subTitle: "भू-स्थानिक उपग्रह और AI किसान सलाहकार प्लेटफॉर्म",
    personas: {
      farmer: "किसान दृश्य",
      government: "सरकारी अधिकारी",
      insurer: "बीमा दावा दल",
      admin: "एडमिन कंसोल"
    },
    nav: {
      aoiDraw: "खेत की सीमा बनाएं",
      layerToggle: "उपग्रह परतें",
      timeSlider: "समय स्लाइडर",
      districtRollup: "जिला अवलोकन",
      alerts: "प्रारंभिक चेतावनी फीड",
      downloadReport: "रिपोर्ट डाउनलोड करें",
      splitCompare: "तुलना मोड"
    },
    farmer: {
      chooseLanguage: "भाषा चुनें / Choose Language",
      myPlots: "पंजीकृत खेत",
      healthScore: "स्वास्थ्य स्कोर",
      healthNeedsCare: "देखभाल आवश्यक",
      healthGood: "स्वस्थ फसल",
      waterAlertTitle: "⚠️ पानी की कमी की चेतावनी",
      waterAlertSub: "फसल को 48 घंटों में पानी की सख्त जरूरत है",
      waterAlertDesc: "सैटेलाइट स्कैन से पता चला है कि खेत की मिट्टी में नमी कम है। अभी पानी देने से फूल और टिंडे गिरने से बचेंगे।",
      whatToDoTitle: "⚡ इस सप्ताह आपको क्या करना है (कार्य सूची)",
      tapToComplete: "पूरा होने पर टिक करें",
      task1: "टिंडे गिरने से रोकने के लिए 48 घंटों के भीतर ड्रिप सिंचाई करें",
      task2: "फसल की मजबूती के लिए पोटैशियम नाइट्रेट (13-0-45) @ 10 ग्राम/लीटर का छिड़काव करें",
      task3: "इस सप्ताह पत्तियों के नीचे सफेद मक्खी या रस चूसक कीटों की जांच करें",
      urgentBadge: "अति आवश्यक",
      expectedYield: "अनुमानित उपज",
      qtlPerAcre: "क्विंटल / एकड़",
      normalIs: "सामान्य उत्पादन ~8.9 क्विंटल/एकड़",
      totalHarvest: "कुल उत्पादन",
      quintals: "क्विंटल",
      forYourAcre: "आपके खेत के रकबे के लिए",
      estMarketValue: "अनुमानित बाजार मूल्य",
      basedOnMsp: "न्यूनतम समर्थन मूल्य ₹7,200/क्विंटल पर",
      healthGrowth30Days: "फसल स्वास्थ्य वृद्धि (पिछले 30 दिन)",
      goodThreshold: "🟢 अच्छा (>70%)",
      needsWaterThreshold: "🟡 पानी की जरूरत",
      kisanCallCentre: "किसान कॉल सेंटर (टोल-फ्री)",
      callOfficer: "अधिकारी को कॉल करें",
      shareWhatsApp: "व्हाट्सएप",
      listenAudio: "🔊 ऑडियो सुनें",
      stopAudio: "ऑडियो रोकें",
      downloadReport: "रिपोर्ट डाउनलोड",
      belowNormal: "सामान्य से कम",
      voiceMessage: "नमस्ते किसान भाई। आपके खेत का स्वास्थ्य स्कोर {score} प्रतिशत है। जरूरी सलाह: टिंडे गिरने से बचाने के लिए अगले 48 घंटों में ड्रिप सिंचाई जरूर करें। अनुमानित उपज {yield} क्विंटल प्रति एकड़ है।"
    },
    government: {
      districtSummary: "जिला सूखा एवं जल निगरानी",
      monitoredPlots: "कुल निगरानी वाले खेत",
      waterDepletion: "जलाशय सतह क्षेत्रफल",
      stressBreakdown: "फसल तनाव विभाजन",
      talukDrilldown: "तालुका एवं गांव विवरण",
      exportEvidence: "आधिकारिक सूखा रिपोर्ट निर्यात करें"
    },
    insurer: {
      claimVerification: "बीमा दावा ऑडिट ट्रेल",
      historicalTimeSeries: "ऐतिहासिक उपग्रह डेटा",
      modelProvenance: "ML मॉडल संस्करण विवरण",
      inputSnapshot: "इनपुट विशेषता स्नैपशॉट",
      earlyWarningCheck: "चेतावनी सत्यापन"
    },
    admin: {
      pipelineHealth: "पाइपलाइन स्वास्थ्य",
      queueDepth: "क्यू गहराई",
      failedTasks: "विफल कार्य अलर्ट",
      modelRegistry: "ML मॉडल रजिस्ट्री",
      rollbackButton: "1-क्लिक रोलबैक संस्करण"
    }
  },

  kn: {
    appTitle: "ಕೃಷಿದೃಷ್ಟಿ AI",
    subTitle: "ಉಪಗ್ರಹ ಮತ್ತು ಎಂಎಲ್ ಕೃಷಿ ವೇದಿಕೆ",
    personas: {
      farmer: "ರೈತರ ನೋಟ",
      government: "ಸರ್ಕಾರಿ ಅಧಿಕಾರಿ",
      insurer: "ವಿಮೆ ಕ್ಲೈಮ್‌ಗಳು",
      admin: "ಅಡ್ಮಿನ್ ಕನ್ಸೋಲ್"
    },
    nav: {
      aoiDraw: "ಜಮೀನಿನ ಗಡಿ ಗುರುತಿಸಿ",
      layerToggle: "ಉಪಗ್ರಹ ಪದರಗಳು",
      timeSlider: "ಸಮಯ ಸ್ಲೈಡರ್",
      districtRollup: "ಜಿಲ್ಲಾ ಸಾರಾಂಶ",
      alerts: "ಮುನ್ನೆಚ್ಚರಿಕೆ",
      downloadReport: "ವರದಿ ಡೌನ್‌ಲೋಡ್",
      splitCompare: "ಹೋಲಿಕೆ ಮೋಡ್"
    },
    farmer: {
      chooseLanguage: "ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ / Choose Language",
      myPlots: "ನೋಂದಾಯಿತ ಜಮೀನು",
      healthScore: "ಆರೋಗ್ಯ ಸ್ಕೋರ್",
      healthNeedsCare: "ಕಾಳಜಿ ಅಗತ್ಯವಿದೆ",
      healthGood: "ಉತ್ತಮ ಬೆಳೆ",
      waterAlertTitle: "⚠️ ನೀರಿನ ಕೊರತೆ ಎಚ್ಚರಿಕೆ",
      waterAlertSub: "48 ಗಂಟೆಗಳಲ್ಲಿ ಬೆಳೆಗೆ ನೀರುಣಿಸಿ",
      waterAlertDesc: "ಉಪಗ್ರಹ ಸ್ಕ್ಯಾನ್ ಮಣ್ಣಿನಲ್ಲಿ ತೇವಾಂಶ ಕಡಿಮೆಯಿರುವುದನ್ನು ತೋರಿಸುತ್ತದೆ. ನೀರುಣಿಸುವುದರಿಂದ ಬೆಳೆ ಹಾನಿ ತಡೆಯಬಹುದು.",
      whatToDoTitle: "⚡ ಈ ವಾರ ನೀವು ಮಾಡಬೇಕಾದ ಕೆಲಸಗಳು",
      tapToComplete: "ಪೂರ್ಣಗೊಂಡ ನಂತರ ಟಿಕ್ ಮಾಡಿ",
      task1: "ಹೂವು ಉದುರುವುದನ್ನು ತಡೆಯಲು 48 ಗಂಟೆಗಳಲ್ಲಿ ಹನಿ ನೀರಾವರಿ ನೀಡಿ",
      task2: "ಬೆಳೆಯ ಬಲವರ್ಧನೆಗಾಗಿ ಪೊಟ್ಯಾಸಿಯಮ್ ನೈಟ್ರೇಟ್ ಸಿಂಪಡಿಸಿ",
      task3: "ಈ ವಾರ ಎಲೆಗಳ ಕೆಳಗೆ ಕೀಟಗಳ ಬಾಧೆಯನ್ನು ಪರಿಶೀಲಿಸಿ",
      urgentBadge: "ತುರ್ತು",
      expectedYield: "ನಿರೀಕ್ಷಿತ ಇಳುವರಿ",
      qtlPerAcre: "ಕ್ವಿಂಟಾಲ್ / ಎಕರೆ",
      normalIs: "ಸಾಮಾನ್ಯ ಇಳುವರಿ ~8.9 ಕ್ವಿಂಟಾಲ್/ಎಕರೆ",
      totalHarvest: "ಒಟ್ಟು ಇಳುವರಿ",
      quintals: "ಕ್ವಿಂಟಾಲ್",
      forYourAcre: "ನಿಮ್ಮ ಜಮೀನಿನ ವಿಸ್ತೀರ್ಣಕ್ಕೆ",
      estMarketValue: "ಅಂದಾಜು ಮಾರುಕಟ್ಟೆ ಮೌಲ್ಯ",
      basedOnMsp: "ಎಂಎಸ್‌ಪಿ ₹7,200/ಕ್ವಿಂಟಾಲ್ ಆಧಾರಿತ",
      healthGrowth30Days: "ಬೆಳೆ ಆರೋಗ್ಯ ಬೆಳವಣಿಗೆ (ಕಳೆದ 30 ದಿನಗಳು)",
      goodThreshold: "🟢 ಉತ್ತಮ (>70%)",
      needsWaterThreshold: "🟡 ನೀರಿನ ಅಗತ್ಯವಿದೆ",
      kisanCallCentre: "ಕಿಸಾನ್ ಕಾಲ್ ಸೆಂಟರ್ (ಉಚಿತ)",
      callOfficer: "ಅಧಿಕಾರಿಗೆ ಕರೆ ಮಾಡಿ",
      shareWhatsApp: "ವಾಟ್ಸಾಪ್",
      listenAudio: "🔊 ಆಡಿಯೋ ಆಲಿಸಿ",
      stopAudio: "ನಿಲ್ಲಿಸಿ",
      downloadReport: "ವರದಿ ಡೌನ್‌ಲೋಡ್",
      belowNormal: "ಸಾಮಾನ್ಯಕ್ಕಿಂತ ಕಡಿಮೆ",
      voiceMessage: "ನಮಸ್ಕಾರ ರೈತ ಮಿತ್ರರೇ. ನಿಮ್ಮ ಜಮೀನಿನ ಆರೋಗ್ಯ ಸ್ಕೋರ್ {score} ಶೇಕಡಾ ಆಗಿದೆ. ತುರ್ತು ಸಲಹೆ: ಬೆಳೆ ರಕ್ಷಣೆಗೆ ಮುಂದಿನ 48 ಗಂಟೆಗಳಲ್ಲಿ ನೀರುಣಿಸಿ. ನಿರೀಕ್ಷಿತ ಇಳುವರಿ ಎಕರೆಗೆ {yield} ಕ್ವಿಂಟಾಲ್ ಆಗಿದೆ."
    },
    government: {
      districtSummary: "ಜಿಲ್ಲಾ ಬರ ಮತ್ತು ನೀರು ಮೇಲ್ವಿಚಾರಣೆ",
      monitoredPlots: "ಒಟ್ಟು ಜಮೀನುಗಳು",
      waterDepletion: "ಜಲಾಶಯದ ಮೇಲ್ಮೈ ವಿಸ್ತೀರ್ಣ",
      stressBreakdown: "ಆರೋಗ್ಯ ವಿಭಜನೆ",
      talukDrilldown: "ತಾಲೂಕು ಮತ್ತು ಗ್ರಾಮ ವಿವರ",
      exportEvidence: "ವರದಿ ಡೌನ್‌ಲೋಡ್"
    },
    insurer: {
      claimVerification: "ವಿಮೆ ಕ್ಲೈಮ್ ಪರಿಶೀಲನೆ",
      historicalTimeSeries: "ಇತಿಹಾಸಿಕ ಡೇಟಾ",
      modelProvenance: "ಮಾಡೆಲ್ ವಿವರ",
      inputSnapshot: "ಇನ್ಪುಟ್ ಸ್ನ್ಯಾಪ್ಶಾಟ್",
      earlyWarningCheck: "ಎಚ್ಚರಿಕೆ ಪರಿಶೀಲನೆ"
    },
    admin: {
      pipelineHealth: "ಪೈಪ್ಲೈನ್ ಸ್ಥಿತಿ",
      queueDepth: "ಕ್ಯೂ ಸಾಮರ್ಥ್ಯ",
      failedTasks: "ವಿಫಲ ಕಾರ್ಯಗಳು",
      modelRegistry: "ಮಾಡೆಲ್ ರಿಜಿಸ್ಟ್ರಿ",
      rollbackButton: "ರೋಲ್ಬ್ಯಾಕ್"
    }
  },

  te: {
    appTitle: "కృషిదృష్టి AI",
    subTitle: "శాటిలైట్ & ML వ్యవసాయ సలహా వేదిక",
    personas: {
      farmer: "రైతు దృశ్యం",
      government: "ప్రభుత్వ అధికారి",
      insurer: "భీమా క్లెయిమ్స్",
      admin: "అడ్మిన్ కన్సోల్"
    },
    nav: {
      aoiDraw: "పొలం సరిహద్దును గీయండి",
      layerToggle: "శాటిలైట్ లేయర్లు",
      timeSlider: "టైమ్ స్లైడర్",
      districtRollup: "జిల్లా అవలోకనం",
      alerts: "ముందస్తు హెచ్చరికలు",
      downloadReport: "నివేదిక డౌన్‌లోడ్",
      splitCompare: "పోలిక మోడ్"
    },
    farmer: {
      chooseLanguage: "భాషను ఎంచుకోండి / Choose Language",
      myPlots: "నమోదిత పొలం",
      healthScore: "ఆరోగ్య స్కోరు",
      healthNeedsCare: "సంరక్షణ అవసరం",
      healthGood: "మంచి పంట",
      waterAlertTitle: "⚠️ నీటి కొరత హెచ్చరిక",
      waterAlertSub: "48 గంటల్లో పంటకు నీరు అందించండి",
      waterAlertDesc: "ఉపగ్రహ స్కానింగ్ ప్రకారం నేలలో తేమ తక్కువగా ఉంది. వెంటనే నీరు అందించడం వల్ల పూత రాలడం తగ్గుతుంది.",
      whatToDoTitle: "⚡ ఈ వారం మీరు చేయవలసిన పనులు",
      tapToComplete: "పూర్తయ్యాక టిక్ చేయండి",
      task1: "కాయలు రాలకుండా ఉండటానికి 48 గంటల్లో డ్రిప్ ద్వారా నీరు అందించండి",
      task2: "మొక్క బలం కోసం పొటాషియం నైట్రేట్ పిచికారీ చేయండి",
      task3: "ఈ వారం ఆకుల కింద తెల్లదోమ లేదా రసం పీల్చే పురుగులను గమనించండి",
      urgentBadge: "అత్యవసరం",
      expectedYield: "అంచనా దిగుబడి",
      qtlPerAcre: "క్వింటాళ్ళు / ఎకరం",
      normalIs: "సాధారణ దిగుబడి ~8.9 క్వింటాళ్ళు/ఎకరం",
      totalHarvest: "మొత్తం దిగుబడి",
      quintals: "క్వింటాళ్ళు",
      forYourAcre: "మీ పొలం వైశాల్యానికి",
      estMarketValue: "అంచనా మార్కెట్ విలువ",
      basedOnMsp: "కనీస మద్దతు ధర ₹7,200/క్వింటా ఆధారంగా",
      healthGrowth30Days: "పంట ఆరోగ్య పెరుగుదల (గత 30 రోజులు)",
      goodThreshold: "🟢 బాగుంది (>70%)",
      needsWaterThreshold: "🟡 నీరు అవసరం",
      kisanCallCentre: "కిసాన్ కాల్ సెంటర్ (టోల్-ఫ్రీ)",
      callOfficer: "అధికారితో మాట్లాడండి",
      shareWhatsApp: "వాట్సాప్",
      listenAudio: "🔊 ఆడియో వినండి",
      stopAudio: "ఆపండి",
      downloadReport: "నివేదిక డౌన్‌లోడ్",
      belowNormal: "సాధారణం కంటే తక్కువ",
      voiceMessage: "నమస్కారం రైతు సోదరులారా. మీ పొలం ఆరోగ్య స్కోరు {score} శాతం. అత్యవసర సలహా: పంట నష్టాన్ని నివారించడానికి తదుపరి 48 గంటల్లో నీరు పెట్టండి. అంచనా దిగుబడి ఎకరానికి {yield} క్వింటాళ్ళు."
    },
    government: {
      districtSummary: "జిల్లా కరువు మరియు నీటి పర్యవేక్షణ",
      monitoredPlots: "మొత్తం పొలాలు",
      waterDepletion: "రిజర్వాయర్ వైశాల్యం",
      stressBreakdown: "ఆరోగ్య విభజన",
      talukDrilldown: "తాలూకా మరియు గ్రామం వివరాలు",
      exportEvidence: "నివేదిక ఎగుమతి"
    },
    insurer: {
      claimVerification: "క్లెయిమ్ తనిఖీ",
      historicalTimeSeries: "చారిత్రక డేటా",
      modelProvenance: "మోడల్ వివరాలు",
      inputSnapshot: "ఇన్‌పుట్ స్నాప్‌షాట్",
      earlyWarningCheck: "హెచ్చరిక తనిఖీ"
    },
    admin: {
      pipelineHealth: "పైప్‌లైన్ ఆరోగ్యం",
      queueDepth: "క్యూ పరిమాణం",
      failedTasks: "వైఫల్యాలు",
      modelRegistry: "మోడల్ రిజిస్ట్రీ",
      rollbackButton: "రోల్‌బ్యాక్"
    }
  }
};
