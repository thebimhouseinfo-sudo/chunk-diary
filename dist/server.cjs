var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
var import_vite = require("vite");
import_dotenv.default.config();
var app = (0, import_express.default)();
app.use(import_express.default.json());
app.use((req, res, next) => {
  const ext = import_path.default.extname(req.path);
  if (ext === ".js" || ext === ".mjs") {
    res.type("application/javascript");
  } else if (ext === ".ts" || ext === ".tsx" || ext === ".jsx") {
    res.type("application/javascript");
  } else if (ext === ".css") {
    res.type("text/css");
  }
  next();
});
var PORT = 3e3;
async function tryGenerateWithModel(provider, modelName, apiKey, diaryContent, nativeLanguage, learningLanguages, onboarding) {
  let userContextPrompt = "";
  if (onboarding) {
    const { nickname, learningPurposes, industryCategory, industry, hobbyCategory, hobby } = onboarding;
    const purposesStr = learningPurposes && learningPurposes.length > 0 ? learningPurposes.join(", ") : "";
    let workContext = "";
    if (learningPurposes?.includes("C\xF4ng vi\u1EC7c")) {
      workContext = `- Nh\xF3m ng\xE0nh ngh\u1EC1 (Dropdown): ${industryCategory || "N/A"}
- Chi ti\u1EBFt c\xF4ng vi\u1EC7c (M\xF4 t\u1EA3): ${industry || "N/A"}`;
    }
    let hobbyContext = "";
    if (learningPurposes?.includes("S\u1EDF th\xEDch")) {
      hobbyContext = `- Nh\xF3m s\u1EDF th\xEDch (Dropdown): ${hobbyCategory || "N/A"}
- Chi ti\u1EBFt s\u1EDF th\xEDch (M\xF4 t\u1EA3): ${hobby || "N/A"}`;
    }
    userContextPrompt = `
User Context for personalized chunk optimization:
- User Nickname: ${nickname || "User"}
- Purpose of learning: ${purposesStr || "Not specified"}
${workContext ? `
[Work Focus]
${workContext}` : ""}
${hobbyContext ? `
[Hobby Focus]
${hobbyContext}` : ""}

*CRITICAL OPTIMIZATION GUIDELINE*:
Please customize/optimize the extracted language chunks, translations, and supplementary explanations (like IPA/notes) to be highly relevant to the user's background, profession, or hobbies specified above:
1. If learning for "C\xF4ng vi\u1EC7c" (Work), prioritize professional, corporate, and office-friendly vocabulary or idioms relevant to their field (${industryCategory} / ${industry}). Prefer polite forms (e.g. Keigo in Japanese, formal register in English/French).
2. If learning for "S\u1EDF th\xEDch" (Hobbies), prioritize words, idioms, or slang that an enthusiastic native would use in the context of their specific hobby category (${hobbyCategory} / ${hobby}).
3. When appropriate, write a short, helpful professional/hobbyist application tip or tone indicator directly within the "meaning" of the generated chunks so the user understands exactly when and how to deploy this chunk.
`;
  }
  if (provider === "gemini") {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required or custom key must be provided");
    }
    const ai = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "chunk-diary-app"
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
     * ipa: International Phonetic Alphabet (IPA) pronunciation guide (e.g., /ha\u028A z \u026At \u02C8\u0261o\u028A\u026A\u014B/ or equivalent).
     * romanization: Easy-to-read romanization of the chunk text. ONLY if the language does NOT use the Latin alphabet (e.g. Chinese, Japanese, Korean, Russian, Greek, Hindi, Arabic). For these languages, format the romanization with syllable separators (e.g. "Sa-rang-hae-yo" or "Sa \xB7 rang \xB7 hae \xB7 yo" or "n\u01D0-h\u01CEo"). If the language uses the Latin alphabet (like English, Spanish, French, German), leave romanization as empty string "".

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
          type: import_genai.Type.OBJECT,
          properties: {
            meaningUnits: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  order: { type: import_genai.Type.INTEGER },
                  nativeText: { type: import_genai.Type.STRING },
                  englishPivot: { type: import_genai.Type.STRING },
                  chunks: {
                    type: import_genai.Type.ARRAY,
                    items: {
                      type: import_genai.Type.OBJECT,
                      properties: {
                        language: { type: import_genai.Type.STRING },
                        text: { type: import_genai.Type.STRING },
                        meaning: { type: import_genai.Type.STRING },
                        ipa: { type: import_genai.Type.STRING },
                        romanization: { type: import_genai.Type.STRING }
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
    const baseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.xai.com/v1";
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
     * romanization: Easy-to-read romanization with syllable separators (e.g. "Sa-rang-hae-yo" or "Sa \xB7 rang \xB7 hae \xB7 yo" or "n\u01D0-h\u01CEo") ONLY if the language does NOT use the Latin alphabet. Leave as empty string for Latin alphabet languages.

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
app.post("/api/generate-chunks", async (req, res) => {
  const { diaryContent, nativeLanguage, learningLanguages, provider, apiKey, models, onboarding } = req.body;
  if (!diaryContent || !nativeLanguage || !learningLanguages || !learningLanguages.length) {
    return res.status(400).json({ error: "Missing required fields (diaryContent, nativeLanguage, or learningLanguages)" });
  }
  const providerType = provider || "gemini";
  const modelList = models && models.length ? models : providerType === "gemini" ? ["gemini-3.5-flash", "gemini-3.1-flash-lite"] : [];
  if (!modelList.length) {
    return res.status(400).json({ error: `No models specified or available for provider ${providerType}` });
  }
  const errors = [];
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
      return res.json({ result, modelUsed: modelName });
    } catch (err) {
      const errMsg = err.message || err;
      console.warn(`Model ${modelName} failed: ${errMsg}`);
      errors.push(`${modelName}: ${errMsg}`);
    }
  }
  res.status(502).json({
    error: "All configured models failed to process the request",
    details: errors
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use((req, res, next) => {
      if (req.path.endsWith(".tsx") || req.path.endsWith(".ts")) {
        res.setHeader("Content-Type", "application/javascript");
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
