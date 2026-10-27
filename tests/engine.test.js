require('../langs.js'); require('../result-text.js'); require('../place-text.js'); require('../symptoms.js');
var E = require('../engine.js');
var assert = require('assert');
var n = 0;
function ev(a) { return E.evaluate(Object.assign({ who: 'adult', days: 'd1', sev: 'ok' }, a)); }
function ok(name, got, level, urgency) {
  assert.strictEqual(got.level, level, name + ' level was ' + got.level);
  if (urgency) assert.strictEqual(got.urgency, urgency, name + ' urgency was ' + got.urgency);
  n++;
}

// every danger sign is an emergency, whoever has it
['chest','breath','faint','fits','bleed','stroke','poison','pregdanger','babyfeed','selfharm'].forEach(function (id) {
  ['adult','child','infant','elder','preg'].forEach(function (w) {
    ok(id + '/' + w, ev({ symptoms: [id, 'cough'], who: w }), 'emergency');
  });
});
assert.strictEqual(ev({ symptoms: ['selfharm'] }).kind, 'mind'); n++;

// answers to the quick questions
ok('q1', ev({ symptoms: ['cough'], q1: true }), 'emergency');
ok('q2', ev({ symptoms: ['belly'], q2: true }), 'emergency');
ok('infant fluids', ev({ symptoms: ['vomit'], who: 'infant', q3: true }), 'emergency');
ok('adult fluids', ev({ symptoms: ['vomit'], q3: true }), 'clinic', 'today');

// home care only when everything is mild and recent
ok('cold', ev({ symptoms: ['cough'] }), 'home', 'none');
ok('headache', ev({ symptoms: ['head', 'ache'] }), 'home', 'none');
ok('fever 1 day adult', ev({ symptoms: ['fever'] }), 'home', 'none');

// anything that raises concern moves it up
ok('fever 2-3 days', ev({ symptoms: ['fever'], days: 'd2' }), 'clinic', 'soon');
ok('fever 3+ days', ev({ symptoms: ['fever'], days: 'd3' }), 'clinic', 'soon');
ok('fever elder', ev({ symptoms: ['fever'], who: 'elder' }), 'clinic', 'soon');
ok('fever infant', ev({ symptoms: ['fever'], who: 'infant' }), 'clinic', 'today');
ok('cold infant', ev({ symptoms: ['cough'], who: 'infant' }), 'clinic', 'today');
ok('fever pregnant', ev({ symptoms: ['fever'], who: 'preg' }), 'clinic', 'today');
ok('weak', ev({ symptoms: ['cough'], sev: 'bad' }), 'clinic', 'today');
ok('rash', ev({ symptoms: ['rash'] }), 'clinic', 'soon');
ok('wound', ev({ symptoms: ['wound'] }), 'clinic', 'soon');
ok('child loose 2d', ev({ symptoms: ['loose'], who: 'child', days: 'd2' }), 'clinic', 'today');
ok('long cough', ev({ symptoms: ['cough'], days: 'd3' }), 'clinic', 'soon');
assert.ok(ev({ symptoms: ['loose'] }).tips.indexOf('orsTip') !== -1); n++;

// the level never drops when you add a symptom or make things worse
var ids = ['cough','fever','head','ache','belly','vomit','loose','rash','wound','urine','eyeear','dizzy','yellow','swell'];
var rank = { home: 0, clinic: 1, emergency: 2 }, urg = { none: 0, soon: 1, today: 2, now: 3 };
function score(r) { return rank[r.level] * 10 + urg[r.urgency]; }
ids.forEach(function (a) {
  ids.forEach(function (b) {
    ['adult','child','infant','elder','preg'].forEach(function (w) {
      var one = score(ev({ symptoms: [a], who: w })), two = score(ev({ symptoms: [a, b], who: w }));
      assert.ok(two >= one, 'adding ' + b + ' to ' + a + ' lowered the level for ' + w); n++;
    });
  });
  ['d1','d2','d3'].forEach(function (d, i, all) {
    if (i) assert.ok(score(ev({ symptoms: [a], days: d })) >= score(ev({ symptoms: [a], days: all[i - 1] })), 'longer lowered ' + a); n++;
  });
  assert.ok(score(ev({ symptoms: [a], sev: 'bad' })) >= score(ev({ symptoms: [a] }))); n++;
});

// voice and typed words in each language
var say = {
  'I have fever and cough': ['fever', 'cough'],
  'mujhe bukhar hai aur ulti': ['fever', 'vomit'],
  'सीने में दर्द और सांस फूल रही है': ['chest', 'breath'],
  'ಜ್ವರ ಮತ್ತು ತಲೆನೋವು': ['fever', 'head'],
  'ताप आणि खोकला': ['fever', 'cough'],
  'காய்ச்சல் மற்றும் வாந்தி': ['fever', 'vomit'],
  'జ్వరం మరియు దగ్గు': ['fever', 'cough'],
  'saanp ne kata': ['poison'],
  'बच्चे को दस्त हैं': ['loose']
};
Object.keys(say).forEach(function (k) {
  var got = E.matchText(k);
  say[k].forEach(function (id) { assert.ok(got.indexOf(id) !== -1, k + ' missed ' + id + ' got ' + got); n++; });
});
assert.deepStrictEqual(E.matchText('hello there'), []); n++;
console.log(n + ' checks passed');
var C = require('../clinics.js');
assert.ok(C.isGov({ name: 'Primary Health Centre Hebbal' })); 
assert.ok(C.isGov({ name: 'Anything', 'operator:type': 'government' }));
assert.ok(C.isGov({ name: 'सरकारी अस्पताल' }));
assert.ok(!C.isGov({ name: 'Sunrise Nursing Home', operator: 'Dr Rao' }));
assert.ok(!C.isGov({ name: 'Apollo Clinic' }));
assert.ok(Math.abs(C.km(12.9716, 77.5946, 13.0827, 80.2707) - 290) < 5);
console.log('clinic helpers ok');
