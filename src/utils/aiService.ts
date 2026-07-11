/**
 * Background AI Service helper for processing diary entries via Google App Script endpoint queue.
 */

// Generate a unique, consistent browser fingerprint
export function getBrowserFingerprint(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + "x" + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || "",
    (navigator as any).deviceMemory || ""
  ];
  const rawString = parts.join("|");

  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  let localId = localStorage.getItem("browser_fingerprint_id");
  if (!localId) {
    localId = "FP-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
    localStorage.setItem("browser_fingerprint_id", localId);
  }

  return `FP-${Math.abs(hash)}-${localId}`;
}

const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbxLmRVOSZXYzipNowTNuRPesNoErVlTZiRdaJVZ-I6zfergemuax1UIYDUaeB0pa2O7/exec";

export interface AIServiceResponse {
  meaningUnits: Array<{
    order: number;
    nativeText: string;
    englishPivot: string;
    chunks: Array<{
      language: string;
      text: string;
      meaning: string;
      ipa: string;
      romanization: string;
    }>;
  }>;
}

/**
 * Sends a prompt to the Google App Script queue and polls until the completed result is ready.
 * Returns a Promise that resolves to the final structured response.
 */
export function callBackgroundAIService(
  prompt: string,
  appScriptUrl: string,
  onStatusUpdate?: (status: "Pending" | "Processing" | "Completed" | "Failed", message: string) => void
): Promise<AIServiceResponse> {
  return new Promise(async (resolve, reject) => {
    const fingerprint = getBrowserFingerprint();
    const finalUrl = appScriptUrl?.trim() || ENDPOINT_URL;

    try {
      if (onStatusUpdate) {
        onStatusUpdate("Pending", "Đang kết nối tới hệ thống xếp hàng...");
      }

      const reqRes = await fetch(finalUrl, {
        method: "POST",
        mode: "cors",
        redirect: "follow",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          fingerprint,
          prompt,
          action: "request"
        })
      });

      if (!reqRes.ok) {
        throw new Error(`Lỗi kết nối máy chủ hàng đợi: ${reqRes.statusText}`);
      }

      const reqData = await reqRes.json();
      if (!reqData.success) {
        throw new Error(reqData.error || "Gửi yêu cầu vào hàng đợi không thành công.");
      }

      const queueId = reqData.queueId;
      const initialStatus = reqData.status as "Pending" | "Processing" | "Completed" | "Failed" || "Pending";
      const initialMsg = reqData.message || "Đã xếp vào hàng đợi ngầm thành công.";

      if (onStatusUpdate) {
        onStatusUpdate(initialStatus, `${initialMsg} (Mã vé: ${queueId})`);
      }

      // 2. Start Polling until "Completed" or "Failed"
      const pollIntervalMs = 5000; // Poll every 5 seconds
      const maxRetries = 120; // 120 * 5s = 10 minutes max timeout
      let retries = 0;

      const poll = async () => {
        try {
          const checkRes = await fetch(finalUrl, {
            method: "POST",
            mode: "cors",
            redirect: "follow",
            headers: {
              "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
              fingerprint,
              action: "check",
              queueId
            })
          });

          if (!checkRes.ok) {
            console.warn(`Polling request failed with status: ${checkRes.status}. Retrying...`);
            retries++;
            if (retries >= maxRetries) {
              reject(new Error("Quá thời gian chờ xử lý từ hàng đợi (Timeout)."));
            } else {
              setTimeout(poll, pollIntervalMs);
            }
            return;
          }

          const checkData = await checkRes.json();
          if (!checkData.success) {
            throw new Error(checkData.error || "Không thể kiểm tra trạng thái hàng đợi.");
          }

          const status = checkData.status as "Pending" | "Processing" | "Completed" | "Failed";
          const result = checkData.result; // Final text or error description

          if (status === "Completed") {
            if (onStatusUpdate) {
              onStatusUpdate("Completed", "Đã nhận kết quả hoàn tất!");
            }
            try {
              const parsedResult = cleanAndParseJSON(result);
              resolve(parsedResult);
            } catch (parseErr) {
              reject(new Error(`Không thể phân tích dữ liệu trả về từ AI: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`));
            }
          } else if (status === "Failed") {
            reject(new Error(`Yêu cầu xử lý thất bại: ${result || "Lỗi không rõ từ AI Worker"}`));
          } else {
            // Still Pending or Processing
            retries++;
            if (retries >= maxRetries) {
              reject(new Error("Quá thời gian chờ xử lý từ hàng đợi (Timeout 10 phút)."));
              return;
            }

            const statusLabel = status === "Processing" ? "Đang xử lý bằng AI" : "Đang chờ hàng đợi";
            if (onStatusUpdate) {
              onStatusUpdate(status, `Trạng thái: ${statusLabel}... (Vòng lặp ${retries})`);
            }
            setTimeout(poll, pollIntervalMs);
          }
        } catch (err) {
          retries++;
          if (retries >= maxRetries) {
            reject(err instanceof Error ? err : new Error(String(err)));
          } else {
            setTimeout(poll, pollIntervalMs);
          }
        }
      };

      // Start initial poll after 5 seconds
      setTimeout(poll, pollIntervalMs);

    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function cleanAndParseJSON(rawText: string): AIServiceResponse {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}
