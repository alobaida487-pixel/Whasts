import {
  type Message,
  EmbedBuilder,
  type GuildMember,
  type TextChannel,
} from "discord.js";

export async function handlePromote(message: Message): Promise<void> {
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
    await message.reply("❌ لازم تمنشن شخص. مثال: `$ترقيه @شخص`");
    return;
  }

  const guild = message.guild;
  const allRoles = guild.roles.cache
    .filter((r) => r.name !== "@everyone" && !r.managed)
    .sort((a, b) => a.position - b.position);

  const topRole = target.roles.highest;
  const topRolePosition = topRole.position;

  const nextRole = allRoles
    .filter((r) => r.position > topRolePosition && !r.managed)
    .sort((a, b) => a.position - b.position)
    .first();

  if (!nextRole) {
    await message.reply("❌ الشخص هذا وصل لأعلى رتبة متاحة.");
    return;
  }

  const botMember = guild.members.me as GuildMember;
  if (nextRole.position >= botMember.roles.highest.position) {
    await message.reply(
      "❌ ما أقدر أعطي هذه الرتبة لأنها أعلى من رتبتي."
    );
    return;
  }

  try {
    await target.roles.add(nextRole);

    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setDescription(
        `⬆️ ترقية ${target.toString()}\n\n**الرتبة الجديدة :** ${nextRole.toString()} ؛ 🎖️`
      )
      .setTimestamp();

    await (message.channel as TextChannel).send({ embeds: [embed] });
  } catch {
    await message.reply("❌ صار خطأ أثناء الترقية، تأكد من صلاحيات البوت.");
  }
}
