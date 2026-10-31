const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
} = require('discord.js');

const TOP_IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-7f539de2-0e56-41cc-afe1-34fc4f8dc21e.png';
const BOTTOM_IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-cdfc75cc-0456-4886-9a51-a14e1563d9bf.png';

// Edit these two messages to whatever you want the buttons to show
const RULES_TEXT = '# Rules\n1. Be respectful to everyone.\n2. No random killing or breaking character.\n3. Follow staff instructions.';
const GAME_INFO_TEXT = '# Game Info\nAdd your game link, server details and other info here.';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Send the Perth Roleplay dashboard in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const container = new ContainerBuilder()
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(TOP_IMAGE))
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '# Dashboard\n> This is the Perth Roleplay dashboard, please read through the rules for a great time here!'
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('dashboard_rules').setLabel('Rules').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('dashboard_gameinfo').setLabel('Game Info').setStyle(ButtonStyle.Secondary)
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(BOTTOM_IMAGE))
      );

    await interaction.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    await interaction.reply({ content: 'Dashboard sent.', flags: MessageFlags.Ephemeral });
  },

  // Button handlers, matched by customId in index.js
  buttons: {
    dashboard_rules: (interaction) =>
      interaction.reply({ content: RULES_TEXT, flags: MessageFlags.Ephemeral }),
    dashboard_gameinfo: (interaction) =>
      interaction.reply({ content: GAME_INFO_TEXT, flags: MessageFlags.Ephemeral }),
  },
};  