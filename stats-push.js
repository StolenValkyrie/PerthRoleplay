// Sends server stats to the Perth Roleplay website every 5 minutes.
// Works with the plain Guilds intent (member count only). With the Server Members and
// Presence intents on (STATS_INTENTS=true) it also sends exact staff and online counts.
const { Events, GatewayIntentBits } = require('discord.js');

module.exports = function startStatsPush(client, { url, secret, guildId, staffRoleIds }) {
  if (!secret) {
    console.warn('[stats] BOT_PUSH_SECRET is not set, so website stats push is off.');
    return;
  }
  const has = (intent) => client.options.intents.has(intent);

  async function push() {
    try {
      const guild = await client.guilds.fetch(guildId);
      const body = { members: guild.memberCount }; // includes bots when the Members intent is off

      if (has(GatewayIntentBits.GuildMembers)) {
        const people = (await guild.members.fetch()).filter((m) => !m.user.bot);
        body.members = people.size;
        body.staff = people.filter((m) => staffRoleIds.some((id) => m.roles.cache.has(id))).size;
        if (has(GatewayIntentBits.GuildPresences)) {
          body.online = people.filter((m) => m.presence && m.presence.status !== 'offline').size;
        }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret },
        body: JSON.stringify(body),
      });
      if (!res.ok) console.error('[stats] push failed:', res.status);
    } catch (err) {
      console.error('[stats] push error:', err.message);
    }
  }

  client.once(Events.ClientReady, () => {
    push();
    setInterval(push, 5 * 60 * 1000);
  });
};