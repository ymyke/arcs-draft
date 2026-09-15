// A draft travels as base64url text in the URL hash:
//
//   names joined by "~" | leader row | lore row | picks | options
//
// Rows are card indices in base 36, one character each. Picks are one letter each: A–Z for a
// leader slot, a–z for a lore slot. Options are four characters (pool, order, offer, lore
// count). Links made before variants existed have no options field and mean the defaults.

import { DEFAULT_OPTIONS, applyPick, availableCards, cleanNames, rowSizes, setupProblem } from './draft.js';

const CODES = {
  pool: { base: 'b', all: 'a' },
  order: { rulebook: 'r', snake: 's' },
  offer: { rulebook: 'o', wide: 'w', deal: 'd' },
};

const encodeOptions = options => CODES.pool[options.pool] + CODES.order[options.order] + CODES.offer[options.offer] + options.lore;

function decodeOptions(text) {
  const match = /^([ba])([rs])([owd])([1-3])$/.exec(text);
  if (!match) return null;
  const lookup = (field, code) => Object.keys(CODES[field]).find(key => CODES[field][key] === code);
  return { pool: lookup('pool', match[1]), order: lookup('order', match[2]), offer: lookup('offer', match[3]), lore: Number(match[4]) };
}

const pickToken = ({ kind, slot }) => String.fromCharCode((kind === 'leader' ? 65 : 97) + slot);

function tokenToPick(token) {
  if (/^[A-Z]$/.test(token)) return { kind: 'leader', slot: token.charCodeAt(0) - 65 };
  if (/^[a-z]$/.test(token)) return { kind: 'lore', slot: token.charCodeAt(0) - 97 };
  return null;
}

function toBase64Url(text) {
  const binary = Array.from(new TextEncoder().encode(text), byte => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code) {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
}

export function encodeDraft(draft) {
  return toBase64Url([
    draft.names.join('~'),
    draft.rows.leader.map(index => index.toString(36)).join(''),
    draft.rows.lore.map(index => index.toString(36)).join(''),
    draft.picks.map(pickToken).join(''),
    encodeOptions(draft.options),
  ].join('|'));
}

export function decodeDraft(input) {
  const code = String(input ?? '').trim().split('#').pop().replace(/[\s/]+/g, '');
  if (!code) return null;

  let fields;
  try {
    fields = fromBase64Url(code).split('|');
  } catch {
    return null;
  }
  if (fields.length !== 4 && fields.length !== 5) return null;
  const [nameField, leaderField, loreField, pickField, optionField] = fields;

  const options = optionField === undefined ? { ...DEFAULT_OPTIONS } : decodeOptions(optionField);
  if (!options) return null;

  const { names, problem } = cleanNames(nameField.split('~'));
  if (problem || setupProblem(options, names.length)) return null;

  const sizes = rowSizes(options, names.length);
  const rows = {};
  for (const [kind, field] of [['leader', leaderField], ['lore', loreField]]) {
    const allowed = new Set(availableCards(kind, options));
    const row = Array.from(field, ch => parseInt(ch, 36));
    if (row.length !== sizes[kind] || new Set(row).size !== row.length || !row.every(index => allowed.has(index))) {
      return null;
    }
    rows[kind] = row;
  }

  let draft = { names, options, rows, picks: [] };
  for (const token of pickField) {
    const pick = tokenToPick(token);
    if (!pick) return null;
    try {
      draft = applyPick(draft, pick.kind, pick.slot);
    } catch {
      return null;
    }
  }
  return draft;
}
