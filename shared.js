/* ============================================================
   shared.js — used by display.html, control.html and settings.html
   ------------------------------------------------------------
   You don't need to edit this file. Everything here is changed
   from the settings page (settings.html).
   ============================================================ */
(function(){
  var S = window.Senhas = {};

  function isObj(x){ return !!x && typeof x === 'object' && !Array.isArray(x); }
  function pad(n){ return String(n).padStart(2, '0'); }

  /* ---------- default settings (seeded from config.js) ---------- */
  S.defaults = function(){
    var rooms = (typeof ROOMS !== 'undefined' && Array.isArray(ROOMS) && ROOMS.length) ? ROOMS : ['Gabinete 1'];
    return {
      rooms: rooms.map(function(name, i){ return { id: String(i), name: String(name), active: true }; }),
      grid: { mode: 'auto', cols: 4 },
      showLogo: true,
      // media area: a looping video, or one image / a slideshow of images
      video: { on: true, kind: 'video', file: 'video.mp4', images: [], seconds: 8,
               position: 'bottom', size: 38, width: 35 },
      speak: (typeof SPEAK_ENABLED === 'boolean') ? SPEAK_ENABLED : true,
      voice: { pt: '', en: '', rate: 1, volume: 1 },
      text: {
        pt: (typeof ANNOUNCE_TEMPLATE === 'string') ? ANNOUNCE_TEMPLATE : 'Senha {n}, {room}',
        en: (typeof ANNOUNCE_TEMPLATE_EN === 'string') ? ANNOUNCE_TEMPLATE_EN : 'Ticket {n}, {room}'
      },
      chime: { on: (typeof SOUND_ENABLED === 'boolean') ? SOUND_ENABLED : true, type: 'classico', volume: 0.8 },
      autoClear: { on: false, minutes: 30 },
      midnight: { on: false }
    };
  };

  /* Merge what's saved in the database over the defaults, so a missing
     or partial setting never breaks a page. */
  S.merge = function(saved){
    var d = S.defaults();
    if (!isObj(saved)) return d;
    var out = {};
    Object.keys(d).forEach(function(k){
      if (k === 'rooms') return;
      if (isObj(d[k])){
        out[k] = {};
        Object.keys(d[k]).forEach(function(kk){
          out[k][kk] = (isObj(saved[k]) && saved[k][kk] !== undefined && saved[k][kk] !== null) ? saved[k][kk] : d[k][kk];
        });
      } else {
        out[k] = (saved[k] !== undefined && saved[k] !== null) ? saved[k] : d[k];
      }
    });
    // the image list can come back from the database as an object; make it a clean array
    var imgs = out.video.images;
    if (isObj(imgs)) imgs = Object.keys(imgs).sort(function(a, b){ return (+a) - (+b); }).map(function(k){ return imgs[k]; });
    out.video.images = Array.isArray(imgs) ? imgs.map(function(x){ return String(x || '').trim(); }).filter(Boolean) : [];
    if (['bottom','top','left','right'].indexOf(out.video.position) === -1) out.video.position = 'bottom';
    if (out.video.kind !== 'images') out.video.kind = 'video';

    var r = saved.rooms;
    if (isObj(r)) r = Object.keys(r).sort(function(a, b){ return (+a) - (+b); }).map(function(k){ return r[k]; });
    out.rooms = (Array.isArray(r) && r.filter(Boolean).length)
      ? r.filter(Boolean).map(function(x, i){
          return {
            id: String(x.id != null ? x.id : i),
            name: String(x.name || ('Gabinete ' + (i + 1))),
            nameEn: String(x.nameEn || '').trim(),      // optional: how the English voice says it
            active: x.active !== false
          };
        })
      : d.rooms;
    return out;
  };

  /* ---------- small helpers ---------- */
  S.roomEn = function(name){ return String(name).replace(/^Gabinete\s+/i, 'Room '); };
  /* What the English voice says for a room: its English name if set, otherwise
     "Gabinete 3" -> "Room 3". The screen always shows the normal name. */
  S.roomSpokenEn = function(room){ return (room && room.nameEn) ? room.nameEn : S.roomEn(room ? room.name : ''); };
  S.fill = function(tpl, n, room){ return String(tpl).split('{n}').join(n).split('{room}').join(room); };
  S.today = function(d){ d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  S.clamp = function(v, lo, hi){ v = +v; if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); };
  S.entryN = function(e){ var n = (e && typeof e === 'object') ? e.n : e; return (n && n > 0) ? n : 0; };

  S.db = function(){
    try{
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      return firebase.database();
    }catch(e){ console.error('Firebase not configured yet:', e); return null; }
  };

  /* ---------- grid layout ----------
     Auto mode tries every column count and keeps the one that gives
     the biggest readable number in a W x H area. */
  S.numberSize = function(tw, th){ return Math.min(th * 0.5, tw / 2.3); };
  S.bestCols = function(n, W, H, gap){
    var best = 1, bestScore = -1;
    for (var c = 1; c <= n; c++){
      var rows = Math.ceil(n / c);
      var perRow = Math.ceil(n / rows);
      var tw = (W - (perRow - 1) * gap) / perRow;
      var th = (H - (rows - 1) * gap) / rows;
      var score = S.numberSize(tw, th);
      if (score > bestScore + 0.5){ bestScore = score; best = c; }
    }
    return best;
  };
  /* Auto: spread tiles evenly (7 in 2 rows -> 4 + 3, 5 -> 3 + 2). */
  S.balancedRows = function(n, cols){
    var rows = Math.ceil(n / cols), base = Math.floor(n / rows), extra = n % rows, out = [];
    for (var i = 0; i < rows; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
  };
  /* Fixed columns: fill each row, the last row stretches. */
  S.filledRows = function(n, cols){
    var out = [], left = n;
    while (left > 0){ var take = Math.min(cols, left); out.push(take); left -= take; }
    return out;
  };
  S.layoutRows = function(settings, n, W, H, gap){
    if (n <= 0) return [];
    if (settings.grid && settings.grid.mode === 'fixed'){
      return S.filledRows(n, S.clamp(parseInt(settings.grid.cols, 10) || 4, 1, n));
    }
    return S.balancedRows(n, S.bestCols(n, W, H, gap));
  };

  /* ---------- media area geometry ----------
     Mirrors the display's CSS, so the settings page can say how big the
     media box is on a given screen. Values are approximate (±10 px). */
  S.isSide = function(pos){ return pos === 'left' || pos === 'right'; };
  S.mediaBox = function(settings, W, H){
    var v = settings.video;
    var c = function(lo, x, hi){ return Math.max(lo, Math.min(hi, x)); };
    var padX = c(19.2, 0.04 * W, 56), padY = c(16, 0.03 * H, 35.2);
    var headerH = 2 * c(12.8, 0.024 * H, 27.2) + 0.93 * c(24, 0.046 * H, 48) + 3;
    var stageW = W - 2 * padX, stageH = H - headerH - 2 * padY;
    if (S.isSide(v.position)) return { w: Math.round(S.clamp(v.width, 10, 70) / 100 * W), h: Math.round(stageH) };
    return { w: Math.round(stageW), h: Math.round(S.clamp(v.size, 10, 70) / 100 * H) };
  };
  /* Size a picture of nw x nh gets when centred inside a w x h box. */
  S.fitInside = function(nw, nh, w, h){
    var k = Math.min(w / nw, h / nh);
    return { w: Math.round(nw * k), h: Math.round(nh * k) };
  };

  /* ---------- chimes (synthesised, nothing to download) ---------- */
  S.CHIMES = [
    { id: 'classico',  label: 'Clássico (2 notas)' },
    { id: 'dingdong',  label: 'Ding-dong' },
    { id: 'tres',      label: 'Três notas' },
    { id: 'sino',      label: 'Sino' },
    { id: 'suave',     label: 'Suave' },
    { id: 'aeroporto', label: 'Aeroporto' },
    { id: 'xilofone',  label: 'Xilofone' }
  ];
  // notes: [frequency Hz, start s, length s]
  var CH = {
    classico:  { len: 650,  notes: [[784, 0, .5], [1046.5, .16, .5]] },
    dingdong:  { len: 1500, notes: [[659.25, 0, 1.1], [523.25, .4, 1.1]] },
    tres:      { len: 950,  notes: [[523.25, 0, .5], [659.25, .16, .5], [783.99, .32, .6]] },
    sino:      { len: 1900, bell: true, notes: [[880, 0, 1.8]] },
    suave:     { len: 1100, attack: .08, notes: [[587.33, 0, 1.0]] },
    aeroporto: { len: 1900, notes: [[659.25, 0, .55], [523.25, .32, .55], [587.33, .64, .55], [392, .96, .9]] },
    xilofone:  { len: 700,  wave: 'triangle', notes: [[1046.5, 0, .25], [1318.5, .09, .25], [1568, .18, .25], [2093, .27, .4]] }
  };
  /* Plays a chime on an AudioContext; returns its length in ms. */
  S.playChime = function(ctx, type, volume){
    var d = CH[type] || CH.classico;
    if (!ctx) return 0;
    var vol = S.clamp(volume == null ? 0.8 : volume, 0, 1);
    var now = ctx.currentTime + 0.02;
    var partials = d.bell ? [[1, 1], [2.76, .45], [5.4, .25], [8.93, .12]] : [[1, 1]];
    d.notes.forEach(function(nt){
      partials.forEach(function(p){
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = d.wave || 'sine';
        o.frequency.value = nt[0] * p[0];
        o.connect(g); g.connect(ctx.destination);
        var s = now + nt[1], att = d.attack || 0.012;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(Math.max(0.2 * vol * p[1], 0.0002), s + att);
        g.gain.exponentialRampToValueAtTime(0.0001, s + nt[2]);
        o.start(s); o.stop(s + nt[2] + 0.05);
      });
    });
    return d.len;
  };
})();
