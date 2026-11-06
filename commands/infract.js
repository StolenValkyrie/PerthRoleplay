const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const config = require('../config');
const { card, isStaff, loadStore, saveStore, randomId } = require('../lib/helpers');

const IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-9a4e3d76-c307-4814-a4d0-145e330ae6b0.png';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infract')
    .setDescription('Issue an infraction to a member')
    .addUserOption((o) => o.setName('user').setDescription('Member being infracted').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the infraction').setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    // Where the infraction message goes (falls back to this channel if no ID is set)
    const channel = config.infractionChannelId
      ? await interaction.client.channels.fetch(config.infractionChannelId).catch(() => null)
      : interaction.channel;
    if (!channel) {
      return interaction.reply({
        content: 'I could not find the infractions channel. Check infractionChannelId in config.js and that I can see that channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const container = card({
      top: IMAGE,
      text:
        `# Infractions\n<@${user.id}> has been infracted.\n\n` +
        `**Reason:**\n${reason}\n\n` +
        'Please make sure to follow staff rules, and avoid infractions.',
    });

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { users: [user.id] },
    });

    // Keep a record for /infractions and /infraction_remove
    const records = loadStore('infractions');
    const id = randomId('INF', records);
    records[id] = {
      id,
      userId: user.id,
      staffId: interaction.user.id,
      reason,
      date: Math.floor(Date.now() / 1000),
    };
    saveStore('infractions', records);

    await interaction.reply({ content: `Infraction posted in ${channel} (${id}).`, flags: MessageFlags.Ephemeral });
  },
};