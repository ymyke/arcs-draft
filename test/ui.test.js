import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDraft, encodeDraft } from '../src/codec.js';
import { DEFAULT_OPTIONS, dealDraft } from '../src/draft.js';
import { PLAYERS, dealOnPage, openPage, seededRandom } from './helpers.js';

const pages = [];
const open = hash => {
  const page = openPage(hash);
  pages.push(page);
  return page;
};
afterEach(() => pages.splice(0).forEach(page => page.close()));

const turnOf = page => page.text('.turn').replace('’s turn', '');

describe('setup', () => {
  test('starts with four name fields and the rulebook variants selected', () => {
    const page = open();
    assert.equal(page.$$('input[data-name]').length, 4);
    assert.equal(page.$('select[data-option="pool"]').value, 'base');
    assert.equal(page.$('select[data-option="offer"]').value, 'rulebook');
  });

  test('explains missing players', () => {
    const page = open();
    page.type('input[data-name="0"]', 'Ann');
    page.click('[data-action="start"]');
    assert.equal(page.text('.err'), 'Enter at least two names.');
  });

  test('explains setups that need the pack', () => {
    const page = open();
    dealOnPage(page, PLAYERS, { offer: 'wide', lore: 2 });
    assert.match(page.text('.err'), /Add the Leaders & Lore pack/);
  });

  test('changing a variant keeps typed names and updates its hint', () => {
    const page = open();
    page.type('input[data-name="0"]', 'Ann');
    page.choose('select[data-option="offer"]', 'deal');
    assert.equal(page.$('input[data-name="0"]').value, 'Ann');
    assert.match(page.text('.opt:nth-of-type(3) .hint'), /dealt 2 leaders and 2 lore cards/);
  });
});

describe('a draft passed around by link', () => {
  const scenarios = [
    ['rulebook defaults', {}, PLAYERS],
    ['pack, two lore, snake order', { pool: 'all', lore: 2, order: 'snake' }, PLAYERS.slice(0, 3)],
    ['deal and pick', { pool: 'all', offer: 'deal' }, PLAYERS.slice(0, 2)],
  ];

  for (const [label, options, names] of scenarios) {
    test(label, () => {
      const setup = open();
      dealOnPage(setup, names, options);
      assert.match(setup.text('.modal h2'), /^Turn order:/);
      let hash = setup.hash();

      const expectedPicks = names.length * (1 + (options.lore ?? 1));
      for (let pick = 0; pick < expectedPicks; pick++) {
        const page = open(hash);
        const player = turnOf(page);
        assert.ok(names.includes(player), `turn ${pick} belongs to a player, got "${player}"`);

        page.click('button.card.pickable');
        assert.equal(page.$$('button.card.pickable').length, 0, 'the board locks after a pick');
        assert.match(page.text('.turn-note'), /locked|Bring this to the table/);
        hash = page.hash();
      }

      const final = open(hash);
      assert.equal(final.text('.turn'), 'All picks made');
      assert.equal(final.$$('.seat dd.empty').length, 0, 'every seat is filled');
      assert.equal(decodeDraft(hash).picks.length, expectedPicks);
    });
  }

  test('in deal and pick only the current player’s hand is clickable', () => {
    const { draft } = dealDraft(['Ann', 'Bo', 'Cy'], { ...DEFAULT_OPTIONS, pool: 'all', offer: 'deal' }, seededRandom(4));
    const page = open(`#${encodeDraft(draft)}`);
    for (const hand of page.$$('section.hand')) {
      const mine = hand.querySelector('h2').textContent.startsWith(turnOf(page));
      assert.equal(hand.querySelectorAll('button.card.pickable').length, mine ? 4 : 0);
    }
  });
});

describe('links and dialogs', () => {
  const draftHash = () => `#${encodeDraft(dealDraft(PLAYERS, DEFAULT_OPTIONS, seededRandom(8)).draft)}`;

  test('a pasted link opens the board', () => {
    const page = open();
    page.click('[data-action="open-screen"]');
    page.type('#code-input', `https://somewhere.test/${draftHash()}`);
    page.click('[data-action="load-code"]');
    assert.ok(page.$('.turn'));
  });

  test('a broken link is refused with an explanation', () => {
    const page = open();
    page.click('[data-action="open-screen"]');
    page.type('#code-input', 'not a draft');
    page.press('#code-input', 'Enter');
    assert.match(page.text('.err'), /doesn’t describe a legal draft/);
  });

  test('the share dialog closes on Escape and on the backdrop, not on clicks inside it', () => {
    const page = open(draftHash());
    page.click('[data-action="show-share"]');
    page.$('.modal p').click();
    assert.ok(page.$('.modal'), 'clicking inside keeps it open');
    page.$('.backdrop').click();
    assert.equal(page.$('.modal'), null);

    page.click('[data-action="show-share"]');
    page.window.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(page.$('.modal'), null);
  });

  test('a new game clears the board and the link', () => {
    const page = open(draftHash());
    page.click('[data-action="new-game"]');
    assert.equal(page.$$('input[data-name]').length, 4);
    assert.equal(page.hash(), '');
  });

  test('player names cannot inject markup', () => {
    const { draft } = dealDraft(['<img src=x>', 'Bo'], DEFAULT_OPTIONS, seededRandom(2));
    const page = open(`#${encodeDraft(draft)}`);
    assert.equal(page.$('img'), null);
    assert.ok(page.text('.roster').includes('<img src=x>'));
  });
});
