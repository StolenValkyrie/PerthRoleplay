
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

// ==========================================
// FIND MEMBER
// ==========================================

async function findMember(guild, input) {
    const value = String(input || '').trim();

    if (!value) return null;

    // Mention or user ID
    const mention = value.match(/^<@!?(\d+)>$/);
    const id = mention ? mention[1] : value;

    if (/^\d{17,20}$/.test(id)) {
        return guild.members.fetch(id).catch(() => null);
    }

    // Search by username or display name
    const members = await guild.members.fetch({
        query: value,
        limit: 10,
    }).catch(() => null);

    if (!members) return null;

    return members.find(member =>
        member.user.username.toLowerCase() === value.toLowerCase() ||
        member.displayName.toLowerCase() === value.toLowerCase() ||
        member.user.tag.toLowerCase() === value.toLowerCase()
    ) || null;
}

// ==========================================
// FIND ROLE
// ==========================================

function findRole(guild, input) {
    const value = String(input || '').trim();

    if (!value) return null;

    // Role mention
    const mention = value.match(/^<@&(\d+)>$/);
    const id = mention ? mention[1] : value;

    if (/^\d{17,20}$/.test(id)) {
        return guild.roles.cache.get(id) || null;
    }

    // Exact role name
    return guild.roles.cache.find(
        role => role.name.toLowerCase() === value.toLowerCase()
    ) || null;
}

// ==========================================
// PERMISSION CHECK
// ==========================================

function canAssignRole(guild, executor, role) {
    const botMember = guild.members.me;

    if (!executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return {
            allowed: false,
            reason: 'You need the **Manage Roles** permission.',
        };
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return {
            allowed: false,
            reason: 'I need the **Manage Roles** permission.',
        };
    }

    if (role.id === guild.id || role.managed) {
        return {
            allowed: false,
            reason: 'That role cannot be assigned.',
        };
    }

    // Bot role hierarchy
    if (role.position >= botMember.roles.highest.position) {
        return {
            allowed: false,
            reason: 'That role is above or equal to my highest role.',
        };
    }

    // Executor role hierarchy (server owner is exempt)
    if (
        executor.id !== guild.ownerId &&
        role.position >= executor.roles.highest.position
    ) {
        return {
            allowed: false,
            reason: 'You cannot assign a role equal to or higher than your highest role.',
        };
    }

    return { allowed: true };
}

// ==========================================
// ASSIGN ROLE
// ==========================================

async function assignRole(guild, executor, target, role) {
    const permission = canAssignRole(guild, executor, role);

    if (!permission.allowed) {
        return {
            success: false,
            message: permission.reason,
        };
    }

    if (target.roles.cache.has(role.id)) {
        return {
            success: false,
            message: `${target} already has the **${role.name}** role.`,
        };
    }

    try {
        await target.roles.add(role);

        return {
            success: true,
            message: `Successfully assigned **${role.name}** to ${target}.`,
        };
    } catch (error) {
        console.error('[ROLE COMMAND ERROR]', error);

        return {
            success: false,
            message: 'I could not assign that role. Check my permissions and role hierarchy.',
        };
    }
}

// ==========================================
// COMMAND
// ==========================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Assign a role to a member')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The member receiving the role')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('The role to assign')
                .setRequired(true)
        ),

    // ======================================
    // SLASH COMMAND
    // ======================================

    async execute(interaction) {
        const target = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');

        if (!target) {
            return interaction.reply({
                content: 'Could not find that server member.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const result = await assignRole(
            interaction.guild,
            interaction.member,
            target,
            role
        );

        return interaction.reply({
            content: result.message,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },

    // ======================================
    // PREFIX COMMAND
    // ======================================

    async prefix(message, args) {
        if (!message.guild) return;

        if (args.length < 2) {
            return message.reply(
                'Usage: `^role username @Role`\n' +
                'Example: `^role Alex Moderator`'
            );
        }

        const targetInput = args[0];
        const roleInput = args.slice(1).join(' ');

        const target = await findMember(
            message.guild,
            targetInput
        );

        if (!target) {
            return message.reply(
                `Could not find member **${targetInput}**.`
            );
        }

        const role = findRole(
            message.guild,
            roleInput
        );

        if (!role) {
            return message.reply(
                `Could not find role **${roleInput}**.`
            );
        }

        const result = await assignRole(
            message.guild,
            message.member,
            target,
            role
        );

        return message.reply({
            content: result.message,
            allowedMentions: { parse: [] },
        });
    },
};
