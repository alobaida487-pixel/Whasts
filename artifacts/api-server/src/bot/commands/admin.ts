import {
  type Message,
  EmbedBuilder,
  type GuildMember,
  type TextChannel,
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import { getAdminRoles } from "../config.js";

function isAdmin(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  );
}

function isMod(member: GuildMember): boolean {
  return (
    isAdmin(member) ||
    member.permissions.has(PermissionsBitField.Flags.BanMembers) ||
    member.permissions.has(PermissionsBitField.Flags.KickMembers) ||
    member.permissions.has(PermissionsBitField.Flags.ManageMessages)
  );
}

function errEmbed(desc: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xff4444).setDescription(`❌ ${desc}`);
}

function okEmbed(desc: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x00ff88).setDescription(desc);
}

export async function handleBan(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("لازم تمنشن شخص. `$ban @شخص [السبب]`")] });
    return;
  }
  const reason = args.slice(1).join(" ") || "لا يوجد سبب";
  try {
    await target.ban({ reason });
    await message.reply({ embeds: [okEmbed(`🔨 تم حظر **${target.user.tag}**\n**السبب:** ${reason}`)] });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل الحظر، تأكد من صلاحيات البوت.")] });
  }
}

export async function handleKick(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("لازم تمنشن شخص. `$kick @شخص [السبب]`")] });
    return;
  }
  const reason = args.slice(1).join(" ") || "لا يوجد سبب";
  try {
    await target.kick(reason);
    await message.reply({ embeds: [okEmbed(`👢 تم طرد **${target.user.tag}**\n**السبب:** ${reason}`)] });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل الطرد، تأكد من صلاحيات البوت.")] });
  }
}

export async function handleMute(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("لازم تمنشن شخص. `$mute @شخص [المدة بالدقائق]`")] });
    return;
  }
  const minutes = parseInt(args[1] ?? "10");
  const duration = isNaN(minutes) ? 10 : minutes;
  const reason = args.slice(2).join(" ") || "لا يوجد سبب";
  try {
    await target.timeout(duration * 60 * 1000, reason);
    await message.reply({ embeds: [okEmbed(`🔇 تم كتم **${target.user.tag}** لمدة **${duration} دقيقة**\n**السبب:** ${reason}`)] });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل الكتم، تأكد من صلاحيات البوت.")] });
  }
}

export async function handleUnmute(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("لازم تمنشن شخص. `$unmute @شخص`")] });
    return;
  }
  try {
    await target.timeout(null);
    await message.reply({ embeds: [okEmbed(`🔊 تم رفع الكتم عن **${target.user.tag}**`)] });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل رفع الكتم.")] });
  }
}

export async function handleClear(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const amount = parseInt(args[0] ?? "10");
  if (isNaN(amount) || amount < 1 || amount > 100) {
    await message.reply({ embeds: [errEmbed("اكتب عدد بين 1 و 100. `$clear 50`")] });
    return;
  }
  try {
    await message.delete().catch(() => {});
    const channel = message.channel as TextChannel;
    const deleted = await channel.bulkDelete(amount, true);
    const notice = await channel.send({ embeds: [okEmbed(`🗑️ تم حذف **${deleted.size}** رسالة`)] });
    setTimeout(() => notice.delete().catch(() => {}), 3000);
  } catch {
    await message.reply({ embeds: [errEmbed("فشل الحذف، الرسائل قد تكون أقدم من 14 يوم.")] });
  }
}

export async function handleLock(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const channel = message.channel as TextChannel;
  try {
    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
    const reason = args.join(" ") || "لا يوجد سبب";
    await message.reply({ embeds: [okEmbed(`🔒 تم قفل القناة\n**السبب:** ${reason}`)] });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل قفل القناة.")] });
  }
}

export async function handleUnlock(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const channel = message.channel as TextChannel;
  try {
    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
    await message.reply({ embeds: [okEmbed(`🔓 تم فتح القناة`)] });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل فتح القناة.")] });
  }
}

export async function handleWarn(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("لازم تمنشن شخص. `$warn @شخص [السبب]`")] });
    return;
  }
  const reason = args.slice(1).join(" ") || "لا يوجد سبب";
  try {
    await target.user.send(`⚠️ تلقيت تحذيراً في **${message.guild.name}**\n**السبب:** ${reason}`).catch(() => {});
    await message.reply({ embeds: [okEmbed(`⚠️ تم تحذير **${target.user.tag}**\n**السبب:** ${reason}`)] });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل التحذير.")] });
  }
}

export async function handleSlowmode(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const seconds = parseInt(args[0] ?? "0");
  if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
    await message.reply({ embeds: [errEmbed("اكتب ثواني بين 0 و 21600. `$slowmode 10`")] });
    return;
  }
  const channel = message.channel as TextChannel;
  try {
    await channel.setRateLimitPerUser(seconds);
    await message.reply({
      embeds: [okEmbed(seconds === 0 ? `✅ تم إلغاء السلو موود` : `🐢 تم تفعيل السلو موود: **${seconds} ثانية**`)],
    });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل تفعيل السلو موود.")] });
  }
}

export async function handleUnban(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isAdmin(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const userId = args[0];
  if (!userId) {
    await message.reply({ embeds: [errEmbed("اكتب ID الشخص. `$unban [ID]`")] });
    return;
  }
  try {
    await message.guild.members.unban(userId);
    await message.reply({ embeds: [okEmbed(`✅ تم رفع الحظر عن **${userId}**`)] });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل رفع الحظر، تأكد من الـ ID.")] });
  }
}

export async function handleNick(message: Message, args: string[]): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("الاستخدام: `$nick @شخص [الاسم]`")] });
    return;
  }
  const newNick = args.slice(1).join(" ") || "";
  try {
    await target.setNickname(newNick || null);
    await message.reply({ embeds: [okEmbed(`✏️ تم تغيير اسم **${target.user.tag}** إلى **${newNick || "الاسم الأصلي"}**`)] });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل تغيير الاسم.")] });
  }
}

// $role — shows dropdown of server roles
export async function handleRole(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isMod(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("ما عندك صلاحية.")] });
    return;
  }
  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("الاستخدام: `$role @شخص`")] });
    return;
  }

  const botMember = message.guild.members.me as GuildMember;
  const roles = message.guild.roles.cache
    .filter((r) => r.name !== "@everyone" && !r.managed && r.position < botMember.roles.highest.position)
    .sort((a, b) => b.position - a.position)
    .first(25);

  if (roles.length === 0) {
    await message.reply({ embeds: [errEmbed("لا توجد رتب متاحة.")] });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`role_select:${target.id}`)
    .setPlaceholder("اختر الرتبة...")
    .addOptions(
      roles.map((r) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(r.name)
          .setValue(r.id)
          .setDescription(target.roles.cache.has(r.id) ? "✅ يملكها — سيتم السحب" : "➕ سيتم الإعطاء")
      )
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(`🎭 اختر الرتبة لـ **${target.user.tag}**`),
    ],
    components: [row],
  });
}

export async function handleRoleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guild) return;
  const targetId = interaction.customId.split(":")[1];
  if (!targetId) return;

  const member = interaction.member as GuildMember;
  if (
    !member.permissions.has(PermissionsBitField.Flags.Administrator) &&
    !member.permissions.has(PermissionsBitField.Flags.ManageRoles) &&
    !member.permissions.has(PermissionsBitField.Flags.BanMembers)
  ) {
    await interaction.reply({ content: "❌ ما عندك صلاحية.", ephemeral: true });
    return;
  }

  const roleId = interaction.values[0]!;
  const target = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await interaction.reply({ content: "❌ ما لقيت الشخص.", ephemeral: true });
    return;
  }

  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.reply({ content: "❌ ما لقيت الرتبة.", ephemeral: true });
    return;
  }

  try {
    if (target.roles.cache.has(roleId)) {
      await target.roles.remove(role);
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`✅ تم سحب رتبة **${role.name}** من **${target.user.tag}**`)],
        components: [],
      });
    } else {
      await target.roles.add(role);
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(0x00ff88).setDescription(`✅ تم إعطاء رتبة **${role.name}** لـ **${target.user.tag}**`)],
        components: [],
      });
    }
  } catch {
    await interaction.reply({ content: "❌ فشل تعديل الرتبة.", ephemeral: true });
  }
}

// $اداره — gives configured admin roles to a user
export async function handleAdminGive(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isAdmin(message.member as GuildMember)) {
    await message.reply({ embeds: [errEmbed("فقط الأدمن يقدر يستخدم هذا الأمر.")] });
    return;
  }

  const target = message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply({ embeds: [errEmbed("لازم تمنشن شخص. `$اداره @شخص`")] });
    return;
  }

  const adminRoleIds = getAdminRoles(message.guild.id);
  if (adminRoleIds.length === 0) {
    await message.reply({
      embeds: [errEmbed("ما تم تحديد رتب الإدارة بعد.\nاستخدم الـ slash command `/setup-admin-roles` لتحديدها.")],
    });
    return;
  }

  const botMember = message.guild.members.me as GuildMember;
  const giveable = adminRoleIds.filter((id) => {
    const role = message.guild!.roles.cache.get(id);
    return role && role.position < botMember.roles.highest.position;
  });

  if (giveable.length === 0) {
    await message.reply({ embeds: [errEmbed("رتب الإدارة أعلى من رتبة البوت.")] });
    return;
  }

  try {
    await target.roles.add(giveable);
    const roleNames = giveable
      .map((id) => message.guild!.roles.cache.get(id)?.name)
      .filter(Boolean)
      .join("، ");
    await message.reply({
      embeds: [okEmbed(`👑 تم ترقية **${target.user.tag}** للإدارة\n**الرتب المُعطاة:** ${roleNames}`)],
    });
  } catch {
    await message.reply({ embeds: [errEmbed("فشل إعطاء الرتب.")] });
  }
}
