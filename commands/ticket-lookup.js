
const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');

const {
    loadTickets,
    canLookup,
    typeLabel,
} = require('../lib/tickets');

const { loadTranscript } = require('../lib/tickets');

// ==========================================
// PERMISSION CHECK
// ==========================================

function hasAccess(member) {
    return canLookup(member);
}

// ==========================================
// FIND TICKET
// ==========================================

function findTicket(id) {
    const tickets = loadTickets();
    const lookupId = String(id || '').trim().toUpperCase();

    return Object.values(tickets).find(
        ticket =>
            String(ticket.id).toUpperCase() === lookupId
    ) || null;
}

// ==========================================
// FORMAT TICKET
// ==========================================

function formatTicket(ticket) {
    const status =
        ticket.status === 'open' ? '🟢 Open' : '🔴 Closed';

    const channel =
        ticket.status === 'open'
            ? `<#${ticket.channelId}>`
            : 'Channel closed';

    const openedAt = ticket.openedAt
        ? `<t:${ticket.openedAt}:F>`
        : 'Unknown';

    const closedAt = ticket.closedAt
        ? `<t:${ticket.closedAt}:F>`
        : 'Not closed';

    return [
        `# Ticket Lookup: ${ticket.id}`,
        '',
        `**Type:** ${typeLabel(ticket)}`,
        `**Status:** ${status}`,
        `**Channel:** ${channel}`,
        `**Opener:** <@${ticket.openerId}>`,
        `**Opener Username:** ${ticket.openerName || 'Unknown'}`,
        `**Opened:** ${openedAt}`,
        `**Claimed By:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Nobody'}`,
        `**Closed By:** ${ticket.closedBy ? `<@${ticket.closedBy}>` : 'N/A'}`,
        `**Closed At:** ${closedAt}`,
        `**Close Reason:** ${ticket.closeReason || 'N/A'}`,
        `**Transcript Saved:** ${ticket.transcriptSaved ? 'Yes' : 'No'}`,
        '',
        `**Opening Reason:** ${ticket.reason || 'Not provided'}`,
    ].join('\n');
}

// ==========================================
// COMMAND
// ==========================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket_lookup')
        .setDescription('Look up a ticket using its ID')
        .addStringOption(option =>
            option
                .setName('id')
                .setDescription('Ticket ID, e.g. GEN-12345')
                .setRequired(true)
        ),

    // ======================================
    // SLASH COMMAND
    // ======================================

    async execute(interaction) {
        if (!hasAccess(interaction.member)) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const id = interaction.options
            .getString('id')
            .trim();

        const ticket = findTicket(id);

        if (!ticket) {
            return interaction.reply({
                content: `No ticket was found with ID \`${id}\`.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        return interaction.reply({
            content: formatTicket(ticket),
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },

    // ======================================
    // PREFIX COMMAND
    // ======================================

    async prefix(message, args) {
        if (!hasAccess(message.member)) {
            return message.reply(
                'You do not have permission to use this command.'
            );
        }

        const id = args[0];

        if (!id) {
            return message.reply(
                'Usage: `^ticket-lookup GEN-12345`'
            );
        }

        const ticket = findTicket(id);

        if (!ticket) {
            return message.reply(
                `No ticket was found with ID \`${id}\`.`
            );
        }

        return message.reply({
            content: formatTicket(ticket),
            allowedMentions: { parse: [] },
        });
    },
};
