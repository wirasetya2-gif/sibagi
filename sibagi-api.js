/**
 * SIBAGI RPS versi install (PWA di GitHub Pages).
 * Pengganti google.script.run: perintah yang sama (api, daftarAkun) dikirim ke Apps Script lewat doPost.
 *
 * Alamat Apps Script sengaja TIDAK ditulis di kode ini (repo-nya publik). Alamatnya dibawa link undangan:
 *   https://<akun>.github.io/<repo>/#k=<ID deployment Apps Script>
 * Dibuka sekali, disimpan di HP, lalu dihapus dari bilah alamat. Untuk pengujian lokal: #u=http://127.0.0.1:PORT/exec
 */
(function () {
  'use strict';
  var KUNCI = 'sibagiEndpoint';
  var simpan = function (v) { try { localStorage.setItem(KUNCI, v); } catch (e) { /* penyimpanan diblokir */ } };
  var baca = function () { try { return localStorage.getItem(KUNCI) || ''; } catch (e) { return ''; } };

  var cocok = location.hash.replace(/^#/, '').match(/(?:^|&)(k|u)=([^&]+)/);
  if (cocok) {
    var nilai = decodeURIComponent(cocok[2]);
    var url = cocok[1] === 'k' ? 'https://script.google.com/macros/s/' + nilai + '/exec' : nilai;
    if (/^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/.test(url) || /^http:\/\/127\.0\.0\.1:\d+\/exec$/.test(url)) simpan(url);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* abaikan */ }
  }

  function kirim(fn, args) {
    var ep = baca();
    if (!ep) {
      return Promise.reject(new Error('Aplikasi belum tersambung. Buka sekali link undangan SIBAGI dari A Wira (link yang panjang dari WhatsApp).'));
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

  // ---- pasang di HP: tombol muncul kalau Chrome menawarkan install dan aplikasi belum terpasang
  var tawaran = null, tombol = null;
  var terpasang = function () {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  };
  // tombol × = "nanti saja": disembunyikan 3 hari supaya tidak terus menutupi kartu akun di layar Masuk
  var KUNCI_TUTUP = 'sibagiTutupPasang';
  function tampilTombol() {
    if (tombol || terpasang() || !document.body) return;
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
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    tawaran = e;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tampilTombol); else tampilTombol();
  });
  window.addEventListener('appinstalled', function () { tawaran = null; sembunyi(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* tetap jalan tanpa cache */ }); });
  }

  window.SIBAGI_PWA = {
    endpoint: baca,
    lupakan: function () { try { localStorage.removeItem(KUNCI); } catch (e) { /* abaikan */ } },
    terpasang: terpasang
  };
})();
