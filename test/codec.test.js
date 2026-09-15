import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDraft, encodeDraft } from '../src/codec.js';
import { DEFAULT_OPTIONS, dealDraft } from '../src/draft.js';
import { PLAYERS, describeOptions, everyOption, playOut, seededRandom } from './helpers.js';

const rawCode = text => Buffer.from(text).toString('base64url');

describe('round trips', () => {
  test('every variant survives encoding at the start, midway and at the end', () => {
    const rand = seededRandom(11);
    for (const options of everyOption()) {
      const { draft } = dealDraft(PLAYERS.slice(0, 3), options, rand);
      if (!draft) continue;
      for (const stopAfter of [0, 4, Infinity]) {
        const state = playOut(draft, rand, stopAfter);
        assert.deepEqual(decodeDraft(encodeDraft(state)), state, `${describeOptions(options)} after ${stopAfter} picks`);
      }
    }
  });

  test('non-ASCII names survive', () => {
    const { draft } = dealDraft(['Zoë', 'Jürg', '李'], DEFAULT_OPTIONS, seededRandom(5));
    assert.deepEqual(decodeDraft(encodeDraft(draft)).names, draft.names);
  });

  test('accepts a full URL, a bare hash, or the code with stray whitespace', () => {
    const { draft } = dealDraft(PLAYERS, DEFAULT_OPTIONS, seededRandom(9));
    const code = encodeDraft(draft);
    for (const input of [`https://example.test/draft/#${code}`, `#${code}`, ` ${code.slice(0, 10)}\n${code.slice(10)} `]) {
      assert.deepEqual(decodeDraft(input), draft);
    }
  });
});

describe('links from before variants existed', () => {
  test('open with the rulebook defaults', () => {
    const draft = decodeDraft(rawCode('Ann~Bo~Cy~Di|01357|259bc|Ac'));
    assert.deepEqual(draft, {
      names: ['Ann', 'Bo', 'Cy', 'Di'],
      options: DEFAULT_OPTIONS,
      rows: { leader: [0, 1, 3, 5, 7], lore: [2, 5, 9, 11, 12] },
      picks: [{ kind: 'leader', slot: 0 }, { kind: 'lore', slot: 2 }],
    });
  });
});

describe('rejects links that do not describe a legal draft', () => {
  const cases = {
    'empty input': '',
    'not base64': '%%%',
    'wrong number of fields': rawCode('Ann~Bo|012|012'),
    'unknown option code': rawCode('Ann~Bo|012|012||xro1'),
    'one player': rawCode('Ann|01|01|'),
    'duplicate names': rawCode('Ann~ann|012|012|'),
    'pack card in a base-only draft': rawCode('Ann~Bo~Cy~Di|0135g|259bc|'),
    'row of the wrong size': rawCode('Ann~Bo~Cy~Di|0135|259bc|'),
    'the same card twice in a row': rawCode('Ann~Bo~Cy~Di|01135|259bc|'),
    'a player taking two leaders': rawCode('Ann~Bo~Cy~Di|01357|259bc|ABCDE'),
    'a pick token outside the row': rawCode('Ann~Bo~Cy~Di|01357|259bc|Z'),
    'too big for the base game': rawCode('Ann~Bo~Cy~Di|01234567|0123456789abcdef||brw2'),
  };
  for (const [label, input] of Object.entries(cases)) {
    test(label, () => assert.equal(decodeDraft(input), null));
  }
});
