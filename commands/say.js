
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

    return interaction.reply({
      content,
      allowedMentions: { parse: [] },
    });
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
      return message.reply(
        'Usage: `^say <message>`'
      );
    }

    return message.channel.send({
      content,
      allowedMentions: { parse: [] },
    });
  },
};
