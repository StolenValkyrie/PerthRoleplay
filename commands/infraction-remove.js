const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { isStaff, loadStore, saveStore } = require('../lib/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction_remove')
    .setDescription('Remove an infraction record')
    .addStringOption((o) => o.setName('id').setDescription('Infraction ID, like INF-7K2QX9').setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    const id = interaction.options.getString('id').trim().toUpperCase();
    const records = loadStore('infractions');
    const record = records[id];

    if (!record) {
      return interaction.reply({ content: `No infraction found with ID **${id}**.`, flags: MessageFlags.Ephemeral });
    }

    delete records[id];
    saveStore('infractions', records);

    return interaction.reply({
      content: `Removed infraction **${id}** for <@${record.userId}>.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};