const { ContainerBuilder, MessageFlags, TextDisplayBuilder } = require('discord.js');
const config = require('../config');
const { BOTTOM_IMAGE, gallery, small, isAdmin, isStaff, loadStore, saveStore, truncate } = require('./helpers');

const V2 = MessageFlags.IsComponentsV2;
const types = config.tickets.types;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ID prefixes: GEN-..., SUP-..., MAN-..., DIR-...
const PREFIXES = { general: 'GEN', supervisory: 'SUP', management: 'MAN', directive: 'DIR' };
const prefixFor = (key) => PREFIXES[key] ?? key.slice(0, 3).toUpperCase();

// All tickets (open and closed), keyed by lookup ID
const loadTickets = () => loadStore('tickets');
const saveTickets = (t) => saveStore('tickets', t);

const findByChannel = (tickets, channelId) =>
  Object.values(tickets).find((t) => t.status === 'open' && t.channelId === channelId);

const typeLabel = (ticket) => types[ticket.type]?.label ?? ticket.type;

// Staff of this ticket's type, or an admin
const canManage = (member, ticket) =>
  isAdmin(member) || (types[ticket.type]?.roleIds ?? []).some((id) => member.roles.cache.has(id));

// Anyone who is staff or manages any ticket type can use /ticket_lookup
const canLookup = (member) =>
  isStaff(member) || Object.values(types).some((t) => t.roleIds.some((id) => member.roles.cache.has(id)));

// ---------- Transcripts ----------
const MAX_MESSAGES = 1500;

function collectText(components = [], out = []) {
  for (const c of components) {
    if (typeof c.content === 'string') out.push(c.content);
    if (c.components) collectText(c.components, out);
  }
  return out;
}

// Plain text of a message (also reads our container cards, which have no normal "content")
const messageText = (m) => m.cleanContent || collectText(m.components).join('\n');

async function saveTranscript(channel, ticketId) {
  try {
    const collected = [];
    let before;
    while (collected.length < MAX_MESSAGES) {
      const batch = await channel.messages.fetch({ limit: 100, before });
      if (!batch.size) break;
      collected.push(...batch.values());
      before = batch.last().id;
      if (batch.size < 100) break;
    }

    const messages = collected.reverse().map((m) => ({
      authorId: m.author.id,
      author: m.author.username,
      bot: m.author.bot,
      timestamp: m.createdTimestamp,
      content: messageText(m),
      attachments: [...m.attachments.values()].map((a) => ({ name: a.name, url: a.url })),
    }));

    saveStore(`transcripts/${ticketId}`, { id: ticketId, savedAt: Date.now(), messages });
    return true;
  } catch (err) {
    console.error('Transcript save failed:', err);
    return false;
  }
}

function loadTranscript(ticketId) {
  const data = loadStore(`transcripts/${ticketId}`);
  return data.messages ? data : null;
}

// Split a transcript into pages that fit in one Discord message
function transcriptPages(data) {
  const pages = [];
  let current = '';
  for (const m of data.messages) {
    let entry = `**${m.author}** <t:${Math.floor(m.timestamp / 1000)}:t>\n${truncate(m.content || '*(no text)*', 600)}`;
    if (m.attachments.length) entry += `\nAttachments: ${m.attachments.map((a) => a.name).join(', ')}`;
    entry += '\n\n';
    if (current.length + entry.length > 3000) {
      pages.push(current);
      current = '';
    }
    current += entry;
  }
  if (current || !pages.length) pages.push(current || '*This transcript is empty.*');
  return pages;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A standalone page people can open in a browser
function transcriptHtml(ticket, data) {
  const rows = data.messages
    .map((m) => {
      const when = new Date(m.timestamp).toUTCString();
      const files = m.attachments
        .map((a) => `<div class="file"><a href="${esc(a.url)}">${esc(a.name)}</a></div>`)
        .join('');
      return `<div class="msg"><span class="author${m.bot ? ' bot' : ''}">${esc(m.author)}</span> <span class="time">${when}</span><div class="text">${esc(m.content || '')}</div>${files}</div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Transcript ${esc(ticket.id)}</title>
<style>
body{background:#1e1f22;color:#dbdee1;font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:24px}
h1{font-size:20px;margin:0 0 4px}.meta{color:#949ba4;margin-bottom:20px;font-size:14px}
.msg{padding:8px 0;border-bottom:1px solid #2b2d31}.author{font-weight:600;color:#fff}.author.bot{color:#5865f2}
.time{color:#949ba4;font-size:12px;margin-left:6px}.text{white-space:pre-wrap;margin-top:2px}.file a{color:#00a8fc}
</style></head><body>
<h1>Transcript ${esc(ticket.id)}</h1>
<div class="meta">${esc(typeLabel(ticket))} ticket opened by ${esc(ticket.openerName)} on ${new Date(ticket.openedAt * 1000).toUTCString()}</div>
${rows}
</body></html>`;
}

// ---------- Logging ----------
const GAP = '\u2003\u2003'; // wide space between the two columns

function buildLog(t) {
  const text = [
    `**Lookup ID:** ${t.id}${GAP}**Opener:** <@${t.openerId}>`,
    `**Date Opened:** <t:${t.openedAt}:f>${GAP}**Closed By:** <@${t.closedBy}>`,
    `**Reason for Closure:** ${t.closeReason || 'N/A'}${GAP}**Transcript Saved:** ${t.transcriptSaved ? 'Y' : 'N'}`,
  ].join('\n');

  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
    .addSeparatorComponents(small())
    .addMediaGalleryComponents(gallery(BOTTOM_IMAGE));
}

async function sendLog(client, ticket) {
  const channelId = config.tickets.logChannelId;
  if (!channelId) return console.warn('[tickets] tickets.logChannelId is not set in config.js, so nothing was logged.');
  try {
    const channel = await client.channels.fetch(channelId);
    await channel.send({ components: [buildLog(ticket)], flags: V2, allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('Could not send ticket log:', err);
  }
}

// Save transcript, record the closure, post the log, delete the channel.
// The caller should already have replied to the interaction.
async function closeTicket(interaction, ticket, reason) {
  const channel = interaction.channel;
  const transcriptSaved = await saveTranscript(channel, ticket.id);

  const tickets = loadTickets();
  const record = tickets[ticket.id];
  Object.assign(record, {
    status: 'closed',
    closedBy: interaction.user.id,
    closedAt: Math.floor(Date.now() / 1000),
    closeReason: reason || null,
    transcriptSaved,
  });
  saveTickets(tickets);

  await sendLog(interaction.client, record);
  await sleep(3000);
  await channel.delete(`Ticket ${ticket.id} closed by ${interaction.user.tag}`);
}

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
};