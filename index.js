
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
  console.error('Missing BOT_TOKEN, CLIENT_ID or GUILD_ID in environment variables.');
  process.exit(1);
}

// ==========================================
// INTENTS
// ==========================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

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

const listeningStatuses = [
  '📸・Mod Scene 1',
  '📸・Mod Scene 2',
  '📸・Mod Scene 3',
  '📸・Mod Scene 4',
  '💫・Booster Lounge',
];

let statusIndex = 0;

function updateBotStatus() {
  try {
    const guild = client.guilds.cache.get(GUILD_ID);

    const totalMembers = guild?.memberCount ?? 0;

    const statuses = [
      {
        name: `${totalMembers} Members`,
        type: ActivityType.Watching,
      },
      {
        name: '4 Staff',
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
    console.error('[status] Failed:', error);
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

  // Start statuses immediately, independently of member fetching.
  updateBotStatus();
  setInterval(updateBotStatus, STATUS_INTERVAL);

  try {
    await registerCommands();
  } catch (error) {
    console.error('Failed to register commands:', error);
  }

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
// INTERACTION HANDLING
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

const findHandler = (map, customId) =>
  map.get(customId) ?? map.get(customId.split(':')[0]);

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
  staffRoleIds: [],
});

// ==========================================
// LOGIN
// ==========================================

client.login(BOT_TOKEN);
