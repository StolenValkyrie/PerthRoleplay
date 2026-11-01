
const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const {
  card,
  isStaff,
  loadStore,
  saveStore,
  randomId,
} = require('../lib/helpers');

const IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-9a4e3d76-c307-4814-a4d0-145e330ae6b0.png';

// ==========================================
// ISSUE INFRACTION
// ==========================================

async function issueInfraction({ channel, user, staffId, reason }) {
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

  const records = loadStore('infractions');
  const id = randomId('INF', records);

  records[id] = {
    id,
    userId: user.id,
    staffId,
    reason,
    date: Math.floor(Date.now() / 1000),
  };

  saveStore('infractions', records);

  return id;
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
    .setName('infract')
    .setDescription('Issue an infraction to a member')
    .addUserOption((o) =>
      o.setName('user')
        .setDescription('Member being infracted')
        .setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('reason')
        .setDescription('Reason for the infraction')
        .setRequired(true)
    ),

  // Slash: /infract
  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const id = await issueInfraction({
      channel: interaction.channel,
      user,
      staffId: interaction.user.id,
      reason,
    });

    await interaction.reply({
      content: `Infraction posted (${id}).`,
      flags: MessageFlags.Ephemeral,
    });
  },

  // Prefix: ^infract @user reason
  async prefix(message, args) {
    if (!isStaff(message.member)) {
      return message.reply(
        'You do not have permission to use this.'
      );
    }

    const user = await resolveUser(message, args[0]);

    if (!user) {
      return message.reply(
        'Usage: `^infract @user reason`\nYou can also provide a user ID.'
      );
    }

    // Remove the user mention/ID from the reason.
    let reason = args.slice(1).join(' ').trim();

    if (!reason) {
      return message.reply(
        'Please provide a reason.\nExample: `^infract @user Breaking staff rules`'
      );
    }

    const id = await issueInfraction({
      channel: message.channel,
      user,
      staffId: message.author.id,
      reason,
    });

    await message.reply(`Infraction posted (${id}).`);
  },
};
