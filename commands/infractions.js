
const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { isStaff, loadStore, truncate } = require('../lib/helpers');

// ==========================================
// GET USER INFRACTIONS
// ==========================================

function getInfractions(userId) {
  return Object.values(loadStore('infractions'))
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.date - a.date);
}

// ==========================================
// FORMAT INFRACTIONS
// ==========================================

function formatInfractions(user, records) {
  if (!records.length) {
    return `<@${user.id}> has no infractions.`;
  }

  const lines = records
    .slice(0, 10)
    .map((r) =>
      `\`${r.id}\` <t:${r.date}:d> by <@${r.staffId}>: ${truncate(r.reason, 80)}`
    );

  const more = records.length > 10
    ? `\nShowing the latest 10 of ${records.length}.`
    : '';

  return (
    `**Infractions for <@${user.id}>** (${records.length})\n` +
    `${lines.join('\n')}${more}`
  );
}

// ==========================================
// PREFIX USER RESOLVER
// ==========================================

async function resolveUser(message, argument) {
  const mentionedUser = message.mentions.users.first();

  if (mentionedUser) return mentionedUser;
  if (!argument) return null;

  const userId = argument.replace(/[<@!>]/g, '');

  if (!/^\d{17,20}$/.test(userId)) return null;

  try {
    return await message.client.users.fetch(userId);
  } catch {
    return null;
  }
}

// ==========================================
// COMMAND
// ==========================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infractions')
    .setDescription("View a member's infractions")
    .addUserOption((o) =>
      o.setName('user')
        .setDescription('Member to look up')
        .setRequired(true)
    ),

  // Slash: /infractions
  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const user = interaction.options.getUser('user');
    const records = getInfractions(user.id);
    const content = formatInfractions(user, records);

    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },

  // Prefix: ^infractions @user
  async prefix(message, args) {
    if (!isStaff(message.member)) {
      return message.reply(
        'You do not have permission to use this.'
      );
    }

    const user = await resolveUser(message, args[0]);

    if (!user) {
      return message.reply(
        'Usage: `^infractions @user`\nYou can also provide a user ID.'
      );
    }

    const records = getInfractions(user.id);
    const content = formatInfractions(user, records);

    return message.reply({
      content,
      allowedMentions: { parse: [] },
    });
  },
};
