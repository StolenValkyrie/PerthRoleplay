const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { card, isStaff, loadStore, saveStore, randomId } = require('../lib/helpers');

const IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-a77aaffa-78fb-46f2-912a-815d7eb3a409.png';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a member')
    .addUserOption((o) => o.setName('user').setDescription('Member being promoted').setRequired(true))
    .addRoleOption((o) => o.setName('rank').setDescription('Rank they are promoted to').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the promotion').setRequired(true))
    .addBooleanOption((o) => o.setName('give_role').setDescription('Also give them the rank role (default: no)')),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    const user = interaction.options.getUser('user');
    const rank = interaction.options.getRole('rank');
    const reason = interaction.options.getString('reason');
    const giveRole = interaction.options.getBoolean('give_role') ?? false;

    let note = '';
    if (giveRole) {
      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(rank.id, `Promoted by ${interaction.user.tag}`);
      } catch (err) {
        console.error('Could not give rank role:', err);
        note = ' I could not give them the role though. Check my Manage Roles permission and role order.';
      }
    }

    const container = card({
      top: IMAGE,
      text:
        `# Promotions\n<@${user.id}> has been promoted to <@&${rank.id}>!\n\n` +
        `**Reason:**\n${reason}\n\n` +
        'Congratulations! We commend you for your efforts and are pleased to see you here!',
    });

    await interaction.channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { users: [user.id] },
    });

    // Keep a record for /promotions
    const records = loadStore('promotions');
    const id = randomId('PRO', records);
    records[id] = {
      id,
      userId: user.id,
      rankId: rank.id,
      rankName: rank.name,
      staffId: interaction.user.id,
      reason,
      date: Math.floor(Date.now() / 1000),
    };
    saveStore('promotions', records);

    await interaction.reply({ content: `Promotion posted (${id}).${note}`, flags: MessageFlags.Ephemeral });
  },
};