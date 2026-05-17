import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  type Message,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  type TextChannel,
  type GuildMember,
  type ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} from "discord.js";
import {
  getStaffRoles,
  saveTicket,
  getTicket,
  deleteTicket,
  getApplyRole,
} from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NK_IMAGE_PATH = path.join(__dirname, "../../../assets/nk-apply.jpeg");

const REASONS: Record<
  string,
  { label: string; description: string; emoji: string }
> = {
  support: {
    label: "دعم فني - Support",
    description: "للمساعدة بشكل عام / للاستفسارات",
    emoji: "🛠️",
  },
  staff_complaints: {
    label: "شكاوي على الإدارة - Staff Complaints",
    description: "إذا كانت هناك شكوى على إداري مع دلائك",
    emoji: "⚖️",
  },
  rewards: {
    label: "الجوائز - Rewards",
    description: "لاستلام جوائز عجلة الحظ / نظام الإنقاش / إلخ",
    emoji: "🎁",
  },
  admin_apply: {
    label: "تقديم الإدارة - Admin Apply",
    description: "تقديم طلب للانضمام لفريق الإدارة",
    emoji: "👑",
  },
};

// ── Shared staff action buttons ───────────────────────────────────────────────
function buildActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_add_user")
      .setLabel("Add User")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Claim")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_delete_reason")
      .setLabel("Delete With Reason")
      .setStyle(ButtonStyle.Danger)
  );
}

export async function sendTicketPanel(message: Message): Promise<void> {
  if (!message.guild) return;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select_reason")
    .setPlaceholder("اختر سبب التذكرة...")
    .addOptions(
      Object.entries(REASONS).map(([value, { label, description, emoji }]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setDescription(description)
          .setValue(value)
          .setEmoji(emoji)
      )
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setTitle("🎫 تذكرة الدعم - Support Ticket")
    .setDescription(
      [
        "السلام عليكم ورحمة الله وبركاته",
        "",
        "🌟 اهلا بك في نظام التذاكر الخاص بـ **Northern Kingdom**",
        "الرجاء اختيار نوع طلبك وسيقوم فريق الدعم بالرد عليك قريباً",
        "",
        "لسنا مسؤولين إذا لم تقرأ القوانين ⚠️",
      ].join("\n")
    )
    .setFooter({ text: "Northern Kingdom • Ticket System" })
    .setTimestamp();

  await (message.channel as TextChannel).send({
    embeds: [embed],
    components: [row],
  });

  await message.delete().catch(() => {});
}

// ── Admin Apply ticket ────────────────────────────────────────────────────────
async function handleAdminApplyTicket(
  interaction: StringSelectMenuInteraction,
  channel: TextChannel,
  userId: string
): Promise<void> {
  const guild = interaction.guild!;
  const applyRoleId = getApplyRole(guild.id);

  // Build the ping content
  const pings = [
    `<@${userId}>`,
    applyRoleId ? `<@&${applyRoleId}>` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Styled embed for admin apply
  const applyEmbed = new EmbedBuilder()
    .setColor(0x0d0d1a)
    .setTitle("👑 تقديم الإدارة | Northern Kingdom")
    .setDescription(
      [
        `مرحباً <@${userId}> 👋`,
        "",
        "**شكراً على اهتمامك بالانضمام لفريق إدارة Northern Kingdom**",
        "",
        "━━━━━━━━━━━━━━━━━━━━━",
        "📋 **متطلبات التقديم:**",
        "> ✅ **رابط سيرفرك** — ضع رابط الدعوة الخاص بسيرفرك",
        "> 🖼️ **شعار سيرفرك** — ارفع صورة الشعار هنا",
        "> 📝 **نبذة عنك** — من أنت وما هي خبرتك في الإدارة؟",
        "> ⭐ **لماذا تريد الانضمام؟** — اشرح سبب رغبتك",
        "━━━━━━━━━━━━━━━━━━━━━",
        "",
        "⚠️ **تأكد من إرفاق جميع المتطلبات قبل الإرسال**",
        "سيتم مراجعة طلبك من قبل الإدارة العليا وسيتم الرد عليك قريباً",
      ].join("\n")
    )
    .setThumbnail(
      "https://cdn.discordapp.com/emojis/1017018743456432218.png"
    )
    .setFooter({ text: "Northern Kingdom • Staff Apply System" })
    .setTimestamp();

  // Try to attach the NK image
  let imageAttachment: AttachmentBuilder | null = null;
  try {
    if (fs.existsSync(NK_IMAGE_PATH)) {
      imageAttachment = new AttachmentBuilder(NK_IMAGE_PATH, {
        name: "nk-apply.jpeg",
        description: "Northern Kingdom — تقديم الإدارة",
      });
      applyEmbed.setImage("attachment://nk-apply.jpeg");
    }
  } catch {}

  const msgOptions: Parameters<TextChannel["send"]>[0] = {
    content: pings,
    embeds: [applyEmbed],
    components: [buildActionRow()],
  };
  if (imageAttachment) {
    msgOptions.files = [imageAttachment];
  }

  await channel.send(msgOptions);
}

// ── Regular ticket (support / complaints / rewards) ───────────────────────────
async function handleRegularTicket(
  interaction: StringSelectMenuInteraction,
  channel: TextChannel,
  userId: string,
  reasonData: { label: string; description: string; emoji: string }
): Promise<void> {
  const guild = interaction.guild!;
  const staffRoleIds = getStaffRoles(guild.id);
  const staffMentions = staffRoleIds.map((id) => `<@&${id}>`).join(" ");

  const ticketEmbed = new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setDescription(
      [
        "السلام عليكم ورحمة الله وبركاته",
        "",
        `🌟 اهلاً بك **<@${userId}>**`,
        "",
        "اهلاً بك في تذكرة الدعم الخاصة بـ **Northern Kingdom**",
        "الرجاء شرح طلبك أو مشكلتك وسيقوم فريق الدعم بالرد عليك قريباً",
        "",
        "لسنا مسؤولين إذا لم تقرأ القوانين ⚠️",
        `السبب: **${reasonData.label}**`,
      ].join("\n")
    )
    .setFooter({ text: "Ticket Support | Northern Kingdom" })
    .setTimestamp();

  await channel.send({
    content: `<@${userId}>${staffMentions ? ` ${staffMentions}` : ""}`,
    embeds: [ticketEmbed],
    components: [buildActionRow()],
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function handleTicketSelectReason(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  if (!interaction.guild) return;

  const reason = interaction.values[0];
  if (!reason || !REASONS[reason]) return;

  const guild = interaction.guild;
  const user = interaction.user;
  const reasonData = REASONS[reason]!;
  const isAdminApply = reason === "admin_apply";

  // Prevent duplicate tickets
  const prefix = isAdminApply ? "apply" : "ticket";
  const cleanName = `${prefix}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const existing = guild.channels.cache.find((ch) => ch.name === cleanName);
  if (existing) {
    await interaction.reply({
      content: `❌ عندك تذكرة مفتوحة بالفعل: ${existing.toString()}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const staffRoleIds = getStaffRoles(guild.id);
  const applyRoleId = getApplyRole(guild.id);

  // Build permissions — staff + (apply role for admin_apply)
  const extraRoles = isAdminApply && applyRoleId
    ? [...staffRoleIds, applyRoleId].filter((v, i, a) => a.indexOf(v) === i)
    : staffRoleIds;

  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
      ],
    },
    ...extraRoles.map((roleId) => ({
      id: roleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
      ],
    })),
  ];

  // Find suitable category
  const categoryKeywords = isAdminApply
    ? ["apply", "تقديم", "staff"]
    : ["ticket", "تذكرة", "التذاكر"];

  const ticketCategory = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      categoryKeywords.some((kw) => ch.name.toLowerCase().includes(kw))
  ) ?? guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      (ch.name.toLowerCase().includes("ticket") || ch.name.includes("تذكرة"))
  );

  const channel = await guild.channels.create({
    name: cleanName,
    type: ChannelType.GuildText,
    parent: ticketCategory?.id,
    permissionOverwrites,
    topic: `${isAdminApply ? "تقديم إدارة" : "تذكرة"} — ${user.tag} | ${reasonData.label}`,
  });

  saveTicket(channel.id, {
    channelId: channel.id,
    ownerId: user.id,
    guildId: guild.id,
    reason: reasonData.label,
  });

  if (isAdminApply) {
    await handleAdminApplyTicket(interaction, channel as TextChannel, user.id);
  } else {
    await handleRegularTicket(interaction, channel as TextChannel, user.id, reasonData);
  }

  await interaction.editReply({
    content: `✅ تم فتح تذكرتك: ${channel.toString()}`,
  });
}

// ── Button handler ────────────────────────────────────────────────────────────
export async function handleTicketButton(
  interaction: ButtonInteraction
): Promise<void> {
  const customId = interaction.customId;
  const channel = interaction.channel as TextChannel;
  const guild = interaction.guild;
  if (!guild || !channel) return;

  const ticketData = getTicket(channel.id);
  const member = interaction.member as GuildMember;
  const staffRoles = getStaffRoles(guild.id);

  const isStaff =
    member.permissions.has("Administrator") ||
    member.permissions.has("ManageChannels") ||
    staffRoles.some((roleId) => member.roles.cache.has(roleId));

  const isOwner = ticketData?.ownerId === interaction.user.id;

  if (customId === "ticket_add_user") {
    if (!isStaff && !isOwner) {
      await interaction.reply({ content: "❌ ما عندك صلاحية.", ephemeral: true });
      return;
    }
    await interaction.reply({
      content: "📝 اكتب منشن الشخص الذي تريد إضافته في الرسالة التالية:",
      ephemeral: true,
    });
    return;
  }

  if (customId === "ticket_claim") {
    if (!isStaff) {
      await interaction.reply({ content: "❌ فقط الإدارة تقدر تستلم.", ephemeral: true });
      return;
    }
    if (ticketData) {
      ticketData.claimedBy = interaction.user.id;
      saveTicket(channel.id, ticketData);
    }
    await interaction.reply({
      content: `✅ تم استلام التذكرة من قبل <@${interaction.user.id}>`,
    });
    return;
  }

  if (customId === "ticket_close") {
    if (!isStaff && !isOwner) {
      await interaction.reply({ content: "❌ ما عندك صلاحية.", ephemeral: true });
      return;
    }
    await interaction.reply({ content: "🔒 سيتم إغلاق التذكرة خلال 5 ثواني..." });
    setTimeout(async () => {
      try {
        deleteTicket(channel.id);
        await channel.delete("تم إغلاق التذكرة");
      } catch {}
    }, 5000);
    return;
  }

  if (customId === "ticket_delete_reason") {
    if (!isStaff) {
      await interaction.reply({ content: "❌ فقط الإدارة تقدر تحذف.", ephemeral: true });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId("ticket_delete_modal")
      .setTitle("سبب الحذف")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("delete_reason_input")
            .setLabel("اكتب سبب الحذف")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder("السبب...")
        )
      );
    await interaction.showModal(modal);
    return;
  }
}

// ── Modal handler ─────────────────────────────────────────────────────────────
export async function handleDeleteModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const channel = interaction.channel as TextChannel;
  if (!channel) return;

  const reason = interaction.fields.getTextInputValue("delete_reason_input");

  await interaction.reply({
    content: `🗑️ سيتم حذف التذكرة...\n**السبب:** ${reason}`,
  });

  const ticketData = getTicket(channel.id);
  if (ticketData) {
    try {
      const owner = await interaction.client.users.fetch(ticketData.ownerId);
      await owner
        .send(`تم حذف تذكرتك في **Northern Kingdom**\n**السبب:** ${reason}`)
        .catch(() => {});
    } catch {}
  }

  setTimeout(async () => {
    try {
      deleteTicket(channel.id);
      await channel.delete(`حذف بسبب: ${reason}`);
    } catch {}
  }, 3000);
}
