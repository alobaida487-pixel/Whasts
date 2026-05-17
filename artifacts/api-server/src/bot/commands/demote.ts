import {
  type Message,
  EmbedBuilder,
  type GuildMember,
  type TextChannel,
} from "discord.js";

export async function handleDemote(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;

  const member = message.member as GuildMember;
  if (
    !member.permissions.has("ManageRoles") &&
    !member.permissions.has("Administrator")
  ) {
    await message.reply("❌ ما عندك صلاحية لاستخدام هذا الأمر.");
    return;
  }

  const target =
    message.mentions.members?.first() as GuildMember | undefined;
  if (!target) {
    await message.reply("❌ لازم تمنشن شخص. مثال: `$تنزيل @شخص`");
    return;
  }

  const guild = message.guild;
  const topRole = target.roles.highest;

  if (topRole.name === "@everyone") {
    await message.reply("❌ الشخص ما عنده رتبة تنزل منها.");
    return;
  }

  const allRoles = guild.roles.cache
    .filter((r) => r.name !== "@everyone" && !r.managed)
    .sort((a, b) => a.position - b.position);

  const prevRole = allRoles
    .filter((r) => r.position < topRole.position && !r.managed)
    .sort((a, b) => b.position - a.position)
    .first();

  const botMember = guild.members.me as GuildMember;
  if (topRole.position >= botMember.roles.highest.position) {
    await message.reply("❌ ما أقدر أشيل هذه الرتبة لأنها أعلى من رتبتي.");
    return;
  }

  try {
    await target.roles.remove(topRole);

    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setDescription(
        `⬇️ تنزيل ${target.toString()}\n\n**الرتبة المُزالة :** ${topRole.toString()} ؛ 📉${
          prevRole
            ? `\n**الرتبة الحالية :** ${prevRole.toString()}`
            : ""
        }`
      )
      .setTimestamp();

    await (message.channel as TextChannel).send({ embeds: [embed] });
  } catch {
    await message.reply("❌ صار خطأ أثناء التنزيل، تأكد من صلاحيات البوت.");
  }
}
