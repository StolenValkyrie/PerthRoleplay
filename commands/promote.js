
const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const {
  card,
  isStaff,
  loadStore,
  saveStore,
  randomId,
} = require('../lib/helpers');

const IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-a77aaffa-78fb-46f2-912a-815d7eb3a409.png';

// ==========================================
// PROMOTION FUNCTION
// ==========================================

async function promoteMember({
  guild,
  channel,
  user,
  rank,
  reason,
  giveRole,
  staffId,
  staffTag,
}) {
  let note = '';

  if (giveRole) {
    try {
      const member = await guild.members.fetch(user.id);

      await member.roles.add(
        rank.id,
        `Promoted by ${staffTag}`
      );
    } catch (err) {
      console.error('Could not give rank role:', err);

      note =
        ' I could not give them the role though. Check my Manage Roles permission and role order.';
    }
  }

  const container = card({
    top: IMAGE,
    text:
      `# Promotions\n<@${user.id}> has been promoted to <@&${rank.id}>!\n\n` +
      `**Reason:**\n${reason}\n\n` +
      'Congratulations! We commend you for your efforts and are pleased to see you here!',
  });

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: {
      users: [user.id],
      roles: [rank.id],
    },
  });

  const records = loadStore('promotions');
  const id = randomId('PRO', records);

  records[id] = {
    id,
    userId: user.id,
    rankId: rank.id,
    rankName: rank.name,
    staffId,
    reason,
    date: Math.floor(Date.now() / 1000),
  };

  saveStore('promotions', records);

  return { id, note };
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
// PREFIX ROLE RESOLVER
// ==========================================

function resolveRole(message, argument) {
  const mentionedRole = message.mentions.roles.first();

  if (mentionedRole) return mentionedRole;
  if (!argument) return null;

  const roleId = argument.replace(/[<@&>]/g, '');

  if (!/^\d{17,20}$/.test(roleId)) return null;

  return message.guild.roles.cache.get(roleId) || null;
}

// ==========================================
// COMMAND
// ==========================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a member')
    .addUserOption((o) =>
      o.setName('user')
        .setDescription('Member being promoted')
        .setRequired(true)
    )
    .addRoleOption((o) =>
      o.setName('rank')
        .setDescription('Rank they are promoted to')
        .setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('reason')
        .setDescription('Reason for the promotion')
        .setRequired(true)
    )
    .addBooleanOption((o) =>
      o.setName('give_role')
        .setDescription('Also give them the rank role (default: no)')
    ),

  // Slash: /promote
  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const user = interaction.options.getUser('user');
    const rank = interaction.options.getRole('rank');
    const reason = interaction.options.getString('reason');
    const giveRole = interaction.options.getBoolean('give_role') ?? false;

    const result = await promoteMember({
      guild: interaction.guild,
      channel: interaction.channel,
      user,
      rank,
      reason,
      giveRole,
      staffId: interaction.user.id,
      staffTag: interaction.user.tag,
    });

    await interaction.reply({
      content: `Promotion posted (${result.id}).${result.note}`,
      flags: MessageFlags.Ephemeral,
    });
  },

  // Prefix: ^promote @user @role reason
  async prefix(message, args) {
    if (!isStaff(message.member)) {
      return message.reply(
        'You do not have permission to use this.'
      );
    }

    const user = await resolveUser(message, args[0]);

    if (!user) {
      return message.reply(
        'Usage: `^promote @user @role reason [give_role]`'
      );
    }

    const rank = resolveRole(message, args[1]);

    if (!rank) {
      return message.reply(
        'Please mention a valid rank role or provide its role ID.'
      );
    }

    const remainingArgs = args.slice(2);

    let giveRole = false;

    if (
      remainingArgs.length &&
      ['true', 'false'].includes(remainingArgs[remainingArgs.length - 1].toLowerCase())
    ) {
      giveRole = remainingArgs.pop().toLowerCase() === 'true';
    }

    const reason = remainingArgs.join(' ').trim();

    if (!reason) {
      return message.reply(
        'Please provide a promotion reason.\nExample: `^promote @user @role Excellent activity`'
      );
    }

    const result = await promoteMember({
      guild: message.guild,
      channel: message.channel,
      user,
      rank,
      reason,
      giveRole,
      staffId: message.author.id,
      staffTag: message.author.tag,
    });

    await message.reply(
      `Promotion posted (${result.id}).${result.note}`
    );
  },
};
