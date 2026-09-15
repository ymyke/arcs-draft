import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LEADERS, LORE } from '../src/cards.js';
import {
  DEFAULT_OPTIONS, applyPick, availableCards, canPick, cleanNames, countOf, currentPlayer, currentRound,
  dealDraft, handOwner, isComplete, pickerAt, rowSizes, setupProblem, totalPicks,
} from '../src/draft.js';
import { PLAYERS, describeOptions, everyOption, playOut, seededRandom } from './helpers.js';

const options = overrides => ({ ...DEFAULT_OPTIONS, ...overrides });

const fixedDraft = (overrides = {}, names = PLAYERS) => {
  const opts = options(overrides);
  const sizes = rowSizes(opts, names.length);
  return {
    names,
    options: opts,
    rows: { leader: [...Array(sizes.leader).keys()], lore: [...Array(sizes.lore).keys()] },
    picks: [],
  };
};

describe('row sizes', () => {
  test('rulebook rows hold one more leader than players and one spare lore card', () => {
    assert.deepEqual(rowSizes(options(), 4), { leader: 5, lore: 5 });
    assert.deepEqual(rowSizes(options({ lore: 2 }), 4), { leader: 5, lore: 9 });
  });

  test('wider rows offer 2 leaders and lore + 2 lore cards per player', () => {
    assert.deepEqual(rowSizes(options({ offer: 'wide' }), 3), { leader: 6, lore: 9 });
  });

  test('deal and pick gives each player 2 leaders and one lore card more than they keep', () => {
    assert.deepEqual(rowSizes(options({ offer: 'deal', lore: 2 }), 3), { leader: 6, lore: 9 });
  });

  test('setups larger than the chosen pool explain what to change', () => {
    assert.match(setupProblem(options({ offer: 'wide', lore: 2 }), 4), /needs 16 lore cards, but the base game has 14\. Add the Leaders & Lore pack/);
    assert.equal(setupProblem(options({ offer: 'wide', lore: 2, pool: 'all' }), 4), null);
  });

  test('the base pool excludes pack cards', () => {
    assert.ok(availableCards('leader', options()).every(i => LEADERS[i].set === 'base'));
    assert.equal(availableCards('lore', options({ pool: 'all' })).length, LORE.length);
  });
});

describe('names', () => {
  test('trims, drops blanks and strips the link separators', () => {
    assert.deepEqual(cleanNames([' Ann ', '', 'B~o|', 'Cy']), { names: ['Ann', 'Bo', 'Cy'], problem: null });
  });

  test('needs two to four distinct players', () => {
    assert.match(cleanNames(['Ann', '']).problem, /at least two/);
    assert.match(cleanNames(['Ann', 'ann']).problem, /share a name/);
  });
});

describe('dealing', () => {
  test('the same random source deals the same draft', () => {
    const deal = () => dealDraft(PLAYERS, options({ pool: 'all' }), seededRandom(7)).draft;
    assert.deepEqual(deal(), deal());
  });

  test('rows hold distinct cards from the chosen pool', () => {
    const { draft } = dealDraft(PLAYERS, options({ offer: 'wide' }), seededRandom(3));
    for (const kind of ['leader', 'lore']) {
      const allowed = new Set(availableCards(kind, draft.options));
      assert.equal(new Set(draft.rows[kind]).size, draft.rows[kind].length);
      assert.ok(draft.rows[kind].every(i => allowed.has(i)));
    }
  });

  test('returns the problem instead of a draft when setup is invalid', () => {
    assert.deepEqual(dealDraft(['Ann'], options()), { problem: 'Enter at least two names.' });
  });
});

describe('pick order', () => {
  test('rulebook order starts right of initiative and repeats each round', () => {
    const draft = fixedDraft({ lore: 2 }, ['Ann', 'Bo', 'Cy']);
    assert.deepEqual([...Array(9).keys()].map(i => pickerAt(draft, i)), ['Cy', 'Bo', 'Ann', 'Cy', 'Bo', 'Ann', 'Cy', 'Bo', 'Ann']);
  });

  test('snake order reverses every other round', () => {
    const draft = fixedDraft({ lore: 2, order: 'snake' }, ['Ann', 'Bo', 'Cy']);
    assert.deepEqual([...Array(9).keys()].map(i => pickerAt(draft, i)), ['Cy', 'Bo', 'Ann', 'Ann', 'Bo', 'Cy', 'Cy', 'Bo', 'Ann']);
  });

  test('the rail shows who has picked in the current round', () => {
    const draft = applyPick(fixedDraft({}, ['Ann', 'Bo']), 'leader', 0);
    assert.deepEqual(currentRound(draft), { round: 0, seats: [{ player: 'Bo', state: 'done' }, { player: 'Ann', state: 'active' }] });
  });
});

describe('picking', () => {
  test('a taken card cannot be taken again', () => {
    const draft = applyPick(fixedDraft(), 'leader', 0);
    assert.throws(() => applyPick(draft, 'leader', 0), /already taken/);
  });

  test('a player holds at most one leader', () => {
    let draft = fixedDraft({}, ['Ann', 'Bo']);
    draft = applyPick(draft, 'leader', 0);
    draft = applyPick(draft, 'lore', 0);
    assert.throws(() => applyPick(draft, 'leader', 1), /Bo cannot take another leader/);
  });

  test('a player holds at most the chosen number of lore cards', () => {
    let draft = fixedDraft({ lore: 2 }, ['Ann', 'Bo']);
    for (const slot of [0, 1, 2, 3]) draft = applyPick(draft, 'lore', slot);
    assert.throws(() => applyPick(draft, 'lore', 4), /Bo cannot take another lore card/);
    assert.equal(countOf(draft, 'Bo', 'lore'), 2);
  });

  test('in deal and pick, players only take from their own hand', () => {
    const draft = fixedDraft({ offer: 'deal' }, ['Ann', 'Bo']);
    assert.equal(currentPlayer(draft), 'Bo');
    assert.equal(handOwner(draft, 'leader', 1), 'Ann');
    assert.throws(() => applyPick(draft, 'leader', 1), /in Ann’s hand/);
    assert.ok(canPick(draft, 'leader', 2));
  });

  test('picks do not mutate the draft they are applied to', () => {
    const draft = fixedDraft();
    applyPick(draft, 'leader', 0);
    assert.deepEqual(draft.picks, []);
  });

  test('nothing can be picked once the draft is complete', () => {
    const draft = playOut(fixedDraft({}, ['Ann', 'Bo']), seededRandom(1));
    assert.ok(isComplete(draft));
    assert.throws(() => applyPick(draft, 'lore', 2), /complete/);
  });
});

test('every variant drafts to completion at every player count', () => {
  const rand = seededRandom(2026);
  for (const playerCount of [2, 3, 4]) {
    for (const opts of everyOption()) {
      const names = PLAYERS.slice(0, playerCount);
      const { draft, problem } = dealDraft(names, opts, rand);
      assert.equal(Boolean(problem), Boolean(setupProblem(opts, playerCount)), describeOptions(opts));
      if (problem) continue;

      const done = playOut(draft, rand);
      const label = `${playerCount} players, ${describeOptions(opts)}`;
      assert.equal(done.picks.length, totalPicks(done), label);
      for (const name of names) {
        assert.equal(countOf(done, name, 'leader'), 1, label);
        assert.equal(countOf(done, name, 'lore'), opts.lore, label);
      }
    }
  }
});
