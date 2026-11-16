// Keepsakes: folded notes hidden among the partner's books, and a flower pressed in a book
// they are reading. Both travel in each person's own record, so they need syncing switched on.
'use strict';
(function () {
  const QUOTES = [
    ['Whatever our souls are made of, his and mine are the same.', 'Emily Brontë, Wuthering Heights'],
    ['He’s more myself than I am.', 'Emily Brontë, Wuthering Heights'],
    ['You pierce my soul. I am half agony, half hope.', 'Jane Austen, Persuasion'],
    ['If I loved you less, I might be able to talk about it more.', 'Jane Austen, Emma'],
    ['I ask you to pass through life at my side—to be my second self, and best earthly companion.', 'Charlotte Brontë, Jane Eyre'],
    ['Doubt thou the stars are fire; doubt that the sun doth move; doubt truth to be a liar; but never doubt I love.', 'William Shakespeare, Hamlet'],
    ['My bounty is as boundless as the sea, my love as deep; the more I give to thee, the more I have, for both are infinite.', 'William Shakespeare, Romeo and Juliet'],
    ['Love is not love which alters when it alteration finds.', 'William Shakespeare, Sonnet 116'],
    ['Shall I compare thee to a summer’s day? Thou art more lovely and more temperate.', 'William Shakespeare, Sonnet 18'],
    ['How do I love thee? Let me count the ways.', 'Elizabeth Barrett Browning'],
    ['Grow old along with me! The best is yet to be.', 'Robert Browning'],
    ['I am my beloved’s, and my beloved is mine.', 'Song of Songs 6:3'],
    ['Who ever loved that loved not at first sight?', 'Christopher Marlowe, Hero and Leander'],
    ['She walks in beauty, like the night of cloudless climes and starry skies.', 'Lord Byron'],
    ['For God’s sake hold your tongue, and let me love.', 'John Donne'],
    ['I cannot exist without you.', 'John Keats, to Fanny Brawne'],
    ['O my Luve is like a red, red rose that’s newly sprung in June.', 'Robert Burns']
  ];
  const MAX_WORDS = 200, WEEK = 7 * 24 * 3600 * 1000;
  const SCRIPT = "'La Belle Aurore','Snell Roundhand','Apple Chancery',cursive";
  const FLOWER = `<svg viewBox="0 0 60 92" aria-hidden="true"><path d="M30 34 C31 52 27 70 31 90" fill="none" stroke="#7C8A63" stroke-width="2" stroke-linecap="round"/><path d="M30 62 C40 54 47 56 50 50 C44 62 38 66 30 66Z" fill="#7C8A63"/><path d="M29 74 C20 68 14 70 11 64 C16 76 22 78 29 78Z" fill="#6B7955"/>${[0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="30" cy="12" rx="7.5" ry="12" transform="rotate(${a} 30 26)" fill="#B5656B" stroke="#8E474F" stroke-width=".8" opacity=".93"/>`).join('')}<circle cx="30" cy="26" r="5.5" fill="#B08D57"/><circle cx="30" cy="26" r="2.2" fill="#8A6A3C"/></svg>`;
  const PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h10l4 4v12H5z"></path><path d="M15 4v4h4M9 13h6M9 16.5h4"></path></svg>';

  const style = document.createElement('style');
  style.textContent = `
.letter{position:relative;width:9px;height:88px;border-radius:1px 1px 0 0;background:linear-gradient(90deg,#CFC3A6,#F1E8D4 35%,#E4D9C2 60%,#BDB194);transform:rotate(var(--tilt,2deg));transform-origin:50% 100%;box-shadow:0 0 3px rgba(0,0,0,.5);margin:0 1px}
.letter::before{content:"";position:absolute;inset:-4px -7px 0}
.letter::after{content:"";position:absolute;left:4px;top:0;bottom:0;width:1px;background:rgba(60,40,20,.25)}
.letter.read{height:66px;filter:brightness(.82)}
#letterview{z-index:30;display:flex;flex-direction:column;align-items:center}
#lv-stage{flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center;perspective:1400px}
#lv-paper{position:relative;transform-style:preserve-3d;transform:translate(var(--tx,0px),var(--ty,0px)) scale(var(--sc,1));opacity:var(--op,1)}
#lv-paper .q{position:absolute;width:50%;height:50%;transform-style:preserve-3d}
#lv-paper .f,#lv-paper .k{position:absolute;inset:0;overflow:hidden;-webkit-backface-visibility:hidden;backface-visibility:hidden;background:#EFE6D2}
#lv-paper .k{transform:rotateY(180deg);background:linear-gradient(135deg,#E6DBC4,#D8CCB2)}
#lv-paper .tl{left:0;top:0}
#lv-paper .bl{left:0;top:50%;transform-origin:50% 0 3px;transform:rotateX(var(--a1,0deg))}
#lv-paper .col{position:absolute;left:50%;top:0;width:50%;height:100%;transform-style:preserve-3d;transform-origin:0 50% 1px;transform:rotateY(calc(-1 * var(--a2,0deg)))}
#lv-paper .col .q{left:0;width:100%}
#lv-paper .col .tr{top:0}
#lv-paper .col .br{top:50%;transform-origin:50% 0 -1px;transform:rotateX(calc(-1 * var(--a1,0deg)))}
#lv-paper .tl .f{box-shadow:inset -1px -1px 0 rgba(60,40,20,.10)}
#lv-paper .tr .f{box-shadow:inset 1px -1px 0 rgba(60,40,20,.10)}
#lv-paper .bl .f{box-shadow:inset -1px 1px 0 rgba(60,40,20,.10)}
#lv-paper .br .f{box-shadow:inset 1px 1px 0 rgba(60,40,20,.10)}
.lsheet{position:absolute;box-sizing:border-box;padding:26px 22px 44px;color:#2B2118;font-family:${SCRIPT}}
.lsheet .ink{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.38}
.lsheet .sig{position:absolute;right:22px;bottom:16px;font-size:15px;color:#5A4A3A}
#lv-actions{flex:none;display:flex;gap:22px;align-items:center;justify-content:center;flex-wrap:wrap;padding:6px 20px calc(env(safe-area-inset-bottom,0px) + 22px);min-height:70px;opacity:0;transition:opacity .3s}
#letterview.ready #lv-actions{opacity:1}
#lettercompose{z-index:30;display:flex;flex-direction:column;align-items:center;gap:14px;padding:calc(env(safe-area-inset-top,0px) + 18px) max(18px,env(safe-area-inset-right,0px)) 18px max(18px,env(safe-area-inset-left,0px));overflow-y:auto}
#lc-text{width:min(340px,100%);height:min(46vh,430px);resize:none;border:0;outline:none;border-radius:2px;background:#EFE6D2;color:#2B2118;font-family:${SCRIPT};font-size:20px;line-height:1.4;padding:22px 20px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#lc-text::placeholder{color:#8C7B65}
#lc-count{font-size:15px;color:var(--dust);font-style:italic}
.flower{width:54px;height:83px;flex:none}
.flower svg{width:100%;height:100%;display:block;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45))}
.flowerbox{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.flowerbox p{font-style:italic;color:var(--dust);font-size:16px;max-width:30ch}
@keyframes flowerfall{0%{transform:translateY(-70px) rotate(-50deg) scale(.3);opacity:0}55%{transform:translateY(6px) rotate(14deg) scale(1.08);opacity:1}100%{transform:rotate(-8deg) scale(1);opacity:1}}
.flowerbox.fresh .flower{width:74px;height:113px;animation:flowerfall 1.5s .75s cubic-bezier(.2,.7,.3,1) both}
.flowerbox .flower{transform:rotate(-8deg)}
.btn .flower{width:20px;height:31px;transform:none}
#flowernotice{z-index:40;display:flex;align-items:center;justify-content:center;padding:24px}
#fn-card{width:min(360px,100%);background:var(--walnut);border:1px solid rgba(176,141,87,.55);border-radius:14px;padding:28px 24px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;transform:translateY(16px);opacity:0;transition:transform .5s,opacity .5s}
#flowernotice.open #fn-card{transform:none;opacity:1}
#fn-card .emoji{font-size:54px;line-height:1}
#fn-card blockquote{margin:0;font-size:22px;font-style:italic;line-height:1.35;text-wrap:balance}
#fn-card cite{font-style:normal;font-size:14px;color:var(--dust);letter-spacing:.5px}
#fn-card .hint2{color:var(--dust);font-style:italic}`;
  document.head.appendChild(style);

  document.body.insertAdjacentHTML('beforeend', `
<div id="letterview" class="overlay" hidden role="dialog" aria-modal="true" aria-label="A folded note">
  <div id="lv-stage"><div id="lv-paper"></div></div>
  <div id="lv-actions"></div>
</div>
<div id="lettercompose" class="overlay solid" hidden role="dialog" aria-modal="true" aria-labelledby="lc-h">
  <div class="bar" style="width:100%;padding-top:0;border-bottom:0"><button class="link quiet" data-act="letter-cancel">Close</button><div class="mid" id="lc-h">A note to hide</div><span style="width:60px"></span></div>
  <label class="eyebrow" for="lc-text" id="lc-label">Write it by hand</label>
  <textarea id="lc-text" placeholder="Something only they should find…"></textarea>
  <div id="lc-count">0 of ${MAX_WORDS} words</div>
  <button class="btn solid" data-act="letter-send">Fold it and hide it</button>
</div>
<div id="flowernotice" class="overlay" hidden role="dialog" aria-modal="true" aria-labelledby="fn-who"><div id="fn-card"></div></div>`);

  /* ---------- shared data ---------- */
  const arr = v => Array.isArray(v) ? v : [];
  const soc = () => (window.librarySync && librarySync.signedIn()) ? librarySync.social() : null;
  const partnerName = s => (s && s.partnerName) || (state.partner && state.partner.ownerName) || 'your partner';
  const cleanLetter = l => ({id: String(l.id || ''), text: String(l.text || '').slice(0, 4000), at: String(l.at || '')});
  const cleanFlower = f => ({id: String(f.id || ''), at: String(f.at || ''), bookId: String(f.bookId || ''), q: Math.abs(Number(f.q) || 0) % QUOTES.length});
  function incomingLetters() {
    const s = soc(); if (!s) return [];
    const tossed = new Set(arr(s.me.tossed)), opened = new Set(arr(s.me.openedLetters));
    return arr(s.partner.letters).map(cleanLetter).filter(l => l.id && l.text && !tossed.has(l.id)).map(l => Object.assign(l, {opened: opened.has(l.id)}));
  }
  function incomingFlowers() {
    const s = soc(); if (!s) return [];
    const found = new Set(arr(s.me.foundFlowers));
    return arr(s.partner.flowers).map(cleanFlower).filter(f => f.id).map(f => Object.assign(f, {found: found.has(f.id), target: targetOf(f)}));
  }
  // The book a flower sits in: the one chosen, or another being read if that one is gone.
  function targetOf(f) {
    const mine = state.mine.books.filter(b => b.owned);
    if (mine.some(b => b.id === f.bookId)) return f.bookId;
    const reading = mine.filter(b => b.status === 'reading'), pool = reading.length ? reading : mine;
    return pool.length ? pool[hash(f.id) % pool.length].id : null;
  }
  const myFlowers = () => { const s = soc(); return s ? arr(s.me.flowers).map(cleanFlower) : []; };
  function nextFlowerAt() {
    const last = myFlowers().reduce((m, f) => Math.max(m, Date.parse(f.at) || 0), 0);
    return last ? last + WEEK : 0;
  }
  const words = t => (t.match(/\S+/g) || []).length;
  function capWords(t) {
    let n = 0, end = t.length; const re = /\S+/g; let m;
    while ((m = re.exec(t))) { n++; if (n === MAX_WORDS) { end = re.lastIndex; break; } }
    return words(t) > MAX_WORDS ? t.slice(0, end) : t;
  }
  const busy = () => !!document.querySelector('.overlay:not([hidden])');

  /* ---------- folded notes: reading ---------- */
  const lv = {id: null, W: 0, H: 0, raf: 0, guard: 0};
  function tween(ms, fn, done) {
    cancelAnimationFrame(lv.raf); clearTimeout(lv.guard);
    const t0 = performance.now(), ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    let over = false;
    const end = () => { if (over) return; over = true; cancelAnimationFrame(lv.raf); clearTimeout(lv.guard); fn(1); if (done) done(); };
    const step = now => { const p = clamp((now - t0) / ms, 0, 1); fn(ease(p)); if (p < 1) lv.raf = requestAnimationFrame(step); else end(); };
    fn(0); lv.raf = requestAnimationFrame(step); lv.guard = setTimeout(end, ms + 400);
  }
  function pose(a1, a2, sc, op) {
    // Keep whatever part of the sheet is showing centred: a quarter, then a half, then all of it.
    const p = $('#lv-paper').style;
    p.setProperty('--a1', a1 + 'deg'); p.setProperty('--a2', a2 + 'deg');
    p.setProperty('--tx', (lv.W / 4) * (a2 / 180) + 'px'); p.setProperty('--ty', (lv.H / 4) * (a1 / 180) + 'px');
    p.setProperty('--sc', sc); p.setProperty('--op', op);
  }
  function openLetter(id) {
    const l = incomingLetters().find(x => x.id === id); if (!l || busy()) return;
    const s = soc();
    lv.id = id;
    lv.W = Math.floor(Math.min(340, window.innerWidth - 40) / 2) * 2; lv.H = Math.floor(lv.W * 1.34 / 2) * 2;
    const date = fmtDate(l.at);
    const inner = size => `<div class="ink" style="font-size:${size}px">${esc(l.text)}</div><div class="sig">${esc(partnerName(s))}${date ? ' · ' + esc(date) : ''}</div>`;
    // Shrink the handwriting until the whole note fits on the sheet.
    const probe = document.createElement('div');
    probe.className = "lsheet"; probe.style.cssText = `visibility:hidden;width:${lv.W}px;left:-9999px;top:0`;
    document.body.appendChild(probe);
    let size = 21;
    for (; size > 9; size -= 0.5) { probe.innerHTML = inner(size); if (probe.firstChild.offsetHeight <= lv.H - 70) break; }
    probe.remove();
    const face = (x, y) => `<div class="f"><div class="lsheet" style="width:${lv.W}px;height:${lv.H}px;left:${-x * lv.W / 2}px;top:${-y * lv.H / 2}px">${inner(size)}</div></div>`;
    const paper = $('#lv-paper');
    paper.style.width = lv.W + 'px'; paper.style.height = lv.H + 'px';
    paper.innerHTML = `<div class="q tl">${face(0, 0)}</div><div class="q bl">${face(0, 1)}<div class="k"></div></div>` +
      `<div class="col"><div class="q tr">${face(1, 0)}<div class="k"></div></div><div class="q br">${face(1, 1)}<div class="k"></div></div></div>`;
    $('#lv-actions').innerHTML = `<button class="btn" data-act="letter-close">Fold it away</button><button class="link danger" data-act="letter-toss">Throw it away</button>`;
    const view = $('#letterview');
    view.classList.remove('ready'); pose(180, 180, 0.6, 0);
    showOverlay(view); $('#app').classList.add('blurred');
    // Appear folded in quarters, open to halves, then to the full sheet.
    tween(280, t => pose(180, 180, 0.6 + 0.4 * t, t), () =>
      tween(800, t => pose(180 * (1 - t), 180, 1, 1), () =>
        tween(900, t => pose(0, 180 * (1 - t), 1, 1), () => { view.classList.add('ready'); const b = view.querySelector('[data-act="letter-close"]'); if (b) b.focus({preventScroll: true}); })));
    if (!l.opened && s) librarySync.patchMe({openedLetters: [...new Set([...arr(s.me.openedLetters), id])].slice(-300)}).catch(() => {});
  }
  function closeLetter(after) {
    const view = $('#letterview'); if (view.hidden) return;
    view.classList.remove('ready');
    const a2 = parseFloat($('#lv-paper').style.getPropertyValue('--a2')) || 0, a1 = parseFloat($('#lv-paper').style.getPropertyValue('--a1')) || 0;
    tween(420, t => pose(a1, a2 + (180 - a2) * t, 1, 1), () =>
      tween(380, t => pose(a1 + (180 - a1) * t, 180, 1, 1), () =>
        tween(200, t => pose(180, 180, 1 - 0.4 * t, 1 - t), () => {
          $('#app').classList.remove('blurred');
          hideOverlay(view, () => { lv.id = null; render(); if (after) after(); });
        })));
  }

  /* ---------- folded notes: writing ---------- */
  function openCompose() {
    const s = soc();
    if (!s) { toast('Sign in to leave notes for each other.'); return; }
    if (!s.hasPartner) { toast('Your partner has not opened their library yet.'); return; }
    $('#lc-label').textContent = `For ${partnerName(s)}, to find among the books`;
    $('#lc-text').value = ''; countWords();
    showOverlay($('#lettercompose')); $('#lc-text').focus();
  }
  function countWords() {
    const el = $('#lc-text'), capped = capWords(el.value);
    if (capped !== el.value) el.value = capped;
    $('#lc-count').textContent = `${words(el.value)} of ${MAX_WORDS} words`;
  }
  $('#lc-text').addEventListener('input', countWords);
  function sendLetter() {
    const s = soc(), text = capWords($('#lc-text').value).trim();
    if (!s) return;
    if (!text) { toast('Write something first.'); $('#lc-text').focus(); return; }
    const letters = [...arr(s.me.letters).map(cleanLetter), {id: uid(), text, at: new Date().toISOString()}].slice(-80);
    librarySync.patchMe({letters}).catch(() => {});
    hideOverlay($('#lettercompose'));
    toast(`Folded and hidden among ${partnerName(s)}’s books.`);
  }

  /* ---------- flowers ---------- */
  function sendFlower(bookId) {
    const s = soc(); if (!s) return;
    const wait = nextFlowerAt();
    if (wait > Date.now()) { toast(`One flower a week. The next can be sent on ${fmtDate(new Date(wait).toISOString())}.`); return; }
    const book = state.partner && state.partner.books.find(b => b.id === bookId); if (!book) return;
    const id = uid();
    const flowers = [...myFlowers(), {id, at: new Date().toISOString(), bookId, q: hash(id) % QUOTES.length}].slice(-60);
    librarySync.patchMe({flowers}).catch(() => {});
    refreshBook();
    toast(`Your flower is pressed inside ${book.title}.`);
  }
  function hintFor(book) {
    if (!book) return 'It is pressed inside one of your books.';
    const where = book.status === 'reading' ? 'a book you are reading' : 'one of your books';
    const author = book.author.trim().split(/\s+/).pop() || '';
    if (author && hash(book.id) % 2) return `It is pressed inside ${where}, written by someone whose surname begins with ${author[0].toUpperCase()}.`;
    return `It is pressed inside ${where}. Its title begins with “${book.title.trim()[0].toUpperCase()}”.`;
  }
  function noticed() { try { return JSON.parse(localStorage.getItem('libray.flowersNoticed')) || []; } catch (e) { return []; } }
  function checkNotices() {
    if (busy() || !soc()) return;
    const seen = noticed();
    const f = incomingFlowers().find(x => !x.found && !seen.includes(x.id)); if (!f) return;
    try { localStorage.setItem('libray.flowersNoticed', JSON.stringify([...seen, f.id].slice(-200))); } catch (e) {}
    const s = soc(), q = QUOTES[f.q], book = state.mine.books.find(b => b.id === f.target);
    $('#fn-card').innerHTML = `<div class="emoji" role="img" aria-label="A flower">🌸</div>` +
      `<blockquote>“${esc(q[0])}”</blockquote><cite>${esc(q[1])}</cite><div class="rule"></div>` +
      `<p id="fn-who">${esc(partnerName(s))} has hidden a flower in your library.</p><p class="hint2">${esc(hintFor(book))}</p>` +
      `<button class="btn solid" data-act="flower-notice-close">Go and look</button>`;
    showOverlay($('#flowernotice')); $('#app').classList.add('blurred');
    $('#fn-card button').focus({preventScroll: true});
  }
  setInterval(checkNotices, 2500);

  /* ---------- hooks used by the app ---------- */
  let pending = false;
  setInterval(() => { if (pending && !busy()) { pending = false; render(); } }, 700);
  window.keepsakes = {
    shelfLetters: () => incomingLetters(),
    visitButtonHTML: () => `<button class="icon" data-act="letter-new" aria-label="Leave a folded note">${PEN}</button>`,
    // Extra lines in the book view: a flower found in my own book, or the way to leave one in theirs.
    bookHTML(b, ro) {
      const s = soc(); if (!s) return '';
      if (!ro) {
        const here = incomingFlowers().filter(f => f.target === b.id); if (!here.length) return '';
        const fresh = here.some(f => !f.found), last = here[here.length - 1];
        return `<div class="flowerbox${fresh ? ' fresh' : ''}"><div class="flower">${FLOWER}</div>` +
          `<p>${fresh ? `${esc(partnerName(s))} hid a flower in this book.` : `A flower from ${esc(partnerName(s))}, pressed here ${esc(fmtDate(last.at))}.`}</p></div>`;
      }
      if (!b.owned || b.status !== 'reading') return '';
      const mineHere = myFlowers().filter(f => f.bookId === b.id), found = new Set(arr(s.partner.foundFlowers));
      let h = '';
      if (mineHere.length) {
        const f = mineHere[mineHere.length - 1];
        h += `<div class="flowerbox"><div class="flower">${FLOWER}</div><p>Your flower is pressed in this book. ${found.has(f.id) ? 'It has been found.' : 'It is waiting to be found.'}</p></div>`;
      }
      const wait = nextFlowerAt();
      h += wait > Date.now()
        ? `<p class="edition">One flower a week. The next can be hidden on ${esc(fmtDate(new Date(wait).toISOString()))}.</p>`
        : `<button class="btn" data-act="flower-send" data-id="${esc(b.id)}"><span class="flower">${FLOWER}</span> Hide a flower in this book</button>`;
      return h;
    },
    bookOpened(b, ro) {
      if (ro) return;
      const s = soc(); if (!s) return;
      const fresh = incomingFlowers().filter(f => f.target === b.id && !f.found).map(f => f.id); if (!fresh.length) return;
      // Counted as found once the flower has had time to fall out of the book.
      setTimeout(() => { const now = soc(); if (now) librarySync.patchMe({foundFlowers: [...new Set([...arr(now.me.foundFlowers), ...fresh])].slice(-300)}).catch(() => {}); }, 2600);
    },
    act(act, t) {
      switch (act) {
        case 'letter-open': openLetter(t.dataset.id); return true;
        case 'letter-close': closeLetter(); return true;
        case 'letter-toss': $('#lv-actions').innerHTML = `<span style="font-style:italic;color:var(--dust)">Throw this note away for good?</span><button class="link danger" data-act="letter-toss-yes">Throw it away</button><button class="link" data-act="letter-keep">Keep it</button>`; return true;
        case 'letter-keep': $('#lv-actions').innerHTML = `<button class="btn" data-act="letter-close">Fold it away</button><button class="link danger" data-act="letter-toss">Throw it away</button>`; return true;
        case 'letter-toss-yes': { const s = soc(), id = lv.id; if (s && id) librarySync.patchMe({tossed: [...new Set([...arr(s.me.tossed), id])].slice(-300)}).catch(() => {}); closeLetter(); return true; }
        case 'letter-new': openCompose(); return true;
        case 'letter-cancel': hideOverlay($('#lettercompose')); return true;
        case 'letter-send': sendLetter(); return true;
        case 'flower-send': sendFlower(t.dataset.id); return true;
        case 'flower-notice-close': $('#app').classList.remove('blurred'); hideOverlay($('#flowernotice')); return true;
      }
      return false;
    },
    // Called whenever either person's record changes.
    refresh() { if (busy()) pending = true; else render(); checkNotices(); },
    _quotes: QUOTES
  };
  render();
})();
