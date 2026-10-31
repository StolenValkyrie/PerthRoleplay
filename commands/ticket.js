const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { loadTickets, findByChannel, canManage, closeTicket } = require('../lib/tickets');

const reply = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket you are in')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add a member to this ticket')
        .addUserOption((o) => o.setName('user').setDescription('Member to add').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a member from this ticket')
        .addUserOption((o) => o.setName('user').setDescription('Member to remove').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('close')
        .setDescription('Close this ticket')
        .addStringOption((o) => o.setName('reason').setDescription('Reason for closing'))
    ),

  async execute(interaction) {
    const ticket = findByChannel(loadTickets(), interaction.channelId);
    if (!ticket) return reply(interaction, 'Use this inside an open ticket.');

    const staff = canManage(interaction.member, ticket);
    const sub = interaction.options.getSubcommand();

    // The person who opened the ticket may close it, everything else is staff only
    if (!staff && !(sub === 'close' && ticket.openerId === interaction.user.id)) {
      return reply(interaction, 'You do not have permission to do that.');
    }

    if (sub === 'close') {
      const reason = interaction.options.getString('reason') ?? '';
      await interaction.reply('Saving the transcript and closing this ticket...');
      return closeTicket(interaction, ticket, reason);
    }

    const user = interaction.options.getUser('user');

    if (sub === 'add') {
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });
      return interaction.reply({ content: `Added <@${user.id}> to this ticket.`, allowedMentions: { users: [user.id] } });
    }

    if (sub === 'remove') {
      if (user.id === ticket.openerId) return reply(interaction, 'You cannot remove the person who opened the ticket.');
      await interaction.channel.permissionOverwrites.delete(user.id);
      return interaction.reply({ content: `Removed <@${user.id}> from this ticket.`, allowedMentions: { parse: [] } });
    }
  },
};