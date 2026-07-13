// ==========================================
// CẤU HÌNH HỆ THỐNG TỰ ĐỘNG LẤY TỪ SCRIPT PROPERTIES
// ==========================================
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty("API");
const GEMINI_MODEL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"; 

/**
 * API Endpoint chính nhận request POST từ Frontend ngoài (GitHub Pages)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (!GEMINI_API_KEY) {
      return createResponse({ success: false, error: "Chưa cấu hình API Key trong Script Properties với key là 'API'." });
    }

    if (!data.fingerprint) {
      return createResponse({ success: false, error: "Thiếu thông tin định danh trình duyệt (Fingerprint)." });
    }

    if (action === "generateChunks") {
      const { diaryContent, nativeLanguage, targetLanguage, cefrLevel, profileContext, existingSemanticGroups } = data;
      
      if (!diaryContent) {
        return createResponse({ success: false, error: "Thiếu nội dung nhật ký." });
      }

      // Xây dựng prompt
      let existingGroupsContext = "";
      if (existingSemanticGroups && existingSemanticGroups.length > 0) {
        existingGroupsContext = `\n## Existing Semantic Groups in User Library
When generating chunks, you MUST check if a chunk matches any existing Semantic Group below.
If its core meaning is highly similar to an existing group, assign that group's ID to "semanticGroupId".
If it represents a completely new idea, set "semanticGroupId" to "new" and provide a "proposedCanonicalMeaning" for it.\n
${existingSemanticGroups.map(g => `- ID: "${g.id}", Meaning: "${g.canonicalMeaning}"`).join("\n")}\n`;
      }

      const prompt = `You are an expert language teacher specializing in chunk-based sentence learning.

## Context
- Native Language (Language 1): ${nativeLanguage || "Vietnamese"}
- Target Language (Language 2): ${targetLanguage || "English"}
- CEFR Level: ${cefrLevel || "A2"}
- User Profile: ${profileContext || "General learner"}

## Diary Content (written in ${nativeLanguage || "Vietnamese"}):
"${diaryContent}"

## Processing Instructions

### Step 1: Understand
Read the entire diary in ${nativeLanguage || "Vietnamese"}. Understand the topic, context, emotions, and meaning. Do NOT translate word by word.

### Step 2: English Narrative
Rewrite the entire diary as a natural English narrative. English serves as the sole semantic layer.

### Step 3: Semantic Units
Split the English Narrative into Semantic Units. Each Semantic Unit represents one complete idea.

### Step 4: Generate Chunks
For each Semantic Unit:

**Common Chunks (1-3):**
- Each chunk is a complete, natural English sentence.
- Preserves the meaning of the Semantic Unit.
- Appropriate for CEFR level ${cefrLevel || "A2"}.
- Natural, as a native speaker would say it.

**Personalized Chunks (0-3):**
- Each chunk is a complete, natural English sentence.
- Based on the user's profile: ${profileContext || "General learner"}.
- Preserves the meaning of the Semantic Unit.
- Only generate if relevant to the user's profile. Can be empty array.

### Step 5: Convert to ${targetLanguage || "English"}
For each English chunk:
- Convert to a complete, natural sentence in ${targetLanguage || "English"}.
- Prioritize native-like expression in ${targetLanguage || "English"}.
- Do NOT translate word by word.
- For non-Latin script languages, provide romanization with syllable separators (e.g. "Sa-rang-hae-yo" or "nǐ-hǎo"). For Latin-script languages, use empty string.

## Chunk Definition
A Chunk is: A short, complete, natural sentence that expresses a complete meaning and can be used independently in conversation.
A good chunk should: have a subject when needed, have a main verb, use correct tense and context, be immediately usable in conversation.

## Core Principles
- Meaning First. Natural First.
- English is the sole Semantic Layer.
- Each chunk is a complete sentence, NOT a phrase or collocation.
- Personalized Chunks only add learning value, they do NOT change the Semantic Unit's meaning.
${existingGroupsContext}
Return a JSON object conforming exactly to this structure:
{
  "englishNarrative": "string (full English narrative)",
  "semanticUnits": [
    {
      "order": 1,
      "nativeText": "string (original text segment in ${nativeLanguage || "Vietnamese"})",
      "englishText": "string (semantic unit in English)",
      "commonChunks": [
        {
          "english": "string (complete English sentence)",
          "text": "string (complete sentence in ${targetLanguage || "English"})",
          "romanization": "string",
          "semanticGroupId": "string (existing group ID, or 'new')",
          "proposedCanonicalMeaning": "string (canonical meaning in English, if semanticGroupId is 'new')"
        }
      ],
      "personalizedChunks": [
        {
          "english": "string (complete English sentence)",
          "text": "string (complete sentence in ${targetLanguage || "English"})",
          "romanization": "string",
          "semanticGroupId": "string (existing group ID, or 'new')",
          "proposedCanonicalMeaning": "string (canonical meaning in English, if semanticGroupId is 'new')"
        }
      ]
    }
  ]
}`;

      console.log("Generating chunks for diary content...");
      const responseText = callGeminiAPI(prompt);

      return createResponse({
        success: true,
        status: "Completed",
        result: responseText
      });
    }

    return createResponse({ success: false, error: `Action '${action}' không được hỗ trợ.` });

  } catch (error) {
    return createResponse({ success: false, error: error.toString() });
  }
}

/**
 * Hàm gọi trực tiếp lên REST API của Gemini với cấu hình ép xuất JSON
 */
function callGeminiAPI(promptText) {
  const url = `${GEMINI_MODEL}?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const resCode = response.getResponseCode();
  const resBody = response.getContentText();
  const json = JSON.parse(resBody);
  
  if (resCode !== 200) {
    throw new Error(`Gemini API Error (Status ${resCode}): ${resBody}`);
  }
  
  if (json.candidates && json.candidates[0].content.parts[0].text) {
    return json.candidates[0].content.parts[0].text;
  } else {
    throw new Error("Cấu trúc phản hồi JSON nhận được từ Gemini không hợp lệ.");
  }
}

/**
 * Helper đóng gói dữ liệu phản hồi JSON hỗ trợ CORS cho ứng dụng Web gọi ngoài
 */
function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}