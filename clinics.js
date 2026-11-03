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
    var ot = text(tags['operator:type'],100).toLowerCase();
    if (ot === 'government' || ot === 'public') return true;
    return false; // Names alone cannot establish public ownership.

  }

  function query(lat, lon, r) {
    return '[out:json][timeout:25];(' +
      'nwr(around:' + r + ',' + lat + ',' + lon + ')[amenity~"^(hospital|clinic|doctors)$"];' +
      'nwr(around:' + r + ',' + lat + ',' + lon + ')[healthcare~"^(hospital|clinic|centre|doctor)$"];' +
      ');out center tags 120;';
  }

  // Give up on a silent server quickly so the place-search fallback can answer instead.
  function validCoords(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180}
  function request(url,options){var c=new AbortController(),t=setTimeout(function(){c.abort()},12000);return fetch(url,Object.assign({},options,{signal:c.signal})).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.text()}).then(function(text){if(text.length>2000000)throw Error('large response');return JSON.parse(text)}).finally(function(){clearTimeout(t)})}
  function text(v,n){return typeof v==='string'?v.slice(0,n):''}

  function post(q) {
    var i = 0;
    function go() {
      if (i >= ENDPOINTS.length) return Promise.reject(new Error('overpass'));
      var url = ENDPOINTS[i++];
      return request(url,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}})
        .catch(go);
    }
    return go();
  }

  function shape(el, lat, lon) {
    var p = el.center || el;
    if (!validCoords(p.lat,p.lon)) return null;
    var t = el.tags && typeof el.tags==='object' ? el.tags : {};
    var name = text(t.name,250) || text(t['name:en'],250) || text(t.operator,250);
    if (!name) return null;
    return {
      id: el.type + el.id, name: name, lat: p.lat, lon: p.lon,
      km: km(lat, lon, p.lat, p.lon),
      gov: isGov(t),
      hospital: t.amenity === 'hospital' || t.healthcare === 'hospital',
      emergency: t.emergency === 'yes',
      phone: text(t.phone || t['contact:phone'],100).split(';')[0].trim(),
      hours: text(t.opening_hours,200),
      place: [text(t['addr:street'],200),text(t['addr:suburb'] || t['addr:city'] || t['addr:village'],200)].filter(Boolean).join(', ')
    };
  }

  // Widens the circle until it finds something worth showing. Government first, then anything.
  function find(lat, lon, wantHospital) {
    if(!validCoords(lat,lon))return Promise.reject(Error('coordinates'));
    function step(i) {
      if (i >= STEPS.length) return Promise.resolve({ list: [], anyGov: false });
      return post(query(lat, lon, STEPS[i])).then(function (data) {
        var seen = {}, all = [];
        (Array.isArray(data.elements)?data.elements.slice(0,300):[]).forEach(function (el) {
          var s = shape(el, lat, lon);
          if (!s) return;
          var key = s.name.toLowerCase() + Math.round(s.lat * 500) + Math.round(s.lon * 500);
          if (seen[key]) return; seen[key] = 1; all.push(s);
        });
        var gov = all.filter(function (x) { return x.gov && (!wantHospital || x.hospital); });
                if (gov.length >= 3 || (gov.length && i === STEPS.length - 1)) {
          gov.sort(function (a, b) { return a.km - b.km; });
          return { list: gov.slice(0, 5), anyGov: true };
        }
        if (i === STEPS.length - 1) {
          var pool = wantHospital ? all.filter(function (x) { return x.hospital; }) : all;
          if (!pool.length && !wantHospital) pool = all;
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
    if(!validCoords(lat,lon))return Promise.reject(Error('coordinates'));
    // One explicit query, not concurrent bursts against a public geocoder.
    return request('https://nominatim.openstreetmap.org/search?format=json&limit=15&bounded=1&viewbox='+vb+'&q='+encodeURIComponent(qs[0])).then(function(arr){return [Array.isArray(arr)?arr.slice(0,15):[]]}).then(function(parts){
      var seen = {}, all = [];
      parts.forEach(function (arr) {
        arr.forEach(function (x) {
          if (seen[x.place_id] || x.class !== 'amenity' && x.class !== 'healthcare') return; seen[x.place_id] = 1;
          var la = parseFloat(x.lat), lo = parseFloat(x.lon);
          if(!validCoords(la,lo)||(wantHospital&&x.type!=='hospital'))return;
          all.push({ id: 'n' + x.place_id, name: text(x.name,250) || text(x.display_name,400).split(',')[0], lat: la, lon: lo, km: km(lat, lon, la, lo),
            gov: isGov({ name: (x.name || '') + ' ' + x.display_name }), hospital: x.type === 'hospital', emergency: false, phone: '', hours: '', place: '' });
        });
      });
      all.sort(function (a, b) { return a.km - b.km; });
      var gov = all.filter(function (x) { return x.gov && (!wantHospital || x.hospital); });
      return { list: (gov.length ? gov : all).slice(0, 5), anyGov: gov.length > 0 };
    });
  }

  function geocode(text) {
    if(typeof text!=='string'||!text.trim()||text.length>200)return Promise.reject(Error('place'));
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=' + encodeURIComponent(text);
    return request(url,{headers:{Accept:'application/json'}}).then(function(a){if(!Array.isArray(a)||!a[0])return null;var lat=Number(a[0].lat),lon=Number(a[0].lon);return validCoords(lat,lon)?{lat:lat,lon:lon,label:String(a[0].display_name||'').slice(0,400)}:null});
  }

  root.NZ.clinics = { find: function (a, b, w) { return find(a, b, w).catch(function () { return fallback(a, b, w); }); }, fallback: fallback, geocode: geocode, isGov: isGov, km: km };
  if (typeof module !== 'undefined') module.exports = root.NZ.clinics;
})(typeof window !== 'undefined' ? window : globalThis);
