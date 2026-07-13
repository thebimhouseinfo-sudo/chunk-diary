import { UserSettings } from "../../../types";

function getLanguageNameVi(lang: string | undefined): string {
  if (!lang) return "ngôn ngữ mục tiêu";
  const l = lang.toLowerCase().trim();
  if (l.includes("english") || l.includes("anh")) return "tiếng Anh";
  if (l.includes("japanese") || l.includes("nhật")) return "tiếng Nhật";
  if (l.includes("korean") || l.includes("hàn")) return "tiếng Hàn";
  if (l.includes("chinese") || l.includes("trung")) return "tiếng Trung";
  if (l.includes("french") || l.includes("pháp")) return "tiếng Pháp";
  if (l.includes("spanish") || l.includes("tây ban nha")) return "tiếng Tây Ban Nha";
  if (l.includes("german") || l.includes("đức")) return "tiếng Đức";
  return lang;
}

function getTargetGreeting(lang: string | undefined, nickname: string): string {
  const name = nickname || "bạn";
  if (!lang) return `Hi ${name}, how are you today?`;
  const l = lang.toLowerCase().trim();
  if (l.includes("english") || l.includes("anh")) {
    const options = [
      `Hi ${name}, how are you today?`,
      `Hello ${name}, how's your day going?`,
      `Hi ${name}, what's been happening today?`,
      `Hello ${name}, tell me about your day.`,
      `Hi ${name}, did anything interesting happen today?`
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (l.includes("japanese") || l.includes("nhật")) {
    const options = [
      `こんにちは、${name}さん。お元気ですか？`,
      `こんにちは、${name}さん。今日はどんな一日でしたか？`
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (l.includes("korean") || l.includes("hàn")) {
    const options = [
      `안녕하세요, ${name}님. 오늘 하루 어떠셨나요?`,
      `안녕하세요, ${name}님. 오늘 특별한 일 있었나요?`
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (l.includes("chinese") || l.includes("trung")) {
    const options = [
      `你好，${name}。今天过得怎么样？`,
      `你好，${name}。今天有什么有趣的事吗？`
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (l.includes("french") || l.includes("pháp")) {
    const options = [
      `Bonjour ${name}, comment ça va aujourd'hui ?`,
      `Salut ${name}, comment s'est passée ta journée ?`
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (l.includes("spanish") || l.includes("tây ban nha")) {
    const options = [
      `¡Hola ${name}! ¿Cómo estás hoy?`,
      `¡Hola ${name}! ¿Qué tal tu día?`
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (l.includes("german") || l.includes("đức")) {
    const options = [
      `Hallo ${name}! Wie geht es dir heute?`,
      `Hallo ${name}! Wie war dein Tag heute?`
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  return `Hi ${name}! Let's talk!`;
}

export const chatbotMessages = {
  getGreeting: (settings: UserSettings | null, isFirstTime: boolean): string => {
    const nickname = settings?.nickname || "bạn";
    const targetLang = settings?.learningLanguages?.[0] || "English";

    const targetVi = getLanguageNameVi(targetLang);
    const targetGreeting = getTargetGreeting(targetLang, nickname);

    if (isFirstTime) {
      return `Chào ${nickname}, mình là Sky.

Bạn cứ kể cho mình nghe về ngày hôm nay bằng tiếng Việt thật tự nhiên.
Mình sẽ giúp bạn chuyển những điều bạn muốn nói thành cách diễn đạt tự nhiên bằng ${targetVi}.

Bắt đầu nhé.

${targetGreeting}`;
    } else {
      return `Chào ${nickname}, hôm nay của bạn thế nào? Kể cho mình nghe nhé!

Bạn cứ kể chuyện như đang nói với một người bạn.
Mình sẽ giúp bạn ở bước tiếp theo.

${targetGreeting}`;
    }
  },

  getEncouragement: (): string => {
    const options = [
      "Mình vẫn đang nghe đây.",
      "Bạn kể tiếp nhé.",
      "Rồi sao nữa?",
      "Sau đó thì sao?",
      "Ừm.",
      "Tiếp nhé.",
      "Mình vẫn ở đây.",
      "Còn gì nữa không?",
      "Bạn cứ kể tự nhiên nhé.",
      "Mình đang lắng nghe.",
      "Tiếp tục nhé.",
      "Bạn cứ tiếp tục khi sẵn sàng."
    ];
    return options[Math.floor(Math.random() * options.length)];
  },

  getTooLongWarning: (): string => {
    return `Một gợi ý nhỏ nhé 😊

Nếu bạn gửi từng đoạn ngắn thì mình sẽ tạo các câu luyện tập tự nhiên và chính xác hơn.

Cứ kể từng ý một là được.`;
  },

  getRecommendation: (): string => {
    return `Có vẻ câu chuyện hôm nay đã khá đầy đủ rồi.

Nếu muốn, bạn có thể bấm "Hoàn thành" để mình chuẩn bị bài luyện tập cho cuộc trò chuyện này.`;
  },

  get30sReminder: (): string => {
    const options = [
      "Còn điều gì bạn muốn kể nữa không?",
      "Bạn muốn kể thêm điều gì không?",
      "Mình vẫn đang nghe đây.",
      "Bạn cứ tiếp tục khi sẵn sàng nhé.",
      "Nếu còn điều gì muốn chia sẻ thì mình vẫn ở đây."
    ];
    return options[Math.floor(Math.random() * options.length)];
  },

  get60sReminder: (): string => {
    return `Mình sẽ đợi ở đây.

Khi nào quay lại thì chúng ta nói chuyện tiếp nhé.`;
  },

  getEndingMessage: (settings: UserSettings | null): string => {
    const targetLang = settings?.learningLanguages?.[0] || "English";
    const l = targetLang.toLowerCase().trim();
    let goodbye = "Goodbye! See you next time.";
    if (l.includes("japanese") || l.includes("nhật")) {
      goodbye = "またね！";
    } else if (l.includes("korean") || l.includes("hàn")) {
      goodbye = "다음에 또 만나요!";
    } else if (l.includes("chinese") || l.includes("trung")) {
      goodbye = "再见！";
    } else if (l.includes("french") || l.includes("pháp")) {
      goodbye = "À bientôt !";
    } else if (l.includes("spanish") || l.includes("tây ban nha")) {
      goodbye = "¡Hasta luego!";
    } else if (l.includes("german") || l.includes("đức")) {
      goodbye = "Bis bald!";
    }

    return `Cảm ơn bạn đã dành thời gian trò chuyện cùng mình.

Hẹn gặp lại nhé!

${goodbye}`;
  }
};
