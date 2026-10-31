
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const config = require('../config');

const { card, isAdmin, randomId } = require('../lib/helpers');

const {
    types,
    prefixFor,
    loadTickets,
    saveTickets,
    findByChannel,
    canManage,
    closeTicket,
} = require('../lib/tickets');

const IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-5e095074-b010-4df0-b13c-16bcb4ce3c9b.png';

const V2 = MessageFlags.IsComponentsV2;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const cleanName = s =>
    String(s)
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '')
        .slice(0, 25) || 'ticket';

const getRoles = key => {
    const roles = types[key]?.roleIds;
    return Array.isArray(roles) ? roles : [];
};

const reply = (interaction, content) =>
    interaction.reply({
        content,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });

const textInput = (id, label, style, {
    required = true,
    max = 500,
} = {}) =>
    new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setStyle(style)
            .setMaxLength(max)
            .setRequired(required)
    );

// ==========================================
// OPENING TICKETS
// ==========================================

function openModal(key) {
    return async interaction => {
        const tickets = loadTickets();
        let changed = false;

        for (const ticket of Object.values(tickets)) {
            if (ticket.status !== 'open') continue;

            if (!interaction.guild.channels.cache.has(ticket.channelId)) {
                Object.assign(ticket, {
                    status: 'closed',
                    closedBy: interaction.client.user.id,
                    closedAt: Math.floor(Date.now() / 1000),
                    closeReason: 'Channel deleted',
                    transcriptSaved: false,
                });

                changed = true;
            } else if (ticket.openerId === interaction.user.id) {
                if (changed) saveTickets(tickets);

                return reply(
                    interaction,
                    `You already have an open ticket: <#${ticket.channelId}>`
                );
            }
        }

        if (changed) saveTickets(tickets);

        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${key}`)
            .setTitle(`${types[key].label} Support`)
            .addComponents(
                textInput(
                    'reason',
                    'Why are you opening this ticket?',
                    TextInputStyle.Paragraph
                )
            );

        return interaction.showModal(modal);
    };
}

// ==========================================
// TICKET BUTTONS
// ==========================================

function ticketButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId('ticket_unclaim')
            .setLabel('Unclaim')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId('ticket_rename')
            .setLabel('Rename')
            .setStyle(ButtonStyle.Secondary)
    );
}

// ==========================================
// CREATE TICKET
// ==========================================

function createTicket(key) {
    return async interaction => {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        const type = types[key];

        if (!type) {
            return interaction.editReply('Invalid ticket type.');
        }

        const roleIds = getRoles(key);
        const reason = interaction.fields.getTextInputValue('reason');
        const user = interaction.user;
        const guild = interaction.guild;

        if (roleIds.length === 0) {
            console.warn(
                `[tickets] No roleIds configured for "${key}".`
            );
        }

        const memberPerms = [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
        ];

        const tickets = loadTickets();
        const id = randomId(prefixFor(key), tickets);

        const channel = await guild.channels.create({
            name: `${key}-${cleanName(user.username)}`,
            type: ChannelType.GuildText,
            parent: config.tickets.categoryId || undefined,

            topic: `${type.label} ticket ${id} for ${user.tag} (${user.id})`,

            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },

                {
                    id: user.id,
                    allow: memberPerms,
                },

                {
                    id: interaction.client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageChannels,
                    ],
                },

                ...roleIds.map(roleId => ({
                    id: roleId,
                    allow: memberPerms,
                })),
            ],
        });

        const now = Math.floor(Date.now() / 1000);

        // Notify the ticket opener and every staff role configured for this type.
        const pingRoleIds = [...new Set(
            roleIds.filter(roleId => /^\d{17,20}$/.test(String(roleId)))
        )];

        const pingContent = [
            `<@${user.id}>`,
            ...pingRoleIds.map(roleId => `<@&${roleId}>`),
        ].join(' ');

        await channel.send({
            content: pingContent,
            allowedMentions: {
                parse: [],
                users: [user.id],
                roles: pingRoleIds,
            },
        });

        await channel.send({
            components: [
                card({
                    top: IMAGE,
                    text:
                        `# ${type.label} Support\n` +
                        `<@${user.id}>, this is your ${type.label} support ticket. ` +
                        'Please wait for staff to respond to your ticket. ' +
                        `You opened this ticket because: ${reason}, at <t:${now}:F>.`,
                    rows: [ticketButtons()],
                }),
            ],
            flags: V2,
            allowedMentions: { parse: [] },
        });

        tickets[id] = {
            id,
            type: key,
            channelId: channel.id,
            openerId: user.id,
            openerName: user.username,
            reason,
            openedAt: now,
            status: 'open',
            claimedBy: null,
            closedBy: null,
            closedAt: null,
            closeReason: null,
            transcriptSaved: false,
        };

        saveTickets(tickets);

        return interaction.editReply(
            `Your ticket has been created: ${channel}`
        );
    };
}

// ==========================================
// TICKET PERMISSIONS
// ==========================================

function withTicket(handler, { staffOnly = true } = {}) {
    return async interaction => {
        const tickets = loadTickets();

        const ticket = findByChannel(
            tickets,
            interaction.channelId
        );

        if (!ticket) {
            return reply(interaction, 'This is not an active ticket.');
        }

        const staff = canManage(interaction.member, ticket);
        const opener = ticket.openerId === interaction.user.id;

        if (staffOnly ? !staff : !(staff || opener)) {
            return reply(
                interaction,
                'You do not have permission to do that.'
            );
        }

        return handler(interaction, ticket, tickets);
    };
}

// ==========================================
// CLAIM TICKET
// ==========================================

const claim = withTicket(async (interaction, ticket, tickets) => {
    if (ticket.claimedBy) {
        return reply(
            interaction,
            `This ticket is already claimed by <@${ticket.claimedBy}>.`
        );
    }

    ticket.claimedBy = interaction.user.id;
    saveTickets(tickets);

    return interaction.reply({
        content: `<@${interaction.user.id}> has claimed this ticket.`,
        allowedMentions: { parse: [] },
    });
});

// ==========================================
// UNCLAIM TICKET
// ==========================================

const unclaim = withTicket(async (interaction, ticket, tickets) => {
    if (!ticket.claimedBy) {
        return reply(interaction, 'This ticket is not claimed.');
    }

    if (
        ticket.claimedBy !== interaction.user.id &&
        !isAdmin(interaction.member)
    ) {
        return reply(
            interaction,
            'Only the person who claimed this ticket can unclaim it.'
        );
    }

    ticket.claimedBy = null;
    saveTickets(tickets);

    return interaction.reply({
        content: `<@${interaction.user.id}> has unclaimed this ticket.`,
        allowedMentions: { parse: [] },
    });
});

// ==========================================
// CLOSE TICKET
// ==========================================

const closeButton = withTicket(
    async interaction => {
        const modal = new ModalBuilder()
            .setCustomId('ticket_close_modal')
            .setTitle('Close ticket')
            .addComponents(
                textInput(
                    'reason',
                    'Reason for closure (optional)',
                    TextInputStyle.Paragraph,
                    { required: false }
                )
            );

        return interaction.showModal(modal);
    },
    { staffOnly: false }
);

const closeModal = withTicket(
    async (interaction, ticket) => {
        const reason = interaction.fields
            .getTextInputValue('reason')
            .trim();

        await interaction.reply(
            'Saving the transcript and closing this ticket...'
        );

        return closeTicket(interaction, ticket, reason);
    },
    { staffOnly: false }
);

// ==========================================
// RENAME TICKET
// ==========================================

const renameButton = withTicket(async interaction => {
    const modal = new ModalBuilder()
        .setCustomId('ticket_rename_modal')
        .setTitle('Rename ticket')
        .addComponents(
            textInput(
                'name',
                'New channel name',
                TextInputStyle.Short,
                { max: 50 }
            )
        );

    return interaction.showModal(modal);
});

const renameModal = withTicket(async interaction => {
    const name = cleanName(
        interaction.fields
            .getTextInputValue('name')
            .replace(/\s+/g, '-')
    );

    await interaction.channel.setName(name);

    return reply(
        interaction,
        `Ticket renamed to **${name}**.`
    );
});

// ==========================================
// BUTTON AND MODAL EXPORTS
// ==========================================

const buttons = {
    ticket_claim: claim,
    ticket_unclaim: unclaim,
    ticket_close: closeButton,
    ticket_rename: renameButton,
};

const modals = {
    ticket_close_modal: closeModal,
    ticket_rename_modal: renameModal,
};

for (const key of Object.keys(types)) {
    buttons[`ticket_open_${key}`] = openModal(key);
    modals[`ticket_modal_${key}`] = createTicket(key);
}

// ==========================================
// SLASH COMMAND
// ==========================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName('supportpanel')
        .setDescription('Send the support ticket panel in this channel')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        const entries = Object.entries(types);

        if (entries.length === 0) {
            return reply(
                interaction,
                'No ticket types are configured in config.js.'
            );
        }

        if (entries.length > 5) {
            return reply(
                interaction,
                'Discord supports a maximum of 5 buttons per action row. Please configure 5 or fewer ticket types.'
            );
        }

        const row = new ActionRowBuilder().addComponents(
            entries.map(([key, type]) =>
                new ButtonBuilder()
                    .setCustomId(`ticket_open_${key}`)
                    .setLabel(type.label)
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        await interaction.channel.send({
            components: [
                card({
                    top: IMAGE,
                    text:
                        '# Support\n' +
                        '> Use the support tickets below to get help from our staff team!',
                    rows: [row],
                }),
            ],
            flags: V2,
        });

        return reply(interaction, 'Support panel sent.');
    },

    buttons,
    modals,
};
