import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEADERS, LORE } from '../src/cards.js';
import { escapeHTML, plainCardText, renderCardText } from '../src/text.js';

test('escapes HTML before applying markup', () => {
  assert.equal(escapeHTML(`<b>"Tom" & 'Jerry'</b>`), '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
  assert.equal(renderCardText('<script>**x**</script>'), '<p>&lt;script&gt;<strong>x</strong>&lt;/script&gt;</p>');
});

test('renders leader abilities, emphasis, symbols and paragraphs', () => {
  assert.equal(
    renderCardText('*Bold*. You ***must*** **battle** twice.\n \nAdd 1 {intercept}. *(Really.)*'),
    '<p><span class="ability">Bold.</span> You <strong><em>must</em></strong> <strong>battle</strong> twice.</p>'
      + '<p>Add 1 <span class="sym">intercept</span>. <em>(Really.)</em></p>',
  );
});

test('no raw markup is left over on any card', () => {
  for (const card of [...LEADERS, ...LORE]) {
    const html = renderCardText(card.text).replace(/<[^>]+>/g, '');
    assert.doesNotMatch(html, /[*`{}$]/, card.name);
  }
});

test('plain text drops the markup and joins paragraphs, for text alternatives', () => {
  assert.equal(
    plainCardText('*Bold*. When you **battle**, roll {intercept}.\n \n***Do not*** flee. *(Really.)*'),
    'Bold. When you battle, roll intercept. Do not flee. (Really.)',
  );
});
