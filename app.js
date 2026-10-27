(function () {
  var NZ = window.NZ, U = NZ.UI, S = NZ.SYMPTOMS, E = NZ.engine, C = NZ.clinics;
  var app = document.getElementById('app');
  var langbar = document.getElementById('langbar');
  var st = { li: 0, step: 1, sel: [], who: 'adult', days: 'd1', sev: 'ok', q1: false, q2: false, q3: false, heard: '' };
  var rec = null, map = null, wave = null;
  var levelStream = null, actx = null;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function t(k) { return U[k][st.li]; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function label(id) { for (var i = 0; i < S.length; i++) if (S[i][0] === id) return S[i][2][st.li]; return id; }
  function isDanger(id) { for (var i = 0; i < S.length; i++) if (S[i][0] === id) return S[i][1] === 'R'; return false; }
  function toggle(id, on) {
    var i = st.sel.indexOf(id);
    if (on === undefined) on = i === -1;
    if (on && i === -1) st.sel.push(id);
    if (!on && i !== -1) st.sel.splice(i, 1);
  }
  function rise(nodes, gap) {
    if (RM || !Element.prototype.animate) return;
    nodes.forEach(function (n, i) {
      n.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
        { duration: 560, delay: 70 * i, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    });
  }

  /* ---- the waveform: mic button, brand mark, one drawn line ---- */
  function Wave(canvas) {
    var ctx = canvas.getContext('2d');
    var w = 0, h = 132, dpr = Math.min(2, window.devicePixelRatio || 1);
    var amp = 5, tt = 0, raf = null, on = false, ink = '#1c1611';
    var wv = this;
    this.level = 0;
    function size() {
      var r = canvas.parentNode.getBoundingClientRect();
      w = Math.max(240, r.width);
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      try { ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || ink; } catch (e) {}
    }
    function frame() {
      tt += 0.016;
      var breathe = (Math.sin(tt * 0.85) + 1) / 2;
      var base = on ? 9 + wv.level * 64 : 4.5 + breathe * 4.5;
      amp += (base - amp) * 0.14;
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      var N = 76, mid = h / 2;
      for (var i = 0; i <= N; i++) {
        var x = i / N * w;
        var env = Math.sin(Math.PI * i / N);
        var y = mid + env * amp * (Math.sin(i * 0.52 + tt * 2.1) * 0.62 + Math.sin(i * 0.21 - tt * 1.25) * 0.38);
        if (on) y += env * wv.level * 26 * Math.sin(i * 1.6 + tt * 8.5);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = ink; ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.stroke();
      raf = requestAnimationFrame(frame);
    }
    function still() { // reduced motion: one calm line, drawn once
      size(); ctx.clearRect(0, 0, w, h); ctx.beginPath();
      var N = 76, mid = h / 2;
      for (var i = 0; i <= N; i++) {
        var x = i / N * w, env = Math.sin(Math.PI * i / N);
        var y = mid + env * 6 * Math.sin(i * 0.52) * 0.62;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = ink; ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.stroke();
    }
    this.start = function () { if (RM) { still(); return; } if (!raf) { size(); frame(); } };
    this.stop = function () { if (raf) cancelAnimationFrame(raf); raf = null; };
    this.on = function (v) { on = v; };
    this.resize = function () { size(); if (RM) still(); };
  }
  window.addEventListener('resize', function () { if (wave) wave.resize(); });

  function startLevel() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !wave) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      levelStream = stream;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      var src = actx.createMediaStreamSource(stream);
      var an = actx.createAnalyser(); an.fftSize = 256;
      src.connect(an);
      var buf = new Uint8Array(an.fftSize);
      (function loop() {
        if (!actx) return;
        an.getByteTimeDomainData(buf);
        var s = 0;
        for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; s += v * v; }
        wave.level = Math.min(1, Math.sqrt(s / buf.length) * 3.2);
        requestAnimationFrame(loop);
      })();
    }).catch(function () {});
  }
  function stopLevel() {
    if (actx) { try { actx.close(); } catch (e) {} actx = null; }
    if (levelStream) { levelStream.getTracks().forEach(function (tr) { tr.stop(); }); levelStream = null; }
    if (wave) wave.level = 0;
  }

  /* ---- chrome that never moves ---- */
  function chrome() {
    document.documentElement.lang = NZ.LANGS[st.li].code;
    var sos = document.getElementById('sos');
    sos.innerHTML = esc(t('sosShort')).replace(/(\d+)/g, '<b>$1</b>');
    sos.href = 'tel:112';
    sos.setAttribute('aria-label', t('sos'));
    document.getElementById('privacy').textContent = t('privacy');
    document.getElementById('disclaimer-foot').textContent = t('disclaimer');
  }
  function renderLangbar() {
    langbar.innerHTML = NZ.LANGS.map(function (l, i) {
      return '<button type="button" data-lang="' + i + '" aria-pressed="' + (i === st.li) + '" lang="' + l.code + '">' + esc(l.name) + '</button>';
    }).join('');
    langbar.querySelectorAll('[data-lang]').forEach(function (b) {
      b.onclick = function () { stopMic(); st.li = +b.dataset.lang; chrome(); syncLangPressed(); render(); };
    });
  }
  function syncLangPressed() {
    langbar.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.lang === st.li); });
  }

  /* ---- step 1: speak ---- */
  function markUp(text) {
    var aliases = [];
    S.forEach(function (s) { s[3].split('|').forEach(function (a) { if (a) aliases.push(a); }); });
    aliases.sort(function (a, b) { return b.length - a.length; });
    var lower = text.toLowerCase(), spans = [];
    aliases.forEach(function (a) {
      var from = 0, i;
      while ((i = lower.indexOf(a, from)) >= 0) { spans.push([i, i + a.length]); from = i + a.length; }
    });
    spans.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var out = [], cur = 0;
    spans.forEach(function (sp) {
      if (sp[0] < cur) return;
      out.push(esc(text.slice(cur, sp[0])));
      out.push('<mark>' + esc(text.slice(sp[0], sp[1])) + '</mark>');
      cur = sp[1];
    });
    out.push(esc(text.slice(cur)));
    return out.join('');
  }

  function chipsHtml() {
    return st.sel.map(function (id) {
      return '<span class="tagchip' + (isDanger(id) ? ' danger' : '') + '">' + esc(label(id)) +
        '<button type="button" class="x" data-un="' + id + '" aria-label="' + esc(t('remove')) + ': ' + esc(label(id)) + '">&times;</button></span>';
    }).join('');
  }

  function chk(s) {
    var danger = s[1] === 'R';
    return '<button type="button" class="chk' + (danger ? ' danger' : '') + '" data-id="' + s[0] + '" aria-pressed="' + (st.sel.indexOf(s[0]) !== -1) + '">' +
      '<span class="ring"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="color:var(--cream)"><path d="M2 6.5 5 9.5 10 2.5"/></svg></span>' + esc(s[2][st.li]) + '</button>';
  }

  function stepOne() {
    stopMic();
    var danger = S.filter(function (s) { return s[1] === 'R'; }), common = S.filter(function (s) { return s[1] !== 'R'; });
    var tg = t('tagline'), cut = -1;
    ['. ', '। '].forEach(function (m) { var i = tg.indexOf(m); if (i >= 0 && (cut < 0 || i < cut)) cut = i + m.length; });
    var s1 = cut > 0 ? tg.slice(0, cut).trim() : tg, s2 = cut > 0 ? tg.slice(cut).trim() : '';
    app.innerHTML =
      '<p class="kicker">Nazdeek &middot; <span lang="hi">नज़दीक़</span></p>' +
      '<h1 class="hero-line"><span class="s1">' + esc(s1) + '</span>' + (s2 ? '<span class="s2">' + esc(s2) + '</span>' : '') + '</h1>' +
      '<section class="voice">' +
      (SR ? '<button type="button" class="wavebtn" id="mic" data-on="false"><canvas id="wave" aria-hidden="true"></canvas>' +
            '<span class="wavelabel"><span class="wavedot" aria-hidden="true"></span><span id="miclabel">' + esc(t('micIdle')) + '</span></span></button>'
          : '<p class="micnone">' + esc(t('micNone')) + '</p>') +
      '<label class="sayhint" for="say">' + esc(t('typeHint')) + '</label>' +
      '<input class="say" id="say" type="text" autocomplete="off" lang="' + NZ.LANGS[st.li].code + '" value="' + esc(st.heard) + '">' +
      '<div class="script" id="script"></div>' +
      '<div class="heardrow" id="heardbox"></div>' +
      '<div id="msgbox"></div>' +
      '<details class="tapalt" id="tapalt"><summary>' + esc(t('orTap')) + '<span class="plus" aria-hidden="true">+</span></summary>' +
      '<h3>' + esc(t('common')) + '</h3><div class="checklist" id="g1">' + common.map(chk).join('') + '</div>' +
      '<h3 class="dt">' + esc(t('danger')) + '</h3><div class="checklist" id="g2">' + danger.map(chk).join('') + '</div></details>' +
      '</section>' +
      '<div class="dock" id="dock" hidden><div class="dockin"><button type="button" class="biggo" id="go">' + esc(t('next')) +
      '<span class="arr"><svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg></span></button></div></div>';

    if (SR) {
      wave = new Wave(document.getElementById('wave'));
      wave.start();
    }
    var dock = document.getElementById('dock'), go = document.getElementById('go');
    function sync() {
      app.querySelectorAll('.chk').forEach(function (c) { c.setAttribute('aria-pressed', st.sel.indexOf(c.dataset.id) !== -1); });
      document.getElementById('heardbox').innerHTML = chipsHtml();
      app.querySelectorAll('[data-un]').forEach(function (x) {
        x.onclick = function () { toggle(x.dataset.un, false); sync(); };
      });
      dock.hidden = !st.sel.length;
    }
    app.querySelectorAll('.chk').forEach(function (c) { c.onclick = function () { toggle(c.dataset.id); sync(); }; });

    var say = document.getElementById('say'), script = document.getElementById('script');
    function heard(text) {
      st.heard = text;
      var ids = E.matchText(text);
      ids.forEach(function (id) { toggle(id, true); });
      say.classList.toggle('quiet', !!text.trim());
      if (!text.trim()) { script.innerHTML = ''; }
      else {
        script.innerHTML = '<div class="heardtag">' + esc(t('heard')) + '</div><p class="said">' + markUp(text) + '</p>' +
          (ids.length ? '' : '<p class="nomatch">' + esc(t('heardNone')) + '</p>');
      }
      sync();
    }
    if (st.heard) heard(st.heard);
    say.addEventListener('input', function () { heard(say.value); });

    go.onclick = function () {
      if (!st.sel.length) return;
      var quick = E.evaluate({ symptoms: st.sel, who: 'adult', days: 'd1', sev: 'ok' });
      st.step = quick.level === 'emergency' ? 3 : 2; render();
    };

    var mic = document.getElementById('mic');
    if (mic) mic.onclick = function () {
      if (rec) { stopMic(); return; }
      rec = new SR(); rec.lang = NZ.LANGS[st.li].speech; rec.interimResults = true; rec.continuous = false;
      var label1 = document.getElementById('miclabel');
      mic.dataset.on = 'true'; label1.textContent = t('micOn');
      wave.on(true); startLevel();
      rec.onresult = function (ev) {
        var txt = ''; for (var i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript + ' ';
        say.value = txt.trim(); heard(say.value);
      };
      rec.onerror = function (ev) {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          document.getElementById('msgbox').innerHTML = '<div class="msg">' + esc(t('micDenied')) + '</div>';
        }
      };
      rec.onend = function () {
        rec = null; mic.dataset.on = 'false'; label1.textContent = t('micIdle');
        wave.on(false); stopLevel();
      };
      try { rec.start(); } catch (e) { rec = null; mic.dataset.on = 'false'; wave.on(false); stopLevel(); }
    };
    rise([app.querySelector('.kicker'), app.querySelector('.hero-line'), app.querySelector('.voice')], 90);
    sync();
  }
  function stopMic() { if (rec) { try { rec.stop(); } catch (e) {} rec = null; } stopLevel(); if (wave) wave.on(false); }

  /* ---- step 2: a few quick questions ---- */
  function opts(name, vals) {
    return '<div class="opts">' + vals.map(function (v) {
      return '<button type="button" class="opt" data-k="' + name + '" data-v="' + v[0] + '" aria-pressed="' + (String(st[name]) === String(v[0])) + '">' + esc(t(v[1])) + '</button>';
    }).join('') + '</div>';
  }
  function stepTwo() {
    var ys = [[false, 'no'], [true, 'yes']];
    var qs = [
      ['whoQ', opts('who', [['adult', 'adult'], ['child', 'child'], ['infant', 'infant'], ['elder', 'elder'], ['preg', 'preg']])],
      ['daysQ', opts('days', [['d1', 'd1'], ['d2', 'd2'], ['d3', 'd3']])],
      ['sevQ', opts('sev', [['ok', 'sevOk'], ['bad', 'sevBad']])],
      ['q1', opts('q1', ys)], ['q2', opts('q2', ys)], ['q3', opts('q3', ys)]
    ];
    app.innerHTML =
      '<p class="kicker">Nazdeek &middot; <span lang="hi">नज़दीक़</span></p>' +
      '<h1 class="hero-line">' + esc(t('quick')) + '</h1>' +
      qs.map(function (q, i) {
        return '<fieldset class="q"><legend><span class="qn">' + ('0' + (i + 1)) + '</span>' + esc(t(q[0])) + '</legend>' + q[1] + '</fieldset>';
      }).join('') +
      '<button type="button" class="backquiet" id="back">&larr; ' + esc(t('back')) + '</button>' +
      '<div class="dock"><div class="dockin"><button type="button" class="biggo" id="go">' + esc(t('seeResult')) +
      '<span class="arr"><svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg></span></button></div></div>';
    app.querySelectorAll('.opt').forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.v; st[b.dataset.k] = (v === 'true') ? true : (v === 'false') ? false : v;
        app.querySelectorAll('[data-k="' + b.dataset.k + '"]').forEach(function (o) { o.setAttribute('aria-pressed', o === b); });
      };
    });
    document.getElementById('back').onclick = function () { st.step = 1; render(); };
    document.getElementById('go').onclick = function () { st.step = 3; render(); };
    rise([app.querySelector('.kicker'), app.querySelector('.hero-line')].concat(Array.prototype.slice.call(app.querySelectorAll('.q'))));
  }

  /* ---- step 3: the answer ---- */
  function speakText(txt) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(txt); u.lang = NZ.LANGS[st.li].speech; speechSynthesis.speak(u);
  }
  function canSpeak() {
    if (!window.speechSynthesis) return false;
    var code = NZ.LANGS[st.li].code, v = speechSynthesis.getVoices();
    return v.some(function (x) { return x.lang.toLowerCase().indexOf(code) === 0; });
  }

  function stepThree() {
    var r = E.evaluate({ symptoms: st.sel, who: st.who, days: st.days, sev: st.sev, q1: st.q1, q2: st.q2, q3: st.q3 });
    var cls = r.urgency === 'now' ? 'emerg' : r.urgency === 'today' ? 'today' : r.urgency === 'soon' ? 'soon' : 'home';
    var head = r.kind === 'mind' ? t('mindTitle') : r.level === 'emergency' ? t('lvEmerg') : r.urgency === 'today' ? t('lvClinicToday') : r.urgency === 'soon' ? t('lvClinicSoon') : t('lvHome');
    var big = r.kind === 'mind' ? '14416' : r.level === 'emergency' ? t('wordEmerg') : r.level === 'clinic' ? t('wordClinic') : t('wordHome');
    var steps = r.kind === 'mind' ? t('mindSteps') : r.level === 'emergency' ? t('emergSteps') : r.level === 'clinic' ? t('clinicSteps') : t('homeSteps');
    var why = r.reasons.map(function (x) {
      var s = t(x.key); if (x.x) s = s.replace('{x}', x.x.map(label).join(', ')); return '<li>' + esc(s) + '</li>';
    }).join('');
    var tips = r.tips.map(function (k) { return '<p class="tips">' + esc(t(k)) + '</p>'; }).join('');
    function callBtn(n, txt, alt) {
      return '<a class="bigcall' + (alt ? ' alt' : '') + '" href="tel:' + n + '"><span>' + esc(txt) + '</span><span class="num">' + n + '</span></a>';
    }
    var calls = r.kind === 'mind' ? '<div class="bigcalls">' + callBtn('14416', t('callMind')) + callBtn('112', t('call112'), true) + '</div>'
      : r.level === 'emergency' ? '<div class="bigcalls">' + callBtn('108', t('callNow')) + callBtn('112', t('call112'), true) + '</div>' : '';
    var warn = r.level === 'emergency' ? '' : '<div class="warn"><b>' + esc(t('warnTitle')) + '</b><ul>' + U.warnList[st.li].map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
    var speakAll = [head, steps].concat(r.tips.map(t)).join('. ');
    app.innerHTML =
      '<section class="answer"><div class="field f-' + cls + '" id="field"><div class="fieldin">' +
      '<h1 class="bigword">' + esc(big) + '</h1>' +
      '<p class="lvline">' + esc(head) + '</p>' + calls +
      '<p class="steps">' + esc(steps) + '</p>' + tips +
      '</div></div>' +
      '<div class="after">' +
      '<h2 class="sect">' + esc(t('why')) + '</h2><ol class="whylist">' + why + '</ol>' + warn +
      '<div class="quietrow">' + (canSpeak() ? '<button type="button" class="quietbtn" id="speak">' + esc(t('listen')) + '</button>' : '') +
      '<button type="button" class="quietbtn" id="again">' + esc(t('again')) + '</button></div>' +
      (r.kind === 'mind' ? '' : finder()) +
      '<p class="disc">' + esc(t('disclaimer')) + '</p>' +
      '</div></section>';

    var sp = document.getElementById('speak'); if (sp) sp.onclick = function () { speakText(speakAll); };
    document.getElementById('again').onclick = function () {
      if (window.speechSynthesis) speechSynthesis.cancel();
      st = { li: st.li, step: 1, sel: [], who: 'adult', days: 'd1', sev: 'ok', q1: false, q2: false, q3: false, heard: '' };
      render(); window.scrollTo(0, 0);
    };
    if (r.kind !== 'mind') bindFinder(r.level === 'emergency');

    // one huge word, always fitted to the field
    var big1 = app.querySelector('.bigword');
    if (big1) {
      big1.style.whiteSpace = 'nowrap';
      var avail = big1.parentNode.getBoundingClientRect().width;
      var fs = parseFloat(getComputedStyle(big1).fontSize), guard = 60;
      while (big1.scrollWidth > avail && fs > 26 && guard--) { fs *= 0.92; big1.style.fontSize = fs + 'px'; }
    }
    // the wipe: emergency and crisis answers appear at once, everything else sweeps in
    var field = document.getElementById('field');
    if (!RM && Element.prototype.animate && r.kind !== 'mind' && r.level !== 'emergency') {
      field.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' });
      rise(Array.prototype.slice.call(field.querySelectorAll('.fieldin > *')));
      rise(Array.prototype.slice.call(app.querySelectorAll('.after > *')));
    }
  }

  function finder() {
    return '<section class="finder"><h2 class="sect">' + esc(t('nearest')) + '</h2>' +
      '<div class="findrow"><button type="button" class="locbtn" id="useloc"><span>' + esc(t('useLoc')) + '</span><svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2"/><circle cx="8" cy="8" r="3.2"/></svg></button>' +
      '<form id="placeform"><input id="place" type="text" autocomplete="off" enterkeyhint="search" placeholder="' + esc(t('orPlace')) + '"><button class="findbtn" type="submit">' + esc(t('find')) + '</button></form></div>' +
      '<div id="found" aria-live="polite"></div></section>';
  }
  function bindFinder(hospital) {
    var found = document.getElementById('found');
    function busy() { found.innerHTML = '<div class="msg"><span class="spin"></span>' + esc(t('searching')) + '</div>'; }
    function run(lat, lon) {
      busy();
      C.find(lat, lon, hospital).then(function (res) { showPlaces(res, lat, lon); }).catch(function () { found.innerHTML = '<div class="msg">' + esc(t('netFail')) + '</div>'; });
    }
    document.getElementById('useloc').onclick = function () {
      if (!navigator.geolocation) { found.innerHTML = '<div class="msg">' + esc(t('locDenied')) + '</div>'; return; }
      busy();
      navigator.geolocation.getCurrentPosition(function (p) { run(p.coords.latitude, p.coords.longitude); },
        function () { found.innerHTML = '<div class="msg">' + esc(t('locDenied')) + '</div>'; }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
    };
    document.getElementById('placeform').onsubmit = function (e) {
      e.preventDefault();
      var q = document.getElementById('place').value.trim(); if (!q) return;
      busy();
      C.geocode(q).then(function (g) { if (!g) found.innerHTML = '<div class="msg">' + esc(t('placeNone')) + '</div>'; else run(g.lat, g.lon); })
        .catch(function () { found.innerHTML = '<div class="msg">' + esc(t('netFail')) + '</div>'; });
    };
    var m = /[#&]loc=([\d.]+),([\d.]+)/.exec(location.hash);
    if (m) run(parseFloat(m[1]), parseFloat(m[2]));
  }
  function showPlaces(res, lat, lon) {
    var found = document.getElementById('found');
    if (!res.list.length) { found.innerHTML = '<div class="msg">' + esc(t('nothingFound')) + '</div>'; return; }
    var html = res.anyGov ? '' : '<div class="msg">' + esc(t('noGov')) + '</div>';
    html += '<ol class="ladder">';
    res.list.forEach(function (p) {
      var phone = p.phone.replace(/[^\d+]/g, '');
      html += '<li class="rung"><div class="dist"><b>' + p.km.toFixed(1) + '</b><small>' + esc(t('away')) + '</small></div>' +
        '<div class="info"><h4>' + esc(p.name) + '</h4>' +
        '<p class="meta"><span class="gtag' + (p.gov ? '' : ' o') + '">' + esc(p.gov ? t('govTag') : t('otherTag')) + '</span>' + esc(p.place) + '</p>' +
        (p.hours ? '<p class="hours">' + esc(p.hours) + '</p>' : '') +
        '<p class="acts"><a href="https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lon + '" target="_blank" rel="noopener">' + esc(t('directions')) + ' &rarr;</a>' +
        (phone ? '<a href="tel:' + esc(phone) + '">' + esc(t('callPlace')) + ' ' + esc(p.phone) + '</a>' : '') + '</p></div></li>';
    });
    html += '</ol><div id="map" role="img" aria-label="map"></div><p class="mapnote">' + esc(t('mapNote')) + '</p>';
    found.innerHTML = html;
    try {
      if (map) { map.remove(); map = null; }
      map = L.map('map', { scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
      var pts = [[lat, lon]];
      L.circleMarker([lat, lon], { radius: 8, color: '#1c1611', fillColor: '#c2410c', fillOpacity: 1 }).addTo(map);
      res.list.forEach(function (p) { L.marker([p.lat, p.lon]).addTo(map).bindPopup(esc(p.name)); pts.push([p.lat, p.lon]); });
      map.fitBounds(pts, { padding: [28, 28], maxZoom: 15 });
    } catch (e) { var m = document.getElementById('map'); if (m) m.remove(); }
  }

  function render() {
    if (st.step === 1) stepOne(); else if (st.step === 2) stepTwo(); else stepThree();
    window.scrollTo(0, 0);
  }

  // plain deep link, handy for sharing a result or testing: #r&s=fever,cough&who=child&d=d2&sev=ok&lang=hi
  function fromHash() {
    var h = location.hash; if (h.indexOf('#r') !== 0) return false;
    var g = function (k) { var m = new RegExp('[&]' + k + '=([^&]*)').exec(h); return m ? decodeURIComponent(m[1]) : null; };
    var ids = (g('s') || '').split(',').filter(function (x) { return S.some(function (s) { return s[0] === x; }); });
    if (!ids.length) return false;
    var li = NZ.LANGS.map(function (l) { return l.code; }).indexOf(g('lang') || 'en');
    st.li = li < 0 ? 0 : li; st.sel = ids;
    st.who = g('who') || 'adult'; st.days = g('d') || 'd1'; st.sev = g('sev') || 'ok';
    st.q1 = g('q1') === '1'; st.q2 = g('q2') === '1'; st.q3 = g('q3') === '1';
    st.step = 3; return true;
  }

  var nav = (navigator.language || 'en').slice(0, 2), idx = NZ.LANGS.map(function (l) { return l.code; }).indexOf(nav);
  st.li = idx < 0 ? 0 : idx;
  fromHash();
  chrome(); renderLangbar(); render();
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () { if (st.step === 3) render(); };
})();
