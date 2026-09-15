import { LEADERS, LORE } from './cards.js';
import {
  DEFAULT_OPTIONS, MAX_PLAYERS, MIN_PLAYERS,
  applyPick, canPick, cardAt, countOf, currentPlayer, currentRound, dealDraft, handSize,
  isComplete, limitOf, ownerOf, pickOrder, picksOf, roundCount,
} from './draft.js';
import { decodeDraft, encodeDraft } from './codec.js';
import { escapeHTML as esc, renderCardText } from './text.js';

const REPO_URL = 'https://github.com/ymyke/arcs-draft';
const EMPTY_NAMES = () => ['', '', '', ''];
const BAD_LINK = 'That doesn’t describe a legal draft. Check it was copied whole, or ask for it again.';

const countSet = (cards, set) => cards.filter(card => card.set === set).length;
const loreCount = n => (n === 1 ? 'a lore card' : `${n} lore cards`);

const OPTION_FIELDS = [
  {
    key: 'pool',
    label: 'Cards',
    choices: [
      ['base', `Base game only (${countSet(LEADERS, 'base')} leaders, ${countSet(LORE, 'base')} lore)`],
      ['all', `Base game + Leaders & Lore pack (${LEADERS.length} leaders, ${LORE.length} lore)`],
    ],
  },
  {
    key: 'lore',
    label: 'Lore cards each',
    choices: [[1, '1 (rulebook)'], [2, '2 (rulebook variant)'], [3, '3']],
    hint: options => (options.lore > 1 ? 'The rulebook allows more lore but warns it can overwhelm everyone.' : ''),
  },
  {
    key: 'offer',
    label: 'Cards on offer',
    choices: [['rulebook', 'Rulebook rows'], ['wide', 'Wider rows'], ['deal', 'Deal and pick']],
    hint: options => ({
      rulebook: 'One more leader than players, and one more lore card than the players take in total.',
      wide: `Twice as many leaders as players, and ${options.lore + 2} lore cards per player, so the last pick still has real choice.`,
      deal: `Each player is dealt 2 leaders and ${options.lore + 1} lore cards and keeps 1 leader and ${loreCount(options.lore)}. Every hand is visible to anyone holding the link.`,
    })[options.offer],
  },
  {
    key: 'order',
    label: 'Pick order',
    choices: [['rulebook', 'Rulebook: same order every round'], ['snake', 'Snake: order reverses each round']],
    hint: () => 'Both start with the player to the right of initiative.',
  },
];

function optionsSummary(options) {
  return [
    options.pool === 'all' ? 'Base game + Leaders & Lore' : 'Base game cards',
    { rulebook: 'rulebook rows', wide: 'wider rows', deal: 'deal and pick' }[options.offer],
    options.order === 'snake' ? 'snake order' : 'rulebook order',
    `${options.lore} lore each`,
  ].join(' · ');
}

/* ---------- views ---------- */

const creditsView = () => `
  <span>Unofficial fan tool, not affiliated with Buried Giant Studios or Leder Games. Card text from the <a href="https://cards.buriedgiant.com" target="_blank" rel="noopener">official card library</a>.</span>
  <a href="${REPO_URL}" target="_blank" rel="noopener">Source on GitHub</a>`;

const problemView = problem => (problem ? `<p class="err" role="alert">${esc(problem)}</p>` : '');

function optionView(field, options) {
  const id = `option-${field.key}`;
  const hint = field.hint?.(options);
  const choices = field.choices.map(([value, label]) =>
    `<option value="${value}"${String(options[field.key]) === String(value) ? ' selected' : ''}>${esc(label)}</option>`).join('');
  return `
    <div class="opt">
      <label for="${id}">${field.label}</label>
      <select id="${id}" data-option="${field.key}">${choices}</select>
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    </div>`;
}

function setupView({ names, options, problem }) {
  const seats = names.map((name, i) => `
    <div class="seat-row">
      <span class="n">${i + 1}</span>
      <input type="text" data-name="${i}" value="${esc(name)}" placeholder="Name" aria-label="Player ${i + 1}" autocomplete="off" spellcheck="false">
      <button class="drop" data-action="remove-player" data-index="${i}" aria-label="Remove player ${i + 1}"${names.length <= MIN_PLAYERS ? ' disabled' : ''}>×</button>
    </div>`).join('');
  return `
    <div class="setup">
      <h1>Arcs draft</h1>
      <p class="sub">Draft your leaders and lore before game night. Everyone picks in their own time, and the table is set up in minutes.</p>
      <section class="panel how">
        <h2>How it works</h2>
        <ol>
          <li>Enter the players and deal. Turn order is shuffled and the cards are drawn face up.</li>
          <li>Send the link to whoever picks first. They take a card and get a new link for the next player.</li>
          <li>Keep passing the newest link until everyone holds their cards.</li>
        </ol>
        <p class="hint">Nothing is stored anywhere — no server, no account. The whole draft lives in the link, so keep the latest one.</p>
      </section>
      <section class="panel">
        <h2>Players</h2>
        <p>Two to four, as the box allows. Order here doesn’t matter — it gets shuffled.</p>
        <div class="seats-in">${seats}</div>
        <div class="setup-actions">
          <button class="solid" data-action="start">Shuffle and deal</button>
          <button class="ghost" data-action="add-player"${names.length >= MAX_PLAYERS ? ' disabled' : ''}>Add a player</button>
          <button class="ghost" data-action="open-screen">Open a link</button>
        </div>
        ${problemView(problem)}
      </section>
      <section class="panel">
        <h2>Variants</h2>
        <p>The defaults follow the rulebook.</p>
        ${OPTION_FIELDS.map(field => optionView(field, options)).join('')}
      </section>
      <footer class="foot">${creditsView()}</footer>
    </div>`;
}

function openView({ problem }) {
  return `
    <div class="setup">
      <h1>Arcs draft</h1>
      <p class="sub">Paste the link you were sent and the board comes back exactly as the last player left it.</p>
      <section class="panel">
        <h2>Open a draft</h2>
        <p>Everything about the game is carried in the link — names, turn order, variants, cards, picks so far.</p>
        <input type="text" id="code-input" placeholder="Paste link…" aria-label="Draft link" autocomplete="off" spellcheck="false">
        <div class="setup-actions">
          <button class="solid" data-action="load-code">Open board</button>
          <button class="ghost" data-action="new-game">Set up a new game instead</button>
        </div>
        ${problemView(problem)}
      </section>
      <footer class="foot">${creditsView()}</footer>
    </div>`;
}

function cardView(state, kind, slot) {
  const { draft } = state;
  const card = cardAt(draft, kind, slot);
  const owner = ownerOf(draft, kind, slot);
  const pickable = !state.justPicked && canPick(draft, kind, slot);
  const number = String(card.number).padStart(2, '0');
  const pack = card.set === 'pack' ? ' · Leaders & Lore' : '';
  const footer = kind === 'lore'
    ? `<div class="num"><span>Lore${pack}</span><span>${number}</span></div>`
    : `<div class="num">Leader ${number}${pack}</div>`;
  const face = `
    <div class="face">
      <div class="art"></div>
      <div class="title">${esc(card.name)}</div>
      <div class="body">${renderCardText(card.text)}</div>
      ${footer}
    </div>`;
  if (pickable) {
    return `<button class="card ${kind} pickable" data-action="pick" data-kind="${kind}" data-slot="${slot}" aria-label="Take ${esc(card.name)}">${face}</button>`;
  }
  const peeked = state.peek === `${kind}:${slot}`;
  const label = owner ? `${card.name}, taken by ${owner}` : card.name;
  return `
    <div class="card ${kind} ${owner ? 'taken' : 'blocked'}${peeked ? ' peek' : ''}" data-action="peek" data-kind="${kind}" data-slot="${slot}"
         role="button" tabindex="0" aria-pressed="${peeked}" aria-label="${esc(label)} — show clearly">
      ${face}${owner ? `<div class="claim">${esc(owner)}</div>` : ''}
    </div>`;
}

function rowView(state, kind, slots, heading) {
  const open = slots.filter(slot => !ownerOf(state.draft, kind, slot)).length;
  return `
    <div class="rowhead"><h2>${heading}</h2><span class="count">${open} of ${slots.length} still open</span></div>
    <div class="row ${kind === 'leader' ? 'leaders' : 'lores'}">${slots.map(slot => cardView(state, kind, slot)).join('')}</div>`;
}

const range = (start, length) => Array.from({ length }, (_, i) => start + i);

function cardsView(state) {
  const { draft } = state;
  if (draft.options.offer !== 'deal') {
    return rowView(state, 'leader', range(0, draft.rows.leader.length), 'Leaders')
      + rowView(state, 'lore', range(0, draft.rows.lore.length), 'Lore');
  }
  const leaders = handSize('leader', draft.options);
  const lore = handSize('lore', draft.options);
  return draft.names.map((name, hand) => `
    <section class="hand${name === currentPlayer(draft) ? ' turn-now' : ''}">
      <h2>${esc(name)}’s hand</h2>
      ${rowView(state, 'leader', range(hand * leaders, leaders), 'Leaders')}
      ${rowView(state, 'lore', range(hand * lore, lore), 'Lore')}
    </section>`).join('');
}

function turnNote(draft, justPicked) {
  if (isComplete(draft)) return 'Bring this to the table.';
  const player = currentPlayer(draft);
  if (justPicked) return `The board is locked until ${player} opens it.`;
  const dealt = draft.options.offer === 'deal';
  const needsLeader = countOf(draft, player, 'leader') < limitOf(draft, 'leader');
  const loreLeft = limitOf(draft, 'lore') - countOf(draft, player, 'lore');
  const where = dealt ? ' from your hand' : '';
  if (needsLeader && loreLeft > 0) return dealt ? 'Take one card from your hand.' : 'Take one card, either row.';
  if (needsLeader) return `Lore is complete, so take a leader${where}.`;
  return `Already holding a leader, so take a lore card${where}${loreLeft > 1 ? ` (${loreLeft} still to take)` : ''}.`;
}

function railView(draft) {
  const { round, seats } = currentRound(draft);
  const players = seats
    .map(({ player, state }) => `<span class="${state}">${esc(player)}</span>`)
    .join('<span class="arrow" aria-hidden="true">→</span>');
  return `<span class="round">Round ${round + 1} of ${roundCount(draft)}</span>${players}`;
}

function seatView(draft, name) {
  const mine = picksOf(draft, name);
  const leader = mine.find(pick => pick.kind === 'leader');
  const lore = mine.filter(pick => pick.kind === 'lore');
  const chosen = (kind, pick) => `<dd>${esc(cardAt(draft, kind, pick.slot).name)}</dd>`;
  const empty = '<dd class="empty">not chosen</dd>';
  return `
    <div class="seat${name === currentPlayer(draft) ? ' turn-now' : ''}">
      <h3>${esc(name)}${name === draft.names[0] ? '<span class="tag">initiative</span>' : ''}</h3>
      <dl>
        <dt>Leader</dt>${leader ? chosen('leader', leader) : empty}
        <dt>Lore</dt>${lore.map(pick => chosen('lore', pick)).join('')}${empty.repeat(limitOf(draft, 'lore') - lore.length)}
      </dl>
    </div>`;
}

function shareView(draft, link) {
  const player = currentPlayer(draft);
  const [title, message] = isComplete(draft)
    ? ['Draft complete', `Everyone holds a leader and ${loreCount(draft.options.lore)}. Share this link so the others can open the finished board — or just bring the roster to the table.`]
    : draft.picks.length === 0
      ? [`Turn order: ${draft.names.join(', ')}`, `${draft.names[0]} has initiative, so drafting runs the other way and ${player} picks first. Send this link to ${player} to start.`]
      : [`Share this link with ${player}`, `Your pick is baked into it. ${player} opens the link and the board comes back exactly as you left it.`];
  return `
    <div class="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <button class="x" data-action="close-share" aria-label="Close">×</button>
        <h2 id="share-title">${esc(title)}</h2>
        <p>${esc(message)}</p>
        <span class="link">${esc(link)}</span>
        <div class="actions">
          <button class="solid" data-action="copy-link">Copy link</button>
          <button class="ghost" data-action="close-share">Look at the board</button>
        </div>
      </div>
    </div>`;
}

function boardView(state, link) {
  const { draft } = state;
  const snake = draft.options.order === 'snake';
  return `
    <header>
      <div>
        <h1>Arcs draft</h1>
        <p class="sub">${esc(draft.names[0])} has initiative, so the draft runs counterclockwise from ${esc(pickOrder(draft)[0])}${snake ? ' and reverses direction each round' : ''}. One card per turn until everyone holds a leader and ${loreCount(draft.options.lore)}.</p>
        <p class="variants">${esc(optionsSummary(draft.options))}</p>
      </div>
      <div class="header-actions">
        <button class="ghost" data-action="show-share">Show the link</button>
        <button class="ghost" data-action="open-screen">Open another link</button>
      </div>
    </header>
    <div class="banner">
      <span class="turn">${isComplete(draft) ? 'All picks made' : `${esc(currentPlayer(draft))}’s turn`}</span>
      <span class="turn-note">${esc(turnNote(draft, state.justPicked))}</span>
    </div>
    <div class="rail">${railView(draft)}</div>
    ${cardsView(state)}
    <div class="roster">${draft.names.map(name => seatView(draft, name)).join('')}</div>
    <footer class="foot">
      <span class="note">Turn order at the table: ${draft.names.map(esc).join(', ')}.</span>
      <button class="ghost" data-action="new-game">New game</button>
      ${creditsView()}
    </footer>
    ${state.shareOpen ? shareView(draft, link) : ''}`;
}

/* ---------- controller ---------- */

async function copyText(win, text) {
  try {
    await win.navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = win.document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0';
      win.document.body.append(area);
      area.select();
      const copied = win.document.execCommand('copy');
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

export function mount(root, win = window) {
  const state = {
    screen: 'setup',
    draft: null,
    justPicked: false,
    shareOpen: false,
    peek: null,
    problem: null,
    names: EMPTY_NAMES(),
    options: { ...DEFAULT_OPTIONS },
  };

  const linkFor = draft => `${win.location.origin}${win.location.pathname}#${encodeDraft(draft)}`;

  function render(focusSelector) {
    root.innerHTML = state.screen === 'board' ? boardView(state, linkFor(state.draft))
      : state.screen === 'open' ? openView(state)
      : setupView(state);
    if (focusSelector) root.querySelector(focusSelector)?.focus();
  }

  function showBoard(draft, { shareOpen = false, justPicked = false } = {}) {
    Object.assign(state, { screen: 'board', draft, shareOpen, justPicked, peek: null, problem: null });
    win.history.replaceState(null, '', `#${encodeDraft(draft)}`);
    render();
  }

  const actions = {
    start() {
      const { draft, problem } = dealDraft(state.names, state.options);
      if (problem) {
        state.problem = problem;
        render();
      } else {
        showBoard(draft, { shareOpen: true });
      }
    },
    'add-player'() {
      if (state.names.length >= MAX_PLAYERS) return;
      state.names.push('');
      state.problem = null;
      render(`input[data-name="${state.names.length - 1}"]`);
    },
    'remove-player'(button) {
      if (state.names.length <= MIN_PLAYERS) return;
      state.names.splice(Number(button.dataset.index), 1);
      state.problem = null;
      render();
    },
    'open-screen'() {
      Object.assign(state, { screen: 'open', draft: null, shareOpen: false, justPicked: false, problem: null });
      render('#code-input');
    },
    'load-code'() {
      const draft = decodeDraft(root.querySelector('#code-input')?.value);
      if (draft) {
        showBoard(draft);
      } else {
        state.problem = BAD_LINK;
        render('#code-input');
      }
    },
    'new-game'() {
      if (state.draft && !win.confirm('Start a new game? The current draft stays reachable through its link.')) return;
      Object.assign(state, { screen: 'setup', draft: null, shareOpen: false, justPicked: false, problem: null, names: EMPTY_NAMES() });
      win.history.replaceState(null, '', win.location.pathname);
      render('input[data-name]');
    },
    pick(button) {
      const { kind } = button.dataset;
      const slot = Number(button.dataset.slot);
      if (state.justPicked || !canPick(state.draft, kind, slot)) return;
      showBoard(applyPick(state.draft, kind, slot), { shareOpen: true, justPicked: true });
    },
    async 'copy-link'(button) {
      const copied = await copyText(win, linkFor(state.draft));
      button.textContent = copied ? 'Copied' : 'Copy it from above';
      if (copied) win.setTimeout(() => { button.textContent = 'Copy link'; }, 1800);
    },
    peek(card) {
      const key = `${card.dataset.kind}:${card.dataset.slot}`;
      state.peek = state.peek === key ? null : key;
      render(`[data-action="peek"][data-kind="${card.dataset.kind}"][data-slot="${card.dataset.slot}"]`);
    },
    'show-share'() {
      state.shareOpen = true;
      render('.modal .solid');
    },
    'close-share'() {
      state.shareOpen = false;
      render();
    },
  };

  root.addEventListener('click', event => {
    if (event.target.classList.contains('backdrop')) {
      actions['close-share']();
      return;
    }
    const control = event.target.closest('[data-action]');
    if (control && root.contains(control)) actions[control.dataset.action]?.(control);
  });

  root.addEventListener('input', event => {
    const index = event.target.dataset.name;
    if (index !== undefined) state.names[Number(index)] = event.target.value;
  });

  root.addEventListener('change', event => {
    const key = event.target.dataset.option;
    if (!key) return;
    state.options = { ...state.options, [key]: key === 'lore' ? Number(event.target.value) : event.target.value };
    state.problem = null;
    render(`select[data-option="${key}"]`);
  });

  root.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-action="peek"]')) {
      event.preventDefault();
      actions.peek(event.target);
      return;
    }
    if (event.key !== 'Enter') return;
    if (event.target.matches('input[data-name]')) actions.start();
    else if (event.target.id === 'code-input') actions['load-code']();
  });

  win.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state.shareOpen) actions['close-share']();
  });

  win.addEventListener('hashchange', () => {
    const draft = decodeDraft(win.location.hash);
    if (draft) showBoard(draft);
  });

  const linked = decodeDraft(win.location.hash);
  if (linked) showBoard(linked);
  else render('input[data-name]');
}
