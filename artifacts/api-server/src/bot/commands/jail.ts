import {
  type Message,
  type StringSelectMenuInteraction,
  type Client,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionsBitField,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import {
  getJailConfig,
  getDismissRoles,
  saveJailRecord,
  deleteJailRecord,
  getAllJailRecords,
} from "../config.js";
import { logger } from "../../lib/logger.js";

function isAdmin(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  );
}

function errEmbed(desc: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xff4444).setDescription(`❌ ${desc}`);
}
function okEmbed(desc: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x00ff88).setDescription(desc);
}

// ── $فصل — remove configured dismiss roles ────────────────────────────────────
export async function handleFasal(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isAdmin(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("فقط الأدمن يقدر يستخدم هذا الأمر.")] });
    return;
  }

  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("الاستخدام: `$فصل @شخص`")] });
    return;
  }

  const dismissRoleIds = getDismissRoles(message.guild.id);
  if (dismissRoleIds.length === 0) {
    await message.reply({
      embeds: [errEmbed("ما تم تحديد رتب الفصل بعد.\nاستخدم `/setup-dismiss-roles` لتحديدها.")],
    });
    return;
  }

  const toRemove = dismissRoleIds.filter((id) => target.roles.cache.has(id));
  if (toRemove.length === 0) {
    await message.reply({ embeds: [errEmbed("الشخص لا يملك أياً من رتب الإدارة المحددة.")] });
    return;
  }

  try {
    await target.roles.remove(toRemove);
    const names = toRemove
      .map((id) => message.guild!.roles.cache.get(id)?.name)
      .filter(Boolean)
      .join("، ");
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle("🚪 تم فصل العضو")
          .setDescription(
            `تم فصل **${target.user.tag}** من الإدارة\n**الرتب المُزالة:** ${names}`
          )
          .setTimestamp(),
      ],
    });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل الفصل، تأكد من صلاحيات البوت.")] });
  }
}

// ── $سجن — show duration dropdown ─────────────────────────────────────────────
export async function handleJail(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isAdmin(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("فقط الأدمن يقدر يستخدم هذا الأمر.")] });
    return;
  }

  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("الاستخدام: `$سجن @شخص`")] });
    return;
  }

  const cfg = getJailConfig(message.guild.id);
  if (!cfg) {
    await message.reply({
      embeds: [errEmbed("ما تم إعداد السجن بعد.\nاستخدم `/setup-jail` لتحديد رتبة المسجون والمدد.")],
    });
    return;
  }

  // Build options
  const options: StringSelectMenuOptionBuilder[] = [];

  // مؤبد
  options.push(
    new StringSelectMenuOptionBuilder()
      .setLabel("مؤبد — بدون انتهاء")
      .setValue("permanent")
      .setEmoji("♾️")
      .setDescription("يُسجن بدون مدة محددة")
  );

  // Day options
  for (const d of cfg.dayOptions) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${d} ${d === 1 ? "يوم" : "أيام"}`)
        .setValue(`days:${d}`)
        .setEmoji("📅")
        .setDescription(`${d * 24} ساعة`)
    );
  }

  // Hour options
  for (const h of cfg.hourOptions) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${h} ${h === 1 ? "ساعة" : "ساعات"}`)
        .setValue(`hours:${h}`)
        .setEmoji("⏰")
        .setDescription(`${h * 60} دقيقة`)
    );
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`jail_select:${target.id}:${message.author.id}`)
    .setPlaceholder("اختر مدة السجن...")
    .addOptions(options.slice(0, 25));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("🔒 تحديد مدة السجن")
        .setDescription(
          `اختر المدة التي ستسجن فيها **${target.user.tag}**\n\n` +
          `> ستُزال جميع رتبه وتُضاف رتبة المسجون`
        )
        .setTimestamp(),
    ],
    components: [row],
  });
}

// ── Handle dropdown selection ─────────────────────────────────────────────────
export async function handleJailSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  if (!interaction.guild) return;

  const parts = interaction.customId.split(":");
  const targetId = parts[1]!;
  const invokerId = parts[2]!;

  // Only the original invoker can use this dropdown
  if (interaction.user.id !== invokerId) {
    await interaction.reply({ content: "❌ فقط من أصدر الأمر يقدر يختار.", ephemeral: true });
    return;
  }

  const guild = interaction.guild;
  const cfg = getJailConfig(guild.id);
  if (!cfg) {
    await interaction.reply({ content: "❌ إعداد السجن مفقود.", ephemeral: true });
    return;
  }

  const target = await guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await interaction.reply({ content: "❌ ما لقيت الشخص.", ephemeral: true });
    return;
  }

  const value = interaction.values[0]!;
  let endsAt: number | null = null;
  let durationLabel = "مؤبد ♾️";

  if (value.startsWith("days:")) {
    const days = parseInt(value.split(":")[1]!);
    endsAt = Date.now() + days * 24 * 60 * 60 * 1000;
    durationLabel = `${days} ${days === 1 ? "يوم" : "أيام"}`;
  } else if (value.startsWith("hours:")) {
    const hours = parseInt(value.split(":")[1]!);
    endsAt = Date.now() + hours * 60 * 60 * 1000;
    durationLabel = `${hours} ${hours === 1 ? "ساعة" : "ساعات"}`;
  }

  // Save original roles (excluding managed/everyone)
  const originalRoles = target.roles.cache
    .filter((r) => r.name !== "@everyone" && !r.managed)
    .map((r) => r.id);

  try {
    // Remove all non-managed roles
    await target.roles.remove(originalRoles);

    // Add prison role
    const jailRole = guild.roles.cache.get(cfg.roleId);
    if (jailRole) await target.roles.add(jailRole);

    // Discord timeout (max 28 days)
    if (endsAt !== null) {
      const timeoutMs = endsAt - Date.now();
      const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;
      if (timeoutMs <= MAX_TIMEOUT) {
        await target.timeout(timeoutMs, "سجن مؤقت").catch(() => {});
      }
    }
  } catch {
    await interaction.update({
      embeds: [errEmbed("فشل السجن، تأكد من صلاحيات البوت.")],
      components: [],
    });
    return;
  }

  // Persist record
  saveJailRecord({
    userId: target.id,
    guildId: guild.id,
    originalRoles,
    jailRoleId: cfg.roleId,
    endsAt,
  });

  // Schedule release if timed
  if (endsAt !== null) {
    const delay = endsAt - Date.now();
    setTimeout(() => void releaseJailed(interaction.client, guild.id, target.id), delay);
  }

  // Notify in channel
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("🔒 تم السجن")
        .setDescription(
          `تم سجن **${target.user.tag}**\n` +
          `**المدة:** ${durationLabel}\n` +
          (endsAt ? `**ينتهي:** <t:${Math.floor(endsAt / 1000)}:R>` : "")
        )
        .setTimestamp(),
    ],
    components: [],
  });

  // DM the jailed user
  await target.user
    .send(
      `🔒 تم سجنك في **${guild.name}**\n` +
        `**المدة:** ${durationLabel}` +
        (endsAt ? `\n**ينتهي:** <t:${Math.floor(endsAt / 1000)}:R>` : "")
    )
    .catch(() => {});
}

// ── Release a jailed user (restore roles) ─────────────────────────────────────
export async function releaseJailed(
  client: Client,
  guildId: string,
  userId: string
): Promise<void> {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    const record = (await import("../config.js")).getJailRecord(guildId, userId);
    if (!record) return;

    // Remove prison role
    const jailRole = guild.roles.cache.get(record.jailRoleId);
    if (jailRole && member.roles.cache.has(jailRole.id)) {
      await member.roles.remove(jailRole).catch(() => {});
    }

    // Restore original roles (filter out deleted roles)
    const toRestore = record.originalRoles.filter((id) => guild.roles.cache.has(id));
    if (toRestore.length > 0) {
      await member.roles.add(toRestore).catch(() => {});
    }

    // Remove timeout
    await member.timeout(null).catch(() => {});

    deleteJailRecord(guildId, userId);

    await member.user
      .send(`✅ تم الإفراج عنك في **${guild.name}**. مرحباً بعودتك!`)
      .catch(() => {});
  } catch (err) {
    logger.error({ err, guildId, userId }, "Failed to release jailed user");
  }
}

// ── Restore timers on bot restart ─────────────────────────────────────────────
export function restoreJailTimers(client: Client): void {
  const records = getAllJailRecords();
  const now = Date.now();

  for (const record of records) {
    if (record.endsAt === null) continue;

    const delay = record.endsAt - now;
    if (delay <= 0) {
      // Already expired — release immediately
      void releaseJailed(client, record.guildId, record.userId);
    } else {
      setTimeout(() => void releaseJailed(client, record.guildId, record.userId), delay);
    }
  }

  if (records.length > 0) {
    logger.info({ count: records.length }, "Restored jail timers");
  }
}
