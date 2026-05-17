import {
  Client,
  GatewayIntentBits,
  Partials,
  type Interaction,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type MessageReaction,
  type User,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { handlePromote } from "./commands/promote.js";
import { handleDemote } from "./commands/demote.js";
import {
  handleGstart,
  handleGiveawayReaction,
  restoreGiveawayTimers,
} from "./commands/giveaway.js";
import { handleSetup } from "./commands/setup.js";
import {
  handleBan,
  handleKick,
  handleMute,
  handleUnmute,
  handleClear,
  handleLock,
  handleUnlock,
  handleWarn,
  handleSlowmode,
  handleNuke,
  handleUnban,
  handleRole,
  handleNick,
} from "./commands/admin.js";
import {
  sendTicketPanel,
  handleTicketSelectReason,
  handleTicketButton,
  handleDeleteModal,
} from "./tickets/index.js";

const PREFIX = "$";
const processedMessages = new Set<string>();

export function startBot(): void {
  const token = process.env["DISCORD_BOT_TOKEN"];

  if (!token) {
    logger.info("Discord bot is disabled — set DISCORD_BOT_TOKEN to enable");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  client.once("clientReady", () => {
    logger.info({ tag: client.user?.tag }, "Discord bot is online");
    restoreGiveawayTimers(client);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    // Prevent duplicate processing
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 10000);

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    try {
      switch (command) {
        // رتب
        case "ترقيه":
        case "ترقية":
        case "promote":
          await handlePromote(message);
          break;
        case "تنزيل":
        case "تنتيل":
        case "demote":
          await handleDemote(message);
          break;

        // قيفاوي
        case "gstart":
          await handleGstart(message, args);
          break;

        // إدارة
        case "ban":
          await handleBan(message, args);
          break;
        case "kick":
          await handleKick(message, args);
          break;
        case "mute":
          await handleMute(message, args);
          break;
        case "unmute":
          await handleUnmute(message);
          break;
        case "clear":
        case "purge":
          await handleClear(message, args);
          break;
        case "lock":
          await handleLock(message, args);
          break;
        case "unlock":
          await handleUnlock(message);
          break;
        case "warn":
          await handleWarn(message, args);
          break;
        case "slowmode":
        case "slow":
          await handleSlowmode(message, args);
          break;
        case "nuke":
          await handleNuke(message);
          break;
        case "unban":
          await handleUnban(message, args);
          break;
        case "role":
          await handleRole(message, args);
          break;
        case "nick":
          await handleNick(message, args);
          break;

        // تكت وإعداد
        case "setup":
          await handleSetup(message, args);
          break;
        case "ticket":
        case "تكت":
          await sendTicketPanel(message);
          break;

        // مساعدة
        case "help":
        case "مساعدة":
          await message.reply({
            embeds: [
              {
                color: 0x1a1a2e,
                title: "🤖 Northern Kingdom Bot — الأوامر",
                description: [
                  "**الرتب:**",
                  "`$ترقيه @شخص` — ترقية شخص رتبة",
                  "`$تنزيل @شخص` — تنزيل شخص رتبة",
                  "",
                  "**الإدارة:**",
                  "`$ban @شخص [سبب]` — حظر",
                  "`$kick @شخص [سبب]` — طرد",
                  "`$mute @شخص [دقائق] [سبب]` — كتم",
                  "`$unmute @شخص` — رفع الكتم",
                  "`$warn @شخص [سبب]` — تحذير",
                  "`$clear [عدد]` — حذف رسائل (1-100)",
                  "`$lock [سبب]` — قفل القناة",
                  "`$unlock` — فتح القناة",
                  "`$slowmode [ثواني]` — سلو موود",
                  "`$nuke` — نيوك القناة",
                  "`$unban [ID]` — رفع الحظر",
                  "`$role @شخص @رتبة` — إعطاء/سحب رتبة",
                  "`$nick @شخص [اسم]` — تغيير النكنيم",
                  "",
                  "**القيفاوي:**",
                  "`$gstart [جائزة] [مدة] [فائزين]` — بدء قيفاوي",
                  "مثال: `$gstart 200M 24h 1`",
                  "",
                  "**التكت:**",
                  "`$ticket` — إرسال لوحة فتح تذكرة",
                  "",
                  "**الإعداد:**",
                  "`$setup @رتبة1 @رتبة2` — تحديد رتب الإدارة",
                ].join("\n"),
                footer: { text: "Northern Kingdom" },
              },
            ],
          });
          break;
      }
    } catch (err) {
      logger.error({ err, command }, "Error handling command");
    }
  });

  client.on("messageReactionAdd", async (reaction: MessageReaction, user: User) => {
    if (user.bot) return;
    if (reaction.emoji.name !== "🌙") return;
    try {
      if (reaction.partial) await reaction.fetch();
      await handleGiveawayReaction(reaction.message.id, user.id, true);
    } catch {}
  });

  client.on("messageReactionRemove", async (reaction: MessageReaction, user: User) => {
    if (user.bot) return;
    if (reaction.emoji.name !== "🌙") return;
    try {
      if (reaction.partial) await reaction.fetch();
      await handleGiveawayReaction(reaction.message.id, user.id, false);
    } catch {}
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isButton()) {
        const btn = interaction as ButtonInteraction;
        if (
          btn.customId === "ticket_add_user" ||
          btn.customId === "ticket_claim" ||
          btn.customId === "ticket_close" ||
          btn.customId === "ticket_delete_reason"
        ) {
          await handleTicketButton(btn);
          return;
        }
      }

      if (interaction.isStringSelectMenu()) {
        const select = interaction as StringSelectMenuInteraction;
        if (select.customId === "ticket_select_reason") {
          await handleTicketSelectReason(select);
          return;
        }
      }

      if (interaction.isModalSubmit()) {
        const modal = interaction as ModalSubmitInteraction;
        if (modal.customId === "ticket_delete_modal") {
          await handleDeleteModal(modal);
          return;
        }
      }
    } catch (err) {
      logger.error({ err }, "Error handling interaction");
    }
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Failed to login to Discord");
  });
}
