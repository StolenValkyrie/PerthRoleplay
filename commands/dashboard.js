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
const RULES_TEXT = '# Rules\n- Be respectful to others, no harassment or hate speech.\n- No spamming or advertising.\n- Follow the Discord Community Guidelines and Terms of Service.\n- No NSFW content.\n- Use appropriate channels for discussions.';
const GAME_INFO_TEXT = '# Game Info\n- No RDM, VDM, or GTA Driving, moderation will take place.\n- Follow PT\'s, announcements, and staff directions.\n- Real staff team members will have a car and a way to check on discord.';

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