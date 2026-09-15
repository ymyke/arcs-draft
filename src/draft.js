// Draft rules as pure functions over a plain draft object:
//
//   { names, options, rows: { leader: [cardIndex], lore: [cardIndex] }, picks: [{ kind, slot }] }
//
// names[0] holds initiative. Picks run in reverse seat order, so who made a pick is derived
// from its position and never stored.

import { LEADERS, LORE } from './cards.js';
import { shuffle } from './random.js';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_LORE = 3;
export const MAX_NAME_LENGTH = 22;
export const KINDS = ['leader', 'lore'];

export const DEFAULT_OPTIONS = Object.freeze({ pool: 'base', lore: 1, offer: 'rulebook', order: 'rulebook' });

const POOLS = { leader: LEADERS, lore: LORE };

export function availableCards(kind, options) {
  return POOLS[kind].flatMap((card, i) => (options.pool === 'all' || card.set === 'base' ? [i] : []));
}

export function rowSizes(options, playerCount) {
  switch (options.offer) {
    case 'wide': return { leader: 2 * playerCount, lore: (options.lore + 2) * playerCount };
    case 'deal': return { leader: 2 * playerCount, lore: (options.lore + 1) * playerCount };
    default: return { leader: playerCount + 1, lore: playerCount * options.lore + 1 };
  }
}

export const handSize = (kind, options) => (kind === 'leader' ? 2 : options.lore + 1);

export function setupProblem(options, playerCount) {
  const needed = rowSizes(options, playerCount);
  for (const kind of KINDS) {
    const available = availableCards(kind, options).length;
    if (needed[kind] <= available) continue;
    const noun = kind === 'leader' ? 'leaders' : 'lore cards';
    return options.pool === 'all'
      ? `This setup needs ${needed[kind]} ${noun}, but the base game and pack together have ${available}. Choose a smaller setup.`
      : `This setup needs ${needed[kind]} ${noun}, but the base game has ${available}. Add the Leaders & Lore pack or choose a smaller setup.`;
  }
  return null;
}

export function cleanNames(rawNames) {
  const names = rawNames
    .map(name => name.trim().replace(/[~|]/g, '').slice(0, MAX_NAME_LENGTH))
    .filter(Boolean);
  if (names.length < MIN_PLAYERS) return { names, problem: 'Enter at least two names.' };
  if (names.length > MAX_PLAYERS) return { names, problem: 'Arcs seats four at most.' };
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) {
    return { names, problem: 'Two players share a name — make them distinguishable.' };
  }
  return { names, problem: null };
}

export function dealDraft(rawNames, options, rand) {
  const { names, problem } = cleanNames(rawNames);
  const tooBig = problem ?? setupProblem(options, names.length);
  if (tooBig) return { problem: tooBig };

  const sizes = rowSizes(options, names.length);
  const drawRow = kind => {
    const drawn = shuffle(availableCards(kind, options), rand).slice(0, sizes[kind]);
    const groupSize = options.offer === 'deal' ? handSize(kind, options) : drawn.length;
    const row = [];
    for (let i = 0; i < drawn.length; i += groupSize) {
      row.push(...drawn.slice(i, i + groupSize).sort((a, b) => a - b));
    }
    return row;
  };

  return {
    draft: {
      names: shuffle(names, rand),
      options: { ...options },
      rows: { leader: drawRow('leader'), lore: drawRow('lore') },
      picks: [],
    },
  };
}

export const pickOrder = draft => [...draft.names].reverse();
export const roundCount = draft => 1 + draft.options.lore;
export const totalPicks = draft => draft.names.length * roundCount(draft);
export const limitOf = (draft, kind) => (kind === 'leader' ? 1 : draft.options.lore);
export const cardAt = (draft, kind, slot) => POOLS[kind][draft.rows[kind][slot]];

export function pickerAt(draft, index) {
  const order = pickOrder(draft);
  const round = Math.floor(index / order.length);
  const seat = index % order.length;
  const reversed = draft.options.order === 'snake' && round % 2 === 1;
  return order[reversed ? order.length - 1 - seat : seat];
}

export const isComplete = draft => draft.picks.length >= totalPicks(draft);
export const currentPlayer = draft => (isComplete(draft) ? null : pickerAt(draft, draft.picks.length));

export const picksOf = (draft, player) => draft.picks.filter((_, i) => pickerAt(draft, i) === player);
export const countOf = (draft, player, kind) => picksOf(draft, player).filter(pick => pick.kind === kind).length;

export function ownerOf(draft, kind, slot) {
  const index = draft.picks.findIndex(pick => pick.kind === kind && pick.slot === slot);
  return index < 0 ? null : pickerAt(draft, index);
}

export function handOwner(draft, kind, slot) {
  if (draft.options.offer !== 'deal') return null;
  return draft.names[Math.floor(slot / handSize(kind, draft.options))];
}

export function pickProblem(draft, kind, slot) {
  const player = currentPlayer(draft);
  if (!player) return 'The draft is complete.';
  if (!KINDS.includes(kind) || !Number.isInteger(slot) || slot < 0 || slot >= draft.rows[kind].length) {
    return 'There is no such card.';
  }
  if (ownerOf(draft, kind, slot)) return 'That card is already taken.';
  if (countOf(draft, player, kind) >= limitOf(draft, kind)) {
    return `${player} cannot take another ${kind === 'leader' ? 'leader' : 'lore card'}.`;
  }
  const hand = handOwner(draft, kind, slot);
  if (hand !== null && hand !== player) return `That card is in ${hand}’s hand.`;
  return null;
}

export const canPick = (draft, kind, slot) => pickProblem(draft, kind, slot) === null;

export function applyPick(draft, kind, slot) {
  const problem = pickProblem(draft, kind, slot);
  if (problem) throw new Error(problem);
  return { ...draft, picks: [...draft.picks, { kind, slot }] };
}

export function currentRound(draft) {
  const seats = draft.names.length;
  const round = Math.min(Math.floor(draft.picks.length / seats), roundCount(draft) - 1);
  return {
    round,
    seats: Array.from({ length: seats }, (_, seat) => {
      const index = round * seats + seat;
      const state = index < draft.picks.length ? 'done' : index === draft.picks.length ? 'active' : 'waiting';
      return { player: pickerAt(draft, index), state };
    }),
  };
}
