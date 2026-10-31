const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} = require('discord.js');
const config = require('../config');

const BOTTOM_IMAGE = 'https://cdn.phototourl.com/member/2026-10-31-cdfc75cc-0456-4886-9a51-a14e1563d9bf.png';

const gallery = (url) => new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(url));
const small = () => new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);

// Container layout used by most messages:
// top image, small separator, text, optional button rows, small separator, bottom image
function card({ top, text, rows = [] }) {
  const container = new ContainerBuilder()
    .addMediaGalleryComponents(gallery(top))
    .addSeparatorComponents(small())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));

  if (rows.length) container.addActionRowComponents(...rows);

  return container.addSeparatorComponents(small()).addMediaGalleryComponents(gallery(BOTTOM_IMAGE));
}

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isStaff(member) {
  return isAdmin(member) || config.staffRoleIds.some((id) => member.roles.cache.has(id));
}

// Tiny JSON file store (saved in /data so it survives restarts)
const DATA_DIR = path.join(__dirname, '..', 'data');

function loadStore(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf8'));
  } catch {
    return {};
  }
}

function saveStore(name, data) {
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Random ID like GEN-7K2QX9 (no confusing characters like 0/O or 1/I)
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomId(prefix, existing = {}) {
  let id;
  do {
    id = `${prefix}-${Array.from({ length: 6 }, () => ID_CHARS[crypto.randomInt(ID_CHARS.length)]).join('')}`;
  } while (existing[id]);
  return id;
}

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

module.exports = {
  BOTTOM_IMAGE,
  card,
  gallery,
  small,
  isAdmin,
  isStaff,
  loadStore,
  saveStore,
  randomId,
  truncate,
};