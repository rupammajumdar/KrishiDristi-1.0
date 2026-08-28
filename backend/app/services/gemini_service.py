"""
KrishiDrishti AI — Google Gemini Intelligent Agronomist Service
Generates real-time, field-specific agricultural advisories, location-adaptive task plans,
and AI conversational assistance grounded directly in ML Model inferences (Random Forest,
LSTM AutoEncoder, UNet water balance) and live Sentinel-2 multispectral and OpenWeather data.
"""

import json
import logging
import httpx
from typing import Dict, Any, List, Optional

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("krishidristi.gemini")


class GeminiAgronomistService:
    """Intelligent Agronomist Engine powered by Google Gemini and ML Model returns."""

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL or "gemini-3.1-flash-lite"
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    async def generate_realtime_actionable_tasks(
        self,
        aoi_data: Dict[str, Any],
        crop_type: str,
        ndvi: float,
        ndwi: float,
        temp_c: float,
        rain_mm: float,
        lang: str = "en",
        ml_stress_classification: Optional[Dict[str, Any]] = None,
        ml_anomaly: Optional[Dict[str, Any]] = None,
        yield_change_pct: Optional[float] = None,
        feature_importance: Optional[Dict[str, float]] = None,
        location_context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate 3 real-time, urgent action items for the farmer based on
        live Sentinel-2 NDVI/NDWI, OpenWeather data, and ML Model inferences.
        """
        if not self.api_key:
            return self._fallback_tasks(
                crop_type, ndvi, ndwi, temp_c, lang, ml_stress_classification, ml_anomaly, yield_change_pct
            )

        LANG_NAMES = {
            "mr": "Marathi (मराठी)",
            "hi": "Hindi (हिन्दी)",
            "kn": "Kannada (ಕನ್ನಡ)",
            "te": "Telugu (తెలుగు)",
            "en": "English",
        }
        lang_full = LANG_NAMES.get(lang, "English")

        location = f"{aoi_data.get('village', 'Field')}, {aoi_data.get('taluk', '')}, {aoi_data.get('district', 'Jalna')}, {aoi_data.get('state', 'Maharashtra')}"
        area_ha = aoi_data.get("area_hectares", 2.5)

        # Extract ML Model diagnoses
        rf_label = ml_stress_classification.get("stress_label", "Moderate Stress") if ml_stress_classification else "Moderate Stress"
        rf_class = ml_stress_classification.get("stress_class_id", 1) if ml_stress_classification else 1
        rf_probs = ml_stress_classification.get("probabilities", {}) if ml_stress_classification else {}
        p_severe = round(rf_probs.get("severe_stress", 0.15) * 100)
        p_healthy = round(rf_probs.get("healthy", 0.60) * 100)

        lstm_anomaly_detected = ml_anomaly.get("anomaly_detected", False) if ml_anomaly else False
        lstm_score = ml_anomaly.get("anomaly_score", 0.20) if ml_anomaly else 0.20
        lstm_status = ml_anomaly.get("status_text", "Normal Trajectory") if ml_anomaly else "Normal Trajectory"

        yield_dev = f"{yield_change_pct:+.1f}% vs 5-yr baseline" if yield_change_pct is not None else "-15.0% vs baseline"

        soil_info = location_context.get("soil_type", "Black Vertisols") if location_context else "Black Vertisols"
        agro_zone = location_context.get("agro_zone", "Agro-Climatic Zone") if location_context else "Agro-Climatic Zone"
        kvk = location_context.get("kvk_station", "District KVK") if location_context else "District KVK"

        prompt = f"""
You are KrishiDrishti AI's Expert Senior Agronomist for Indian Agriculture.
The platform's Machine Learning models have executed inference on real-time satellite telemetry and weather for a farm plot.
Generate exactly 5 comprehensive, prioritized, actionable tasks for "WHAT TO DO THIS WEEK" for the farmer growing {crop_type.upper()}.

CRITICAL: Your recommendations MUST directly address the findings and diagnosis of the ML models below!

=== REAL-TIME ML INFERENCE RESULTS & DIAGNOSIS ===
1. Random Forest Stress Model (rf_stress.joblib):
   - Diagnosis: {rf_label} (Class {rf_class})
   - Severe Stress Probability: {p_severe}% | Healthy Probability: {p_healthy}%
2. PyTorch LSTM AutoEncoder Temporal Anomaly Model (lstm_anomaly.pth):
   - Anomaly Detected: {lstm_anomaly_detected}
   - Reconstruction Anomaly Score: {lstm_score:.2f} / 1.00 ({lstm_status})
3. ML Yield Impact Prediction:
   - Expected Yield Deviation: {yield_dev}
4. Real-time Field Telemetry:
   - Location: {location} ({agro_zone}, {soil_info})
   - KVK Hub: {kvk}
   - Crop: {crop_type.upper()} on {area_ha} Ha (~{round(float(area_ha)*2.47, 1)} Acres)
   - Sentinel-2 NDVI: {ndvi:.2f} (Vegetation Health)
   - Sentinel-2 NDWI: {ndwi:.2f} (Soil/Canopy Water Index)
   - Ambient Temp: {temp_c:.1f}°C | Forecast Rain: {rain_mm:.0f} mm
   - Output Language: {lang_full}

=== INSTRUCTIONS FOR TASK GENERATION ===
1. Task 1 MUST address Drip Irrigation & Water Management based on Random Forest & NDWI ({ndwi:.2f}).
2. Task 2 MUST be Crop-Specific Foliar Nutrition (e.g. 19:19:19, 0:52:34, 13:0:45 Potassium Nitrate, Boron/Micronutrients) with exact dosages per litre/acre to mitigate predicted {yield_dev} loss.
3. Task 3 MUST be Integrated Pest & Disease Scouting (sucking pests, bollworm, leaf spot) recommended by {kvk} for {crop_type.upper()} at {temp_c:.1f}°C.
4. Task 4 MUST address Soil Health, Weeding & Inter-cultivation (hoeing, root aeration, weed clearance in {soil_info}).
5. Task 5 MUST address Weather Adaptation & Stress Shielding (protection against high heat/excess rain, bio-stimulant or Neem spray).
6. Write ALL titles and subtitles strictly in {lang_full}. Include precise dosages (g/L, ml/L, hours of drip, kg/acre).

Return ONLY a valid JSON array of 5 objects (no markdown fences, just pure JSON):
[
  {{
    "id": 1,
    "title": "Drip Irrigation Title in {lang_full}",
    "subtitle": "Clear drip schedule and water timing in {lang_full}",
    "urgency": "{'Urgent' if (rf_class == 0 or lstm_anomaly_detected) else 'Moderate'}",
    "icon": "Droplets"
  }},
  {{
    "id": 2,
    "title": "Foliar Nutrition Title in {lang_full}",
    "subtitle": "Fertilizer spray with exact ratio and dosage in {lang_full}",
    "urgency": "{'High' if (rf_class != 2) else 'Routine'}",
    "icon": "Sprout"
  }},
  {{
    "id": 3,
    "title": "Pest Protection Title in {lang_full}",
    "subtitle": "Pest/Disease defense with formulation dosage in {lang_full}",
    "urgency": "Routine",
    "icon": "ShieldCheck"
  }},
  {{
    "id": 4,
    "title": "Soil & Weeding Title in {lang_full}",
    "subtitle": "Hoeing and inter-cultivation advice in {lang_full}",
    "urgency": "Routine",
    "icon": "Sprout"
  }},
  {{
    "id": 5,
    "title": "Weather Shielding Title in {lang_full}",
    "subtitle": "Micro-climate adaptation and protective spray in {lang_full}",
    "urgency": "Routine",
    "icon": "Sun"
  }}
]
"""
        try:
            url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"
            async with httpx.AsyncClient(timeout=14.0) as client:
                res = await client.post(
                    url,
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                    headers={"Content-Type": "application/json"},
                )
                if res.status_code == 200:
                    resp_json = res.json()
                    candidates = resp_json.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        raw_text = candidates[0]["content"]["parts"][0]["text"].strip()
                        if raw_text.startswith("```json"):
                            raw_text = raw_text[7:]
                        if raw_text.startswith("```"):
                            raw_text = raw_text[3:]
                        if raw_text.endswith("```"):
                            raw_text = raw_text[:-3]
                        raw_text = raw_text.strip()
                        parsed = json.loads(raw_text)
                        if isinstance(parsed, list) and len(parsed) > 0:
                            logger.info(f"[Gemini AI] Generated real-time ML-grounded advisory tasks for {crop_type} ({lang}).")
                            return parsed
                else:
                    logger.warning("[Gemini AI Advisory] API status %s: %s", res.status_code, res.text[:200])
        except Exception as e:
            logger.warning("[Gemini AI Advisory] Error calling Gemini: %s", e)

        return self._fallback_tasks(
            crop_type, ndvi, ndwi, temp_c, lang, ml_stress_classification, ml_anomaly, yield_change_pct
        )

    async def ask_agronomist_assistant(
        self,
        question: str,
        aoi_data: Dict[str, Any],
        crop_type: str,
        ndvi: float,
        temp_c: float,
        rain_mm: float,
        lang: str = "en",
        ml_prediction: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Interactive Question-Answering for the farmer with real-time farm context & ML insights."""
        if not self.api_key:
            return "KrishiDrishti AI Agronomist is currently monitoring your field. Provide drip irrigation within 48 hours to sustain flowering."

        LANG_NAMES = {
            "mr": "Marathi (मराठी)",
            "hi": "Hindi (हिन्दी)",
            "kn": "Kannada (ಕನ್ನಡ)",
            "te": "Telugu (తెలుగు)",
            "en": "English",
        }
        lang_full = LANG_NAMES.get(lang, "English / Hindi as asked")

        location = f"{aoi_data.get('village', 'Field')}, {aoi_data.get('district', 'Jalna')}, {aoi_data.get('state', 'Maharashtra')}"

        # ── Pull today's exact telemetry & ML diagnosis from the live prediction ──
        snapshot = (ml_prediction or {}).get("input_snapshot_json", {}) or {}
        ndvi_today = ndvi if ndvi is not None else snapshot.get("mean_ndvi", 0.48)
        ndwi_today = snapshot.get("mean_ndwi", -0.15)
        rain_today = rain_mm if rain_mm is not None else snapshot.get("rainfall_mm", 360)
        temp_today = temp_c if temp_c is not None else snapshot.get("temp_avg_c", 29.2)

        rf = (ml_prediction or {}).get("ml_stress_classification", {}) or {}
        lstm = (ml_prediction or {}).get("ml_anomaly", {}) or {}
        loc_ctx = (ml_prediction or {}).get("location_context", {}) or {}
        soil_type = loc_ctx.get("soil_type", snapshot.get("location_context", {}).get("soil_type", "Regional Soil Profile"))
        agro_zone = loc_ctx.get("agro_zone", snapshot.get("location_context", {}).get("agro_zone", f"{aoi_data.get('district', 'Local')} Agro-Climatic Zone"))
        kvk = loc_ctx.get("kvk_station", snapshot.get("location_context", {}).get("kvk_station", f"KVK {aoi_data.get('district', 'Regional')}"))

        rf_label = rf.get("stress_label", "Moderate Stress")
        rf_class = rf.get("stress_class_id", 1)
        rf_probs = rf.get("probabilities", {})
        p_severe = round(rf_probs.get("severe_stress", 0.10) * 100)
        p_moderate = round(rf_probs.get("moderate_stress", 0.50) * 100)
        p_healthy = round(rf_probs.get("healthy", 0.35) * 100)

        lstm_detected = lstm.get("anomaly_detected", False)
        lstm_score = lstm.get("anomaly_score", 0.20)
        lstm_status = lstm.get("status_text", "Normal Trajectory")

        yield_pct = (ml_prediction or {}).get("yield_change_pct", -15.0)
        pred_yield = (ml_prediction or {}).get("predicted_yield_kg_ha")

        # Interpret today's spectral health so the answer can be grounded in it.
        if ndwi_today <= -0.30 or ndvi_today < 0.25:
            spectral_health = "Severe moisture stress / very dry canopy (NDWI very low)"
        elif ndwi_today >= -0.15 and ndvi_today >= 0.55:
            spectral_health = "Healthy / well-watered canopy (good NDVI & NDWI)"
        elif ndvi_today < 0.40:
            spectral_health = "Moderate canopy stress / thinning vegetation"
        else:
            spectral_health = "Moderate to good canopy with adequate water balance"

        ml_context_str = (
            f"- Sentinel-2 NDVI (today): {ndvi_today:.2f}  → {spectral_health}\n"
            f"- Sentinel-2 NDWI (today): {ndwi_today:.2f}  (canopy/soil water index)\n"
            f"- Random Forest Stress: {rf_label} (class {rf_class}); "
            f"probs: Healthy {p_healthy}% | Moderate {p_moderate}% | Severe {p_severe}%\n"
            f"- LSTM Anomaly: {'Detected' if lstm_detected else 'None'} (score {lstm_score:.2f} / 1.00; {lstm_status})\n"
            f"- ML Predicted Yield Trend: {yield_pct:+.1f}%\n"
            f"- Predicted Yield: {pred_yield} kg/ha\n"
            f"- Agro-Climatic Zone: {agro_zone}\n"
            f"- Soil: {soil_type}\n"
            f"- KVK Hub: {kvk}\n"
        )

        prompt = f"""
You are KrishiDrishti AI's Expert Virtual Agronomist (कृषि विशेषज्ञ).
The farmer is asking you a direct question about their farm TODAY.
Ground your entire answer in the REAL-TIME telemetry below — the specific NDVI, NDWI and ML diagnosis measured on this plot right now. Do NOT answer generically; use these exact numbers.

REAL-TIME FIELD TELEMETRY & ML CONTEXT (measured today):
- Location: {location}
- Active Crop: {crop_type.upper()}
- Ambient Temperature: {temp_today:.1f}°C
- Forecast Rainfall: {rain_today:.0f} mm
{ml_context_str}- Output Language: {lang_full}

FARMER'S QUESTION:
"{question}"

INSTRUCTIONS FOR YOUR ANSWER:
1. Answer the farmer's question directly, accurately, and practically, using this plot's ACTUAL NDVI ({ndvi_today:.2f}) and NDWI ({ndwi_today:.2f}) and the ML diagnosis ({rf_label}). If the farmer asks about irrigation/water, base it on NDWI ({ndwi_today:.2f}) and soil ({soil_type}). If they ask about fertilizers, base dosages on the crop stage and this soil. If they ask about pests/diseases, factor in current temperature ({temp_today:.1f}°C) and NDWI.
2. Reply in the farmer's chosen language: {lang_full}.
3. If they ask about pests, diseases, irrigation, or fertilizers for {crop_type.upper()}, give exact brand-neutral chemical/organic formulations with precise measurements (e.g. ml/liter or kg/acre).
4. Format with short bullet points so it is easy to read on a mobile screen.
5. If the farmer's question is about the current stress/anomaly ({rf_label}; {'anomaly detected' if lstm_detected else 'no anomaly'}), explain what those numbers mean and give a concrete action plan.
"""
        try:
            url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"
            async with httpx.AsyncClient(timeout=14.0) as client:
                res = await client.post(
                    url,
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                    headers={"Content-Type": "application/json"},
                )
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        return candidates[0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            logger.warning("[Gemini AI Q&A] Error: %s", e)

        return "KrishiDrishti AI recommends verifying field soil moisture and applying crop-specific nutrients as per local KVK guidance."

    def _fallback_tasks(
        self,
        crop: str,
        ndvi: float,
        ndwi: float,
        temp_c: float,
        lang: str,
        ml_stress: Optional[Dict[str, Any]] = None,
        ml_anomaly: Optional[Dict[str, Any]] = None,
        yield_pct: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Reliable fallback tasks dynamically adapted to ML model outputs."""
        is_severe = False
        if ml_stress:
            is_severe = ml_stress.get("stress_class_id") == 0
        if ml_anomaly and ml_anomaly.get("anomaly_detected"):
            is_severe = True

        crop_u = crop.upper()

        if lang == "mr":
            if is_severe:
                return [
                    {
                        "id": 1,
                        "title": "ML अलर्ट: त्वरित ठिबक सिंचन सुरू करा (Severe Stress)",
                        "subtitle": f"रँडम फॉरेस्ट मॉडेलने गंभीर ताण नोंदवला (NDWI: {ndwi:.2f}, {temp_c:.1f}°C). ओलावा टिकवण्यासाठी ३ तास ठिबक द्या.",
                        "urgency": "अतितातडीचे",
                        "icon": "Droplets",
                    },
                    {
                        "id": 2,
                        "title": f"{crop_u} साठी पोटॅशियम नायट्रेट (१३:०:४५) फवारणी",
                        "subtitle": "१० ग्रॅम प्रति लिटर पाण्यात मिसळून फवारा जेणेकरून पानांची व पातेगळ थांबेल व दुष्काळ प्रतिकारशक्ती वाढेल.",
                        "urgency": "तातडीचे",
                        "icon": "Sprout",
                    },
                    {
                        "id": 3,
                        "title": "रसशोषक किडी व बोंडअळी / रोग निरीक्षण",
                        "subtitle": "पानांच्या खालील बाजूस पांढरी माशी व मावा तपासा. गरज भासल्यास ५% निंबोळी अर्क ३ मिली/लिटर फवारा.",
                        "urgency": "नियमित",
                        "icon": "ShieldCheck",
                    },
                    {
                        "id": 4,
                        "title": "तण नियंत्रण व कोळपणी (हवा खेळती ठेवा)",
                        "subtitle": "मुळांभोवती तण काढून घ्या व हलकी कोळपणी करा जेणेकरून जमिनीत ऑक्सिजन व नत्र शोषण सुधारेल.",
                        "urgency": "नियमित",
                        "icon": "Sprout",
                    },
                    {
                        "id": 5,
                        "title": "उष्णता ताण संरक्षण व सूक्ष्म अन्नद्रव्य फवारणी",
                        "subtitle": f"तापमान {temp_c:.1f}°C असल्याने संध्याकाळी बाष्पीभवन रोखण्यासाठी चिलेटेड झिंक @ १.५ ग्रॅम/लिटर फवारा.",
                        "urgency": "नियमित",
                        "icon": "Sun",
                    },
                ]
            return [
                {
                    "id": 1,
                    "title": "नियमित ठिबक सिंचन चक्र (Healthy)",
                    "subtitle": f"NDVI {ndvi:.2f} निरोगी पातळीवर आहे. जमिनीतील ओलावा टिकवण्यासाठी नियमित २ तास पाणी द्या.",
                    "urgency": "मध्यम",
                    "icon": "Droplets",
                },
                {
                    "id": 2,
                    "title": f"{crop_u} साठी १९:१९:१९ विद्राव्य खताची मात्रा",
                    "subtitle": "५ ग्रॅम प्रति लिटर पाण्याने फवारणी करून शाकीय वाढ व फुलोरा मजबूत करा.",
                    "urgency": "नियमित",
                    "icon": "Sprout",
                },
                {
                    "id": 3,
                    "title": "किडींचे एकात्मिक नियंत्रण (KVK सल्ला)",
                    "subtitle": "प्रति एकर ५ कामगंध सापळे व पिवळे चिकट सापळे लावा आणि नियमित निरीक्षण ठेवा.",
                    "urgency": "नियमित",
                    "icon": "ShieldCheck",
                },
                {
                    "id": 4,
                    "title": "जमीन मशागत व मुळांची भर देणे",
                    "subtitle": "झाडांच्या ओळीत हलकी खुरपणी करून मुळांना मातीची भर द्या जेणेकरून झाड मजबूत उभे राहील.",
                    "urgency": "नियमित",
                    "icon": "Sprout",
                },
                {
                    "id": 5,
                    "title": "जैविक फवारणी व पीक आरोग्य संरक्षण",
                    "subtitle": "१५०० पीपीएम निंबोळी अर्क ३ मिली/लिटर फवारून किडींच्या अंडी व पिल्लांचे नियंत्रण करा.",
                    "urgency": "नियमित",
                    "icon": "Sun",
                },
            ]
        elif lang == "hi":
            if is_severe:
                return [
                    {
                        "id": 1,
                        "title": "ML अलर्ट: 48 घंटे के भीतर ड्रिप सिंचाई करें",
                        "subtitle": f"रैंडम फॉरेस्ट मॉडल ने गंभीर जल तनाव पाया (NDWI: {ndwi:.2f}, {temp_c:.1f}°C). नमी बचाने के लिए तुरंत 3 घंटे सिंचाई करें.",
                        "urgency": "अति-आवश्यक",
                        "icon": "Droplets",
                    },
                    {
                        "id": 2,
                        "title": f"{crop_u} हेतु पोटेशियम नाइट्रेट (13:0:45) का छिड़काव",
                        "subtitle": "10 ग्राम प्रति लीटर पानी में घोलकर छिड़कें ताकि फूल/फल झड़ने से बचें और सूखा सहनशीलता बढ़े.",
                        "urgency": "आवश्यक",
                        "icon": "Sprout",
                    },
                    {
                        "id": 3,
                        "title": "रस चूसक कीट एवं सुंडी निगरानी",
                        "subtitle": "पत्तियों की निचली सतह पर सफेद मक्खी और चेपा की जांच करें. आवश्यकतानुसार 5% नीम तेल स्प्रे करें.",
                        "urgency": "नियमित",
                        "icon": "ShieldCheck",
                    },
                    {
                        "id": 4,
                        "title": "खरपतवार नियंत्रण एवं निराई-गुड़ाई",
                        "subtitle": "जड़ों के आसपास से खरपतवार निकालें और हल्की गुड़ाई करें ताकि मृदा में हवा का प्रवाह बढ़े.",
                        "urgency": "नियमित",
                        "icon": "Sprout",
                    },
                    {
                        "id": 5,
                        "title": "तापमान तनाव सुरक्षा एवं सूक्ष्म पोषक तत्व",
                        "subtitle": f"तापमान {temp_c:.1f}°C होने के कारण शाम को चिलेटेड जिंक @ 1.5 ग्राम/लीटर का स्प्रे करें.",
                        "urgency": "नियमित",
                        "icon": "Sun",
                    },
                ]
            return [
                {
                    "id": 1,
                    "title": "नियमित ड्रिप सिंचाई चक्र",
                    "subtitle": f"NDVI {ndvi:.2f} स्वस्थ स्तर पर है. शाम के समय 2 घंटे का नियमित सिंचाई चक्र बनाए रखें.",
                    "urgency": "सामान्य",
                    "icon": "Droplets",
                },
                {
                    "id": 2,
                    "title": f"{crop_u} हेतु 19:19:19 घुलनशील पोषक तत्व स्प्रे",
                    "subtitle": "5 ग्राम प्रति लीटर पानी के साथ फसल की वनस्पति वृद्धि और शाखाओं को बढ़ावा दें.",
                    "urgency": "सामान्य",
                    "icon": "Sprout",
                },
                {
                    "id": 3,
                    "title": "एकीकृत कीट प्रबंधन (KVK सलाह)",
                    "subtitle": "प्रति एकड़ 5 फेरोमोन ट्रैप एवं पीले चिपचिपे कार्ड लगाएं और कीट प्रकोप पर नजर रखें.",
                    "urgency": "नियमित",
                    "icon": "ShieldCheck",
                },
                {
                    "id": 4,
                    "title": "मृदा स्वास्थ्य एवं हल्की निराई",
                    "subtitle": "पौधों की कतारों के बीच खरपतवार साफ करें और मिट्टी को भुरभुरी बनाएं.",
                    "urgency": "नियमित",
                    "icon": "Sprout",
                },
                {
                    "id": 5,
                    "title": "जैविक सुरक्षा (नीम तेल छिड़काव)",
                    "subtitle": "1500 PPM नीम तेल @ 3ml/L का छिड़काव कर कीटों के अंडे व बच्चों को रोकें.",
                    "urgency": "नियमित",
                    "icon": "Sun",
                },
            ]

        elif lang == "kn":
            if is_severe:
                return [
                    {
                        "id": 1,
                        "title": "ML ಸೂಚನೆ: 24-48 ಗಂಟೆಗಳಲ್ಲಿ ಹನಿ ನೀರಾವರಿ ನೀಡಿ",
                        "subtitle": f"ರ‍್ಯಾಂಡಮ್ ಫಾರೆಸ್ಟ್ ಮಾದರಿಯು ತೀವ್ರ ತೇವಾಂಶ ಕೊರತೆಯನ್ನು ಪತ್ತೆ ಮಾಡಿದೆ (NDWI: {ndwi:.2f}, {temp_c:.1f}°C). ಬೆಳೆ ರಕ್ಷಣೆಗೆ 3 ಗಂಟೆ ನೀರಾವರಿ ನೀಡಿ.",
                        "urgency": "ಅತಿ-ಅಗತ್ಯ",
                        "icon": "Droplets",
                    },
                    {
                        "id": 2,
                        "title": f"{crop_u} ಗೆ ಪೊಟ್ಯಾಸಿಯಮ್ ನೈಟ್ರೇಟ್ (13:0:45) ಸಿಂಪಡಣೆ",
                        "subtitle": "10 ಗ್ರಾಂ/ಲೀಟರ್ ನೀರಿನಲ್ಲಿ ಬೆರೆಸಿ ಸಿಂಪಡಿಸಿ, ಹೂವು ಮತ್ತು ಕಾಯಿ ಉದುರುವುದನ್ನು ತಡೆಯಿರಿ.",
                        "urgency": "ಅಗತ್ಯ",
                        "icon": "Sprout",
                    },
                    {
                        "id": 3,
                        "title": "ಕೀಟಗಳ ಪರಿಶೀಲನೆ ಮತ್ತು ಮೋಹಕ ಬಲೆಗಳ ಅಳವಡಿಕೆ",
                        "subtitle": "ಎಲೆಗಳ ಕೆಳಭಾಗದಲ್ಲಿ ನುಸಿ/ಬಿಳಿ ನೊಣಗಳನ್ನು ಪರಿಶೀಲಿಸಿ. ಎಕರೆಗೆ 5 ಮೋಹಕ ಬಲೆಗಳನ್ನು ಹಾಕಿ.",
                        "urgency": "ಸಾಮಾನ್ಯ",
                        "icon": "ShieldCheck",
                    },
                    {
                        "id": 4,
                        "title": "ಮಣ್ಣಿನ ಆಮ್ಲಜನಕೀಕರಣ ಮತ್ತು ಕಳೆ ನಿರ್ವಹಣೆ",
                        "subtitle": "ಸಾಲುಗಳ ನಡುವೆ ಕಳೆಗಳನ್ನು ತೆಗೆದು ಮಣ್ಣನ್ನು ಹಗುರಗೊಳಿಸಿ ಕಾಯಿಸಿ.",
                        "urgency": "ಸಾಮಾನ್ಯ",
                        "icon": "Sprout",
                    },
                    {
                        "id": 5,
                        "title": "ಶಾಖ ನಿಯಂತ್ರಣ ಮತ್ತು ಜೈವಿಕ नीम ಎಣ್ಣೆ ಸಿಂಪಡಣೆ",
                        "subtitle": "1500 PPM नीम ಎಣ್ಣೆಯನ್ನು 3ml/L ಸಾಂದ್ರತೆಯಲ್ಲಿ ಸಂಜೆ ಸಿಂಪಡಿಸಿ.",
                        "urgency": "ಸಾಮಾನ್ಯ",
                        "icon": "Sun",
                    },
                ]
            return [
                {
                    "id": 1,
                    "title": "ನಿಯಮಿತ ಹನಿ ನೀರಾವರಿ ವೇಳಾಪಟ್ಟಿ",
                    "subtitle": f"NDVI {ndvi:.2f} ಉತ್ತಮವಾಗಿದೆ. ಸಂಜೆ 2 ಗಂಟೆಗಳ ಕಾಲ ನಿಯಮಿತ ನೀರಾವರಿ ನಿರ್ವಹಿಸಿ.",
                    "urgency": "ಸಾಮಾನ್ಯ",
                    "icon": "Droplets",
                },
                {
                    "id": 2,
                    "title": f"{crop_u} ಗೆ 19:19:19 ನೀರಿನಲ್ಲಿ ಕರಗುವ ಗೊಬ್ಬರ ಸಿಂಪಡಣೆ",
                    "subtitle": "ಬೆಳೆಯ ಕಾಯಿ ಮತ್ತು ಕೊಂಬೆಗಳ ಬೆಳವಣಿಗೆಗೆ 5g/L ಸಿಂಪಡಿಸಿ.",
                    "urgency": "ಸಾಮಾನ್ಯ",
                    "icon": "Sprout",
                },
                {
                    "id": 3,
                    "title": "ಸಮಗ್ರ ಕೀಟ ನಿರ್ವಹಣೆ (KVK ಸಲಹೆ)",
                    "subtitle": "ಹಳದಿ ಅಂಟು ಹಾಳೆಗಳು ಮತ್ತು ಕೀಟ ಬಲೆಗಳನ್ನು ಇರಿಸಿ ಕೀಟಗಳ ಮೇಲೆ ನಿಗಾ ಇರಿಸಿ.",
                    "urgency": "ಸಾಮಾನ್ಯ",
                    "icon": "ShieldCheck",
                },
                {
                    "id": 4,
                    "title": "ಮಣ್ಣಿನ ಆರೈಕೆ ಮತ್ತು ಮೇಲ್ಮೈ ಸಡಿಲಿಕೆ",
                    "subtitle": "ಗಿಡಗಳ ಬುಡಕ್ಕೆ ಮಣ್ಣು ಏರಿಸಿ ಬೇರುಗಳ ಬೆಳವಣಿಗೆಗೆ ಸಹಕರಿಸಿ.",
                    "urgency": "ಸಾಮಾನ್ಯ",
                    "icon": "Sprout",
                },
                {
                    "id": 5,
                    "title": "ರಕ್ಷಣಾತ್ಮಕ ಮೈಕ್ರೋ-ಕ್ಲೈಮೇಟ್ ಸಿಂಪಡಣೆ",
                    "subtitle": "ತಾಪಮಾನ ಏರಿಕೆಯಿಂದ ತಡೆಯಲು ಸೂಕ್ಷ್ಮ ಪೋಷಕಾಂಶಗಳ ಸಿಂಪಡಣೆ ಮಾಡಿ.",
                    "urgency": "ಸಾಮಾನ್ಯ",
                    "icon": "Sun",
                },
            ]
        elif lang == "te":
            if is_severe:
                return [
                    {
                        "id": 1,
                        "title": "ML హెచ్చరిక: 24-48 గంటల్లో డ్రిప్ ద్వారా నీరు ఇవ్వండి",
                        "subtitle": f"రాండమ్ ఫారెస్ట్ మోడల్ తీవ్ర తేమ కొరతను గుర్తించింది (NDWI: {ndwi:.2f}, {temp_c:.1f}°C). పంటను కాపాడటానికి 3 గంటలు నీటిని అందించండి.",
                        "urgency": "అత్యవసరం",
                        "icon": "Droplets",
                    },
                    {
                        "id": 2,
                        "title": f"{crop_u} కి పొటాషియం నైట్రేట్ (13:0:45) పిచికారీ",
                        "subtitle": "లీటరు నీటికి 10 గ్రాములు కలిపి పిచికారీ చేసి పువ్వులు, పిందెలు రాలకుండా చూడండి.",
                        "urgency": "అవసరం",
                        "icon": "Sprout",
                    },
                    {
                        "id": 3,
                        "title": "తెగుళ్ల పరిశీలన మరియు లింగాకర్షక బుట్టలు",
                        "subtitle": "ఆకుల అడుగున తెల్లదోమ, పేనుబంక గమనించండి. ఎకరాకు 5 లింగాకర్షక బుట్టలు ఏర్పాటు చేయండి.",
                        "urgency": "సాధారణం",
                        "icon": "ShieldCheck",
                    },
                    {
                        "id": 4,
                        "title": "నేల యాజమాన్యం మరియు కలుపు నివారణ",
                        "subtitle": "మొక్కల మొదళ్ల వద్ద కలుపు తీసి వేళ్లకు గాలి ఆడేలా దున్నండి.",
                        "urgency": "సాధారణం",
                        "icon": "Sprout",
                    },
                    {
                        "id": 5,
                        "title": "వాతావరణ రక్షణ & వేప నూనె స్ప్రే",
                        "subtitle": "సాయంత్రం వేళల్లో 1500 PPM వేప నూనె @ 3ml/L పిచికారీ చేయండి.",
                        "urgency": "సాధారణం",
                        "icon": "Sun",
                    },
                ]
            return [
                {
                    "id": 1,
                    "title": "క్రమబద్ధమైన డ్రిప్ నీటి యాజమాన్యం",
                    "subtitle": f"NDVI {ndvi:.2f} ఆరోగ్యకరంగా ఉంది. సాయంత్రం 2 గంటలు నీటిని అందించండి.",
                    "urgency": "సాధారణం",
                    "icon": "Droplets",
                },
                {
                    "id": 2,
                    "title": f"{crop_u} కి 19:19:19 నీటిలో కరిగే ఎరువుల పిచికారీ",
                    "subtitle": "మొక్కల ఎదుగుదలకు లీటరు నీటికి 5 గ్రాముల చొప్పున స్ప్రే చేయండి.",
                    "urgency": "సాధారణం",
                    "icon": "Sprout",
                },
                {
                    "id": 3,
                    "title": "సమగ్ర సస్యరక్షణ (KVK సలహా)",
                    "subtitle": "పసుపు రంగు జిగురు అట్టలు ఏర్పాటు చేసి తెగుళ్లను గమనించండి.",
                    "urgency": "సాధారణం",
                    "icon": "ShieldCheck",
                },
                {
                    "id": 4,
                    "title": "నేల గుల్ల చేయడం & వేళ్ల పోషణ",
                    "subtitle": "మొక్కల వరసల మధ్య తేలికపాటి గునపంతో నేలను గుల్ల చేయండి.",
                    "urgency": "సాధారణం",
                    "icon": "Sprout",
                },
                {
                    "id": 5,
                    "title": "వాతావరణ రక్షణ చర్యలు",
                    "subtitle": "ఎండ తీవ్రత తట్టుకోవడానికి మైక్రో-న్యూట్రియంట్ స్ప్రే చేయండి.",
                    "urgency": "సాధారణం",
                    "icon": "Sun",
                },
            ]

        # English Default
        if is_severe:
            return [
                {
                    "id": 1,
                    "title": "ML Critical Alert: Execute Drip Irrigation Within 24-48 Hrs",
                    "subtitle": f"Random Forest & LSTM detected Severe Moisture Stress (NDWI: {ndwi:.2f}, Temp: {temp_c:.1f}°C). Provide 3-hr drip to halt yield drop.",
                    "urgency": "Urgent",
                    "icon": "Droplets",
                },
                {
                    "id": 2,
                    "title": "Foliar Spray of Potassium Nitrate (13:0:45)",
                    "subtitle": "Mix 10g/Litre water to strengthen cellular osmotic pressure and arrest flower/fruit drop.",
                    "urgency": "High",
                    "icon": "Sprout",
                },
                {
                    "id": 3,
                    "title": "Inspect for Sucking Pests & Install Traps",
                    "subtitle": "Check lower canopy for whitefly/jassids. Install 5 pheromone traps per acre as per KVK advisory.",
                    "urgency": "Routine",
                    "icon": "ShieldCheck",
                },
                {
                    "id": 4,
                    "title": "Soil Aeration & Inter-Cultivation Weeding",
                    "subtitle": "Perform shallow hoeing between rows to loosen root-zone soil, boost oxygenation, and accelerate nitrogen uptake.",
                    "urgency": "Routine",
                    "icon": "Sprout",
                },
                {
                    "id": 5,
                    "title": "Weather Stress Shielding & Neem Bio-Spray",
                    "subtitle": f"Ambient temp is {temp_c:.1f}°C. Apply 1500 PPM Neem Oil @ 3ml/L in evening to shield foliage against heat scald.",
                    "urgency": "Routine",
                    "icon": "Sun",
                },
            ]

        return [
            {
                "id": 1,
                "title": "Maintain Scheduled Drip Cycle",
                "subtitle": f"Sentinel-2 NDVI is {ndvi:.2f} with {temp_c:.1f}°C temp. Maintain standard 2-hr drip cycle in root zone.",
                "urgency": "Moderate",
                "icon": "Droplets",
            },
            {
                "id": 2,
                "title": "Apply Soluble 19:19:19 Crop Booster",
                "subtitle": f"Spray 5g/Litre water to boost vegetative branching across {crop.upper()} canopy.",
                "urgency": "Routine",
                "icon": "Sprout",
            },
            {
                "id": 3,
                "title": "Routine Pest Scouting & Monitoring",
                "subtitle": "Inspect crop foliage weekly and maintain field sanitation as recommended by KVK.",
                "urgency": "Routine",
                "icon": "ShieldCheck",
            },
            {
                "id": 4,
                "title": "Soil Moisture Conservation & Mulching",
                "subtitle": "Clear inter-row weeds and spread crop residue mulch to preserve root zone moisture.",
                "urgency": "Routine",
                "icon": "Sprout",
            },
            {
                "id": 5,
                "title": "Protective Micro-Climate Foliar Shield",
                "subtitle": "Apply 1500 PPM Neem Oil @ 3ml/L in late afternoon to prevent fungal spore germination.",
                "urgency": "Routine",
                "icon": "Sun",
            },
        ]


gemini_service = GeminiAgronomistService()
