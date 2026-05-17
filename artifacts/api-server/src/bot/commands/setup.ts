import { type Message, EmbedBuilder, type GuildMember } from "discord.js";
import { setStaffRoles, getStaffRoles } from "../config.js";

export async function handleSetup(
  message: Message,
  args: string[]
): Promise<void> {
  if (!message.guild || !message.member) return;

  const member = message.member as GuildMember;
  if (!member.permissions.has("Administrator")) {
    await message.reply("❌ فقط الأدمن يقدر يستخدم أمر الإعداد.");
    return;
  }

  const mentionedRoles = message.mentions.roles;

  if (mentionedRoles.size === 0) {
    const current = getStaffRoles(message.guild.id);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("⚙️ إعداد Northern Kingdom")
      .setDescription(
        current.length > 0
          ? `**رتب الإدارة الحالية:**\n${current.map((id) => `<@&${id}>`).join("\n")}`
          : "لم يتم تحديد رتب إدارة بعد.\n\nالاستخدام: `$setup @رتبة1 @رتبة2 ...`"
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  const roleIds = mentionedRoles.map((r) => r.id);
  setStaffRoles(message.guild.id, roleIds);

  const embed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle("✅ تم الإعداد بنجاح")
    .setDescription(
      `**رتب الإدارة للتكتات:**\n${roleIds.map((id) => `<@&${id}>`).join("\n")}`
    )
    .setFooter({ text: "Northern Kingdom Bot" })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
