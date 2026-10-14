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
      // the logo is a row in the same list, so it can sit anywhere in the grid
      rooms: [{ id: 'logo', name: 'Logótipo', active: true }].concat(
             rooms.map(function(name, i){ return { id: String(i), name: String(name), active: true }; })),
      grid: { mode: 'auto', cols: 4 },
      // media area: a playlist of videos and images from the media/ folder.
      // Each item: { file: 'media/x.jpg', on: true|false }. video.mp4 at the top
      // level is kept from the first version so an existing setup keeps playing.
      video: { on: true, playlist: [{ file: 'video.mp4', on: true }], seconds: 8,
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
    // the playlist can come back from the database as an object; make it a clean array
    var pl = (isObj(saved.video) && saved.video.playlist !== undefined) ? saved.video.playlist : d.video.playlist;
    if (isObj(pl)) pl = Object.keys(pl).sort(function(a, b){ return (+a) - (+b); }).map(function(k){ return pl[k]; });
    var seen = {};
    out.video.playlist = (Array.isArray(pl) ? pl : []).filter(function(x){
      if (!x || !x.file || seen[x.file]) return false;
      seen[x.file] = 1; return true;
    }).map(function(x){ return { file: String(x.file), on: x.on !== false }; });
    if (['bottom','top','left','right'].indexOf(out.video.position) === -1) out.video.position = 'bottom';

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
    // exactly one logo row; older settings without it get one at the top (honouring the old on/off switch)
    var logoSeen = false;
    out.rooms = out.rooms.filter(function(r){ if (r.id !== 'logo') return true; if (logoSeen) return false; logoSeen = true; return true; });
    if (!logoSeen) out.rooms.unshift({ id: 'logo', name: 'Logótipo', nameEn: '', active: saved.showLogo !== false });
    return out;
  };

  /* ---------- small helpers ---------- */
  S.isLogo = function(r){ return !!r && r.id === 'logo'; };
  S.realRooms = function(settings){ return settings.rooms.filter(function(r){ return r.id !== 'logo'; }); };
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

  /* ---------- media files ---------- */
  S.MEDIA_FOLDER = (typeof MEDIA_FOLDER === 'string' && MEDIA_FOLDER) ? MEDIA_FOLDER.replace(/\/+$/, '') : 'media';
  S.VIDEO_EXT = ['mp4', 'webm', 'm4v', 'mov', 'ogv'];
  S.IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'];
  S.ext = function(f){ var m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(String(f)); return m ? m[1].toLowerCase() : ''; };
  S.isVideo = function(f){ return S.VIDEO_EXT.indexOf(S.ext(f)) !== -1; };
  S.isImage = function(f){ return S.IMAGE_EXT.indexOf(S.ext(f)) !== -1; };
  S.isMedia = function(f){ return S.isVideo(f) || S.isImage(f); };
  /* A path like "media/Cartaz de Verão.jpg" made safe for src="" */
  S.url = function(path){ return String(path).split('/').map(encodeURIComponent).join('/'); };
  S.baseName = function(path){ return String(path).split('/').pop(); };

  /* Which repository are these pages served from? "owner/repo", or null.
     config.js may set MEDIA_REPO = "owner/repo" (needed with a custom web address). */
  S.githubRepo = function(){
    if (typeof MEDIA_REPO === 'string' && MEDIA_REPO.indexOf('/') > 0) return MEDIA_REPO;
    var h = location.hostname.toLowerCase();
    if (!/\.github\.io$/.test(h)) return null;
    var owner = h.replace(/\.github\.io$/, '');
    var seg = location.pathname.split('/').filter(Boolean);
    // project site: owner.github.io/repo/page.html ; user site: owner.github.io/page.html
    var repo = (seg.length >= 2 || (seg.length === 1 && !/\.[a-z0-9]+$/i.test(seg[0]))) ? seg[0] : (owner + '.github.io');
    return owner + '/' + repo;
  };

  /* Lists the videos/images in the media folder.
     Resolves to { files: [{ file, size }], source } or rejects with { reason }. */
  S.detectMedia = function(){
    var folder = S.MEDIA_FOLDER;
    var repo = S.githubRepo();
    function keep(list){
      return list.filter(function(x){ return S.isMedia(x.file); })
                 .sort(function(a, b){ return a.file.localeCompare(b.file, 'pt'); });
    }
    if (repo){
      var api = 'https://api.github.com/repos/' + repo + '/contents/' + S.url(folder) + '?t=' + Date.now();
      return fetch(api, { headers: { 'Accept': 'application/vnd.github+json' } }).then(function(r){
        if (r.status === 404) throw { reason: 'nofolder', repo: repo };
        if (r.status === 403 || r.status === 429) throw { reason: 'ratelimit' };
        if (!r.ok) throw { reason: 'http', status: r.status };
        return r.json();
      }).then(function(items){
        if (!Array.isArray(items)) throw { reason: 'nofolder', repo: repo };
        return {
          source: 'github', repo: repo,
          files: keep(items.filter(function(x){ return x.type === 'file'; })
                           .map(function(x){ return { file: folder + '/' + x.name, size: x.size }; }))
        };
      }, function(err){ throw (err && err.reason) ? err : { reason: 'network' }; });
    }
    // Any other server (e.g. the Raspberry Pi later): read the folder's index page.
    return fetch(S.url(folder) + '/?t=' + Date.now()).then(function(r){
      if (r.status === 404) throw { reason: 'nofolder' };
      if (!r.ok) throw { reason: 'http', status: r.status };
      return r.text();
    }).then(function(html){
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var names = {};
      [].forEach.call(doc.querySelectorAll('a[href]'), function(a){
        var href = a.getAttribute('href').split('?')[0].split('#')[0];
        if (!href || /\/$/.test(href) || /^(https?:|\/|\.\.)/.test(href)) return;
        try{ names[decodeURIComponent(href)] = 1; }catch(e){}
      });
      return { source: 'folder', files: keep(Object.keys(names).map(function(n){ return { file: folder + '/' + n }; })) };
    }, function(err){ throw (err && err.reason) ? err : { reason: 'network' }; });
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
