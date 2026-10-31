// Edit this file with your own IDs. None of these are secrets, so it is fine to push to GitHub.
// To copy an ID in Discord: turn on Developer Mode (Settings > Advanced), then right-click > Copy ID.

module.exports = {
  // Roles that count as staff for /promote, /infract and /session. Administrators always count.
  // Example: ['123456789012345678', '234567890123456789']
  staffRoleIds: [],

  // Role that gets pinged for session votes and session starts
  sessionPingRoleId: '1566066035138756629',

  // Roblox place ID of your game (the number in the game's URL: roblox.com/games/<THIS NUMBER>/...)
  robloxPlaceId: '',

  tickets: {
    // Category (folder) where ticket channels are created. Leave '' to create them at the top level.
    categoryId: '',

    // Channel where closed-ticket logs are posted
    logChannelId: '',

    // Which roles can see and manage each type of ticket
    types: {
      general:     { label: 'General',     roleIds: [] },
      supervisory: { label: 'Supervisory', roleIds: [] },
      management:  { label: 'Management',  roleIds: [] },
      directive:   { label: 'Directive',   roleIds: [] },
    },
  },
};