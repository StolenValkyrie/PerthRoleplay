const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { isStaff, loadStore, truncate } = require('../lib/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promotions')
    .setDescription("View a member's promotions")
    .addUserOption((o) => o.setName('user').setDescription('Member to look up').setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    const user = interaction.options.getUser('user');
    const records = Object.values(loadStore('promotions'))
      .filter((r) => r.userId === user.id)
      .sort((a, b) => b.date - a.date);

    if (!records.length) {
      return interaction.reply({ content: `<@${user.id}> has no promotions.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }

    const lines = records
      .slice(0, 10)
      .map((r) => `\`${r.id}\` <t:${r.date}:d> to **${r.rankName}** by <@${r.staffId}>: ${truncate(r.reason, 80)}`);
    const more = records.length > 10 ? `\nShowing the latest 10 of ${records.length}.` : '';

    return interaction.reply({
      content: `**Promotions for <@${user.id}>** (${records.length})\n${lines.join('\n')}${more}`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};