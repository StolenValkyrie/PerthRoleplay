
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require('discord.js');

function createContainer(content) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content)
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('containersay')
    .setDescription('Send a message in a container')
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
    const container = createContainer(content);

    // Private acknowledgement
    await interaction.deferReply({ ephemeral: true });

    // Send standalone container with all mentions enabled
    await interaction.channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: {
        parse: ['everyone', 'roles', 'users'],
        repliedUser: false,
      },
    });

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
      return message.reply(
        'Usage: `^containersay <message>`'
      );
    }

    const container = createContainer(content);

    // Send standalone container with all mentions enabled
    await message.channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: {
        parse: ['everyone', 'roles', 'users'],
        repliedUser: false,
      },
    });

    // Delete original prefix command
    return message.delete().catch(() => null);
  },
};
