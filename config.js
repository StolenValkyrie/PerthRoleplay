// Edit this file with your own IDs. None of these are secrets, so it is fine to push to GitHub.
// To copy an ID in Discord: turn on Developer Mode (Settings > Advanced), then right-click > Copy ID.
// IMPORTANT: keep every ID inside quotes, like '123456789012345678'.

module.exports = {
  // Roles that count as staff for /promote, /infract and /session. Administrators always count.
  // Example: ['123456789012345678', '234567890123456789']
  staffRoleIds: [],

  // Channels where /promote and /infract post their messages
  promotionChannelId: '1566066039106830378',
  infractionChannelId: '1566066039106830379',

  // Role that gets pinged for session votes and session starts
  sessionPingRoleId: '1566066035138756629',

  // Roblox place ID of your game (the number in the game's URL: roblox.com/games/<THIS NUMBER>/...)
  robloxPlaceId: '',

  tickets: {
    // Category (folder) where ticket channels are created. Leave '' to create them at the top level.
    categoryId: '1568124220423278623',

    // Channel where closed-ticket logs are posted
    logChannelId: '',

    // Which roles can see and manage each type of ticket
    types: {
      general:     { label: 'General',     roleIds: ['1566066035189354590'] },
      supervisory: { label: 'Supervisory', roleIds: ['1566066035189354589'] },
      management:  { label: 'Management',  roleIds: ['1566066035189354588'] },
      directive:   { label: 'Directive',   roleIds: ['1566066035189354591'] },
    },
  },
};