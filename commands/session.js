
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');

const config = require('../config');

const {
  card,
  isStaff,
  loadStore,
  saveStore,
} = require('../lib/helpers');

const IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-d718cf04-bbb9-45a5-82ab-32a224382129.png';

const UPDATE_MS = 60 * 1000;

let S = loadStore('session') || {};

const save = () => saveStore('session', S);

const ping = () => `<@&${config.sessionPingRoleId}>`;
const V2 = MessageFlags.IsComponentsV2;

// ==========================================
// ROBLOX GAME INFO
// ==========================================

let universeId = null;

async function getGameInfo() {
  const placeId = config.robloxPlaceId;

  if (!placeId) return null;

  try {
    if (!universeId) {
      const res = await fetch(
        `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
      );

      if (!res.ok) return null;

      const data = await res.json();
      universeId = data.universeId;

      if (!universeId) return null;
    }

    const res = await fetch(
      `https://games.roblox.com/v1/games?universeIds=${universeId}`
    );

    if (!res.ok) return null;

    const data = await res.json();
    const game = data.data?.[0];

    if (!game) return null;

    return {
      name: game.name,
      playing: game.playing,
      maxPlayers: game.maxPlayers,
    };
  } catch (err) {
    console.error('Roblox game lookup failed:', err.message);
    return null;
  }
}

// ==========================================
// MESSAGE BUILDERS
// ==========================================

function buildVote(count, target) {
  return card({
    top: IMAGE,
    text: `# Session Vote\nVote for a session to occur today!\n\n${ping()}`,
    rows: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('session_vote')
          .setLabel(`${count}/${target} Votes`)
          .setStyle(ButtonStyle.Primary)
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
          .setLabel(
            ended
              ? 'Session ended'
              : `${count ?? '?'} Members In-Game`
          )
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

// ==========================================
// SESSION LOOP
// ==========================================

let timer = null;

function startLoop(client) {
  clearInterval(timer);

  timer = setInterval(async () => {
    if (!S.active) {
      clearInterval(timer);
      timer = null;
      return;
    }

    const info = await getGameInfo();

    if (!info) return;

    S.count = info.playing;
    S.peak = Math.max(S.peak ?? 0, info.playing);

    save();

    try {
      const channel = await client.channels.fetch(S.channelId);
      const msg = await channel.messages.fetch(S.startMessageId);

      await msg.edit({
        components: [buildStart(S.count)],
        flags: V2,
      });
    } catch (err) {
      console.error('Could not update session message:', err.message);
    }
  }, UPDATE_MS);
}

// ==========================================
// START SESSION
// ==========================================

async function startSession(channel) {
  const info = await getGameInfo();
  const count = info?.playing ?? null;

  const msg = await channel.send({
    components: [buildStart(count)],
    flags: V2,
    allowedMentions: {
      parse: ['roles', 'everyone'],
    },
  });

  S = {
    active: true,
    channelId: channel.id,
    startMessageId: msg.id,
    peak: count ?? 0,
    count,
  };

  save();
  startLoop(channel.client);
}

// ==========================================
// STOP SESSION
// ==========================================

async function stopSession(client) {
  const info = await getGameInfo();

  const peak = Math.max(
    S.peak ?? 0,
    info?.playing ?? 0
  );

  const channel = await client.channels.fetch(S.channelId);

  try {
    const msg = await channel.messages.fetch(S.startMessageId);

    await msg.edit({
      components: [buildStart(null, true)],
      flags: V2,
    });
  } catch {
    // Start message was deleted.
  }

  await channel.send({
    components: [
      buildStop(config.robloxPlaceId ? peak : null),
    ],
    flags: V2,
  });

  clearInterval(timer);
  timer = null;

  S = {};
  save();
}

// ==========================================
// POST SESSION VOTE
// ==========================================

async function postVote(channel, target) {
  if (S.active) {
    return {
      success: false,
      message: 'A session is already running. Use `/session stop` first.',
    };
  }

  const msg = await channel.send({
    components: [buildVote(0, target)],
    flags: V2,
    allowedMentions: {
      parse: ['roles'],
    },
  });

  S = {
    voteMessageId: msg.id,
    voteTarget: target,
    voters: [],
  };

  save();

  return {
    success: true,
    message: 'Session vote posted.',
  };
}

// ==========================================
// COMMAND
// ==========================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName('session')
    .setDescription('Manage roleplay sessions')

    .addSubcommand((s) =>
      s
        .setName('vote')
        .setDescription('Post a session vote')
        .addIntegerOption((o) =>
          o
            .setName('votes')
            .setDescription('Votes needed to start the session')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )

    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription('Start a session right now')
    )

    .addSubcommand((s) =>
      s
        .setName('stop')
        .setDescription('End the current session')
    ),

  // ========================================
  // SLASH COMMAND
  // ========================================

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'vote') {
      const target = interaction.options.getInteger('votes');

      const result = await postVote(
        interaction.channel,
        target
      );

      return interaction.reply({
        content: result.message,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'start') {
      if (S.active) {
        return interaction.reply({
          content: 'A session is already running.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      await startSession(interaction.channel);

      return interaction.editReply('Session started.');
    }

    if (sub === 'stop') {
      if (!S.active) {
        return interaction.reply({
          content: 'There is no session running.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      await stopSession(interaction.client);

      return interaction.editReply('Session stopped.');
    }
  },

  // ========================================
  // PREFIX COMMAND
  // ========================================

  async prefix(message, args) {
    if (!isStaff(message.member)) {
      return message.reply(
        'You do not have permission to use this.'
      );
    }

    const sub = args[0]?.toLowerCase();

    if (!sub || !['vote', 'start', 'stop'].includes(sub)) {
      return message.reply(
        'Usage:\n' +
        '`^session vote 10`\n' +
        '`^session start`\n' +
        '`^session stop`'
      );
    }

    // VOTE
    if (sub === 'vote') {
      const target = Number(args[1]);

      if (
        !Number.isInteger(target) ||
        target < 1 ||
        target > 100
      ) {
        return message.reply(
          'Please provide a vote target between 1 and 100.\nExample: `^session vote 10`'
        );
      }

      const result = await postVote(
        message.channel,
        target
      );

      return message.reply(result.message);
    }

    // START
    if (sub === 'start') {
      if (S.active) {
        return message.reply(
          'A session is already running.'
        );
      }

      await message.reply('Starting session...');

      await startSession(message.channel);

      return;
    }

    // STOP
    if (sub === 'stop') {
      if (!S.active) {
        return message.reply(
          'There is no session running.'
        );
      }

      await message.reply('Stopping session...');

      await stopSession(message.client);

      return;
    }
  },

  // ========================================
  // BUTTON HANDLERS
  // ========================================

  buttons: {
    session_vote: async (interaction) => {
      if (
        !S.voteMessageId ||
        interaction.message.id !== S.voteMessageId
      ) {
        return interaction.reply({
          content: 'This vote has ended.',
          flags: MessageFlags.Ephemeral,
        });
      }

      S.voters ||= [];

      // Clicking again removes your vote.
      const i = S.voters.indexOf(interaction.user.id);

      if (i >= 0) {
        S.voters.splice(i, 1);
      } else {
        S.voters.push(interaction.user.id);
      }

      if (S.voters.length >= S.voteTarget) {
        S.voteMessageId = null;

        save();

        await interaction.deferUpdate();

        await interaction.message.delete().catch(() => {});

        return startSession(interaction.channel);
      }

      save();

      return interaction.update({
        components: [
          buildVote(S.voters.length, S.voteTarget),
        ],
        flags: V2,
      });
    },

    session_info: async (interaction) => {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const info = await getGameInfo();

      if (!info) {
        return interaction.editReply(
          'Server info is not available right now.'
        );
      }

      return interaction.editReply(
        `**${info.name}**\n` +
        `Players: ${info.playing}/${info.maxPlayers}\n` +
        `https://www.roblox.com/games/${config.robloxPlaceId}`
      );
    },
  },

  // ========================================
  // RESUME AFTER RESTART
  // ========================================

  ready(client) {
    if (S.active) {
      startLoop(client);
    }
  },
};
