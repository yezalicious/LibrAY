// LibrAY syncing through Firebase. Loaded only when firebase-config.js holds a project.
// Each person's books live under users/{their id}/books; the partner's are read live.
// The phone's own copy stays the one the app draws from, so it works offline as before.
'use strict';
(function () {
  const S = {
    auth: null, db: null, user: null, ready: false, loading: true,
    synced: new Map(),      // book id -> last JSON known to match the cloud
    nameSynced: null,       // owner name last written to the cloud
    partnerUid: null, partnerName: '', partnerBooks: new Map(),
    stop: [],               // listeners to detach on sign-out
    meDoc: {}, partnerDoc: {}, mePending: 0
  };
  const ser = b => JSON.stringify(Object.assign({}, cleanBook(b), {updatedAt: undefined}));
  const now = () => new Date().toISOString();

  function redraw() {
    // Never redraw under an open book: the shelf is behind it and the spine is hidden mid-animation.
    if ($('#bookview').hidden) render(); else S.pending = true;
  }
  new MutationObserver(() => { if (S.pending && $('#bookview').hidden) { S.pending = false; render(); } })
    .observe($('#bookview'), {attributes: true, attributeFilter: ['hidden']});

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src; el.onload = resolve; el.onerror = () => { el.remove(); reject(new Error('load ' + src)); };
      document.body.appendChild(el);
    });
  }

  async function boot() {
    try {
      if (!window.firebase) {
        await loadScript('firebase/firebase-app-compat.js');
        await loadScript('firebase/firebase-auth-compat.js');
        await loadScript('firebase/firebase-firestore-compat.js');
      }
    } catch (e) {
      // First launch with no connection: try again once online.
      S.loading = false;
      if (!state.mine.ownerName) showOverlay($('#welcome'));
      window.addEventListener('online', boot, {once: true});
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(window.LIBRAY_FIREBASE);
    S.auth = firebase.auth();
    S.db = firebase.firestore();
    try { await S.db.enablePersistence({synchronizeTabs: true}); } catch (e) { /* another tab owns it, or unsupported: works online only */ }
    S.auth.onAuthStateChanged(onUser);
  }

  function skipped() { try { return localStorage.getItem('libray.syncSkipped') === '1'; } catch (e) { return false; } }

  function onUser(user) {
    S.loading = false;
    detach();
    S.user = user;
    if (!user) {
      if (!skipped()) openSignin();
      else if (!state.mine.ownerName) showOverlay($('#welcome'));
      render();
      return;
    }
    try { localStorage.removeItem('libray.syncSkipped'); } catch (e) {}
    if (!$('#signin').hidden) hideOverlay($('#signin'));
    const users = S.db.collection('users'), mine = users.doc(user.uid);

    // My own books: first snapshot merges, later ones apply changes from elsewhere.
    let first = true;
    S.stop.push(mine.collection('books').onSnapshot(snap => {
      if (first) { first = false; mergeFirst(snap); return; }
      applyChanges(snap);
    }, err => syncError(err)));

    // Who else is here: the partner is the other person with a user record.
    S.stop.push(users.onSnapshot(snap => {
      S.usersSeen = true;
      const me = snap.docs.find(d => d.id === user.uid);
      if (me) S.nameSynced = String(me.data().ownerName || '') || null;
      if (me && !state.mine.ownerName && me.data().ownerName) {
        state.mine.ownerName = String(me.data().ownerName).slice(0, 80);
        S.nameSynced = state.mine.ownerName;
        store('libray.mine', state.mine);
        if (!$('#welcome').hidden) hideOverlay($('#welcome'));
        redraw();
      }
      if (!state.mine.ownerName && S.ready) openWelcomeIfIdle();
      push();
      const other = snap.docs.find(d => d.id !== user.uid);
      // Notes and flowers travel in each person's own record.
      if (me && !S.mePending) S.meDoc = me.data();
      S.partnerDoc = other ? other.data() : {};
      if (window.keepsakes) window.keepsakes.refresh();
      if (!other) return;
      S.partnerName = String(other.data().ownerName || '').slice(0, 80);
      if (other.id !== S.partnerUid) watchPartner(other.id);
      else publishPartner();
    }, err => syncError(err)));
  }

  function mergeFirst(snap) {
    const remote = new Map();
    snap.docs.forEach(d => remote.set(d.id, cleanBook(Object.assign({}, d.data(), {id: d.id}))));
    const local = new Map(state.mine.books.map(b => [b.id, b]));
    const merged = [];
    for (const id of new Set([...local.keys(), ...remote.keys()])) {
      const l = local.get(id), r = remote.get(id);
      if (!r) merged.push(l);
      else if (!l) merged.push(r);
      else merged.push((l.updatedAt || '') > (r.updatedAt || '') ? l : r);
    }
    S.synced = new Map([...remote].map(([id, b]) => [id, ser(b)]));
    state.mine.books = merged;
    store('libray.mine', state.mine);
    S.ready = true;
    if (!state.mine.ownerName && S.usersSeen) openWelcomeIfIdle();
    push();
    redraw();
  }

  function applyChanges(snap) {
    let touched = false;
    snap.docChanges().forEach(ch => {
      const id = ch.doc.id;
      if (ch.type === 'removed') {
        if (!S.synced.has(id)) return;           // our own delete coming back
        S.synced.delete(id);
        const before = state.mine.books.length;
        state.mine.books = state.mine.books.filter(b => b.id !== id);
        touched = touched || state.mine.books.length !== before;
        return;
      }
      const r = cleanBook(Object.assign({}, ch.doc.data(), {id}));
      const json = ser(r);
      if (S.synced.get(id) === json) return;      // our own write coming back
      const i = state.mine.books.findIndex(b => b.id === id);
      if (i < 0) state.mine.books.push(r);
      else if ((r.updatedAt || '') >= (state.mine.books[i].updatedAt || '')) state.mine.books[i] = r;
      else return;
      S.synced.set(id, json);
      touched = true;
    });
    if (touched) { store('libray.mine', state.mine); redraw(); }
  }

  // Sends every book that differs from the cloud, and removes deleted ones.
  function push() {
    if (!S.ready || !S.user) return;
    const books = S.db.collection('users').doc(S.user.uid).collection('books');
    const seen = new Set();
    let stamped = false;
    for (const b of state.mine.books) {
      seen.add(b.id);
      const json = ser(b);
      if (S.synced.get(b.id) === json) continue;
      b.updatedAt = now(); stamped = true;
      S.synced.set(b.id, json);
      books.doc(b.id).set(JSON.parse(JSON.stringify(b))).catch(syncError);
    }
    for (const id of [...S.synced.keys()]) {
      if (seen.has(id)) continue;
      S.synced.delete(id);
      books.doc(id).delete().catch(syncError);
    }
    if (stamped) store('libray.mine', state.mine);
    if (S.usersSeen && state.mine.ownerName && state.mine.ownerName !== S.nameSynced) {
      S.nameSynced = state.mine.ownerName;
      S.db.collection('users').doc(S.user.uid).set({ownerName: state.mine.ownerName, updatedAt: now()}, {merge: true}).catch(syncError);
    }
  }

  function watchPartner(uid) {
    if (S.partnerStop) S.partnerStop();
    S.partnerUid = uid; S.partnerBooks = new Map();
    S.partnerStop = S.db.collection('users').doc(uid).collection('books').onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'removed') S.partnerBooks.delete(ch.doc.id);
        else S.partnerBooks.set(ch.doc.id, cleanBook(Object.assign({}, ch.doc.data(), {id: ch.doc.id})));
      });
      publishPartner();
    }, err => syncError(err));
    S.stop.push(() => { if (S.partnerStop) S.partnerStop(); S.partnerStop = null; S.partnerUid = null; });
  }

  function publishPartner() {
    state.partner = {ownerName: S.partnerName, books: [...S.partnerBooks.values()], exportedAt: null, live: true};
    store('libray.partner', state.partner);
    if (state.tab === 'visit') redraw();
  }

  function detach() {
    S.stop.forEach(fn => { try { fn(); } catch (e) {} });
    S.meDoc = {}; S.partnerDoc = {}; S.mePending = 0;
    S.stop = []; S.ready = false; S.usersSeen = false; S.synced = new Map(); S.nameSynced = null;
  }

  let lastError = 0;
  function syncError(err) {
    const code = err && err.code;
    if (Date.now() - lastError < 15000) return;
    lastError = Date.now();
    if (code === 'permission-denied') toast('This account is not allowed to sync. Check the email address in the Firebase rules.');
    else if (code === 'resource-exhausted') toast('The free syncing limit was reached for today. Changes will sync tomorrow.');
    else toast('Syncing paused. Your changes are saved on this phone.');
  }

  function openWelcomeIfIdle() {
    if ($('#welcome').hidden && $('#signin').hidden) showOverlay($('#welcome'));
  }

  function openSignin(msg) {
    $('#signin-msg').textContent = msg || '';
    if ($('#signin').hidden) showOverlay($('#signin'));
    if (!$('#welcome').hidden) hideOverlay($('#welcome'));
  }

  const MESSAGES = {
    'auth/invalid-credential': 'That email and password do not match.',
    'auth/wrong-password': 'That email and password do not match.',
    'auth/user-not-found': 'That email and password do not match.',
    'auth/invalid-email': 'Check the email address.',
    'auth/missing-password': 'Type your password.',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
    'auth/network-request-failed': 'No connection. Try again when you are online.',
    'auth/user-disabled': 'This account has been switched off in Firebase.'
  };

  async function signIn() {
    const email = $('#signin-email').value.trim(), pass = $('#signin-pass').value;
    if (!email) { $('#signin-email').focus(); return; }
    if (!S.auth) { $('#signin-msg').textContent = 'Still connecting. Try again in a moment.'; return; }
    const go = $('#signin-go');
    go.disabled = true; $('#signin-msg').textContent = 'Signing in.';
    try {
      await S.auth.signInWithEmailAndPassword(email, pass);
      $('#signin-pass').value = '';
    } catch (e) {
      $('#signin-msg').textContent = MESSAGES[e && e.code] || 'Sign-in did not work. Try again.';
    } finally { go.disabled = false; }
  }

  async function resetPassword() {
    const email = $('#signin-email').value.trim();
    if (!email) { $('#signin-msg').textContent = 'Type your email first, then tap this again.'; $('#signin-email').focus(); return; }
    if (!S.auth) { $('#signin-msg').textContent = 'Still connecting. Try again in a moment.'; return; }
    try {
      await S.auth.sendPasswordResetEmail(email);
      $('#signin-msg').textContent = 'If that address has an account, an email with a link to set your password is on its way.';
    } catch (e) {
      $('#signin-msg').textContent = MESSAGES[e && e.code] || 'The email could not be sent. Try again.';
    }
  }

  window.librarySync = {
    signedIn: () => !!S.user,
    social: () => ({me: S.meDoc || {}, partner: S.partnerDoc || {}, partnerName: S.partnerName, hasPartner: !!S.partnerUid}),
    // Changes fields of my own record (sent notes and flowers, what I have found).
    patchMe(fields) {
      if (!S.user) return Promise.reject(new Error('signed out'));
      S.meDoc = Object.assign({}, S.meDoc, fields);
      S.mePending++;
      const done = () => { S.mePending = Math.max(0, S.mePending - 1); };
      return S.db.collection('users').doc(S.user.uid).set(JSON.parse(JSON.stringify(fields)), {merge: true}).then(done, e => { done(); syncError(e); throw e; });
    },
    changed: push,
    footHTML() {
      if (S.loading) return '';
      if (S.user) return `<p class="fine">Shelves kept in step as ${esc(S.user.email || 'you')}.<br><button class="link quiet" data-act="signout" style="min-height:44px;font-size:15px">Sign out</button></p>`;
      return `<p class="fine">This library is only on this phone.<br><button class="link" data-act="signin-open" style="min-height:44px;font-size:15px">Sign in to share it</button></p>`;
    },
    act(act) {
      if (act === 'signin-open') openSignin();
      else if (act === 'signin-skip') {
        try { localStorage.setItem('libray.syncSkipped', '1'); } catch (e) {}
        hideOverlay($('#signin'), () => { if (!state.mine.ownerName) openWelcomeIfIdle(); });
        render();
      } else if (act === 'signin-reset') resetPassword();
      else if (act === 'signout') {
        if (!S.auth) return;
        try { localStorage.setItem('libray.syncSkipped', '1'); } catch (e) {}
        S.auth.signOut().then(() => {
          if (state.partner && state.partner.live) { state.partner = null; try { localStorage.removeItem('libray.partner'); } catch (e) {} }
          state.entered = false; render(); toast('Signed out. Your books stay on this phone.');
        });
      }
    },
    submit(id) { if (id === 'signin-form') signIn(); },
    _state: S
  };
  render();
  boot();
})();
