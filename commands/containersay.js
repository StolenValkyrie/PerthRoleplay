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

return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
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
        'Usage: `^containersay <message>`'
      );
    }

const container = createContainer(content);

return message.channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};