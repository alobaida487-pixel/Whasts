import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  type Interaction,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type MessageReaction,
  type User,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  type GuildMember,
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
  handleUnban,
  handleRole,
  handleRoleSelect,
  handleNick,
  handleAdminGive,
} from "./commands/admin.js";
import {
  sendTicketPanel,
  handleTicketSelectReason,
  handleTicketButton,
  handleDeleteModal,
} from "./tickets/index.js";
import { setAdminRoles, getAdminRoles } from "./config.js";

const PREFIX = "$";
const processedMessages = new Set<string>();

async function registerSlashCommands(token: string, clientId: string): Promise<void> {
  const commands = [
    new SlashCommandBuilder()
      .setName("setup-admin-roles")
      .setDescription("تحديد الرتب التي تُعطى عند استخدام $اداره")
      .addRoleOption((o) => o.setName("role1").setDescription("الرتبة الأولى").setRequired(true))
      .addRoleOption((o) => o.setName("role2").setDescription("الرتبة الثانية").setRequired(false))
      .addRoleOption((o) => o.setName("role3").setDescription("الرتبة الثالثة").setRequired(false))
      .addRoleOption((o) => o.setName("role4").setDescription("الرتبة الرابعة").setRequired(false))
      .addRoleOption((o) => o.setName("role5").setDescription("الرتبة الخامسة").setRequired(false))
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.info("Slash commands registered");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }
}

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
    if (client.user) {
      void registerSlashCommands(token, client.user.id);
    }
  });

  // ── Prefix commands ──────────────────────────────────────────────────────────
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

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
          await handlePromote(message); break;
        case "تنزيل":
        case "تنتيل":
        case "demote":
          await handleDemote(message); break;

        // إدارة
        case "ban":         await handleBan(message, args); break;
        case "kick":        await handleKick(message, args); break;
        case "mute":        await handleMute(message, args); break;
        case "unmute":      await handleUnmute(message); break;
        case "clear":
        case "purge":       await handleClear(message, args); break;
        case "lock":        await handleLock(message, args); break;
        case "unlock":      await handleUnlock(message); break;
        case "warn":        await handleWarn(message, args); break;
        case "slowmode":
        case "slow":        await handleSlowmode(message, args); break;
        case "unban":       await handleUnban(message, args); break;
        case "role":        await handleRole(message); break;
        case "nick":        await handleNick(message, args); break;
        case "اداره":
        case "ادارة":        await handleAdminGive(message); break;

        // قيفاوي
        case "gstart":      await handleGstart(message, args); break;

        // تكت وإعداد
        case "setup":       await handleSetup(message, args); break;
        case "ticket":
        case "تكت":         await sendTicketPanel(message); break;

        // مساعدة
        case "help":
        case "مساعدة":
          await message.reply({
            embeds: [{
              color: 0x1a1a2e,
              title: "🤖 Northern Kingdom Bot — الأوامر",
              description: [
                "**الرتب:**",
                "`$ترقيه @شخص` — ترقية رتبة",
                "`$تنزيل @شخص` — تنزيل رتبة",
                "`$اداره @شخص` — إعطاء رتب الإدارة",
                "",
                "**الإدارة:**",
                "`$ban @شخص [سبب]` — حظر",
                "`$kick @شخص [سبب]` — طرد",
                "`$mute @شخص [دقائق] [سبب]` — كتم",
                "`$unmute @شخص` — رفع الكتم",
                "`$warn @شخص [سبب]` — تحذير",
                "`$clear [عدد]` — حذف رسائل",
                "`$lock [سبب]` — قفل القناة",
                "`$unlock` — فتح القناة",
                "`$slowmode [ثواني]` — سلو موود",
                "`$unban [ID]` — رفع الحظر",
                "`$role @شخص` — إعطاء/سحب رتبة (قائمة)",
                "`$nick @شخص [اسم]` — تغيير النكنيم",
                "",
                "**القيفاوي:**",
                "`$gstart [جائزة] [مدة] [فائزين]` — بدء قيفاوي",
                "",
                "**التكت والإعداد:**",
                "`$ticket` — لوحة التذاكر",
                "`$setup @رتبة...` — رتب إدارة التكت",
                "`/setup-admin-roles` — رتب أمر $اداره",
              ].join("\n"),
              footer: { text: "Northern Kingdom" },
            }],
          });
          break;
      }
    } catch (err) {
      logger.error({ err, command }, "Error handling command");
    }
  });

  // ── Reactions (giveaway) ──────────────────────────────────────────────────
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

  // ── Interactions ─────────────────────────────────────────────────────────
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      // Slash command: /setup-admin-roles
      if (interaction.isChatInputCommand()) {
        const cmd = interaction as ChatInputCommandInteraction;
        if (cmd.commandName === "setup-admin-roles") {
          if (!cmd.guild) return;
          const member = cmd.member as GuildMember;
          if (!member.permissions.has("Administrator")) {
            await cmd.reply({ content: "❌ فقط الأدمن يقدر يستخدم هذا الأمر.", ephemeral: true });
            return;
          }
          const roleIds: string[] = [];
          for (let i = 1; i <= 5; i++) {
            const role = cmd.options.getRole(`role${i}`);
            if (role) roleIds.push(role.id);
          }
          setAdminRoles(cmd.guild.id, roleIds);
          const current = getAdminRoles(cmd.guild.id);
          const names = current.map((id) => `<@&${id}>`).join("\n");
          await cmd.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x00ff88)
                .setTitle("✅ تم تحديد رتب الإدارة")
                .setDescription(`الرتب التي ستُعطى عند `+"`$اداره @شخص`"+`:\n${names}`)
                .setFooter({ text: "Northern Kingdom" }),
            ],
            ephemeral: false,
          });
        }
        return;
      }

      // Buttons
      if (interaction.isButton()) {
        const btn = interaction as ButtonInteraction;
        if (["ticket_add_user","ticket_claim","ticket_close","ticket_delete_reason"].includes(btn.customId)) {
          await handleTicketButton(btn);
        }
        return;
      }

      // Select menus
      if (interaction.isStringSelectMenu()) {
        const select = interaction as StringSelectMenuInteraction;
        if (select.customId === "ticket_select_reason") {
          await handleTicketSelectReason(select);
          return;
        }
        if (select.customId.startsWith("role_select:")) {
          await handleRoleSelect(select);
          return;
        }
      }

      // Modals
      if (interaction.isModalSubmit()) {
        const modal = interaction as ModalSubmitInteraction;
        if (modal.customId === "ticket_delete_modal") {
          await handleDeleteModal(modal);
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
