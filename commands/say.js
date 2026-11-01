
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The message to send')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  async execute(interaction) {
    const content = interaction.options.getString('message');

    // Private acknowledgement
    await interaction.deferReply({ ephemeral: true });

    // Send standalone message with all mentions enabled
    await interaction.channel.send({
      content,
      allowedMentions: {
        parse: ['everyone', 'roles', 'users'],
        repliedUser: false,
      },
    });

    // Remove private acknowledgement
    return interaction.deleteReply();
  },

  async prefix(message, args) {
    if (!message.member.permissions.has(
      PermissionFlagsBits.ManageMessages
    )) {
      return message.reply(
        'You need Manage Messages permission to use this command.'
      );
    }

    const content = args.join(' ').trim();

    if (!content) {
      return message.reply('Usage: `^say <message>`');
    }

    // Send standalone message with all mentions enabled
    await message.channel.send({
      content,
      allowedMentions: {
        parse: ['everyone', 'roles', 'users'],
        repliedUser: false,
      },
    });

    // Delete original command
    return message.delete().catch(() => null);
  },
};
