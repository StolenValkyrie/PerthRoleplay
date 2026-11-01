
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  Events,
  MessageFlags,
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

// ==========================================
// CONFIGURATION
// ==========================================

const PREFIX = "^";

const TOKEN = process.env.DISCORD_TOKEN?.trim();
const CLIENT_ID = process.env.CLIENT_ID?.trim();
const GUILD_ID = process.env.GUILD_ID?.trim();

console.log("[ENV CHECK]", {
  tokenLoaded: !!TOKEN,
  clientIdLoaded: !!CLIENT_ID,
  guildIdLoaded: !!GUILD_ID,
});

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "[ENV ERROR] Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID."
  );
  process.exit(1);
}

// ==========================================
// CLIENT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();

// ==========================================
// COMMAND LOADER
// ==========================================

const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
  throw new Error("The commands folder was not found.");
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

console.log(`[COMMAND LOADER] Found ${commandFiles.length} commands.`);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);

  try {
    delete require.cache[require.resolve(filePath)];

    const command = require(filePath);

    if (!command.data?.name || typeof command.execute !== "function") {
      console.warn(`[COMMAND] Skipped invalid command: ${file}`);
      continue;
    }

    client.commands.set(command.data.name, command);

    // Register buttons
    if (command.buttons) {
      const buttons = command.buttons instanceof Map
        ? command.buttons
        : Object.entries(command.buttons);

      for (const [customId, handler] of buttons) {
        client.buttons.set(customId, handler);
      }
    }

    // Register modals
    if (command.modals) {
      const modals = command.modals instanceof Map
        ? command.modals
        : Object.entries(command.modals);

      for (const [customId, handler] of modals) {
        client.modals.set(customId, handler);
      }
    }

    console.log(`[LOADED] /${command.data.name}`);
  } catch (error) {
    console.error(`[COMMAND LOAD ERROR] ${file}:`, error);
  }
}

console.log(
  `[COMMAND LOADER] Successfully loaded ${client.commands.size} commands.`
);

// ==========================================
// SLASH COMMAND REGISTRATION
// ==========================================

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerSlashCommands() {
  const commands = client.commands.map((command) =>
    command.data.toJSON()
  );

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log(`[SLASH] Registered ${commands.length} commands.`);
}

// ==========================================
// INTERACTION HANDLER
// ==========================================

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) return;

      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      const handler = client.buttons.get(interaction.customId);

      if (handler) {
        await handler(interaction);
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      const handler = client.modals.get(interaction.customId);

      if (handler) {
        await handler(interaction);
      }
    }
  } catch (error) {
    console.error("[INTERACTION ERROR]", error);

    if (!interaction.isRepliable()) return;

    const response = {
      content: "Something went wrong while processing this interaction.",
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(() => {});
    } else {
      await interaction.reply(response).catch(() => {});
    }
  }
});

// ==========================================
// PREFIX COMMAND HANDLER
// ==========================================

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const content = message.content.slice(PREFIX.length).trim();

  if (!content) return;

  const args = content.split(/\s+/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);

  if (!command) return;

  if (typeof command.prefix !== "function") {
    await message.reply(
      `The \`${commandName}\` command does not support prefix usage yet.`
    );
    return;
  }

  try {
    await command.prefix(message, args);
  } catch (error) {
    console.error(`[PREFIX ERROR: ${commandName}]`, error);

    await message.reply(
      "Something went wrong while running that command."
    ).catch(() => {});
  }
});

// ==========================================
// READY EVENT
// ==========================================

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[READY] Logged in as ${readyClient.user.tag}`);

  for (const [name, command] of client.commands) {
    if (typeof command.ready === "function") {
      try {
        await command.ready(client);
        console.log(`[READY] Started ${name}`);
      } catch (error) {
        console.error(`[READY ERROR: ${name}]`, error);
      }
    }
  }
});

// ==========================================
// START BOT
// ==========================================

async function startBot() {
  try {
    console.log("[STARTUP] Registering slash commands...");

    await registerSlashCommands();

    console.log("[STARTUP] Connecting to Discord...");

    await client.login(TOKEN);
  } catch (error) {
    console.error("[STARTUP ERROR]", error);
    process.exit(1);
  }
}

startBot();
