(function () {
  'use strict';

  var CH = window.CHAPTERS || [];
  var TZ = 'Europe/London';
  var ALT = {
    1: 'Two suitcases burst open in a hotel room at night: Oscar pops out of the orange one with his football, Samuel out of the teal one in his colander helmet with his sword raised, and Daddy clutches his cheeks. Through the window, the Golden Gate Bridge glows in the fog.',
    2: 'Daddy waves at a laptop where Mummy, Victoria and baby Rosie are on a video call. Under the curtains, two pairs of small feet are poking out. Outside the window, the bridge is gone.',
    3: 'A very tall “Daddy” in a long coat and hat takes a video meeting with Brenda, with a small pair of trainers peeping out underneath. Across the room, the real Daddy peers through a magnifying glass at a tiny orange bolt stamped GG 1937.',
    4: 'A red cable car rattles down a steep San Francisco hill past rows of painted houses, with Big Lou, Daddy, Oscar and Samuel hanging on. The bay glitters below.',
    5: 'Red lanterns glow over a Chinatown street at dusk. In the golden window of the Golden Fortune Bakery, May stands behind a heap of fortune cookies, while Oscar, Samuel and Daddy look in.',
    6: 'Sea lions lounge on wooden floats at Pier 39. The biggest of all, the Admiral, wears a little navy hat and barks at the boys on the pier. Alcatraz sits out in the bay.',
    7: 'Under a big moon and a sky full of stars, Daddy rows a little boat across the dark bay towards Alcatraz, where one window is lit.',
    8: 'In a moonlit hall full of glass cabinets holding a tiny Big Ben, a tiny Eiffel Tower and a tiny Leaning Tower of Pisa, the Golden Gate Bridge sits on a red velvet cushion. Professor Pinch in his purple coat points the glowing Shrink-u-lator at Samuel, who charges with his sword.',
    9: 'Down at mouse height, tiny Samuel rides a T. rex skeleton across the floorboards towards a giant brass key, while an enormous ginger cat watches.',
    10: 'Daddy stands at a glowing green screen of code where a minus has been crossed out and changed to a plus. Oscar kicks his football in a perfect arc towards Professor Pinch. Jack-o’-lanterns grin and an orange Halloween moon shines through the bars.',
    11: 'The Golden Gate Bridge is back, glowing orange in the sunrise. Fireboats spray fountains, confetti flies, an aeroplane heads for home, and the three of them wave from the hillside.'
  };

  /* ---------- storage: cookies and localStorage, each optional ---------- */
  function getCookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }
  function setCookie(name, value) {
    try { document.cookie = name + '=' + encodeURIComponent(value) + '; max-age=31536000; path=/; SameSite=Lax'; } catch (e) {}
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function store(k, v) { setCookie(k, v); lsSet(k, v); }
  function load(k) { var c = getCookie(k); return c !== null ? c : lsGet(k); }

  function readSet() {
    var s = {};
    [getCookie('gbr_read'), lsGet('gbr_read')].forEach(function (v) {
      (v || '').split(',').forEach(function (x) { if (x) s[x] = true; });
    });
    return s;
  }
  function saveRead(s) { store('gbr_read', Object.keys(s).join(',')); }

  var state = {
    edition: load('gbr_edition') === 'samuel' ? 'samuel' : 'oscar',
    unlockAll: load('gbr_unlock') === '1',
    read: readSet(),
    current: null
  };

  /* ---------- dates in UK time ---------- */
  function londonParts(d) {
    var parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(d || new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return parts;
  }
  function londonToday() { var p = londonParts(); return p.year + '-' + p.month + '-' + p.day; }
  function isOpen(ch) { return state.unlockAll || ch.date <= londonToday(); }
  function latestOpen() {
    var last = null;
    CH.forEach(function (c) { if (isOpen(c)) last = c; });
    return last;
  }
  function niceDate(iso, opts) {
    var d = new Date(iso + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', Object.assign({ timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }, opts || {}));
  }
  function untilMidnight() {
    var p = londonParts();
    var secs = 86400 - (+p.hour * 3600 + +p.minute * 60 + +p.second);
    var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
    return (h ? h + (h === 1 ? ' hour ' : ' hours ') : '') + m + (m === 1 ? ' minute' : ' minutes');
  }
  function daysUntil(iso) {
    var a = Date.parse(londonToday() + 'T00:00:00Z'), b = Date.parse(iso + 'T00:00:00Z');
    return Math.round((b - a) / 86400000);
  }

  /* ---------- text ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function inline(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
  var ORNAMENT = '<div class="break" aria-hidden="true"><svg viewBox="0 0 120 26"><path d="M6 20h108" stroke="currentColor" stroke-width="1.6"/><path d="M34 22V4M42 22V4M78 22V4M86 22V4M33 7h10M77 7h10" stroke="currentColor" stroke-width="2.2"/><path d="M6 18Q20 16 38 5Q60 26 82 5Q100 16 114 18" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></div>';
  function prose(paras) {
    return paras.map(function (p) { return p.trim() === '~' ? ORNAMENT : '<p>' + inline(p) + '</p>'; }).join('');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function words(paras) { return paras.join(' ').split(/\s+/).length; }

  /* ---------- rendering ---------- */
  var shelf = document.getElementById('shelf');
  var main = document.getElementById('chapter');

  function renderEdition() {
    ['oscar', 'samuel'].forEach(function (ed) {
      var b = document.getElementById('ed-' + ed);
      b.setAttribute('aria-checked', String(state.edition === ed));
      b.tabIndex = state.edition === ed ? 0 : -1;
    });
    document.body.classList.toggle('ed-oscar', state.edition === 'oscar');
    document.body.classList.toggle('ed-samuel', state.edition === 'samuel');
  }

  function renderShelf() {
    var newest = latestOpen();
    shelf.innerHTML = CH.map(function (c) {
      var open = isOpen(c), cur = state.current === c.day, read = state.read[c.day];
      var date = niceDate(c.date, { weekday: 'short', day: 'numeric', month: 'short' });
      var badge = read ? '<span class="tag-star" aria-label="read">★</span>' : '';
      var fresh = !read && open && newest && newest.day === c.day && !state.unlockAll ? '<span class="tag-new">new!</span>' : '';
      var title = open ? esc(c.title) : 'Opens ' + niceDate(c.date, { weekday: 'long', day: undefined, month: undefined });
      return '<li><button type="button" class="tag" data-day="' + c.day + '" data-state="' + (open ? 'open' : 'locked') + '"' + (cur ? ' aria-current="true"' : '') + '>' +
        '<span class="tag-date">' + date + '</span><span class="tag-day">Day ' + c.day + '</span><span class="tag-title">' + title + '</span>' + badge + '</button></li>';
    }).join('');
  }

  function renderChapter(day, focus) {
    var c = CH[day - 1];
    if (!c) return;
    state.current = day;
    var prev = CH[day - 2], next = CH[day];
    var html;
    if (!isOpen(c)) {
      var n = daysUntil(c.date);
      html = '<div class="sealed"><div class="seal" aria-hidden="true">' + c.day + '</div>' +
        '<h2>Still packed in Daddy’s suitcase</h2>' +
        '<p>Day ' + c.day + ' opens at midnight (UK time) on ' + niceDate(c.date) + '.</p>' +
        (n === 1 ? '<p class="countdown">Only ' + untilMidnight() + ' to go!</p>' : '<p class="countdown">' + n + ' more sleeps.</p>') +
        '</div>';
    } else {
      var v = c[state.edition];
      var mins = state.edition === 'oscar' ? Math.max(1, Math.round(words(v.paragraphs) / 230)) : Math.max(1, Math.round(words(v.paragraphs) / 150));
      var isLast = c.day === CH.length;
      var paras = v.paragraphs.filter(function (p) { return !/^\*\*THE END\.?\*\*$/i.test(p.trim()); });
      html =
        '<img class="plate" src="images/plate-' + pad(c.day) + '.jpg" width="1800" height="1125" alt="' + esc(ALT[c.day] || c.title) + '">' +
        '<div class="chapter-head">' +
          '<p class="chapter-eyebrow">Day ' + c.day + ' · ' + niceDate(c.date) + '</p>' +
          '<h2 class="chapter-title">' + esc(c.title) + '</h2>' +
          '<p class="read-time">' + (state.edition === 'oscar' ? 'About ' + mins + ' minutes of reading' : 'About ' + mins + (mins === 1 ? ' minute' : ' minutes') + ' to read aloud') + '</p>' +
        '</div>' +
        '<div class="prose">' + prose(paras) +
          '<p class="continued">' + (isLast ? 'The End.' : 'To be continued…') + '</p></div>' +
        (state.edition === 'oscar' ?
          '<figure class="map"><a class="map-link" href="images/map-' + pad(c.day) + '.jpg" target="_blank" rel="noopener"><img src="images/map-' + pad(c.day) + '.jpg" width="1800" height="1125" loading="lazy" alt="Oscar’s watercolour map of San Francisco for day ' + c.day + ', showing the route taken so far."></a>' +
          '<figcaption>Oscar’s map: where we went on Day ' + c.day + '. Tap it to see it bigger.</figcaption></figure>' : '') +
        '<div class="after">' +
          '<section class="puzzle" aria-labelledby="pz-title">' +
            '<div class="puzzle-head"><span>The Grand Magnolia Hotel</span><span>Room 1937</span></div>' +
            '<h3 id="pz-title">' + (isLast ? 'The very last puzzle' : 'Tonight’s puzzle') + '</h3>' +
            '<p class="puzzle-q">' + inline(v.puzzle.q) + '</p>' +
            '<button type="button" class="btn btn-answer" id="show-answer" aria-expanded="false" aria-controls="answer">Show the answer</button>' +
            '<p class="puzzle-a" id="answer" hidden><b>Answer:</b> ' + inline(v.puzzle.a) + '</p>' +
          '</section>' +
          '<div class="actions"><button type="button" class="btn btn-read" id="mark-read" aria-pressed="' + (state.read[c.day] ? 'true' : 'false') + '">' + readLabel(c.day) + '</button></div>' +
          '<nav class="pager" aria-label="Other chapters">' +
            '<button type="button" data-day="' + (prev ? prev.day : '') + '"' + (prev ? '' : ' disabled') + '><small>← Day ' + (prev ? prev.day : '') + '</small><span>' + (prev ? esc(prev.title) : '') + '</span></button>' +
            '<button type="button" data-day="' + (next ? next.day : '') + '"' + (next ? '' : ' disabled') + '><small>Day ' + (next ? next.day : '') + ' →</small><span>' + (next ? (isOpen(next) ? esc(next.title) : 'Opens ' + niceDate(next.date, { month: undefined, day: undefined })) : '') + '</span></button>' +
          '</nav>' +
        '</div>';
    }
    main.innerHTML = html;
    renderShelf();
    try { history.replaceState(null, '', '#day-' + day); } catch (e) {}
    if (focus) {
      main.focus({ preventScroll: true });
      main.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }
  function readLabel(day) { return state.read[day] ? '★ We’ve read this one' : '☆ We read tonight’s chapter'; }

  /* ---------- events ---------- */
  document.querySelector('.edition').addEventListener('click', function (e) {
    var b = e.target.closest('[data-edition]');
    if (!b) return;
    state.edition = b.getAttribute('data-edition');
    store('gbr_edition', state.edition);
    renderEdition();
    renderChapter(state.current, false);
  });
  document.querySelector('.edition').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    var other = state.edition === 'oscar' ? 'samuel' : 'oscar';
    document.getElementById('ed-' + other).click();
    document.getElementById('ed-' + other).focus();
  });
  shelf.addEventListener('click', function (e) {
    var b = e.target.closest('[data-day]');
    if (b) renderChapter(+b.getAttribute('data-day'), true);
  });
  main.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'show-answer') {
      var a = document.getElementById('answer');
      a.hidden = !a.hidden;
      t.setAttribute('aria-expanded', String(!a.hidden));
      t.textContent = a.hidden ? 'Show the answer' : 'Hide the answer';
    } else if (t.id === 'mark-read') {
      var d = state.current;
      if (state.read[d]) delete state.read[d]; else state.read[d] = true;
      saveRead(state.read);
      t.setAttribute('aria-pressed', String(!!state.read[d]));
      t.textContent = readLabel(d);
      renderShelf();
    } else if (t.hasAttribute('data-day') && t.getAttribute('data-day')) {
      renderChapter(+t.getAttribute('data-day'), true);
    }
  });

  /* grown-ups' corner: press and hold the little key */
  var key = document.getElementById('grownups-key'), sheet = document.getElementById('grownups'), timer = null;
  function openSheet() {
    sheet.hidden = false;
    document.getElementById('gu-status').textContent = state.unlockAll ? 'Every chapter is open on this device.' : '';
    document.getElementById('gu-unlock').focus();
  }
  function startHold(e) {
    if (e.type === 'touchstart') e.preventDefault();
    key.classList.add('holding');
    timer = setTimeout(function () { key.classList.remove('holding'); openSheet(); }, 1500);
  }
  function endHold() { clearTimeout(timer); key.classList.remove('holding'); }
  key.addEventListener('mousedown', startHold);
  key.addEventListener('touchstart', startHold, { passive: false });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) { key.addEventListener(ev, endHold); });
  key.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.shiftKey) openSheet(); });
  key.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.getElementById('gu-unlock').addEventListener('click', function () {
    state.unlockAll = true; store('gbr_unlock', '1');
    document.getElementById('gu-status').textContent = 'Every chapter is open on this device.';
    renderChapter(state.current, false);
  });
  document.getElementById('gu-lock').addEventListener('click', function () {
    state.unlockAll = false; store('gbr_unlock', '0');
    document.getElementById('gu-status').textContent = 'Back to one chapter a night.';
    var c = CH[state.current - 1];
    renderChapter(isOpen(c) ? state.current : (latestOpen() || CH[0]).day, false);
  });
  document.getElementById('gu-reset').addEventListener('click', function () {
    state.read = {}; saveRead(state.read);
    document.getElementById('gu-status').textContent = 'Reading stars cleared.';
    renderChapter(state.current, false);
  });
  function closeSheet() { sheet.hidden = true; key.focus(); }
  document.getElementById('gu-close').addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  /* ---------- start ---------- */
  renderEdition();
  var m = /^#day-(\d+)$/.exec(location.hash || '');
  var want = m ? +m[1] : null;
  var start = (want && CH[want - 1] && isOpen(CH[want - 1])) ? want : (latestOpen() || CH[0]).day;
  renderChapter(start, false);

  // if the page stays open past midnight, let the new chapter arrive
  var lastDay = londonToday();
  setInterval(function () {
    var t = londonToday();
    if (t !== lastDay) { lastDay = t; renderChapter((latestOpen() || CH[0]).day, false); }
  }, 60000);
})();
