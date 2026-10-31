const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');
const config = require('../config');
const { card, isStaff, loadStore, saveStore } = require('../lib/helpers');

const IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-d718cf04-bbb9-45a5-82ab-32a224382129.png';
const UPDATE_MS = 60 * 1000; // how often the in-game count refreshes

// Saved session state (survives restarts):
// { active, channelId, startMessageId, peak, count, voteMessageId, voteTarget, voters }
let S = loadStore('session');
const save = () => saveStore('session', S);

const ping = () => `<@&${config.sessionPingRoleId}>`;
const V2 = MessageFlags.IsComponentsV2;

// ---------- Roblox game info ----------
let universeId = null;

async function getGameInfo() {
  const placeId = config.robloxPlaceId;
  if (!placeId) return null;
  try {
    if (!universeId) {
      const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
      universeId = (await res.json()).universeId;
    }
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    const game = (await res.json()).data?.[0];
    if (!game) return null;
    return { name: game.name, playing: game.playing, maxPlayers: game.maxPlayers };
  } catch (err) {
    console.error('Roblox game lookup failed:', err.message);
    return null;
  }
}

// ---------- Message layouts ----------
function buildVote(count, target) {
  return card({
    top: IMAGE,
    text: `# Session Vote\nVote for a session to occur today!\n\n${ping()}`,
    rows: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('session_vote').setLabel(`${count}/${target} Votes`).setStyle(ButtonStyle.Primary)
      ),
    ],
  });
}

function buildStart(count, ended = false) {
  return card({
    top: IMAGE,
    text:
      '# Session Start\nA session has started up! Join for some amazing roleplays and a great time!\n\n' +
      `${ping()} @here`,
    rows: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('session_count')
          .setLabel(ended ? 'Session ended' : `${count ?? '?'} Members In-Game`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('session_info')
          .setLabel('Server Info')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(ended)
      ),
    ],
  });
}

function buildStop(peak) {
  return card({
    top: IMAGE,
    text:
      '# Session Stop\nThank you for joining our session today! ' +
      `We reached a peak of ${peak ?? 'N/A'}! Please wait for our next session as the server may be down.`,
  });
}

// ---------- Session logic ----------
let timer = null;

function startLoop(client) {
  clearInterval(timer);
  timer = setInterval(async () => {
    if (!S.active) return clearInterval(timer);
    const info = await getGameInfo();
    if (!info) return;

    S.count = info.playing;
    S.peak = Math.max(S.peak ?? 0, info.playing);
    save();

    try {
      const channel = await client.channels.fetch(S.channelId);
      const msg = await channel.messages.fetch(S.startMessageId);
      await msg.edit({ components: [buildStart(S.count)], flags: V2 });
    } catch (err) {
      console.error('Could not update session message:', err.message);
    }
  }, UPDATE_MS);
}

async function startSession(channel) {
  const info = await getGameInfo();
  const count = info?.playing ?? null;

  const msg = await channel.send({
    components: [buildStart(count)],
    flags: V2,
    allowedMentions: { parse: ['roles', 'everyone'] },
  });

  S = { active: true, channelId: channel.id, startMessageId: msg.id, peak: count ?? 0, count };
  save();
  startLoop(channel.client);
}

async function stopSession(client) {
  const info = await getGameInfo();
  const peak = Math.max(S.peak ?? 0, info?.playing ?? 0);
  const channel = await client.channels.fetch(S.channelId);

  try {
    const msg = await channel.messages.fetch(S.startMessageId);
    await msg.edit({ components: [buildStart(null, true)], flags: V2 });
  } catch {
    // start message was deleted, nothing to update
  }

  await channel.send({ components: [buildStop(config.robloxPlaceId ? peak : null)], flags: V2 });

  clearInterval(timer);
  S = {};
  save();
}

// ---------- Command ----------
module.exports = {
  data: new SlashCommandBuilder()
    .setName('session')
    .setDescription('Manage roleplay sessions')
    .addSubcommand((s) =>
      s
        .setName('vote')
        .setDescription('Post a session vote')
        .addIntegerOption((o) =>
          o.setName('votes').setDescription('Votes needed to start the session').setRequired(true).setMinValue(1).setMaxValue(100)
        )
    )
    .addSubcommand((s) => s.setName('start').setDescription('Start a session right now'))
    .addSubcommand((s) => s.setName('stop').setDescription('End the current session')),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'vote') {
      if (S.active) {
        return interaction.reply({ content: 'A session is already running. Use /session stop first.', flags: MessageFlags.Ephemeral });
      }
      const target = interaction.options.getInteger('votes');
      const msg = await interaction.channel.send({
        components: [buildVote(0, target)],
        flags: V2,
        allowedMentions: { parse: ['roles'] },
      });
      S = { voteMessageId: msg.id, voteTarget: target, voters: [] };
      save();
      return interaction.reply({ content: 'Session vote posted.', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'start') {
      if (S.active) {
        return interaction.reply({ content: 'A session is already running.', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await startSession(interaction.channel);
      return interaction.editReply('Session started.');
    }

    if (sub === 'stop') {
      if (!S.active) {
        return interaction.reply({ content: 'There is no session running.', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await stopSession(interaction.client);
      return interaction.editReply('Session stopped.');
    }
  },

  buttons: {
    session_vote: async (interaction) => {
      if (!S.voteMessageId || interaction.message.id !== S.voteMessageId) {
        return interaction.reply({ content: 'This vote has ended.', flags: MessageFlags.Ephemeral });
      }

      // Clicking again removes your vote
      const i = S.voters.indexOf(interaction.user.id);
      if (i >= 0) S.voters.splice(i, 1);
      else S.voters.push(interaction.user.id);

      if (S.voters.length >= S.voteTarget) {
        S.voteMessageId = null; // stops double triggers
        save();
        await interaction.deferUpdate();
        await interaction.message.delete().catch(() => {});
        return startSession(interaction.channel);
      }

      save();
      return interaction.update({ components: [buildVote(S.voters.length, S.voteTarget)], flags: V2 });
    },

    session_info: async (interaction) => {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const info = await getGameInfo();
      if (!info) return interaction.editReply('Server info is not available right now.');
      return interaction.editReply(
        `**${info.name}**\nPlayers: ${info.playing}/${info.maxPlayers}\nhttps://www.roblox.com/games/${config.robloxPlaceId}`
      );
    },
  },

  // Runs once when the bot starts: resume the live counter if a session was running
  ready(client) {
    if (S.active) startLoop(client);
  },
};