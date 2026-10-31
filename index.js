
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

// Validate environment variables
if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error('[ERROR] Missing BOT_TOKEN, CLIENT_ID or GUILD_ID.');
    process.exit(1);
}

// Create Discord client
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();

// ==========================================
// LOAD ALL COMMANDS
// ==========================================

function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');

    if (!fs.existsSync(commandsPath)) {
        console.error('[ERROR] Commands folder not found!');
        process.exit(1);
    }

    const files = fs.readdirSync(commandsPath)
        .filter(file => file.endsWith('.js'));

    console.log(`\n[COMMAND LOADER] Found ${files.length} command files.\n`);

    for (const file of files) {
        const filePath = path.join(commandsPath, file);

        try {
            // Load command file
            const command = require(filePath);

            // Validate command
            if (!command.data || !command.execute) {
                console.warn(`[SKIPPED] ${file} - Missing data or execute.`);
                continue;
            }

            const commandName = command.data.name;

            // Check duplicate command names
            if (client.commands.has(commandName)) {
                console.warn(`[SKIPPED] ${file} - Duplicate command: ${commandName}`);
                continue;
            }

            // Register command locally
            client.commands.set(commandName, command);

            // Load button handlers
            for (const [id, handler] of Object.entries(command.buttons || {})) {
                client.buttons.set(id, handler);
            }

            // Load modal handlers
            for (const [id, handler] of Object.entries(command.modals || {})) {
                client.modals.set(id, handler);
            }

            console.log(`[LOADED] /${commandName} (${file})`);

        } catch (error) {
            console.error(`[ERROR] Failed to load ${file}:`, error);
        }
    }

    console.log(`\n[COMMAND LOADER] Successfully loaded ${client.commands.size} commands.\n`);
}

// ==========================================
// REGISTER COMMANDS TO DISCORD
// ==========================================

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    const commands = client.commands.map(command =>
        command.data.toJSON()
    );

    console.log(`[REGISTER] Registering ${commands.length} commands...`);

    await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
    );

    console.log(`[SUCCESS] Registered ${commands.length} commands to guild ${GUILD_ID}.`);
}

// ==========================================
// ERROR HANDLING
// ==========================================

async function run(interaction, handler) {
    try {
        await handler(interaction);
    } catch (error) {
        console.error('[COMMAND ERROR]', error);

        const response = {
            content: 'Something went wrong while executing this command.',
            flags: MessageFlags.Ephemeral,
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response).catch(() => {});
        } else {
            await interaction.reply(response).catch(() => {});
        }
    }
}

// ==========================================
// INTERACTION HANDLER
// ==========================================

client.on(Events.InteractionCreate, async interaction => {

    // Slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.warn(`[UNKNOWN COMMAND] ${interaction.commandName}`);
            return;
        }

        await run(interaction, command.execute);
    }

    // Buttons
    else if (interaction.isButton()) {
        const handler = client.buttons.get(interaction.customId);

        if (handler) {
            await run(interaction, handler);
        }
    }

    // Modals
    else if (interaction.isModalSubmit()) {
        const handler = client.modals.get(interaction.customId);

        if (handler) {
            await run(interaction, handler);
        }
    }
});

// ==========================================
// BOT READY
// ==========================================

client.once(Events.ClientReady, async (c) => {
    console.log('\n================================');
    console.log(`Logged in as ${c.user.tag}`);
    console.log('================================\n');

    try {
        await registerCommands();
    } catch (error) {
        console.error('[REGISTER ERROR]', error);
    }

    // Run optional startup functions
    for (const command of client.commands.values()) {
        if (typeof command.ready === 'function') {
            try {
                await command.ready(c);
                console.log(`[READY] /${command.data.name}`);
            } catch (error) {
                console.error(`[READY ERROR] /${command.data.name}:`, error);
            }
        }
    }

    console.log('\n[BOT] Startup complete.\n');
});

// ==========================================
// START BOT
// ==========================================

loadCommands();

client.login(BOT_TOKEN).catch(error => {
    console.error('[LOGIN ERROR]', error);
});
