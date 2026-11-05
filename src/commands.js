import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const histories = new Map();

const SYSTEM_PROMPT = `
تو یک منشی هوشمند فارسی‌زبان هستی.
به فارسی روان، محترمانه و طبیعی پاسخ بده.
پاسخ‌ها دقیق، کاربردی و تا حد امکان مختصر باشند.
اگر اطلاعات کافی نداری، سؤال روشن‌کننده بپرس.
اطلاعات را جعل نکن.
`;

export function registerCommands(bot) {
  bot.command("start", async (ctx) => {
    await ctx.reply("سلام! منشی هوشمندت آماده‌ام. هر چیزی خواستی بپرس.");
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("پیامت را بفرست تا پاسخ بدهم.\nبرای پاک کردن حافظه گفت‌وگو: /reset");
  });

  bot.command("reset", async (ctx) => {
    histories.delete(ctx.chat.id);
    await ctx.reply("حافظه این گفت‌وگو پاک شد.");
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const text = ctx.message.text;
    if (text.startsWith("/")) return;

    if (!openai) {
      await ctx.reply("کلید OpenAI تنظیم نشده است. لطفاً تنظیمات ربات را بررسی کن.");
      return;
    }

    const chatId = ctx.chat.id;
    const history = histories.get(chatId) || [];

    try {
      await ctx.replyWithChatAction("typing");

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history,
          { role: "user", content: text }
        ]
      });

      const answer =
        response.choices[0]?.message?.content?.trim() ||
        "متأسفم، نتوانستم پاسخ مناسبی تولید کنم.";

      history.push(
        { role: "user", content: text },
        { role: "assistant", content: answer }
      );

      histories.set(chatId, history.slice(-12));

      for (let i = 0; i < answer.length; i += 4000) {
        await ctx.reply(answer.slice(i, i + 4000));
      }
    } catch (error) {
      console.error("OpenAI error:", error.message);
      await ctx.reply("در ارتباط با هوش مصنوعی مشکلی پیش آمد. کمی بعد دوباره امتحان کن.");
    }
  });
}
