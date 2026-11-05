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

export function registerCommands(bot) {
  bot.command("start", async (ctx) => {
    await ctx.reply("سلام! منشی هوشمندت با Gemini آماده است.");
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("پیامت را بفرست.\nبرای پاک کردن حافظه: /reset");
  });

  bot.command("reset", async (ctx) => {
    histories.delete(ctx.chat.id);
    await ctx.reply("حافظه گفت‌وگو پاک شد.");
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const text = ctx.message.text;
    if (text.startsWith("/")) return;

    if (!process.env.GEMINI_API_KEY) {
      await ctx.reply("کلید Gemini تنظیم نشده است.");
      return;
    }

    const chatId = ctx.chat.id;
    const history = histories.get(chatId) || [];

    try {
      await ctx.replyWithChatAction("typing");

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          ...history,
          { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + text }] }
        ]
      });

      const answer = response.text || "پاسخی دریافت نشد.";

      history.push(
        { role: "user", parts: [{ text }] },
        { role: "model", parts: [{ text: answer }] }
      );

      histories.set(chatId, history.slice(-12));

      for (let i = 0; i < answer.length; i += 4000) {
        await ctx.reply(answer.slice(i, i + 4000));
      }

    } catch (error) {
      console.error("Gemini error:", error.message);
      await ctx.reply("در ارتباط با Gemini مشکلی پیش آمد.");
    }
  });
}
0

