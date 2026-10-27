(function (root) {
  var NZ = root.NZ;
  var base = {};
  NZ.SYMPTOMS.forEach(function (s) { base[s[0]] = s[1]; });

  function has(list, id) { return list.indexOf(id) !== -1; }

  // Turns spoken or typed words into symptom ids. Never removes anything on a "no": the person confirms the chips.
  function matchText(text) {
    var t = String(text || '').toLowerCase();
    var out = [];
    if (!t.trim()) return out;
    NZ.SYMPTOMS.forEach(function (s) {
      var words = s[3].split('|');
      for (var i = 0; i < words.length; i++) {
        if (words[i] && t.indexOf(words[i]) !== -1) { out.push(s[0]); break; }
      }
    });
    return out;
  }

  // in: { symptoms:[id], who:'adult|child|infant|elder|preg', days:'d1|d2|d3', sev:'ok|bad', q1,q2,q3: bool }
  // out: { level:'emergency|clinic|home', urgency:'now|today|soon|none', kind?:'mind', reasons:[{key,x}], tips:[key] }
  function evaluate(a) {
    var sy = a.symptoms || [];
    var reasons = [];
    var reds = sy.filter(function (id) { return base[id] === 'R'; });
    var tips = [];
    if (has(sy, 'vomit') || has(sy, 'loose')) tips.push('orsTip');

    if (has(sy, 'selfharm')) {
      return { level: 'emergency', urgency: 'now', kind: 'mind', reasons: [{ key: 'r_red', x: ['selfharm'] }], tips: [] };
    }
    if (reds.length) {
      return { level: 'emergency', urgency: 'now', reasons: [{ key: 'r_red', x: reds }], tips: [] };
    }
    if (a.q1 || a.q2) {
      return { level: 'emergency', urgency: 'now', reasons: [{ key: 'r_answer' }], tips: [] };
    }
    if (a.who === 'infant' && a.q3) {
      return { level: 'emergency', urgency: 'now', reasons: [{ key: 'r_infant' }, { key: 'r_fluids' }], tips: [] };
    }

    var today = false, soon = false;
    function t(key, x) { today = true; reasons.push({ key: key, x: x }); }
    function s(key, x) { soon = true; reasons.push({ key: key, x: x }); }

    if (a.who === 'infant') t('r_infant');
    if (a.who === 'preg' && (has(sy, 'fever') || has(sy, 'head') || has(sy, 'swell') || has(sy, 'belly') || has(sy, 'dizzy') || has(sy, 'vomit') || has(sy, 'urine'))) t('r_preg');
    if (a.q3) t('r_fluids');
    if (a.sev === 'bad') t('r_sev');
    if (a.who === 'child' && (has(sy, 'vomit') || has(sy, 'loose')) && a.days !== 'd1') t('r_dehyd');

    if (a.days === 'd3') s('r_days');
    if (has(sy, 'fever') && a.days !== 'd1') s('r_fever');
    if (a.who === 'elder' && has(sy, 'fever')) s('r_elder');
    var needCheck = sy.filter(function (id) { return base[id] === 'C'; });
    if (needCheck.length) s('r_kind');

    if (today) return { level: 'clinic', urgency: 'today', reasons: reasons, tips: tips };
    if (soon) return { level: 'clinic', urgency: 'soon', reasons: reasons, tips: tips };
    return { level: 'home', urgency: 'none', reasons: [{ key: 'r_mild' }], tips: tips };
  }

  NZ.engine = { matchText: matchText, evaluate: evaluate };
  if (typeof module !== 'undefined') module.exports = NZ.engine;
})(typeof window !== 'undefined' ? window : globalThis);
