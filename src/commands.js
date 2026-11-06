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
`;

async function handleAI(ctx, text, historyKey) {
  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply("کلید Gemini تنظیم نشده است.");
    return;
  }

  const history = histories.get(historyKey) || [];

  try {
    await ctx.replyWithChatAction("typing");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        ...history,
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + "\n\n" + text }]
        }
      ]
    });

    const answer = response.text || "پاسخی دریافت نشد.";

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
    await ctx.reply("در ارتباط با Gemini مشکلی پیش آمد.");
  }
}

export function registerCommands(bot) {

  bot.command("start", async (ctx) => {
    await ctx.reply("سلام! منشی هوشمندت با Gemini آماده است.");
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

  // پیام‌های معمولی ربات
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

      // پیام‌های خود صاحب حساب را نادیده بگیر
      if (ctx.from?.id === connection.user.id) return;

      // بررسی مجوز پاسخ‌گویی
      if (!connection.is_enabled || !connection.rights?.can_reply) {
        return;
      }

      const text = ctx.businessMessage.text;
      if (text.startsWith("/")) return;

      const key = `business:${ctx.businessConnectionId}:${ctx.chat.id}`;

      await handleAI(ctx, text, key);

    } catch (error) {
      console.error("Business error:", error);
    }
  });
}
