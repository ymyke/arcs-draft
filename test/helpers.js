import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mount } from '../src/app.js';
import { KINDS, applyPick, canPick, isComplete } from '../src/draft.js';

export const PLAYERS = ['Ann', 'Bo', 'Cy', 'Di'];

// Deterministic stand-in for randomInt (mulberry32).
export function seededRandom(seed) {
  let state = seed >>> 0;
  return n => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 2 ** 32) * n);
  };
}

export function* everyOption() {
  for (const pool of ['base', 'all'])
    for (const lore of [1, 2, 3])
      for (const offer of ['rulebook', 'wide', 'deal'])
        for (const order of ['rulebook', 'snake'])
          yield { pool, lore, offer, order };
}

export const describeOptions = options => Object.values(options).join('/');

export const legalPicks = draft =>
  KINDS.flatMap(kind => draft.rows[kind].map((_, slot) => ({ kind, slot })))
    .filter(({ kind, slot }) => canPick(draft, kind, slot));

export function playOut(draft, rand, stopAfter = Infinity) {
  let played = 0;
  while (!isComplete(draft) && played < stopAfter) {
    const choices = legalPicks(draft);
    if (choices.length === 0) throw new Error(`No legal pick after ${draft.picks.length} picks`);
    const { kind, slot } = choices[rand(choices.length)];
    draft = applyPick(draft, kind, slot);
    played++;
  }
  return draft;
}

const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Loads index.html into jsdom and mounts the app, as src/main.js does in a browser.
export function openPage(hash = '') {
  const dom = new JSDOM(shell, { url: `https://arcs-draft.test/${hash}`, pretendToBeVisual: true });
  const { window } = dom;
  window.confirm = () => true;
  mount(window.document.getElementById('app'), window);

  const $ = selector => window.document.querySelector(selector);
  const $$ = selector => [...window.document.querySelectorAll(selector)];
  const fire = (element, type) => element.dispatchEvent(new window.Event(type, { bubbles: true }));

  return {
    window,
    $,
    $$,
    text: selector => $(selector)?.textContent.replace(/\s+/g, ' ').trim(),
    hash: () => window.location.hash,
    click: selector => $(selector).click(),
    press: (selector, key) => $(selector).dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true })),
    type(selector, value) {
      $(selector).value = value;
      fire($(selector), 'input');
    },
    choose(selector, value) {
      $(selector).value = String(value);
      fire($(selector), 'change');
    },
    close: () => window.close(),
  };
}

export function dealOnPage(page, names, options = {}) {
  while (page.$$('input[data-name]').length < names.length) page.click('[data-action="add-player"]');
  while (page.$$('input[data-name]').length > names.length) page.click('[data-action="remove-player"]');
  for (const [key, value] of Object.entries(options)) page.choose(`select[data-option="${key}"]`, value);
  names.forEach((name, i) => page.type(`input[data-name="${i}"]`, name));
  page.click('[data-action="start"]');
}
