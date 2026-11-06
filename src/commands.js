
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const histories = new Map();

const SYSTEM_PROMPT = `
تو یک منشی هوشمند فارسی‌زبان هستی.
به فارسی روان، محترمانه و طبیعی پاسخ بده.
پاسخ‌ها دقیق و کاربردی باشند.
اطلاعات جعل نکن.
اگر جواب چیزی را نمی‌دانی، صادقانه بگو.
`;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(contents) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT
        }
      });
    } catch (error) {
      lastError = error;

      const status = error.status || error.code;

      const temporaryError = [
        429, 500, 502, 503, 504
      ].includes(Number(status));

      if (!temporaryError || attempt === 3) {
        throw error;
      }

      console.log(
        `Gemini retry ${attempt}/3 after error ${status}`
      );

      await sleep(attempt * 2000);
    }
  }

  throw lastError;
}

async function handleAI(ctx, text, historyKey) {
  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply("کلید Gemini تنظیم نشده است.");
    return;
  }

  const history = histories.get(historyKey) || [];

  try {
    await ctx.replyWithChatAction("typing");

    const contents = [
      ...history,
      {
        role: "user",
        parts: [{ text }]
      }
    ];

    const response = await generateWithRetry(contents);

    const answer =
      response.text?.trim() || "پاسخی دریافت نشد.";

    history.push(
      { role: "user", parts: [{ text }] },
      { role: "model", parts: [{ text: answer }] }
    );

    histories.set(historyKey, history.slice(-12));

    for (let i = 0; i < answer.length; i += 4000) {
      await ctx.reply(answer.slice(i, i + 4000));
    }

  } catch (error) {
    console.error("Gemini error:", error);

    const status = Number(error.status || error.code);

    if (status === 503 || status === 429) {
      await ctx.reply(
        "سرویس هوش مصنوعی فعلاً شلوغ است. لطفاً کمی بعد دوباره پیام بده."
      );
    } else {
      await ctx.reply(
        "در ارتباط با هوش مصنوعی مشکلی پیش آمد. لطفاً دوباره تلاش کن."
      );
    }
  }
}

export function registerCommands(bot) {

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "سلام! منشی هوشمندت با Gemini آماده است."
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "پیامت را بفرست.\nبرای پاک کردن حافظه: /reset"
    );
  });

  bot.command("reset", async (ctx) => {
    histories.delete(`bot:${ctx.chat.id}`);
    await ctx.reply("حافظه گفت‌وگو پاک شد.");
  });

  // پیام‌های خصوصی ربات
  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const text = ctx.message.text;

    if (text.startsWith("/")) return;

    await handleAI(ctx, text, `bot:${ctx.chat.id}`);
  });

  // پیام‌های دایرکت Telegram Business
  bot.on("business_message:text", async (ctx) => {
    try {
      const connection = await ctx.getBusinessConnection();

      if (ctx.from?.id === connection.user.id) return;

      if (
        !connection.is_enabled ||
        !connection.rights?.can_reply
      ) {
        return;
      }

      const text = ctx.businessMessage.text;

      if (text.startsWith("/")) return;

      const key =
        `business:${ctx.businessConnectionId}:${ctx.chat.id}`;

      await handleAI(ctx, text, key);

    } catch (error) {
      console.error("Business error:", error);
    }
  });
}
0
