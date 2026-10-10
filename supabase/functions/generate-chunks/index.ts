import { GoogleGenAI, Type } from "npm:@google/genai@2.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GenerateChunksInput {
  diaryContent?: string;
  nativeLanguage?: string;
  targetLanguage?: string;
  cefrLevel?: string;
  specialty?: string;
  subSpecialty?: string;
  profileContext?: string;
  existingSemanticGroups?: Array<{
    id?: string;
    canonicalMeaning: string;
    coverageLevel: number;
    createdAt: string;
  }>;
}

const chunkSchema = {
  type: Type.OBJECT,
  properties: {
    english: { type: Type.STRING },
    text: { type: Type.STRING },
    meaning: { type: Type.STRING },
    ipa: { type: Type.STRING },
    romanization: { type: Type.STRING },
    semanticGroupId: { type: Type.STRING },
    proposedCanonicalMeaning: { type: Type.STRING },
  },
  required: ["english", "text", "meaning", "ipa", "romanization", "semanticGroupId"],
};

function buildPrompt(input: Required<Pick<GenerateChunksInput, "diaryContent" | "nativeLanguage" | "targetLanguage">> & GenerateChunksInput) {
  const existingGroups = input.existingSemanticGroups?.slice(0, 80) ?? [];

  return `You are an expert language teacher specializing in chunk-based learning.

Native language: ${input.nativeLanguage}
Target language: ${input.targetLanguage}
CEFR level: ${input.cefrLevel || "not specified"}
Specialty/profession: ${input.specialty || "not specified"}
Sub-specialty: ${input.subSpecialty || "not specified"}
Profile context: ${input.profileContext || "not specified"}

Existing semantic groups:
${JSON.stringify(existingGroups, null, 2)}

Diary:
${input.diaryContent}

Tasks:
1. Translate the diary into a natural English narrative.
2. Split the diary into ordered semantic units.
3. For each semantic unit, provide the original native text and an English translation.
4. Extract common chunks and personalized chunks in the target language.
5. Prefer reusing a matching existing semanticGroupId when the meaning matches an existing semantic group.
6. If no existing group matches, set semanticGroupId to an empty string and provide proposedCanonicalMeaning.

Return only JSON with this exact shape:
{
  "englishNarrative": "string",
  "semanticUnits": [
    {
      "order": 1,
      "nativeText": "string",
      "englishText": "string",
      "commonChunks": [],
      "personalizedChunks": []
    }
  ]
}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return Response.json({ success: false, error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ success: false, error: "Authentication is required to generate chunks" }, { status: 401, headers: corsHeaders });
    }

    const input = await req.json() as GenerateChunksInput;
    if (!input.diaryContent || !input.nativeLanguage || !input.targetLanguage) {
      return Response.json({ success: false, error: "Missing required fields: diaryContent, nativeLanguage, targetLanguage" }, { status: 400, headers: corsHeaders });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return Response.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500, headers: corsHeaders });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash",
      contents: buildPrompt(input as Required<Pick<GenerateChunksInput, "diaryContent" | "nativeLanguage" | "targetLanguage">> & GenerateChunksInput),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            englishNarrative: { type: Type.STRING },
            semanticUnits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  order: { type: Type.INTEGER },
                  nativeText: { type: Type.STRING },
                  englishText: { type: Type.STRING },
                  commonChunks: { type: Type.ARRAY, items: chunkSchema },
                  personalizedChunks: { type: Type.ARRAY, items: chunkSchema },
                },
                required: ["order", "nativeText", "englishText", "commonChunks", "personalizedChunks"],
              },
            },
          },
          required: ["englishNarrative", "semanticUnits"],
        },
      },
    });

    if (!response.text) {
      return Response.json({ success: false, error: "Empty response from Gemini" }, { status: 502, headers: corsHeaders });
    }

    return Response.json({ success: true, result: response.text }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ success: false, error: message }, { status: 500, headers: corsHeaders });
  }
});
