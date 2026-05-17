import {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { handlePromote } from "./commands/promote.js";
import { handleDemote } from "./commands/demote.js";
import { handleGstart, handleGiveawayJoin, restoreGiveawayTimers } from "./commands/giveaway.js";
import { handleSetup } from "./commands/setup.js";
import {
  sendTicketPanel,
  handleTicketSelectReason,
  handleTicketButton,
  handleDeleteModal,
} from "./tickets/index.js";

const PREFIX = "$";

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

  client.once("ready", () => {
    logger.info({ tag: client.user?.tag }, "Discord bot is online");
    restoreGiveawayTimers(client);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    try {
      if (command === "ترقيه" || command === "ترقية" || command === "promote") {
        await handlePromote(message);
      } else if (command === "تنزيل" || command === "تنتيل" || command === "demote") {
        await handleDemote(message);
      } else if (command === "gstart") {
        await handleGstart(message, args);
      } else if (command === "setup") {
        await handleSetup(message, args);
      } else if (command === "ticket" || command === "تكت") {
        await sendTicketPanel(message);
      } else if (command === "help" || command === "مساعدة") {
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
                "**القيفاوي:**",
                "`$gstart [جائزة] [مدة] [فائزين]` — بدء قيفاوي",
                "مثال: `$gstart 200M 24h 1`",
                "",
                "**التكت:**",
                "`$ticket` — إرسال لوحة فتح تذكرة",
                "",
                "**الإعداد:**",
                "`$setup @رتبة1 @رتبة2` — تحديد رتب الإدارة",
                "`$setup` — عرض الإعدادات الحالية",
              ].join("\n"),
              footer: { text: "Northern Kingdom" },
            },
          ],
        });
      }
    } catch (err) {
      logger.error({ err, command }, "Error handling command");
    }
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isButton()) {
        const btn = interaction as ButtonInteraction;
        if (btn.customId === "giveaway_join") {
          const { joined, count } = await handleGiveawayJoin(
            btn.message.id,
            btn.user.id
          );
          if (joined) {
            const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId("giveaway_join")
                .setLabel(`🎉 ${count}`)
                .setStyle(ButtonStyle.Secondary)
            );
            await btn.update({ components: [newRow] });
          } else {
            await btn.reply({ content: "⚠️ أنت مسجل بالفعل في هذا القيفاوي.", ephemeral: true });
          }
          return;
        }
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
