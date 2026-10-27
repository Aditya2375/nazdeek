(function (root) {
  var ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  var STEPS = [8000, 20000, 40000];
  var GOV = /govern|govt|\bgov\b|\bphc\b|\bchc\b|\buphc\b|sub.?cent(er|re)|primary health|community health|district hospital|taluk|general hospital|civil hospital|\besi\b|\besic\b|jan aushadhi|anganwadi|wellness cent|arogya|aarogya|swasthya|sarkari|सरकारी|शासकीय|ಸರ್ಕಾರಿ|ಸರಕಾರಿ|அரசு|ప్రభుత్వ|medical college|\baiims\b|\bnhm\b/i;

  function km(a, b, c, d) {
    var r = Math.PI / 180, dLat = (c - a) * r, dLon = (d - b) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 12742 * Math.asin(Math.sqrt(x));
  }

  function isGov(tags) {
    var ot = (tags['operator:type'] || '').toLowerCase();
    if (ot === 'government' || ot === 'public') return true;
    var hay = [tags.name, tags['name:en'], tags['name:hi'], tags['name:kn'], tags.operator, tags['operator:en']].filter(Boolean).join(' | ');
    return GOV.test(hay);
  }

  function query(lat, lon, r) {
    return '[out:json][timeout:25];(' +
      'nwr(around:' + r + ',' + lat + ',' + lon + ')[amenity~"^(hospital|clinic|doctors)$"];' +
      'nwr(around:' + r + ',' + lat + ',' + lon + ')[healthcare~"^(hospital|clinic|centre|doctor)$"];' +
      ');out center tags 120;';
  }

  function post(q) {
    var i = 0;
    function go() {
      if (i >= ENDPOINTS.length) return Promise.reject(new Error('overpass'));
      var url = ENDPOINTS[i++];
      return fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
        .then(function (res) { if (!res.ok) throw new Error('http ' + res.status); return res.json(); })
        .catch(go);
    }
    return go();
  }

  function shape(el, lat, lon) {
    var p = el.center || el;
    if (typeof p.lat !== 'number') return null;
    var t = el.tags || {};
    var name = t.name || t['name:en'] || t.operator || '';
    if (!name) return null;
    return {
      id: el.type + el.id, name: name, lat: p.lat, lon: p.lon,
      km: km(lat, lon, p.lat, p.lon),
      gov: isGov(t),
      hospital: t.amenity === 'hospital' || t.healthcare === 'hospital',
      emergency: t.emergency === 'yes',
      phone: (t.phone || t['contact:phone'] || '').split(';')[0].trim(),
      hours: t.opening_hours || '',
      place: [t['addr:street'], t['addr:suburb'] || t['addr:city'] || t['addr:village']].filter(Boolean).join(', ')
    };
  }

  // Widens the circle until it finds something worth showing. Government first, then anything.
  function find(lat, lon, wantHospital) {
    function step(i) {
      if (i >= STEPS.length) return Promise.resolve({ list: [], anyGov: false });
      return post(query(lat, lon, STEPS[i])).then(function (data) {
        var seen = {}, all = [];
        (data.elements || []).forEach(function (el) {
          var s = shape(el, lat, lon);
          if (!s) return;
          var key = s.name.toLowerCase() + Math.round(s.lat * 500) + Math.round(s.lon * 500);
          if (seen[key]) return; seen[key] = 1; all.push(s);
        });
        var gov = all.filter(function (x) { return x.gov; });
                if (gov.length >= 3 || (gov.length && i === STEPS.length - 1)) {
          gov.sort(function (a, b) { return a.km - b.km; });
          return { list: gov.slice(0, 5), anyGov: true };
        }
        if (i === STEPS.length - 1) {
          var pool = wantHospital ? all.filter(function (x) { return x.hospital; }) : all;
          if (!pool.length) pool = all;
          pool.sort(function (a, b) { return a.km - b.km; });
          var g = gov.length ? gov.concat(pool.filter(function (x) { return !x.gov; })) : pool;
          g.sort(function (a, b) { return a.km - b.km; });
          return { list: g.slice(0, 5), anyGov: gov.length > 0 };
        }
        return step(i + 1);
      });
    }
    return step(0);
  }

  // If every Overpass server is busy, ask the place search instead. Fewer details, same idea.
  function fallback(lat, lon, wantHospital) {
    var d = 0.35, vb = [lon - d, lat + d, lon + d, lat - d].join(',');
    var qs = wantHospital ? ['government hospital', 'hospital'] : ['government hospital', 'primary health centre', 'clinic'];
    return Promise.all(qs.map(function (q) {
      return fetch('https://nominatim.openstreetmap.org/search?format=json&limit=15&bounded=1&viewbox=' + vb + '&q=' + encodeURIComponent(q))
        .then(function (r) { if (!r.ok) throw new Error('geo'); return r.json(); });
    })).then(function (parts) {
      var seen = {}, all = [];
      parts.forEach(function (arr) {
        arr.forEach(function (x) {
          if (seen[x.place_id] || x.class !== 'amenity' && x.class !== 'healthcare') return; seen[x.place_id] = 1;
          var la = parseFloat(x.lat), lo = parseFloat(x.lon);
          all.push({ id: 'n' + x.place_id, name: x.name || x.display_name.split(',')[0], lat: la, lon: lo, km: km(lat, lon, la, lo),
            gov: isGov({ name: (x.name || '') + ' ' + x.display_name }), hospital: x.type === 'hospital', emergency: false, phone: '', hours: '', place: '' });
        });
      });
      all.sort(function (a, b) { return a.km - b.km; });
      var gov = all.filter(function (x) { return x.gov; });
      return { list: (gov.length ? gov : all).slice(0, 5), anyGov: gov.length > 0 };
    });
  }

  function geocode(text) {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=' + encodeURIComponent(text);
    return fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (r) { if (!r.ok) throw new Error('geo'); return r.json(); })
      .then(function (a) { return a && a[0] ? { lat: parseFloat(a[0].lat), lon: parseFloat(a[0].lon), label: a[0].display_name } : null; });
  }

  root.NZ.clinics = { find: function (a, b, w) { return find(a, b, w).catch(function () { return fallback(a, b, w); }); }, fallback: fallback, geocode: geocode, isGov: isGov, km: km };
  if (typeof module !== 'undefined') module.exports = root.NZ.clinics;
})(typeof window !== 'undefined' ? window : globalThis);
