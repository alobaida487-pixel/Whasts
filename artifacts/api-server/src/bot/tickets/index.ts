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

// ── Ticket panel ──────────────────────────────────────────────────────────────
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

// ── Dropdown select handler ───────────────────────────────────────────────────
export async function handleTicketSelectReason(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  if (!interaction.guild) return;

  const reason = interaction.values[0];
  if (!reason || !REASONS[reason]) return;

  // Admin apply → show modal with questions first
  if (reason === "admin_apply") {
    const guild = interaction.guild;
    const user = interaction.user;
    const cleanName = `apply-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const existing = guild.channels.cache.find((ch) => ch.name === cleanName);
    if (existing) {
      await interaction.reply({
        content: `❌ عندك تقديم مفتوح بالفعل: ${existing.toString()}`,
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId("admin_apply_modal")
      .setTitle("📋 تقديم الإدارة — Northern Kingdom")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("apply_name_age")
            .setLabel("الاسم والعمر")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("مثال: محمد — 20 سنة")
            .setRequired(true)
            .setMaxLength(60)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("apply_reason")
            .setLabel("سبب التقديم")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("لماذا تريد الانضمام لفريق الإدارة؟")
            .setRequired(true)
            .setMaxLength(400)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("apply_experience")
            .setLabel("خبراتك في الإدارة")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("هل سبق أن عملت إداري؟ ما هي خبرتك؟")
            .setRequired(true)
            .setMaxLength(400)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("apply_activity")
            .setLabel("مدة تفاعلك في السيرفر")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("مثال: 3 أشهر — يومياً")
            .setRequired(true)
            .setMaxLength(100)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("apply_benefit")
            .setLabel("وش بتفيدنا؟")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("ما الذي ستضيفه لفريق Northern Kingdom؟")
            .setRequired(true)
            .setMaxLength(400)
        )
      );

    await interaction.showModal(modal);
    return;
  }

  // Regular ticket (support / complaints / rewards)
  const guild = interaction.guild;
  const user = interaction.user;
  const reasonData = REASONS[reason]!;

  const cleanName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
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
  const channel = await guild.channels.create({
    name: cleanName,
    type: ChannelType.GuildText,
    parent: guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildCategory &&
        (ch.name.toLowerCase().includes("ticket") ||
          ch.name.includes("تذكرة") ||
          ch.name.includes("التذاكر"))
    )?.id,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      ...staffRoleIds.map((roleId) => ({
        id: roleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels,
        ],
      })),
    ],
    topic: `تذكرة — ${user.tag} | ${reasonData.label}`,
  });

  saveTicket(channel.id, {
    channelId: channel.id,
    ownerId: user.id,
    guildId: guild.id,
    reason: reasonData.label,
  });

  const staffMentions = staffRoleIds.map((id) => `<@&${id}>`).join(" ");

  const ticketEmbed = new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setDescription(
      [
        "السلام عليكم ورحمة الله وبركاته",
        "",
        `🌟 اهلاً بك **<@${user.id}>**`,
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

  await (channel as TextChannel).send({
    content: `<@${user.id}>${staffMentions ? ` ${staffMentions}` : ""}`,
    embeds: [ticketEmbed],
    components: [buildActionRow()],
  });

  await interaction.editReply({ content: `✅ تم فتح تذكرتك: ${channel.toString()}` });
}

// ── Admin Apply modal submit ───────────────────────────────────────────────────
export async function handleAdminApplyModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  if (!interaction.guild) return;

  const guild = interaction.guild;
  const user = interaction.user;

  const nameAge = interaction.fields.getTextInputValue("apply_name_age");
  const reason = interaction.fields.getTextInputValue("apply_reason");
  const experience = interaction.fields.getTextInputValue("apply_experience");
  const activity = interaction.fields.getTextInputValue("apply_activity");
  const benefit = interaction.fields.getTextInputValue("apply_benefit");

  await interaction.deferReply({ ephemeral: true });

  const applyRoleId = getApplyRole(guild.id);
  const staffRoleIds = getStaffRoles(guild.id);
  const cleanName = `apply-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  // Permissions: user + staff + apply role
  const reviewRoles = [
    ...staffRoleIds,
    ...(applyRoleId ? [applyRoleId] : []),
  ].filter((v, i, a) => a.indexOf(v) === i);

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
    ...reviewRoles.map((roleId) => ({
      id: roleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
      ],
    })),
  ];

  // Find apply/staff category or fall back to ticket category
  const ticketCategory =
    guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildCategory &&
        (ch.name.toLowerCase().includes("apply") ||
          ch.name.includes("تقديم") ||
          ch.name.toLowerCase().includes("staff"))
    ) ??
    guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildCategory &&
        (ch.name.toLowerCase().includes("ticket") ||
          ch.name.includes("تذكرة"))
    );

  const channel = await guild.channels.create({
    name: cleanName,
    type: ChannelType.GuildText,
    parent: ticketCategory?.id,
    permissionOverwrites,
    topic: `تقديم إدارة — ${user.tag}`,
  });

  saveTicket(channel.id, {
    channelId: channel.id,
    ownerId: user.id,
    guildId: guild.id,
    reason: "تقديم الإدارة - Admin Apply",
  });

  // Build pings
  const pings = [
    `<@${user.id}>`,
    applyRoleId ? `<@&${applyRoleId}>` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Apply answers embed
  const applyEmbed = new EmbedBuilder()
    .setColor(0x0d0d1a)
    .setAuthor({
      name: `${user.username} — تقديم الإدارة`,
      iconURL: user.displayAvatarURL(),
    })
    .setTitle("👑 طلب انضمام — Northern Kingdom")
    .addFields(
      { name: "👤 الاسم والعمر", value: nameAge, inline: false },
      { name: "📋 سبب التقديم", value: reason, inline: false },
      { name: "⭐ الخبرات في الإدارة", value: experience, inline: false },
      { name: "📅 مدة التفاعل في السيرفر", value: activity, inline: false },
      { name: "💡 وش بتفيدنا؟", value: benefit, inline: false }
    )
    .setFooter({ text: "Northern Kingdom • Staff Apply System" })
    .setTimestamp();

  // Try to attach NK image
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
  if (imageAttachment) msgOptions.files = [imageAttachment];

  await (channel as TextChannel).send(msgOptions);

  await interaction.editReply({
    content: `✅ تم إرسال تقديمك بنجاح: ${channel.toString()}\nستتم مراجعته من قبل الإدارة قريباً 🕐`,
  });
}

// ── Ticket buttons ────────────────────────────────────────────────────────────
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

// ── Delete modal ──────────────────────────────────────────────────────────────
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
