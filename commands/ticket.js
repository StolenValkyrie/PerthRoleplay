
const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const {
  loadTickets,
  findByChannel,
  canManage,
  closeTicket,
} = require('../lib/tickets');

// ==========================================
// SLASH REPLY
// ==========================================

const reply = (interaction, content) =>
  interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });

// ==========================================
// PREFIX USER RESOLVER
// ==========================================

async function resolveUser(message, argument) {
  const mentionedUser = message.mentions.users.first();

  if (mentionedUser) return mentionedUser;
  if (!argument) return null;

  const userId = argument.replace(/[<@!>]/g, '');

  if (!/^\d{17,20}$/.test(userId)) return null;

  try {
    return await message.client.users.fetch(userId);
  } catch {
    return null;
  }
}

// ==========================================
// TICKET PERMISSION CHECK
// ==========================================

function hasTicketPermission(member, ticket, subcommand, userId) {
  const staff = canManage(member, ticket);

  // Ticket opener can only close their own ticket.
  if (!staff && !(subcommand === 'close' && ticket.openerId === userId)) {
    return false;
  }

  return true;
}

// ==========================================
// COMMAND
// ==========================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket you are in')

    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add a member to this ticket')
        .addUserOption((o) =>
          o
            .setName('user')
            .setDescription('Member to add')
            .setRequired(true)
        )
    )

    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a member from this ticket')
        .addUserOption((o) =>
          o
            .setName('user')
            .setDescription('Member to remove')
            .setRequired(true)
        )
    )

    .addSubcommand((s) =>
      s
        .setName('close')
        .setDescription('Close this ticket')
        .addStringOption((o) =>
          o
            .setName('reason')
            .setDescription('Reason for closing')
        )
    ),

  // ========================================
  // SLASH COMMAND
  // ========================================

  async execute(interaction) {
    const ticket = findByChannel(
      loadTickets(),
      interaction.channelId
    );

    if (!ticket) {
      return reply(interaction, 'Use this inside an open ticket.');
    }

    const sub = interaction.options.getSubcommand();

    if (!hasTicketPermission(
      interaction.member,
      ticket,
      sub,
      interaction.user.id
    )) {
      return reply(interaction, 'You do not have permission to do that.');
    }

    // CLOSE
    if (sub === 'close') {
      const reason = interaction.options.getString('reason') ?? '';

      await interaction.reply(
        'Saving the transcript and closing this ticket...'
      );

      return closeTicket(interaction, ticket, reason);
    }

    const user = interaction.options.getUser('user');

    // ADD
    if (sub === 'add') {
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });

      return interaction.reply({
        content: `Added <@${user.id}> to this ticket.`,
        allowedMentions: { users: [user.id] },
      });
    }

    // REMOVE
    if (sub === 'remove') {
      if (user.id === ticket.openerId) {
        return reply(
          interaction,
          'You cannot remove the person who opened the ticket.'
        );
      }

      await interaction.channel.permissionOverwrites.delete(user.id);

      return interaction.reply({
        content: `Removed <@${user.id}> from this ticket.`,
        allowedMentions: { parse: [] },
      });
    }
  },

  // ========================================
  // PREFIX COMMAND
  // ========================================

  async prefix(message, args) {
    const ticket = findByChannel(
      loadTickets(),
      message.channel.id
    );

    if (!ticket) {
      return message.reply(
        'Use this command inside an open ticket.'
      );
    }

    const sub = args[0]?.toLowerCase();

    if (!sub || !['add', 'remove', 'close'].includes(sub)) {
      return message.reply(
        'Ticket commands:\n' +
        '`^ticket add @user`\n' +
        '`^ticket remove @user`\n' +
        '`^ticket close [reason]`'
      );
    }

    if (!hasTicketPermission(
      message.member,
      ticket,
      sub,
      message.author.id
    )) {
      return message.reply(
        'You do not have permission to do that.'
      );
    }

    // CLOSE
    if (sub === 'close') {
      const reason = args.slice(1).join(' ').trim();

      await message.reply(
        'Saving the transcript and closing this ticket...'
      );

      // Adapt the message into the context expected by closeTicket.
      const context = {
        channel: message.channel,
        channelId: message.channel.id,
        guild: message.guild,
        guildId: message.guild.id,
        client: message.client,
        user: message.author,
        member: message.member,
      };

      return closeTicket(context, ticket, reason);
    }

    // ADD / REMOVE
    const user = await resolveUser(message, args[1]);

    if (!user) {
      return message.reply(
        `Usage: \`^ticket ${sub} @user\`\nYou can also provide a user ID.`
      );
    }

    // ADD
    if (sub === 'add') {
      await message.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });

      return message.reply({
        content: `Added <@${user.id}> to this ticket.`,
        allowedMentions: { users: [user.id] },
      });
    }

    // REMOVE
    if (sub === 'remove') {
      if (user.id === ticket.openerId) {
        return message.reply(
          'You cannot remove the person who opened the ticket.'
        );
      }

      await message.channel.permissionOverwrites.delete(user.id);

      return message.reply({
        content: `Removed <@${user.id}> from this ticket.`,
        allowedMentions: { parse: [] },
      });
    }
  },
};
