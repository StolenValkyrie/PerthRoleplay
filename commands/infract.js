const { MessageFlags, SlashCommandBuilder } = require('discord.js');
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

    const container = card({
      top: IMAGE,
      text:
        `# Infractions\n<@${user.id}> has been infracted.\n\n` +
        `**Reason:**\n${reason}\n\n` +
        'Please make sure to follow staff rules, and avoid infractions.',
    });

    await interaction.channel.send({
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

    await interaction.reply({ content: `Infraction posted (${id}).`, flags: MessageFlags.Ephemeral });
  },
};