
const {
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');

const {
  isStaff,
  loadStore,
  truncate,
} = require('../lib/helpers');

function getPromotions(userId) {
  return Object.values(loadStore('promotions'))
    .filter(record => record.userId === userId)
    .sort((a, b) => b.date - a.date);
}

function formatPromotions(user, records) {
  if (!records.length) {
    return `<@${user.id}> has no promotions.`;
  }

  const lines = records
    .slice(0, 10)
    .map(record =>
      `\`${record.id}\` <t:${record.date}:d> to **${record.rankName}** by <@${record.staffId}>: ${truncate(record.reason, 80)}`
    );

  const more = records.length > 10
    ? `\nShowing the latest 10 of ${records.length}.`
    : '';

  return (
    `**Promotions for <@${user.id}>** (${records.length})\n` +
    `${lines.join('\n')}${more}`
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promotions')
    .setDescription("View a member's promotions")
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Member to look up')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const user = interaction.options.getUser('user');
    const records = getPromotions(user.id);

    return interaction.reply({
      content: formatPromotions(user, records),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },

  async prefix(message, args) {
    if (!isStaff(message.member)) {
      return message.reply(
        'You do not have permission to use this.'
      );
    }

    const user =
      message.mentions.users.first() ||
      (args[0] ? await message.client.users.fetch(
        args[0].replace(/[<@!>]/g, '')
      ).catch(() => null) : null);

    if (!user) {
      return message.reply(
        'Usage: `^promotions @user`'
      );
    }

    const records = getPromotions(user.id);

    return message.reply({
      content: formatPromotions(user, records),
      allowedMentions: { parse: [] },
    });
  },
};
