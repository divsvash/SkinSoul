// ============================================================
//  services/aiService.js
//  Powered by Google Gemini (free tier — no credit card needed)
//
//  SETUP:
//    1. Go to https://aistudio.google.com → Get API Key → Create API key
//    2. Add to your .env:  GEMINI_API_KEY=your_key_here
//    3. Run: npm install @google/generative-ai
// ============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// gemini-1.5-flash is free and supports vision (image analysis)
const VISION_MODEL = 'gemini-1.5-flash';
// gemini-1.5-flash is also great for text generation
const TEXT_MODEL   = 'gemini-1.5-flash';

// ── Helpers ──────────────────────────────────────────────────

function buildLifestyleContext(lifestyle) {
  if (!lifestyle) return 'No lifestyle data provided.';

  const {
    diet = {}, exercise = {}, sleep = {}, medical = {}, skincare = {},
    name, age, city, gender
  } = lifestyle;

  return `
PATIENT PROFILE:
- Name: ${name || 'Not provided'}
- Age: ${age || 'Not provided'}
- Gender: ${gender || 'Not provided'}
- City: ${city || 'Not provided'}

DIET:
- Type: ${diet.type || 'Not specified'}
- Dairy: ${diet.dairy || 'Not specified'}
- Sugar intake: ${diet.sugar || 'Not specified'}
- Habits: ${(diet.habits || []).join(', ') || 'None selected'}

EXERCISE:
- Frequency: ${exercise.frequency || 'Not specified'}
- Types: ${(exercise.types || []).join(', ') || 'Not specified'}
- Post-workout cleanse: ${exercise.postWorkoutCleanse || 'Not specified'}

SLEEP:
- Duration: ${sleep.duration || 'Not specified'}
- Schedule: ${sleep.schedule || 'Not specified'}
- Pillowcase changed: ${sleep.pillowcaseFreq || 'Not specified'}
- Habits: ${(sleep.habits || []).join(', ') || 'None'}

MEDICAL:
- Skin conditions: ${(medical.skinConditions || []).join(', ') || 'None'}
- Hormonal: ${(medical.hormonal || []).join(', ') || 'None'}
- Medications: ${medical.medications || 'None'}
- Stress level: ${medical.stress || 'Not specified'}
- Family history: ${medical.familyHistory || 'Not provided'}
- Allergies: ${medical.allergies || 'None'}

SKINCARE ROUTINE:
- Morning: ${(skincare.morning || []).join(', ') || 'Not specified'}
- Night: ${(skincare.night || []).join(', ') || 'Not specified'}
- SPF: ${skincare.spf || 'Not specified'}
- Home remedies: ${skincare.homeRemedies || 'None mentioned'}
`.trim();
}

// ── Helper: safely parse JSON from AI response ───────────────
function parseJSON(text) {
  // Strip markdown code fences if present
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/,  '')
    .trim();
  return JSON.parse(clean);
}

// ── 1. Skin Image Analysis ────────────────────────────────────
async function analyzeSkinImage(imageBase64, mimeType, lifestyleData) {
  const model = genAI.getGenerativeModel({ model: VISION_MODEL });

  const lifestyleContext = buildLifestyleContext(lifestyleData);

  const prompt = `You are a professional AI skin analysis assistant. Analyse the skin in this image carefully and return a JSON object — no markdown, no prose, only valid JSON.

PATIENT LIFESTYLE CONTEXT:
${lifestyleContext}

Analyse the image for:
1. Skin type (oily/dry/combination/normal/sensitive)
2. Hydration level (scale 1-10)
3. Visible concerns (acne, pores, pigmentation, texture, redness, fine lines, sun damage)
4. Skin health score (0-100)
5. Correlations between lifestyle factors and observed skin state

Return ONLY this exact JSON structure (no extra text, no markdown):
{
  "skinScore": <number 0-100>,
  "skinType": "<oily|dry|combination|normal|sensitive>",
  "hydrationLevel": <number 1-10>,
  "concerns": [
    {
      "issue": "<issue name>",
      "severity": "<mild|moderate|severe>",
      "color": "<hex color e.g. #E76F51>",
      "description": "<plain-english 1 sentence, warm non-alarming tone>"
    }
  ],
  "positives": [
    {
      "aspect": "<what is working well>",
      "description": "<1 sentence>"
    }
  ],
  "lifestyleCorrelations": [
    {
      "factor": "<diet|exercise|sleep|hydration|stress|skincare>",
      "impact": "<positive|negative|neutral>",
      "observation": "<how this lifestyle factor is visibly affecting the skin>"
    }
  ],
  "immediateActions": [
    "<most urgent single action the person can take today>"
  ],
  "analysisConfidence": <number 0-100>,
  "disclaimer": "This AI analysis is for informational purposes only and does not constitute medical advice."
}`;

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const text   = result.response.text();
  return parseJSON(text);
}

// ── 2. Personalised User Report ───────────────────────────────
async function generatePersonalisedReport(analysisResult, lifestyleData, userName) {
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

  const prompt = `You are SkinSoul's caring AI advisor. Generate a warm, personalised skin health report for ${userName || 'the user'}.

SKIN ANALYSIS RESULTS:
${JSON.stringify(analysisResult, null, 2)}

LIFESTYLE DATA:
${buildLifestyleContext(lifestyleData)}

Return ONLY valid JSON (no markdown, no extra text):
{
  "greeting": "<warm personal greeting using their name, 1 sentence>",
  "overallMessage": "<2-3 sentence encouraging summary>",
  "skinScoreLabel": "<Glowing|Good|Needs Attention|Work in Progress>",
  "suggestedChanges": [
    {
      "category": "<diet|exercise|sleep|skincare|lifestyle>",
      "emoji": "<relevant emoji>",
      "title": "<action title max 8 words>",
      "description": "<2-3 sentences specific actionable advice using their actual lifestyle data>",
      "priority": "<high|medium|low>"
    }
  ],
  "gharKeNuskhe": [
    {
      "name": "<Hindi/English home remedy name>",
      "emoji": "<emoji>",
      "ingredients": "<exact amounts>",
      "method": "<brief how-to>",
      "frequency": "<how often>",
      "targetConcern": "<which skin concern this addresses>"
    }
  ],
  "weeklyRoutineBoosts": [
    "<one small addition to their existing routine>"
  ],
  "hydrationInsight": "<personalised water tip based on their intake and skin hydration>",
  "motivationalNote": "<warm personal closing 2 sentences>"
}`;

  const result = await model.generateContent(prompt);
  const text   = result.response.text();
  return parseJSON(text);
}

// ── 3. Dermatologist Clinical Report ─────────────────────────
async function generateDermatologistReport(analysisResult, lifestyleData, userProfile) {
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

  const prompt = `You are a clinical AI assistant generating a structured dermatology referral summary for a dermatologist to review before a patient appointment. Use professional medical terminology.

AI VISUAL ANALYSIS:
${JSON.stringify(analysisResult, null, 2)}

PATIENT LIFESTYLE (self-reported):
${buildLifestyleContext(lifestyleData)}

Return ONLY valid JSON (no markdown, no extra text):
{
  "patientSummary": {
    "chiefComplaint": "<primary skin concern in clinical terms>",
    "skinType": "<clinical classification>",
    "fitzpatrickScale": "<estimated Fitzpatrick phototype I-VI or Unable to determine>"
  },
  "aiFindings": [
    {
      "finding": "<clinical finding>",
      "location": "<face zone>",
      "severity": "<Grade I-IV or mild/moderate/severe>",
      "differentialDiagnosis": "<possible diagnoses to rule in/out>"
    }
  ],
  "lifestyleSummary": {
    "diet": "<clinical summary>",
    "exercise": "<exercise habits>",
    "sleep": "<sleep quality and habits>",
    "hormonal": "<hormonal factors>",
    "medications": "<current medications>",
    "stress": "<stress level>",
    "waterIntake": "<hydration status>",
    "uvExposure": "<sun exposure and SPF compliance>"
  },
  "aiRecommendations": [
    {
      "type": "<topical|systemic|lifestyle|investigation>",
      "suggestion": "<clinical recommendation>",
      "rationale": "<clinical reasoning>"
    }
  ],
  "flaggedForReview": [
    "<anything needing immediate clinical attention>"
  ],
  "disclaimer": "This report is AI-generated for informational purposes only. All findings must be validated by a qualified dermatologist."
}`;

  const result = await model.generateContent(prompt);
  const text   = result.response.text();
  return parseJSON(text);
}

// ── 4. Quick Skin Tip (for toasts) ───────────────────────────
async function generateSkinTip(concern, userCity, season) {
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

  const prompt = `Give one single skin care tip as plain text (no JSON, no markdown, no bullet points).
Concern: ${concern}. City: ${userCity || 'India'}. Season: ${season || 'summer'}.
Max 2 sentences. Warm friendly tone. Include one specific product or ingredient if relevant.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

module.exports = {
  analyzeSkinImage,
  generatePersonalisedReport,
  generateDermatologistReport,
  generateSkinTip,
};