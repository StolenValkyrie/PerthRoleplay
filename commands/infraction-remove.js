
const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { isStaff, loadStore, saveStore } = require('../lib/helpers');

async function removeInfraction(id) {
  id = id.trim().toUpperCase();

  const records = loadStore('infractions');
  const record = records[id];

  if (!record) {
    return { success: false, id };
  }

  delete records[id];
  saveStore('infractions', records);

  return { success: true, id, record };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction_remove')
    .setDescription('Remove an infraction record')
    .addStringOption((o) =>
      o.setName('id')
        .setDescription('Infraction ID, like INF-7K2QX9')
        .setRequired(true)
    ),

  // Slash: /infraction_remove
  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const id = interaction.options.getString('id');
    const result = await removeInfraction(id);

    if (!result.success) {
      return interaction.reply({
        content: `No infraction found with ID **${result.id}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: `Removed infraction **${result.id}** for <@${result.record.userId}>.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },

  // Prefix: ^infraction_remove INF-7K2QX9
  async prefix(message, args) {
    if (!isStaff(message.member)) {
      return message.reply(
        'You do not have permission to use this.'
      );
    }

    const id = args[0];

    if (!id) {
      return message.reply(
        'Usage: `^infraction_remove INF-7K2QX9`'
      );
    }

    const result = await removeInfraction(id);

    if (!result.success) {
      return message.reply(
        `No infraction found with ID **${result.id}**.`
      );
    }

    return message.reply({
      content: `Removed infraction **${result.id}** for <@${result.record.userId}>.`,
      allowedMentions: { parse: [] },
    });
  },
};
