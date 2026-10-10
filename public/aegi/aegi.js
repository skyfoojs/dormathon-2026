/* Aegi, the AiGIS guardian avatar: behaviour.
   Needs aegi.css and the markup from aegi-markup.html on the page.
   Set window.AEGI_CONFIG before loading this file, or call Aegi.setPending(n) later. */
(function () {
  var CONFIG = Object.assign({
    pending: 3,                           // REAL number of purchase orders waiting for approval
    reviewHref: 'PurchaseOrders.html',    // where "Review now" goes
    sampleLabel: true,                    // show the "Sample data" tag while numbers are mock
    autoPlay: true
  }, window.AEGI_CONFIG || {});
  var girl = document.getElementById('aegiGirl'), box = document.getElementById('aegiMsgs');
  if (!girl || !box) return;
  var timers = [], running = false, typingEl = null;

  function lines() {
    var p = CONFIG.pending;
    return [
      'Hi! I\u2019m Aegi. I keep watch over your hospital\u2019s stock.',
      p > 0 ? 'While you were away I checked every item and drafted ' + p + ' purchase order' + (p === 1 ? '' : 's') + ' for you.'
            : 'While you were away I checked every item. All purchase orders are handled.',
      p > 0 ? 'Nothing goes to a supplier until you approve it. Want to take a look?' : 'Everything looks calm for now.'
    ];
  }
  function T(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function bubble(text, action) {
    var d = document.createElement('div'); d.className = 'ai-bub';
    var t = document.createElement('div'); t.textContent = text; d.appendChild(t);
    if (action) {
      var row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:10px';
      var a = document.createElement('a'); a.className = 'ai-cta'; a.href = CONFIG.reviewHref; a.textContent = 'Review now'; row.appendChild(a);
      if (CONFIG.sampleLabel) { var s = document.createElement('span'); s.className = 'ai-mono'; s.style.cssText = 'font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6B8199'; s.textContent = 'Sample data'; row.appendChild(s); }
      d.appendChild(row);
    }
    return d;
  }
  function showTyping() { typingEl = document.createElement('div'); typingEl.className = 'ai-bub'; typingEl.style.padding = '18px 24px'; typingEl.innerHTML = '<span class="ai-dots"><i></i><i></i><i></i></span>'; box.appendChild(typingEl); girl.classList.add('ai-talk'); }
  function say(i) {
    if (typingEl) { typingEl.remove(); typingEl = null; }
    var L = lines();
    box.appendChild(bubble(L[i], i === 2 && CONFIG.pending > 0));
    girl.classList.add('ai-talk'); T(function () { girl.classList.remove('ai-talk'); }, 1200);
  }
  function play(first) {
    timers.forEach(clearTimeout); timers = []; running = true;
    box.innerHTML = ''; box.classList.remove('ai-msgs-off'); girl.className = 'ai-girl';
    var b = first ? 700 : 100;
    T(function () { girl.classList.add('ai-out'); }, b);                                   // jumps out
    T(showTyping, b + 1500);  T(function () { say(0); }, b + 2800);
    T(showTyping, b + 3900);  T(function () { say(1); }, b + 5300);
    T(showTyping, b + 6400);  T(function () { say(2); }, b + 7900);
    T(function () { box.classList.add('ai-msgs-off'); }, b + 15500);                       // messages fade
    T(function () { girl.classList.remove('ai-out', 'ai-talk'); girl.classList.add('ai-peek'); }, b + 16300); // tuck to the edge
    T(function () { box.innerHTML = ''; running = false; }, b + 17300);
  }
  girl.addEventListener('mouseenter', function () { if (!running && girl.classList.contains('ai-peek')) play(false); });
  window.Aegi = { play: function () { play(false); }, setPending: function (n) { CONFIG.pending = n; } };
  if (CONFIG.autoPlay) play(true);
})();
