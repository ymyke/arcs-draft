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
