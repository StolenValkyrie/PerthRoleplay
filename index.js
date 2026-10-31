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
} = require('discord.js');

const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Missing BOT_TOKEN, CLIENT_ID or GUILD_ID in environment variables.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();

// Load every file in /commands
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    // Commands can also export button and modal handlers: { customId: handler }
    for (const [id, handler] of Object.entries(command.buttons ?? {})) client.buttons.set(id, handler);
    for (const [id, handler] of Object.entries(command.modals ?? {})) client.modals.set(id, handler);
  } else {
    console.warn(`[WARN] ${file} is missing "data" or "execute".`);
  }
}

// Register slash commands to ONE server only (updates show instantly)
async function registerCommands() {
  const rest = new REST().setToken(BOT_TOKEN);
  const body = client.commands.map((c) => c.data.toJSON());
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
  console.log(`Registered ${body.length} command(s) to guild ${GUILD_ID}.`);
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  try {
    await registerCommands();
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
  // Let commands run start-up code (e.g. resume a running session)
  for (const command of client.commands.values()) {
    try {
      await command.ready?.(c);
    } catch (err) {
      console.error(`ready() failed for /${command.data.name}:`, err);
    }
  }
});

async function run(interaction, handler) {
  try {
    await handler(interaction);
  } catch (err) {
    console.error(err);
    const msg = { content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await run(interaction, command.execute);
  } else if (interaction.isButton()) {
    const handler = client.buttons.get(interaction.customId);
    if (handler) await run(interaction, handler);
  } else if (interaction.isModalSubmit()) {
    const handler = client.modals.get(interaction.customId);
    if (handler) await run(interaction, handler);
  }
});

client.login(BOT_TOKEN);