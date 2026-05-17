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
  handleJail,
  handleFasal,
  handleJailSelect,
  restoreJailTimers,
} from "./commands/jail.js";
import {
  sendTicketPanel,
  handleTicketSelectReason,
  handleTicketButton,
  handleDeleteModal,
  handleAdminApplyModal,
} from "./tickets/index.js";
import {
  setAdminRoles,
  getAdminRoles,
  setApplyRole,
  getApplyRole,
  setDismissRoles,
  getDismissRoles,
  setJailConfig,
  getJailConfig,
} from "./config.js";

const PREFIX = "$";

// ── Singleton guard ───────────────────────────────────────────────────────────
let activeClient: Client | null = null;

// Deduplicates messages within a single process.
const processedMessages = new Set<string>();

// ── Slash command registration ────────────────────────────────────────────────
async function registerSlashCommands(token: string, clientId: string): Promise<void> {
  const commands = [
    // /setup-admin-roles
    new SlashCommandBuilder()
      .setName("setup-admin-roles")
      .setDescription("تحديد الرتب التي تُعطى عند استخدام $اداره")
      .addRoleOption((o) => o.setName("role1").setDescription("الرتبة الأولى").setRequired(true))
      .addRoleOption((o) => o.setName("role2").setDescription("الرتبة الثانية").setRequired(false))
      .addRoleOption((o) => o.setName("role3").setDescription("الرتبة الثالثة").setRequired(false))
      .addRoleOption((o) => o.setName("role4").setDescription("الرتبة الرابعة").setRequired(false))
      .addRoleOption((o) => o.setName("role5").setDescription("الرتبة الخامسة").setRequired(false))
      .toJSON(),

    // /setup-apply-role
    new SlashCommandBuilder()
      .setName("setup-apply-role")
      .setDescription("تحديد الرتبة التي تُنبَّه عند فتح تذكرة تقديم الإدارة")
      .addRoleOption((o) =>
        o.setName("role").setDescription("الرتبة المسؤولة عن مراجعة التقديمات").setRequired(true)
      )
      .toJSON(),

    // /setup-dismiss-roles  ($فصل)
    new SlashCommandBuilder()
      .setName("setup-dismiss-roles")
      .setDescription("تحديد الرتب التي تُزال عند استخدام $فصل (رتب الإدارة للشخص المفصول)")
      .addRoleOption((o) => o.setName("role1").setDescription("الرتبة الأولى").setRequired(true))
      .addRoleOption((o) => o.setName("role2").setDescription("الرتبة الثانية").setRequired(false))
      .addRoleOption((o) => o.setName("role3").setDescription("الرتبة الثالثة").setRequired(false))
      .addRoleOption((o) => o.setName("role4").setDescription("الرتبة الرابعة").setRequired(false))
      .addRoleOption((o) => o.setName("role5").setDescription("الرتبة الخامسة").setRequired(false))
      .toJSON(),

    // /setup-jail  ($سجن)
    new SlashCommandBuilder()
      .setName("setup-jail")
      .setDescription("إعداد نظام السجن — تحديد رتبة المسجون ومدد السجن المتاحة")
      .addRoleOption((o) =>
        o.setName("role").setDescription("رتبة المسجون").setRequired(true)
      )
      .addIntegerOption((o) =>
        o.setName("day1").setDescription("خيار أيام (1)").setRequired(false).setMinValue(1).setMaxValue(365)
      )
      .addIntegerOption((o) =>
        o.setName("day2").setDescription("خيار أيام (2)").setRequired(false).setMinValue(1).setMaxValue(365)
      )
      .addIntegerOption((o) =>
        o.setName("day3").setDescription("خيار أيام (3)").setRequired(false).setMinValue(1).setMaxValue(365)
      )
      .addIntegerOption((o) =>
        o.setName("day4").setDescription("خيار أيام (4)").setRequired(false).setMinValue(1).setMaxValue(365)
      )
      .addIntegerOption((o) =>
        o.setName("hour1").setDescription("خيار ساعات (1)").setRequired(false).setMinValue(1).setMaxValue(672)
      )
      .addIntegerOption((o) =>
        o.setName("hour2").setDescription("خيار ساعات (2)").setRequired(false).setMinValue(1).setMaxValue(672)
      )
      .addIntegerOption((o) =>
        o.setName("hour3").setDescription("خيار ساعات (3)").setRequired(false).setMinValue(1).setMaxValue(672)
      )
      .addIntegerOption((o) =>
        o.setName("hour4").setDescription("خيار ساعات (4)").setRequired(false).setMinValue(1).setMaxValue(672)
      )
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

// ── Bot startup ───────────────────────────────────────────────────────────────
export function startBot(): void {
  const token = process.env["DISCORD_BOT_TOKEN"];

  if (!token) {
    logger.info("Discord bot is disabled — set DISCORD_BOT_TOKEN to enable");
    return;
  }

  if (activeClient !== null) {
    logger.warn("startBot() called again — ignoring, client already running");
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
    restoreJailTimers(client);
    if (client.user) void registerSlashCommands(token, client.user.id);
  });

  // ── Prefix commands ───────────────────────────────────────────────────────
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
        case "promote":       await handlePromote(message); break;
        case "تنزيل":
        case "تنتيل":
        case "demote":        await handleDemote(message); break;

        // إدارة عامة
        case "ban":           await handleBan(message, args); break;
        case "kick":          await handleKick(message, args); break;
        case "mute":          await handleMute(message, args); break;
        case "unmute":        await handleUnmute(message); break;
        case "clear":
        case "purge":         await handleClear(message, args); break;
        case "lock":          await handleLock(message, args); break;
        case "unlock":        await handleUnlock(message); break;
        case "warn":          await handleWarn(message, args); break;
        case "slowmode":
        case "slow":          await handleSlowmode(message, args); break;
        case "unban":         await handleUnban(message, args); break;
        case "role":          await handleRole(message); break;
        case "nick":          await handleNick(message, args); break;
        case "اداره":
        case "ادارة":          await handleAdminGive(message); break;

        // فصل وسجن
        case "فصل":
        case "dismiss":       await handleFasal(message); break;
        case "سجن":
        case "jail":          await handleJail(message); break;

        // قيفاوي
        case "gstart":        await handleGstart(message, args); break;

        // تكت وإعداد
        case "setup":         await handleSetup(message, args); break;
        case "ticket":
        case "تكت":           await sendTicketPanel(message); break;

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
                "`$فصل @شخص` — فصل من الإدارة (شيل رتبها)",
                "`$سجن @شخص` — سجن عضو (شيل كل رتبه)",
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
                "",
                "**Slash Commands:**",
                "`/setup-admin-roles` — رتب أمر $اداره",
                "`/setup-dismiss-roles` — رتب أمر $فصل",
                "`/setup-jail` — إعداد نظام السجن",
                "`/setup-apply-role` — رتبة مراجعة التقديمات",
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

  // ── Interactions ──────────────────────────────────────────────────────────
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      // ── Slash commands ──────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const cmd = interaction as ChatInputCommandInteraction;
        if (!cmd.guild) return;
        const member = cmd.member as GuildMember;
        if (!member.permissions.has("Administrator")) {
          await cmd.reply({ content: "❌ فقط الأدمن يقدر يستخدم هذا الأمر.", ephemeral: true });
          return;
        }

        // /setup-admin-roles
        if (cmd.commandName === "setup-admin-roles") {
          const roleIds: string[] = [];
          for (let i = 1; i <= 5; i++) {
            const r = cmd.options.getRole(`role${i}`);
            if (r) roleIds.push(r.id);
          }
          setAdminRoles(cmd.guild.id, roleIds);
          const names = getAdminRoles(cmd.guild.id).map((id) => `<@&${id}>`).join("\n");
          await cmd.reply({
            embeds: [new EmbedBuilder().setColor(0x00ff88).setTitle("✅ رتب $اداره").setDescription(names).setFooter({ text: "Northern Kingdom" })],
          });
          return;
        }

        // /setup-apply-role
        if (cmd.commandName === "setup-apply-role") {
          const role = cmd.options.getRole("role", true);
          setApplyRole(cmd.guild.id, role.id);
          const current = getApplyRole(cmd.guild.id);
          await cmd.reply({
            embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("✅ رتبة مراجعة التقديمات").setDescription(`<@&${current}>`).setFooter({ text: "Northern Kingdom" })],
          });
          return;
        }

        // /setup-dismiss-roles
        if (cmd.commandName === "setup-dismiss-roles") {
          const roleIds: string[] = [];
          for (let i = 1; i <= 5; i++) {
            const r = cmd.options.getRole(`role${i}`);
            if (r) roleIds.push(r.id);
          }
          setDismissRoles(cmd.guild.id, roleIds);
          const names = getDismissRoles(cmd.guild.id).map((id) => `<@&${id}>`).join("\n");
          await cmd.reply({
            embeds: [new EmbedBuilder().setColor(0xff6600).setTitle("✅ رتب $فصل").setDescription(`الرتب التي ستُزال عند الفصل:\n${names}`).setFooter({ text: "Northern Kingdom" })],
          });
          return;
        }

        // /setup-jail
        if (cmd.commandName === "setup-jail") {
          const role = cmd.options.getRole("role", true);
          const dayOptions: number[] = [];
          const hourOptions: number[] = [];
          for (let i = 1; i <= 4; i++) {
            const d = cmd.options.getInteger(`day${i}`);
            if (d !== null) dayOptions.push(d);
            const h = cmd.options.getInteger(`hour${i}`);
            if (h !== null) hourOptions.push(h);
          }
          setJailConfig(cmd.guild.id, { roleId: role.id, dayOptions, hourOptions });
          const cfg = getJailConfig(cmd.guild.id)!;
          const dayList = cfg.dayOptions.length > 0 ? cfg.dayOptions.map((d) => `${d} أيام`).join("، ") : "لا يوجد";
          const hourList = cfg.hourOptions.length > 0 ? cfg.hourOptions.map((h) => `${h} ساعات`).join("، ") : "لا يوجد";
          await cmd.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle("✅ تم إعداد نظام السجن")
                .addFields(
                  { name: "🔒 رتبة المسجون", value: `<@&${role.id}>`, inline: false },
                  { name: "📅 خيارات الأيام", value: dayList, inline: true },
                  { name: "⏰ خيارات الساعات", value: hourList, inline: true },
                )
                .setFooter({ text: "Northern Kingdom • Jail System" }),
            ],
          });
          return;
        }

        return;
      }

      // ── Buttons ─────────────────────────────────────────────────────────
      if (interaction.isButton()) {
        const btn = interaction as ButtonInteraction;
        if (["ticket_add_user", "ticket_claim", "ticket_close", "ticket_delete_reason"].includes(btn.customId)) {
          await handleTicketButton(btn);
        }
        return;
      }

      // ── Select menus ─────────────────────────────────────────────────────
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
        if (select.customId.startsWith("jail_select:")) {
          await handleJailSelect(select);
          return;
        }
      }

      // ── Modals ───────────────────────────────────────────────────────────
      if (interaction.isModalSubmit()) {
        const modal = interaction as ModalSubmitInteraction;
        if (modal.customId === "ticket_delete_modal") {
          await handleDeleteModal(modal);
          return;
        }
        if (modal.customId === "admin_apply_modal") {
          await handleAdminApplyModal(modal);
          return;
        }
      }
    } catch (err) {
      logger.error({ err }, "Error handling interaction");
    }
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  activeClient = client;

  function shutdown() {
    if (activeClient) {
      activeClient.destroy();
      activeClient = null;
    }
  }
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  client.login(token).catch((err) => {
    logger.error({ err }, "Failed to login to Discord");
  });
}
