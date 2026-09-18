import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEADERS, LORE } from '../src/cards.js';

for (const [label, cards, baseCount] of [['leaders', LEADERS, 8], ['lore', LORE, 14]]) {
  test(`${label}: base game cards come first, then the pack`, () => {
    assert.equal(cards.length, 2 * baseCount);
    assert.deepEqual(cards.map(card => card.set), [...Array(baseCount).fill('base'), ...Array(baseCount).fill('pack')]);
  });

  test(`${label}: numbered 1..n in list order, since links store positions`, () => {
    assert.deepEqual(cards.map(card => card.number), cards.map((_, i) => i + 1));
  });

  test(`${label}: names are unique and texts are non-empty`, () => {
    assert.equal(new Set(cards.map(card => card.name)).size, cards.length);
    for (const card of cards) assert.ok(card.text.trim().length > 20, card.name);
  });
}

test('published text errata are applied', () => {
  const text = name => [...LEADERS, ...LORE].find(card => card.name === name).text;
  assert.match(text('Upstart'), /You cannot \*\*tax\*\* cities that you do not control\./);
  assert.match(text('Agitator'), /and is intercepted,/);
  assert.match(text('Living Structures'), /Replace a Loyal starport in a slot with a Loyal city/);
});

test('every card points at its scan in the official card library', () => {
  const file = (prefix, card) => `${prefix}${String(card.number).padStart(2, '0')}.webp`;
  for (const [cards, prefix] of [[LEADERS, 'LEAD'], [LORE, 'L']]) {
    for (const card of cards) {
      assert.equal(card.image, `https://cardcdn.buriedgiant.com/cards/arcs/en-US/${file(prefix, card)}`, card.name);
    }
  }
});

test('only cards with text errata carry the corrected sentence, since their scans show the old one', () => {
  const corrected = [...LEADERS, ...LORE].filter(card => card.errata);
  assert.deepEqual(corrected.map(card => card.name).sort(), ['Agitator', 'Living Structures', 'Upstart']);
  for (const card of corrected) assert.ok(card.text.includes(card.errata), card.name);
});
