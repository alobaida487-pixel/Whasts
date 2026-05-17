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
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  getStaffRoles,
  saveTicket,
  getTicket,
  deleteTicket,
} from "../config.js";

const TICKET_IMAGE =
  "https://i.imgur.com/OdMdKOV.png";

const REASONS: Record<
  string,
  { label: string; description: string; emoji: string }
> = {
  support: {
    label: "دعم فني - Support",
    description: "للمساعدة بشكل عام / للاستفسارات :",
    emoji: "🛠️",
  },
  staff_complaints: {
    label: "شكاوي على الإدارة - Staff Complaints",
    description: "إذا كانت هناك شكوى على إداري مع دلائك :",
    emoji: "⚖️",
  },
  rewards: {
    label: "الجوائز - Rewards",
    description:
      "لاستلام جوائز عجلة الحظ / نظام الإنقاش / مسابقة الصور / إلخ :",
    emoji: "🎁",
  },
};

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

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectMenu
  );

  const embed = new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setTitle("🎫 تذكرة الدعم - Support Ticket")
    .setDescription(
      [
        "السلام عليكم ورحمة الله وبركاته",
        "",
        "🌟 اهلا بك في نظام التذاكر الخاص بـ **Northern Kingdom**",
        "الرجاء شرح طلبك او مشكلتك وسيقوم فريق الدعم بالرد عليك قريباً",
        "",
        "لسنا مسؤولين إذا لم تقرأ القوانين ⚠️",
      ].join("\n")
    )
    .setThumbnail("attachment://northern.png")
    .setFooter({ text: "Northern Kingdom • Ticket System" })
    .setTimestamp();

  await (message.channel as TextChannel).send({
    embeds: [embed],
    components: [row],
  });

  await message.delete().catch(() => {});
}

export async function handleTicketSelectReason(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  if (!interaction.guild) return;

  const reason = interaction.values[0];
  if (!reason || !REASONS[reason]) return;

  const guild = interaction.guild;
  const user = interaction.user;
  const reasonData = REASONS[reason]!;

  const existing = guild.channels.cache.find(
    (ch) =>
      ch.name === `${user.id}-ticket` ||
      ch.name.startsWith(`ticket-${user.username.toLowerCase()}`)
  );
  if (existing) {
    await interaction.reply({
      content: `❌ عندك تذكرة مفتوحة بالفعل: ${existing.toString()}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const staffRoleIds = getStaffRoles(guild.id);
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
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
  ];

  let ticketCategory = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      (ch.name.toLowerCase().includes("ticket") ||
        ch.name.includes("تذكرة") ||
        ch.name.includes("التذاكر"))
  );

  const channel = await guild.channels.create({
    name: `${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}-ticket`,
    type: ChannelType.GuildText,
    parent: ticketCategory?.id,
    permissionOverwrites,
    topic: `تذكرة ${user.tag} | السبب: ${reasonData.label}`,
  });

  saveTicket(channel.id, {
    channelId: channel.id,
    ownerId: user.id,
    guildId: guild.id,
    reason: reasonData.label,
  });

  const staffMentions =
    staffRoleIds.length > 0
      ? staffRoleIds.map((id) => `<@&${id}>`).join(" ")
      : "";

  const ticketEmbed = new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setDescription(
      [
        "السلام عليكم ورحمة الله وبركاته",
        "",
        `🌟 اهلا بك **<@${user.id}>**`,
        "",
        "اهلاً بك في تذكرة الدعم الخاصة بـ **Northern Kingdom**",
        "الرجاء شرح طلبك او مشكلتك وسيقوم فريق الدعم بالرد عليك قريباً",
        "",
        `${staffMentions ? `<@❖•TicketHelper> ;` : ""}`,
        "",
        "لسنا مسؤولين إذا لم تقرأ القوانين ⚠️",
        `السبب: **${reasonData.label}**`,
      ].join("\n")
    )
    .setImage(TICKET_IMAGE)
    .setFooter({ text: "Ticket Support . | Northern Kingdom" })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

  await (channel as TextChannel).send({
    content: `<@${user.id}> ${staffMentions}`,
    embeds: [ticketEmbed],
    components: [actionRow],
  });

  await interaction.editReply({
    content: `✅ تم فتح تذكرتك: ${channel.toString()}`,
  });
}

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
      await interaction.reply({ content: "❌ فقط الإدارة تقدر تكلم.", ephemeral: true });
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
    await interaction.reply({
      content: "🔒 سيتم إغلاق التذكرة خلال 5 ثواني...",
    });
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
        .send(
          `تم حذف تذكرتك في **Northern Kingdom**\n**السبب:** ${reason}`
        )
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
