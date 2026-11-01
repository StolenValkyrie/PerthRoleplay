
const {
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
} = require('discord.js');

const config = require('../config');

const {
    BOTTOM_IMAGE,
    gallery,
    small,
    isAdmin,
    isStaff,
    loadStore,
    saveStore,
    truncate,
} = require('./helpers');

const V2 = MessageFlags.IsComponentsV2;
const types = config.tickets.types;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// TICKET ID PREFIXES
// ==========================================

const PREFIXES = {
    general: 'GEN',
    supervisory: 'SUP',
    management: 'MAN',
    directive: 'DIR',
};

const prefixFor = key =>
    PREFIXES[key] ?? key.slice(0, 3).toUpperCase();

// ==========================================
// STORAGE
// ==========================================

const loadTickets = () => loadStore('tickets');

const saveTickets = tickets =>
    saveStore('tickets', tickets);

const findByChannel = (tickets, channelId) =>
    Object.values(tickets).find(
        ticket =>
            ticket.status === 'open' &&
            ticket.channelId === channelId
    );

const typeLabel = ticket =>
    types[ticket.type]?.label ?? ticket.type;

// ==========================================
// PERMISSIONS
// ==========================================

const canManage = (member, ticket) =>
    isAdmin(member) ||
    (Array.isArray(types[ticket.type]?.roleIds)
        ? types[ticket.type].roleIds
        : []
    ).some(id => member.roles.cache.has(id));

const canLookup = member =>
    isAdmin(member) ||
    isStaff(member) ||
    Object.values(types).some(type =>
        (Array.isArray(type.roleIds) ? type.roleIds : [])
            .some(id => member.roles.cache.has(id))
    );

// ==========================================
// TRANSCRIPTS
// ==========================================

const MAX_MESSAGES = 1500;

function collectText(components = [], output = []) {
    for (const component of components) {
        if (typeof component.content === 'string') {
            output.push(component.content);
        }

        if (component.components) {
            collectText(component.components, output);
        }
    }

    return output;
}

const messageText = message =>
    message.cleanContent ||
    collectText(message.components).join('\n');

async function saveTranscript(channel, ticketId) {
    try {
        const collected = [];
        let before;

        while (collected.length < MAX_MESSAGES) {
            const batch = await channel.messages.fetch({
                limit: 100,
                before,
            });

            if (!batch.size) break;

            collected.push(...batch.values());

            before = batch.last().id;

            if (batch.size < 100) break;
        }

        const messages = collected.reverse().map(message => ({
            authorId: message.author.id,
            author: message.author.username,
            bot: message.author.bot,
            timestamp: message.createdTimestamp,
            content: messageText(message),
            attachments: [...message.attachments.values()].map(
                attachment => ({
                    name: attachment.name,
                    url: attachment.url,
                })
            ),
        }));

        saveStore(`transcripts/${ticketId}`, {
            id: ticketId,
            savedAt: Date.now(),
            messages,
        });

        console.log(`[tickets] Transcript saved for ${ticketId}`);

        return true;
    } catch (error) {
        console.error('[tickets] Transcript save failed:', error);
        return false;
    }
}

function loadTranscript(ticketId) {
    const data = loadStore(`transcripts/${ticketId}`);
    return data?.messages ? data : null;
}

// ==========================================
// TRANSCRIPT PAGES
// ==========================================

function transcriptPages(data) {
    const pages = [];
    let current = '';

    for (const message of data.messages) {
        let entry =
            `**${message.author}** <t:${Math.floor(message.timestamp / 1000)}:t>\n` +
            `${truncate(message.content || '*(no text)*', 600)}`;

        if (message.attachments?.length) {
            entry +=
                `\nAttachments: ${message.attachments
                    .map(attachment => attachment.name)
                    .join(', ')}`;
        }

        entry += '\n\n';

        if (current.length + entry.length > 3000) {
            if (current) pages.push(current);
            current = '';
        }

        current += entry;
    }

    if (current || !pages.length) {
        pages.push(current || '*This transcript is empty.*');
    }

    return pages;
}

// ==========================================
// TRANSCRIPT HTML
// ==========================================

const esc = value =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

function transcriptHtml(ticket, data) {
    const rows = data.messages
        .map(message => {
            const when = new Date(message.timestamp).toUTCString();

            const files = (message.attachments || [])
                .map(attachment =>
                    `<div class="file"><a href="${esc(attachment.url)}">${esc(attachment.name)}</a></div>`
                )
                .join('');

            return `
<div class="msg">
    <span class="author${message.bot ? ' bot' : ''}">${esc(message.author)}</span>
    <span class="time">${when}</span>
    <div class="text">${esc(message.content || '')}</div>
    ${files}
</div>`;
        })
        .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Transcript ${esc(ticket.id)}</title>
<style>
body{background:#1e1f22;color:#dbdee1;font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:24px}
h1{font-size:20px;margin:0 0 4px}
.meta{color:#949ba4;margin-bottom:20px;font-size:14px}
.msg{padding:8px 0;border-bottom:1px solid #2b2d31}
.author{font-weight:600;color:#fff}
.author.bot{color:#5865f2}
.time{color:#949ba4;font-size:12px;margin-left:6px}
.text{white-space:pre-wrap;margin-top:2px}
.file a{color:#00a8fc}
</style>
</head>
<body>
<h1>Transcript ${esc(ticket.id)}</h1>
<div class="meta">
${esc(typeLabel(ticket))} ticket opened by ${esc(ticket.openerName)}
on ${new Date(ticket.openedAt * 1000).toUTCString()}
</div>
${rows}
</body>
</html>`;
}

// ==========================================
// TICKET LOG
// ==========================================

const GAP = '\u2003\u2003';

function buildLog(ticket) {
    const text = [
        `**Lookup ID:** ${ticket.id}${GAP}**Opener:** <@${ticket.openerId}>`,
        `**Date Opened:** <t:${ticket.openedAt}:f>${GAP}**Closed By:** ${ticket.closedBy ? `<@${ticket.closedBy}>` : 'Unknown'}`,
        `**Reason for Closure:** ${ticket.closeReason || 'N/A'}${GAP}**Transcript Saved:** ${ticket.transcriptSaved ? 'Y' : 'N'}`,
    ].join('\n');

    return new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(text)
        )
        .addSeparatorComponents(small())
        .addMediaGalleryComponents(gallery(BOTTOM_IMAGE));
}

async function sendLog(client, ticket) {
    const channelId =
        config.tickets.logChannelId ||
        '1566066040755196020';

    if (!channelId) {
        console.warn('[tickets] No log channel configured.');
        return false;
    }

    try {
        const channel = await client.channels.fetch(channelId);

        if (!channel || !channel.isTextBased() || !channel.send) {
            console.error(
                '[tickets] Log channel not found or cannot receive messages.'
            );
            return false;
        }

        await channel.send({
            components: [buildLog(ticket)],
            flags: V2,
            allowedMentions: { parse: [] },
        });

        console.log(`[tickets] Log sent for ${ticket.id}`);

        return true;
    } catch (error) {
        console.error('[tickets] Could not send ticket log:', error);
        return false;
    }
}

// ==========================================
// CLOSE TICKET
// ==========================================

async function closeTicket(interaction, ticket, reason) {
    const channel = interaction.channel;

    if (!channel) {
        throw new Error('[tickets] Ticket channel not found.');
    }

    const transcriptSaved = await saveTranscript(
        channel,
        ticket.id
    );

    const tickets = loadTickets();
    const record = tickets[ticket.id];

    if (!record) {
        throw new Error(
            `[tickets] Ticket record ${ticket.id} was not found.`
        );
    }

    Object.assign(record, {
        status: 'closed',
        closedBy: interaction.user.id,
        closedAt: Math.floor(Date.now() / 1000),
        closeReason: reason || null,
        transcriptSaved,
    });

    saveTickets(tickets);

    // Try to send the log before deleting the ticket channel.
    await sendLog(interaction.client, record);

    await sleep(3000);

    await channel.delete(
        `Ticket ${ticket.id} closed by ${
            interaction.user.tag || interaction.user.username
        }`
    );

    console.log(`[tickets] Ticket ${ticket.id} closed.`);
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    types,
    prefixFor,
    loadTickets,
    saveTickets,
    findByChannel,
    typeLabel,
    canManage,
    canLookup,
    loadTranscript,
    transcriptPages,
    transcriptHtml,
    closeTicket,
    sendLog,
};
