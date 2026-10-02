/**
 * SIBAGI RPS versi install (PWA di GitHub Pages).
 * Pengganti google.script.run: perintah yang sama (api, daftarAkun) dikirim ke Apps Script lewat doPost.
 *
 * Alamat Apps Script sengaja TIDAK ditulis di kode ini (repo-nya publik). Alamatnya dibawa link undangan:
 *   https://<akun>.github.io/<repo>/#k=<ID deployment Apps Script>
 * Dibuka sekali, disimpan di HP, lalu dihapus dari bilah alamat. Untuk pengujian lokal: #u=http://127.0.0.1:PORT/exec
 * Ikon di layar utama iPhone punya penyimpanan sendiri (tidak berbagi dengan Safari), jadi kalau HP belum menyimpan
 * alamatnya, muncul kotak "Sambungkan SIBAGI" untuk menempel link undangan sekali.
 */
(function () {
  'use strict';
  var KUNCI = 'sibagiEndpoint';
  var simpan = function (v) { try { localStorage.setItem(KUNCI, v); } catch (e) { /* penyimpanan diblokir */ } };
  var baca = function () { try { return localStorage.getItem(KUNCI) || ''; } catch (e) { return ''; } };
  var sah = function (url) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/.test(url) || /^http:\/\/127\.0\.0\.1:\d+\/exec$/.test(url);
  };

  /** Alamat server dari link undangan (...#k=<ID> / ...#u=<alamat>), alamat .../exec, atau ID deployment saja. '' kalau tidak dikenali. */
  function alamatDari(teks) {
    teks = String(teks || '').trim();
    var m = teks.match(/[#&?](k|u)=([^&\s#]+)/), url = '';
    if (m) {
      var nilai = m[2];
      try { nilai = decodeURIComponent(nilai); } catch (e) { /* biarkan apa adanya */ }
      url = m[1] === 'k' ? 'https://script.google.com/macros/s/' + nilai + '/exec' : nilai;
    } else {
      var a = teks.match(/https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec/);
      if (a) url = a[0];
      else if (/^[\w-]{40,}$/.test(teks)) url = 'https://script.google.com/macros/s/' + teks + '/exec';
    }
    return sah(url) ? url : '';
  }

  if (/(?:^#|&)(k|u)=/.test(location.hash)) {
    var dariLink = alamatDari(location.hash);
    if (dariLink) simpan(dariLink);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* abaikan */ }
  }

  /** Link undangan untuk HP ini, dipakai tombol "Salin link sambungan" di panduan iPhone. */
  function linkUndangan() {
    var ep = baca();
    if (!ep) return '';
    var m = ep.match(/^https:\/\/script\.google\.com\/macros\/s\/([\w-]+)\/exec$/);
    return location.origin + location.pathname + (m ? '#k=' + m[1] : '#u=' + encodeURIComponent(ep));
  }

  function kirim(fn, args) {
    var ep = baca();
    if (!ep) {
      tampilSambung();
      return Promise.reject(new Error('Aplikasi belum tersambung. Tempel link undangan SIBAGI dari WhatsApp di kotak "Sambungkan SIBAGI".'));
    }
    return fetch(ep, {
      method: 'POST', redirect: 'follow', cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // text/plain = tanpa preflight CORS
      body: JSON.stringify({ fn: fn, args: args })
    }).then(function (r) {
      if (!r.ok) throw new Error('Server SIBAGI tidak menjawab (kode ' + r.status + '). Coba lagi sebentar.');
      return r.json();
    }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || 'Terjadi kesalahan di server.');
      return j.data;
    }, function (e) {
      if (e && e.name === 'TypeError') throw new Error('Tidak tersambung ke server. Cek internet, lalu coba lagi.');
      throw e;
    });
  }

  function buatRunner(ok, gagal) {
    var jalankan = function (fn, args) {
      kirim(fn, Array.prototype.slice.call(args)).then(function (d) { if (ok) ok(d); }, function (e) { if (gagal) gagal(e); });
    };
    return {
      withSuccessHandler: function (f) { return buatRunner(f, gagal); },
      withFailureHandler: function (f) { return buatRunner(ok, f); },
      api: function () { jalankan('api', arguments); },
      daftarAkun: function () { jalankan('daftarAkun', arguments); }
    };
  }

  window.google = window.google || {};
  window.google.script = {
    run: buatRunner(null, null),
    history: {
      push: function (state, params, hash) { history.pushState(state, '', '#' + (hash || '')); },
      setChangeHandler: function (fn) { window.addEventListener('popstate', function (e) { fn({ state: e.state }); }); }
    }
  };

  // ---- lapisan di atas tampilan utama (di bawah animasi pembuka z-index 100, di atas layar muat 80)
  function lapisan(id) {
    var d = document.createElement('div');
    d.id = id;
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.style.cssText = 'position:fixed;inset:0;z-index:95;background:rgba(10,20,17,.5);display:flex;align-items:center;' +
      'justify-content:center;padding:18px;overflow-y:auto';
    return d;
  }
  var KARTU = '<div class="card" style="width:100%;max-width:420px;margin:auto;box-shadow:0 12px 32px rgba(0,0,0,.25)">';

  // ---- kotak "Sambungkan SIBAGI": HP ini belum menyimpan alamat server
  var kotak = null;
  function tampilSambung() {
    if (kotak || baca()) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', tampilSambung); return; }
    kotak = lapisan('sibagiSambung');
    kotak.setAttribute('aria-labelledby', 'sbJudul');
    kotak.innerHTML = KARTU + '<h2 id="sbJudul">Sambungkan SIBAGI</h2>' +
      '<p class="muted small" style="margin:0">HP ini belum tersambung ke server SIBAGI. Salin link undangan SIBAGI dari WhatsApp ' +
      '(link panjang dari A Wira), lalu tempel di sini. Cukup sekali.</p>' +
      '<label class="lb" for="sbLink">Link undangan</label>' +
      '<input id="sbLink" class="in" type="text" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" ' +
      'spellcheck="false" placeholder="https://.../sibagi/#k=...">' +
      '<div id="sbErr" class="err"></div>' +
      '<button type="button" class="btn ghost" id="sbTempel">Tempel link yang sudah disalin</button>' +
      '<button type="button" class="btn" id="sbOk">Sambungkan</button></div>';
    document.body.appendChild(kotak);
    sembunyi();   // tombol Pasang baru berguna setelah tersambung
    var masukan = kotak.querySelector('#sbLink'), galat = kotak.querySelector('#sbErr'), tombolOk = kotak.querySelector('#sbOk');
    var sambung = function () {
      var url = alamatDari(masukan.value);
      if (!url) {
        galat.textContent = 'Link tidak dikenali. Yang ditempel harus link undangan SIBAGI (ada tulisan #k= di belakangnya).';
        return;
      }
      simpan(url);
      if (baca() !== url) { galat.textContent = 'HP ini menolak menyimpan data. Matikan mode Privat, lalu coba lagi.'; return; }
      galat.textContent = '';
      tombolOk.disabled = true;
      tombolOk.textContent = 'Tersambung. Memuat ulang...';
      setTimeout(function () { location.reload(); }, 300);
    };
    tombolOk.onclick = sambung;
    masukan.addEventListener('keydown', function (e) { if (e.key === 'Enter') sambung(); });
    kotak.querySelector('#sbTempel').onclick = function () {
      var manual = function () {
        galat.textContent = 'Salinan tidak bisa dibaca otomatis. Tekan lama kotak di atas, pilih Tempel, lalu ketuk Sambungkan.';
        masukan.focus();
      };
      if (!navigator.clipboard || !navigator.clipboard.readText) { manual(); return; }
      navigator.clipboard.readText().then(function (t) {
        masukan.value = String(t || '').trim();
        if (masukan.value) sambung(); else manual();
      }, manual);
    };
  }

  // ---- pasang di HP: Chrome (Android/laptop) menawarkan install sendiri; iPhone lewat Bagikan > Tambah ke Layar Utama
  var tawaran = null, tombol = null, panduan = null;
  var terpasang = function () {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  };
  var diIphone = function () {
    return /iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };
  // tombol × = "nanti saja": disembunyikan 3 hari supaya tidak terus menutupi kartu akun di layar Masuk
  var KUNCI_TUTUP = 'sibagiTutupPasang';
  function tampilTombol() {
    if (tombol || kotak || terpasang() || !document.body) return;
    try { if (Number(localStorage.getItem(KUNCI_TUTUP) || 0) > Date.now()) return; } catch (e) { /* abaikan */ }
    tombol = document.createElement('div');
    tombol.id = 'btnPasangApp';
    tombol.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:65;' +
      'display:flex;align-items:center;background:#F5B400;color:#1A1300;border:1.5px solid #8A6100;border-radius:999px;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.28);font:700 15px system-ui,sans-serif;white-space:nowrap';
    tombol.innerHTML = '<button type="button" id="btnPasangYa" style="background:none;border:0;color:inherit;font:inherit;padding:11px 6px 11px 18px;cursor:pointer">' +
      'Pasang SIBAGI di HP</button><button type="button" id="btnPasangNanti" aria-label="Nanti saja" title="Nanti saja" ' +
      'style="background:none;border:0;border-left:1px solid rgba(26,19,0,.25);color:inherit;font:700 18px/1 system-ui,sans-serif;padding:9px 14px 9px 10px;cursor:pointer">×</button>';
    tombol.querySelector('#btnPasangYa').onclick = function () {
      if (diIphone()) { tampilPanduanIphone(); return; }
      if (!tawaran) return;
      tawaran.prompt();
      tawaran.userChoice.then(function () { tawaran = null; sembunyi(); });
    };
    tombol.querySelector('#btnPasangNanti').onclick = function () {
      try { localStorage.setItem(KUNCI_TUTUP, String(Date.now() + 3 * 864e5)); } catch (e) { /* abaikan */ }
      sembunyi();
    };
    document.body.appendChild(tombol);
  }
  function sembunyi() { if (tombol) { tombol.remove(); tombol = null; } }

  function salin(teks) {
    var cadangan = function () {
      var t = document.createElement('textarea');
      t.value = teks;
      t.setAttribute('readonly', '');
      t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(t);
      t.select();
      t.setSelectionRange(0, teks.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove();
      return ok;
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(teks).then(function () { return true; }, function () { return cadangan(); });
    }
    return Promise.resolve(cadangan());
  }

  /** iPhone tidak punya tombol install otomatis: tampilkan langkah Bagikan > Tambah ke Layar Utama. */
  function tampilPanduanIphone() {
    if (panduan || !document.body) return;
    var link = linkUndangan();
    panduan = lapisan('sibagiPanduanIphone');
    panduan.setAttribute('aria-labelledby', 'piJudul');
    panduan.innerHTML = KARTU + '<h2 id="piJudul">Pasang SIBAGI di iPhone</h2>' +
      '<ol style="margin:0 0 12px;padding-left:22px;line-height:1.55">' +
      (link ? '<li>Ketuk <b>Salin link sambungan</b> di bawah. Nanti dipakai sekali di ikon baru.</li>' : '') +
      '<li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas). Di Safari letaknya di bawah layar atau di menu <b>•••</b>; ' +
      'di Chrome ada di bilah alamat.</li>' +
      '<li>Pilih <b>Tambah ke Layar Utama</b>, lalu <b>Tambah</b>.</li>' +
      '<li>Buka ikon SIBAGI di layar utama' + (link ? ', ketuk <b>Tempel link yang sudah disalin</b>, selesai.' : '.') + '</li></ol>' +
      (link ? '<button type="button" class="btn ghost" id="piSalin">Salin link sambungan</button>' +
        '<div id="piSalinKet" class="muted small" style="margin:6px 0 4px;min-height:1em;word-break:break-all"></div>' : '') +
      '<button type="button" class="btn" id="piTutup">Mengerti</button></div>';
    document.body.appendChild(panduan);
    var tutup = function () { if (panduan) { panduan.remove(); panduan = null; } };
    panduan.querySelector('#piTutup').onclick = tutup;
    panduan.addEventListener('click', function (e) { if (e.target === panduan) tutup(); });
    var tSalin = panduan.querySelector('#piSalin');
    if (tSalin) {
      tSalin.onclick = function () {
        var ket = panduan.querySelector('#piSalinKet');
        salin(link).then(function (ok) {
          ket.textContent = ok ? 'Link tersalin. Lanjut ke langkah 2.' : 'Salin manual link ini: ' + link;
        });
      };
    }
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    tawaran = e;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tampilTombol); else tampilTombol();
  });
  window.addEventListener('appinstalled', function () { tawaran = null; sembunyi(); });

  var mulai = function () {
    if (!baca()) tampilSambung();
    if (diIphone()) tampilTombol();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else mulai();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* tetap jalan tanpa cache */ }); });
  }

  window.SIBAGI_PWA = {
    endpoint: baca,
    lupakan: function () { try { localStorage.removeItem(KUNCI); } catch (e) { /* abaikan */ } },
    terpasang: terpasang,
    linkUndangan: linkUndangan
  };
})();
