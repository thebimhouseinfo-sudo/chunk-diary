import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Sequential LLM generation handler
async function tryGenerateWithModel(
  provider: string,
  modelName: string,
  apiKey: string,
  diaryContent: string,
  nativeLanguage: string,
  learningLanguages: string[],
  onboarding?: {
    nickname?: string;
    learningPurposes?: string[];
    industryCategory?: string;
    industry?: string;
    hobbyCategory?: string;
    hobby?: string;
  }
) {
  let userContextPrompt = "";
  if (onboarding) {
    const { nickname, learningPurposes, industryCategory, industry, hobbyCategory, hobby } = onboarding;
    const purposesStr = learningPurposes && learningPurposes.length > 0 ? learningPurposes.join(", ") : "";
    
    let workContext = "";
    if (learningPurposes?.includes("Công việc")) {
      workContext = `- Nhóm ngành nghề (Dropdown): ${industryCategory || "N/A"}\n- Chi tiết công việc (Mô tả): ${industry || "N/A"}`;
    }
    
    let hobbyContext = "";
    if (learningPurposes?.includes("Sở thích")) {
      hobbyContext = `- Nhóm sở thích (Dropdown): ${hobbyCategory || "N/A"}\n- Chi tiết sở thích (Mô tả): ${hobby || "N/A"}`;
    }

    userContextPrompt = `\nUser Context for personalized chunk optimization:
- User Nickname: ${nickname || "User"}
- Purpose of learning: ${purposesStr || "Not specified"}
${workContext ? `\n[Work Focus]\n${workContext}` : ""}
${hobbyContext ? `\n[Hobby Focus]\n${hobbyContext}` : ""}

*CRITICAL OPTIMIZATION GUIDELINE*:
Please customize/optimize the extracted language chunks, translations, and supplementary explanations (like IPA/notes) to be highly relevant to the user's background, profession, or hobbies specified above:
1. If learning for "Công việc" (Work), prioritize professional, corporate, and office-friendly vocabulary or idioms relevant to their field (${industryCategory} / ${industry}). Prefer polite forms (e.g. Keigo in Japanese, formal register in English/French).
2. If learning for "Sở thích" (Hobbies), prioritize words, idioms, or slang that an enthusiastic native would use in the context of their specific hobby category (${hobbyCategory} / ${hobby}).
3. When appropriate, write a short, helpful professional/hobbyist application tip or tone indicator directly within the "meaning" of the generated chunks so the user understands exactly when and how to deploy this chunk.
`;
  }

  if (provider === "gemini") {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required or custom key must be provided");
    }
    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `You are an expert language teacher and translator specializing in chunk-based learning.
Native Language: ${nativeLanguage}
Learning Languages: ${learningLanguages.join(", ")}
Diary Content: "${diaryContent}"${userContextPrompt}

Please process this diary according to these guidelines:
1. Understand the exact meaning of the diary in ${nativeLanguage}.
2. Split it into a series of logical "Meaning Units" (sentences or complete thoughts) in order.
3. For each Meaning Unit:
   - Provide the original text in ${nativeLanguage} (nativeText).
   - Translate it into natural, idiomatic English (englishPivot) as an intermediary translation (English Pivot).
   - For each requested learning language, translate the Meaning Unit into a natural, native-like sentence.
   - For each translated sentence, extract 1 to 3 "Language Chunks" (natural, idiomatic units of language like collocations, phrases, or short sentences, NOT just single words unless the word itself is an idiom).
   - For each extracted chunk, generate:
     * text: The exact chunk text in the learning language.
     * meaning: The translation of this chunk back into ${nativeLanguage}.
     * ipa: International Phonetic Alphabet (IPA) pronunciation guide (e.g., /haʊ z ɪt ˈɡoʊɪŋ/ or equivalent).
     * romanization: Easy-to-read romanization of the chunk text. ONLY if the language does NOT use the Latin alphabet (e.g. Chinese, Japanese, Korean, Russian, Greek, Hindi, Arabic). For these languages, format the romanization with syllable separators (e.g. "Sa-rang-hae-yo" or "Sa · rang · hae · yo" or "nǐ-hǎo"). If the language uses the Latin alphabet (like English, Spanish, French, German), leave romanization as empty string "".

Return a JSON object conforming exactly to this structure:
{
  "meaningUnits": [
    {
      "order": number,
      "nativeText": "string",
      "englishPivot": "string",
      "chunks": [
        {
          "language": "string",
          "text": "string",
          "meaning": "string",
          "ipa": "string",
          "romanization": "string"
        }
      ]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            meaningUnits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  order: { type: Type.INTEGER },
                  nativeText: { type: Type.STRING },
                  englishPivot: { type: Type.STRING },
                  chunks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        language: { type: Type.STRING },
                        text: { type: Type.STRING },
                        meaning: { type: Type.STRING },
                        ipa: { type: Type.STRING },
                        romanization: { type: Type.STRING }
                      },
                      required: ["language", "text", "meaning", "ipa", "romanization"]
                    }
                  }
                },
                required: ["order", "nativeText", "englishPivot", "chunks"]
              }
            }
          },
          required: ["meaningUnits"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    return JSON.parse(text);

  } else if (provider === "openai" || provider === "xai") {
    const baseUrl = provider === "openai" 
      ? "https://api.openai.com/v1" 
      : "https://api.xai.com/v1";

    if (!apiKey) {
      throw new Error(`API Key is required for provider ${provider}`);
    }

    const prompt = `You are an expert language teacher and translator specializing in chunk-based learning.
Native Language: ${nativeLanguage}
Learning Languages: ${learningLanguages.join(", ")}
Diary Content: "${diaryContent}"${userContextPrompt}

Please process this diary according to these guidelines:
1. Understand the exact meaning of the diary in ${nativeLanguage}.
2. Split it into a series of logical "Meaning Units" (sentences or complete thoughts) in order.
3. For each Meaning Unit:
   - Provide original text in ${nativeLanguage} (nativeText).
   - Translate it into natural, idiomatic English (englishPivot) as an intermediary translation (English Pivot).
   - For each requested learning language, translate the Meaning Unit into a natural, native-like sentence.
   - For each translated sentence, extract 1 to 3 "Language Chunks" (natural, idiomatic units of language like collocations, phrases, or short sentences, NOT just single words unless the word itself is an idiom).
   - For each extracted chunk, generate:
     * text: The exact chunk text in the learning language.
     * meaning: The translation of this chunk back into ${nativeLanguage}.
     * ipa: International Phonetic Alphabet (IPA) pronunciation guide.
     * romanization: Easy-to-read romanization with syllable separators (e.g. "Sa-rang-hae-yo" or "Sa · rang · hae · yo" or "nǐ-hǎo") ONLY if the language does NOT use the Latin alphabet. Leave as empty string for Latin alphabet languages.

Your response must be a JSON object conforming exactly to this schema:
{
  "meaningUnits": [
    {
      "order": number,
      "nativeText": "string",
      "englishPivot": "string",
      "chunks": [
        {
          "language": "string",
          "text": "string",
          "meaning": "string",
          "ipa": "string",
          "romanization": "string"
        }
      ]
    }
  ]
}`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: "You are a helpful language tutoring assistant. Always return valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error from ${provider} (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response content from provider");
    return JSON.parse(content);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

// REST API Endpoints
app.post("/api/generate-chunks", async (req, res) => {
  const { diaryContent, nativeLanguage, learningLanguages, provider, apiKey, models, onboarding } = req.body;

  if (!diaryContent || !nativeLanguage || !learningLanguages || !learningLanguages.length) {
    return res.status(400).json({ error: "Missing required fields (diaryContent, nativeLanguage, or learningLanguages)" });
  }

  const providerType = provider || "gemini";
  const modelList = (models && models.length) ? models : (providerType === "gemini" ? ["gemini-3.5-flash", "gemini-3.1-flash-lite"] : []);

  if (!modelList.length) {
    return res.status(400).json({ error: `No models specified or available for provider ${providerType}` });
  }

  const errors: string[] = [];

  // Sequential try
  for (const modelName of modelList) {
    try {
      console.log(`Attempting generation using provider: ${providerType}, model: ${modelName}`);
      const result = await tryGenerateWithModel(
        providerType,
        modelName,
        apiKey,
        diaryContent,
        nativeLanguage,
        learningLanguages,
        onboarding
      );
      // Successful generation
      return res.json({ result, modelUsed: modelName });
    } catch (err: any) {
      const errMsg = err.message || err;
      console.warn(`Model ${modelName} failed: ${errMsg}`);
      errors.push(`${modelName}: ${errMsg}`);
    }
  }

  // If all models failed
  res.status(502).json({
    error: "All configured models failed to process the request",
    details: errors
  });
});

// Vite Middleware Configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
