
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  ActivityType,
} = require('discord.js');

const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    'Missing BOT_TOKEN, CLIENT_ID or GUILD_ID in environment variables.'
  );
  process.exit(1);
}

// ==========================================
// INTENTS
// ==========================================

const intents = [GatewayIntentBits.Guilds];

if (process.env.STATS_INTENTS === 'true') {
  intents.push(
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  );
}

const client = new Client({ intents });

// ==========================================
// COLLECTIONS
// ==========================================

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();
client.selects = new Collection();

// ==========================================
// BOT STATUS ROTATION
// ==========================================

const STATUS_INTERVAL = 10 * 1000;

const STAFF_ROLE_IDS = [
  '1566066035189354590', // General
  '1566066035189354589', // Supervisory
  '1566066035189354588', // Management
  '1566066035189354591', // Directive
  '1566066035210067984', // All Staff
];

const listeningStatuses = [
  '📸・Mod Scene 1',
  '📸・Mod Scene 2',
  '📸・Mod Scene 3',
  '📸・Mod Scene 4',
  '💫・Booster Lounge',
];

let statusIndex = 0;
let statusInterval = null;

async function updateBotStatus() {
  try {
    const guild = client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      console.error('[status] Guild not found.');
      return;
    }

    const totalMembers = guild.memberCount;

    // Count unique non-bot members with at least one staff role.
    const staffCount = guild.members.cache.filter(member =>
      !member.user.bot &&
      STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId))
    ).size;

    const statuses = [
      {
        name: `${totalMembers} Members`,
        type: ActivityType.Watching,
      },
      {
        name: `${staffCount} Staff`,
        type: ActivityType.Watching,
      },
      {
        name: 'Perth Roleplay',
        type: ActivityType.Playing,
      },
      ...listeningStatuses.map(name => ({
        name,
        type: ActivityType.Listening,
      })),
    ];

    const currentStatus = statuses[statusIndex];

    client.user.setActivity(currentStatus.name, {
      type: currentStatus.type,
    });

    console.log(`[status] Updated: ${currentStatus.name}`);

    statusIndex = (statusIndex + 1) % statuses.length;
  } catch (error) {
    console.error('[status] Failed to update:', error);
  }
}

// ==========================================
// LOAD COMMANDS
// ==========================================

const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);

    for (const [id, handler] of Object.entries(command.buttons ?? {})) {
      client.buttons.set(id, handler);
    }

    for (const [id, handler] of Object.entries(command.modals ?? {})) {
      client.modals.set(id, handler);
    }

    for (const [id, handler] of Object.entries(command.selects ?? {})) {
      client.selects.set(id, handler);
    }
  } else {
    console.warn(`[WARN] ${file} is missing "data" or "execute".`);
  }
}

// ==========================================
// REGISTER SLASH COMMANDS
// ==========================================

async function registerCommands() {
  const rest = new REST().setToken(BOT_TOKEN);
  const body = client.commands.map(command => command.data.toJSON());

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body }
  );

  console.log(`Registered ${body.length} command(s) to guild ${GUILD_ID}.`);
}

// ==========================================
// BOT READY
// ==========================================

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  try {
    const guild = c.guilds.cache.get(GUILD_ID);

    if (!guild) {
      console.error('[status] Could not find configured server.');
    } else {
      // Fetch members once at startup for accurate staff counts.
      if (process.env.STATS_INTENTS === 'true') {
        await guild.members.fetch();
        console.log('[status] Members cached successfully.');
      } else {
        console.warn(
          '[status] STATS_INTENTS is not enabled. Staff count may be incomplete.'
        );
      }

      await updateBotStatus();

      if (statusInterval) clearInterval(statusInterval);

      statusInterval = setInterval(updateBotStatus, STATUS_INTERVAL);
    }
  } catch (error) {
    console.error('[status] Startup error:', error);

    // Still start status rotation if member fetching fails.
    await updateBotStatus();

    if (statusInterval) clearInterval(statusInterval);

    statusInterval = setInterval(updateBotStatus, STATUS_INTERVAL);
  }

  try {
    await registerCommands();
  } catch (error) {
    console.error('Failed to register commands:', error);
  }

  // Run command startup handlers.
  for (const command of client.commands.values()) {
    try {
      await command.ready?.(c);
    } catch (error) {
      console.error(
        `ready() failed for /${command.data.name}:`,
        error
      );
    }
  }
});

// ==========================================
// INTERACTION ERROR HANDLING
// ==========================================

async function run(interaction, handler) {
  try {
    await handler(interaction);
  } catch (error) {
    console.error(error);

    const msg = {
      content: 'Something went wrong. Please try again.',
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
}

// Finds a handler by exact customId or prefix before ":".
const findHandler = (map, customId) =>
  map.get(customId) ?? map.get(customId.split(':')[0]);

// ==========================================
// INTERACTION HANDLER
// ==========================================

client.on(Events.InteractionCreate, async interaction => {
  let handler;

  if (interaction.isChatInputCommand()) {
    handler = client.commands.get(interaction.commandName)?.execute;
  } else if (interaction.isButton()) {
    handler = findHandler(client.buttons, interaction.customId);
  } else if (interaction.isStringSelectMenu()) {
    handler = findHandler(client.selects, interaction.customId);
  } else if (interaction.isModalSubmit()) {
    handler = findHandler(client.modals, interaction.customId);
  }

  if (handler) {
    await run(interaction, handler);
  }
});

// ==========================================
// WEBSITE STATS INTEGRATION
// ==========================================

require('./stats-push')(client, {
  url: 'https://perthwebsite.stolenvalkyrie.workers.dev/api/bot/stats',
  secret: process.env.BOT_PUSH_SECRET,
  guildId: GUILD_ID,
  staffRoleIds: [
    '1566066035210067984',
  ],
});

// ==========================================
// LOGIN
// ==========================================

client.login(BOT_TOKEN);
