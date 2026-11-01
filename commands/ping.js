
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's latency"),

  // Slash command: /ping
  async execute(interaction) {
    await interaction.reply({
      content: `Pong! ${interaction.client.ws.ping}ms`,
    });
  },

  // Prefix command: ^ping
  async prefix(message) {
    await message.reply(
      `Pong! ${message.client.ws.ping}ms`
    );
  },
};
