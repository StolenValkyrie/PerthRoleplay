const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
} = require('discord.js');

const TOP_IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-3cf39f6e-c9db-490f-b0b7-95fefbdc7265.png';
const BOTTOM_IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-cdfc75cc-0456-4886-9a51-a14e1563d9bf.png';

const DOCK_API = 'https://api.docksys.xyz';
const MAX_WAIT_MS = 10 * 60 * 1000; // stop waiting after 10 minutes

// Users who currently have a verification being tracked
const tracking = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Small wrapper around the Dock API (retries when rate limited)
async function dock(method, path, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${DOCK_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.DOCK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);

    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? json?.meta?.rateLimit?.retryAfter ?? 1);
      await sleep(Math.max(wait, 1) * 1000);
      continue;
    }
    return { ok: res.ok, status: res.status, json };
  }
  return { ok: false, status: 429, json: null };
}

async function giveVerifiedRole(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  await member.roles.add(process.env.VERIFIED_ROLE_ID, 'Verified with Dock');
}

function linkRow(url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Verify with Dock').setStyle(ButtonStyle.Link).setURL(url)
  );
}

async function onVerifyClick(interaction) {
  const { DOCK_API_KEY, DOCK_PID, VERIFIED_ROLE_ID } = process.env;
  if (!DOCK_API_KEY || !DOCK_PID || !VERIFIED_ROLE_ID) {
    console.error('Missing DOCK_API_KEY, DOCK_PID or VERIFIED_ROLE_ID.');
    return interaction.reply({
      content: 'Verification is not set up yet. Please tell a staff member.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
      return interaction.editReply('You are already verified.');
    }

    // 1) Already linked on Dock? Then just give the role.
    const lookup = await dock(
      'GET',
      `/v2/discord?discordId=${interaction.user.id}&guildId=${interaction.guildId}`
    );
    if (lookup.ok) {
      await giveVerifiedRole(interaction);
      return interaction.editReply('You are verified. Welcome in!');
    }
    if (lookup.json?.error?.code !== 'LINK_NOT_FOUND') {
      console.error('Dock lookup failed:', lookup.status, JSON.stringify(lookup.json));
      return interaction.editReply('Something went wrong checking your account. Please try again in a moment.');
    }

    // 2) Not linked yet: create a hosted verification session
    const created = await dock('POST', '/v2/sessions', {
      pid: DOCK_PID,
      clientId: interaction.user.id,
      guildId: interaction.guildId,
    });
    if (!created.ok) {
      console.error('Dock session failed:', created.status, JSON.stringify(created.json));
      return interaction.editReply('Could not start verification. Please tell a staff member.');
    }

    const session = created.json.data;
    await interaction.editReply({
      content: 'Click the button below to link your Roblox account. This message updates when you are done.',
      components: [linkRow(session.verifyUrl)],
    });

    // Already tracking this user (they clicked Verify twice), so don't start a second wait loop
    if (tracking.has(interaction.user.id)) return;
    tracking.add(interaction.user.id);

    // 3) Wait for the session to finish
    const deadline = Math.min(Date.parse(session.expiresAt) || Infinity, Date.now() + MAX_WAIT_MS);
    let errors = 0;

    while (Date.now() < deadline && errors < 5) {
      const poll = await dock('GET', `/v2/sessions/${session.id}?wait=25`);
      if (!poll.ok) {
        errors++;
        await sleep(3000);
        continue;
      }

      const s = poll.json.data;

      if (s.status === 'completed') {
        const linkedId = s.result?.discordId;
        if (linkedId && linkedId !== interaction.user.id) {
          return interaction.editReply({ content: 'That verification did not match your Discord account.', components: [] });
        }
        await giveVerifiedRole(interaction);
        return interaction.editReply({ content: 'You are verified. Welcome in!', components: [] });
      }

      if (s.status === 'expired' || s.status === 'cancelled') {
        return interaction.editReply({
          content: 'Your verification expired or was cancelled. Press Verify to try again.',
          components: [],
        });
      }
    }

    await interaction.editReply({
      content: 'Still waiting? Press Verify again after you finish linking your account.',
      components: [],
    });
  } catch (err) {
    console.error('Verification error:', err);
    await interaction
      .editReply({ content: 'Something went wrong. Please tell a staff member.', components: [] })
      .catch(() => {});
  } finally {
    tracking.delete(interaction.user.id);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verifypanel')
    .setDescription('Send the verification panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const container = new ContainerBuilder()
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(TOP_IMAGE))
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '# Verification\n> Verify to talk in the server, and play within sessions.'
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('verify_start').setLabel('Verify').setStyle(ButtonStyle.Success)
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(BOTTOM_IMAGE))
      );

    await interaction.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    await interaction.reply({ content: 'Verification panel sent.', flags: MessageFlags.Ephemeral });
  },

  buttons: {
    verify_start: onVerifyClick,
  },
};