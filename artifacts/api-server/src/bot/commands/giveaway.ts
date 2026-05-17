import {
  type Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type TextChannel,
} from "discord.js";
import { saveGiveaway, getGiveaway, getAllGiveaways } from "../config.js";

const GIVEAWAY_EMOJI = "<a:kg_give:1501875249472344105>";
const MOON = "🌙";

function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1]!);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return val * (multipliers[unit] ?? 0);
}

function formatEndsAt(endsAt: number): string {
  const now = Date.now();
  const diff = endsAt - now;
  if (diff <= 0) return "انتهى";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const date = new Date(endsAt);
  const dateStr = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  if (days > 0) return `in ${days} days ${dateStr} ${timeStr}`;
  return `${dateStr} ${timeStr}`;
}

function buildGiveawayEmbed(
  prize: string,
  endsAt: number,
  hostedBy: string,
  winners: number
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setTitle(`${GIVEAWAY_EMOJI} GIVEAWAY ${GIVEAWAY_EMOJI}`)
    .setDescription(
      [
        `${MOON} Prize: **${prize}**`,
        `${MOON} Ends At: **${formatEndsAt(endsAt)}**`,
        `${MOON} Hosted By: <@${hostedBy}>`,
        `${MOON} Winners: **${winners}**`,
      ].join("\n")
    )
    .setTimestamp(endsAt);
}

function buildGiveawayRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("giveaway_join")
      .setLabel("🎉 312")
      .setStyle(ButtonStyle.Secondary)
  );
}

export async function handleGstart(
  message: Message,
  args: string[]
): Promise<void> {
  if (!message.guild || !message.member) return;

  if (args.length < 3) {
    await message.reply(
      "❌ الاستخدام الصحيح: `$gstart [الجائزة] [المدة] [عدد_الفائزين]`\nمثال: `$gstart 200M 24h 1`"
    );
    return;
  }

  const prize = args[0]!;
  const durationStr = args[1]!;
  const winnersCount = parseInt(args[2]!);

  if (isNaN(winnersCount) || winnersCount < 1) {
    await message.reply("❌ عدد الفائزين يجب أن يكون رقم صحيح أكبر من 0.");
    return;
  }

  const duration = parseDuration(durationStr);
  if (!duration) {
    await message.reply(
      "❌ صيغة المدة غلط. استخدم: `1d` (يوم), `2h` (ساعة), `30m` (دقيقة), `60s` (ثانية)"
    );
    return;
  }

  const endsAt = Date.now() + duration;
  const embed = buildGiveawayEmbed(
    prize,
    endsAt,
    message.author.id,
    winnersCount
  );
  const row = buildGiveawayRow();

  const gMsg = await (message.channel as TextChannel).send({
    embeds: [embed],
    components: [row],
  });

  saveGiveaway(gMsg.id, {
    channelId: message.channel.id,
    messageId: gMsg.id,
    prize,
    endsAt,
    hostedBy: message.author.id,
    winners: winnersCount,
    guildId: message.guild.id,
    ended: false,
    participants: [],
  });

  scheduleGiveawayEnd(gMsg.id, duration, message.client);
  await message.delete().catch(() => {});
}

export function scheduleGiveawayEnd(
  messageId: string,
  delay: number,
  client: Client
): void {
  const cappedDelay = Math.min(delay, 2147483647);
  setTimeout(() => {
    void endGiveaway(messageId, client);
  }, cappedDelay);
}

async function endGiveaway(messageId: string, client: Client): Promise<void> {
  const data = getGiveaway(messageId);
  if (!data || data.ended) return;

  try {
    const channel = await client.channels.fetch(data.channelId) as TextChannel | null;
    if (!channel) return;

    const gMsg = await channel.messages.fetch(messageId);
    const participants = data.participants;

    let resultText = "";
    if (participants.length === 0) {
      resultText = "لا يوجد مشاركون في القيفاوي! 😢";
    } else {
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const winnerIds = shuffled.slice(0, Math.min(data.winners, shuffled.length));
      resultText = `🎉 الفائزون: ${winnerIds.map((id) => `<@${id}>`).join(", ")}`;
    }

    const endEmbed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle("🎊 انتهى القيفاوي!")
      .setDescription(
        [
          `${MOON} الجائزة: **${data.prize}**`,
          `${MOON} Hosted By: <@${data.hostedBy}>`,
          "",
          resultText,
        ].join("\n")
      )
      .setTimestamp();

    await gMsg.edit({ embeds: [endEmbed], components: [] });
    await channel.send({
      content: `🎉 انتهى القيفاوي على **${data.prize}**!\n${resultText}`,
    });

    data.ended = true;
    saveGiveaway(messageId, data);
  } catch {}
}

export async function handleGiveawayJoin(
  messageId: string,
  userId: string
): Promise<{ joined: boolean; count: number }> {
  const data = getGiveaway(messageId);
  if (!data || data.ended) return { joined: false, count: 0 };

  if (data.participants.includes(userId)) {
    return { joined: false, count: data.participants.length };
  }

  data.participants.push(userId);
  saveGiveaway(messageId, data);
  return { joined: true, count: data.participants.length };
}

export function restoreGiveawayTimers(client: Client): void {
  const all = getAllGiveaways();
  const now = Date.now();
  for (const [msgId, giveaway] of Object.entries(all)) {
    if (giveaway.ended) continue;
    const remaining = giveaway.endsAt - now;
    if (remaining <= 0) {
      void endGiveaway(msgId, client);
    } else {
      scheduleGiveawayEnd(msgId, remaining, client);
    }
  }
}
