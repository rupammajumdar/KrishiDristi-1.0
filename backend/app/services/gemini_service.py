"""
KrishiDrishti AI — Google Gemini Intelligent Agronomist Service
Generates real-time, field-specific agricultural advisories, location-adaptive task plans,
and AI conversational assistance using live Sentinel-2 multispectral and OpenWeather data.
"""

import json
import logging
import httpx
from typing import Dict, Any, List, Optional

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("krishidristi.gemini")


class GeminiAgronomistService:
    """Intelligent Agronomist Engine powered by Google Gemini."""

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
        lang: str = "en"
    ) -> List[Dict[str, Any]]:
        """
        Generate 3-4 real-time, urgent action items for the farmer based on
        live Sentinel-2 NDVI, NDWI, soil moisture, and OpenWeather real data.
        """
        if not self.api_key:
            return self._fallback_tasks(crop_type, ndvi, temp_c, lang)

        LANG_NAMES = {
            "mr": "Marathi (मराठी)",
            "hi": "Hindi (हिन्दी)",
            "kn": "Kannada (ಕನ್ನಡ)",
            "te": "Telugu (తెలుగు)",
            "en": "English"
        }
        lang_full = LANG_NAMES.get(lang, "English")

        location = f"{aoi_data.get('village', 'Field')}, {aoi_data.get('taluk', '')}, {aoi_data.get('district', 'Jalna')}, {aoi_data.get('state', 'Maharashtra')}"
        area_ha = aoi_data.get("area_hectares", 2.5)

        prompt = f"""
You are KrishiDrishti AI's Expert Senior Agronomist for Indian Agriculture.
Analyze the following REAL-TIME field telemetry and generate 3 specific, highly tailored tasks for the CROP: {crop_type.upper()}.

FIELD TELEMETRY & CONDITIONS:
- Location: {location}
- Crop Type: {crop_type.upper()} (Generate tasks ONLY relevant to {crop_type.upper()})
- Field Area: {area_ha} Hectares (~{round(float(area_ha)*2.47, 1)} Acres)
- Sentinel-2 NDVI (Vegetation Vigor): {ndvi:.2f} (Scale: 0.0 to 1.0; <0.4 is stressed, >0.6 is healthy)
- Sentinel-2 NDWI (Water Balance): {ndwi:.2f} (< -0.15 indicates severe soil moisture deficit)
- Current Temperature: {temp_c:.1f}°C
- 30-Day Estimated Rainfall: {rain_mm:.0f} mm
- Output Language: {lang_full}

CRITICAL RULES:
1. Every task must specifically target {crop_type.upper()} cultivation (e.g. for Cotton: bollworm/whitefly/drip/KNO3; for Soybean: pod borer/0:52:34/drainage; for Maize: Fall Armyworm/Urea; for Tur/Gram: pod borer/wilt; for Wheat: CRI stage irrigation; for Sugarcane: trash mulching/borer).
2. Write the "title" and "subtitle" strictly in {lang_full}.
3. The subtitle must contain exact dosage, timing, and chemical/fertilizer/water requirements.

Return ONLY a valid JSON array of 3 objects (no markdown fences, just pure JSON):
[
  {{
    "id": 1,
    "title": "Action Title in {lang_full}",
    "subtitle": "Clear, practical guidance with exact dosage and timing in {lang_full}",
    "urgency": "Urgent",
    "icon": "Droplets"
  }},
  {{
    "id": 2,
    "title": "Nutrition Title in {lang_full}",
    "subtitle": "Fertilizer spray with exact ratio and dosage in {lang_full}",
    "urgency": "High",
    "icon": "Sprout"
  }},
  {{
    "id": 3,
    "title": "Protection Title in {lang_full}",
    "subtitle": "Pest/Disease defense with formulation dosage in {lang_full}",
    "urgency": "Routine",
    "icon": "ShieldCheck"
  }}
]
"""
        try:
            url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"
            async with httpx.AsyncClient(timeout=14.0) as client:
                res = await client.post(
                    url,
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                    headers={"Content-Type": "application/json"}
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
                            logger.info(f"[Gemini AI] Generated real-time advisory tasks for {crop_type} ({lang}).")
                            return parsed
                else:
                    logger.warning("[Gemini AI Advisory] API status %s: %s", res.status_code, res.text[:200])
        except Exception as e:
            logger.warning("[Gemini AI Advisory] Error calling Gemini: %s", e)

        return self._fallback_tasks(crop_type, ndvi, temp_c, lang)

    async def ask_agronomist_assistant(
        self,
        question: str,
        aoi_data: Dict[str, Any],
        crop_type: str,
        ndvi: float,
        temp_c: float,
        rain_mm: float,
        lang: str = "en"
    ) -> str:
        """Interactive Question-Answering for the farmer with real-time farm context."""
        if not self.api_key:
            return "KrishiDrishti AI Agronomist is currently monitoring your field. Provide drip irrigation within 48 hours to sustain flowering."

        LANG_NAMES = {
            "mr": "Marathi (मराठी)",
            "hi": "Hindi (हिन्दी)",
            "kn": "Kannada (ಕನ್ನಡ)",
            "te": "Telugu (తెలుగు)",
            "en": "English"
        }
        lang_full = LANG_NAMES.get(lang, "English / Hindi as asked")

        location = f"{aoi_data.get('village', 'Field')}, {aoi_data.get('district', 'Jalna')}, {aoi_data.get('state', 'Maharashtra')}"
        prompt = f"""
You are KrishiDrishti AI's Expert Virtual Agronomist (कृषी सहाय्यक).
The farmer is asking you a direct question about their farm.

REAL-TIME FIELD TELEMETRY & CONTEXT:
- Location: {location}
- Active Crop: {crop_type.upper()}
- Sentinel-2 NDVI: {ndvi:.2f} (Vegetation Health)
- Ambient Temperature: {temp_c:.1f}°C
- Forecast Rainfall: {rain_mm:.0f} mm
- Output Language: {lang_full}

FARMER'S QUESTION:
"{question}"

INSTRUCTIONS FOR YOUR ANSWER:
1. Answer the farmer's question directly, accurately, and practically. Do NOT give generic unrelated answers.
2. Reply in the farmer's chosen language: {lang_full} (If the farmer asked in Hindi or Marathi, answer in natural, clear Devanagari script).
3. If they ask about pests, diseases, irrigation, or fertilizers for {crop_type.upper()}, give exact brand-neutral chemical/organic formulations with precise measurements (e.g. ml/liter or kg/acre).
4. Format with short bullet points so it is easy to read on a mobile screen.
"""
        try:
            url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"
            async with httpx.AsyncClient(timeout=14.0) as client:
                res = await client.post(
                    url,
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                    headers={"Content-Type": "application/json"}
                )
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        return candidates[0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            logger.warning("[Gemini AI Q&A] Error: %s", e)

        return "KrishiDrishti AI recommends verifying field soil moisture and applying crop-specific nutrients as per local KVK guidance."

    def _fallback_tasks(self, crop: str, ndvi: float, temp_c: float, lang: str) -> List[Dict[str, Any]]:
        """Reliable fallback tasks if offline."""
        if lang == "mr":
            return [
                {
                    "id": 1,
                    "title": "४८ तासांच्या आत ठिबक सिंचन द्या",
                    "subtitle": f"उपग्रह NDVI {ndvi:.2f} आणि {temp_c:.1f}°C तापमानामुळे जमिनीतील ओलावा कमी झाला आहे.",
                    "urgency": "तातडीचे",
                    "icon": "Droplets"
                },
                {
                    "id": 2,
                    "title": "पोटॅशियम नायट्रेट (13:0:45) फवारणी करा",
                    "subtitle": "१० ग्रॅम प्रति लिटर पाण्यात मिसळून पिकाची दुष्काळ सहनशीलता वाढवा.",
                    "urgency": "तातडीचे",
                    "icon": "Sprout"
                },
                {
                    "id": 3,
                    "title": "पांढरी माशी व कीड निरीक्षण",
                    "subtitle": "पानांच्या खाली कीड तपासा आणि आवश्यकतेनुसार निंबोळी अर्क ५% फवारा.",
                    "urgency": "नियमित",
                    "icon": "ShieldCheck"
                }
            ]
        return [
            {
                "id": 1,
                "title": "Give Drip Irrigation Within 48 Hours",
                "subtitle": f"Sentinel-2 NDVI is {ndvi:.2f} with {temp_c:.1f}°C heat; provide moisture to stop flower shedding.",
                "urgency": "Urgent",
                "icon": "Droplets"
            },
            {
                "id": 2,
                "title": "Foliar Spray of Potassium Nitrate (13:0:45)",
                "subtitle": "Mix 10g/Litre water to boost plant osmotic strength and drought tolerance.",
                "urgency": "High",
                "icon": "Sprout"
            },
            {
                "id": 3,
                "title": "Inspect for Whitefly and Sucking Pests",
                "subtitle": "Check underside of leaves; spray 5% Neem seed kernel extract if needed.",
                "urgency": "Routine",
                "icon": "ShieldCheck"
            }
        ]


gemini_service = GeminiAgronomistService()
