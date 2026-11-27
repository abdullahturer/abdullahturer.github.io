// Zikirmatik web titreşim ve bip köprüsü. Uygulama (Dart) şunları çağırır:
//   window.zkTitresimVar()    tarayıcı titreşim destekliyor mu (iPhone: hayır)
//   window.zkTitresim(desen)  desen: [titreşim_ms, ara_ms, titreşim_ms, ...]
//   window.zkBip(n)           n kez kısa bip
//   window.zkSesAyari(acik)   bildirim sesi ayarı (açıkken ses ilk dokunuşta hazırlanır)
//
// TİTREŞİM
// - Android Chrome vb.: navigator.vibrate ile gerçek titreşim.
// - iPhone (Safari): web'den titreşim mümkün değil; uygulama iPhone'da titreşim yerine
//   bip sesi kullanır (üstteki düğme bip aç/kapa olur).
//
// BİP
// - Bip sesi küçük bir WAV dosyası olarak üretilip <audio> ile çalınır. iPhone'da <audio>,
//   video gibi, yandaki sessiz anahtarı açıkken de çalar (Web Audio ise susar).
//   iPhone her ses öğesinin önce bir dokunuşla "açılmasını" ister; ayar açıkken ilk dokunuşta açılır.
(function () {
  // ---------------- Dokunuş takibi ----------------
  var parmakBasili = false;
  var bekleyenler = []; // parmak kalkınca çalışacak işler

  function parmakKalkti() {
    parmakBasili = false;
    var isler = bekleyenler;
    bekleyenler = [];
    for (var i = 0; i < isler.length; i++) {
      try {
        isler[i]();
      } catch (e) {}
    }
  }

  document.addEventListener(
    'pointerdown',
    function (e) {
      if (e.pointerType !== 'mouse') parmakBasili = true;
    },
    true
  );
  document.addEventListener('touchstart', function () { parmakBasili = true; }, true);
  document.addEventListener('touchend', parmakKalkti, true);
  document.addEventListener('touchcancel', parmakKalkti, true);
  // Fare / kalem: tıklama sonunda
  document.addEventListener('click', parmakKalkti, true);

  // İşi etkileşim içinde çalıştır: parmak ekrandaysa kalkınca, değilse hemen.
  // Parmak kalkma olayı hiç gelmezse 600 ms sonra yine de dene.
  function etkilesimde(is) {
    if (!parmakBasili) {
      is();
      return;
    }
    var yapildi = false;
    var tek = function () {
      if (yapildi) return;
      yapildi = true;
      is();
    };
    bekleyenler.push(tek);
    setTimeout(tek, 600);
  }

  // ---------------- Titreşim ----------------
  window.zkTitresimVar = function () {
    return typeof navigator.vibrate === 'function';
  };

  window.zkTitresim = function (desen) {
    if (!Array.isArray(desen) || desen.length === 0) desen = [30];
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(desen);
    } catch (e) {}
    return true;
  };

  // ---------------- Bip ----------------
  var sesAcik = false;
  var sesler = {}; // n -> <audio>
  var acildi = false;
  var hazir = {}; // n -> ses öğesi dokunuşla açıldı mı (sonraki çalmalar bekletilmez)

  var ORAN = 22050;

  // n bip içeren ses örnekleri (C6 ~1046 Hz, 180 ms bip, 120 ms ara), -1..1 aralığında.
  function ornekler(n) {
    var rate = ORAN;
    var bip = Math.round(rate * 0.18);
    var ara = Math.round(rate * 0.12);
    var toplam = n * bip + (n - 1) * ara + Math.round(rate * 0.05);
    var atak = Math.round(rate * 0.01);
    var sonum = Math.round(rate * 0.04);
    var out = new Float32Array(toplam);
    for (var s = 0; s < toplam; s++) {
      var periyot = bip + ara;
      var konum = s % periyot;
      var hangi = Math.floor(s / periyot);
      if (hangi < n && konum < bip) {
        var zarf = Math.min(1, konum / atak, (bip - konum) / sonum);
        out[s] = Math.sin((2 * Math.PI * 1046.5 * konum) / rate) * 0.7 * zarf;
      }
    }
    return out;
  }

  // Aynı sesi 16-bit mono WAV dosyası olarak üret (<audio> yedeği için).
  function wavUrl(n) {
    var rate = ORAN;
    var veri = ornekler(n);
    var toplam = veri.length;
    var buf = new ArrayBuffer(44 + toplam * 2);
    var v = new DataView(buf);
    function yaz(o, s) {
      for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    }
    yaz(0, 'RIFF');
    v.setUint32(4, 36 + toplam * 2, true);
    yaz(8, 'WAVE');
    yaz(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    yaz(36, 'data');
    v.setUint32(40, toplam * 2, true);
    for (var s = 0; s < toplam; s++) {
      v.setInt16(44 + s * 2, Math.round(veri[s] * 32767), true);
    }
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  function ses(n) {
    if (!sesler[n]) {
      var a = new Audio();
      a.preload = 'auto';
      a.src = wavUrl(n);
      a.setAttribute('playsinline', '');
      sesler[n] = a;
    }
    return sesler[n];
  }

  // ---- Düşük gecikmeli yol: Web Audio ----
  // <audio> Safari'de 100-300 ms gecikmeyle başlar; Web Audio ~10-20 ms. Ancak iPhone'da
  // Web Audio, yandaki sessiz anahtarı açıkken susar. iOS 17+ Safari'de
  // navigator.audioSession.type = 'playback' ile sessiz modda da çalar; bu özelliği olmayan
  // eski iPhone'larda <audio> yedeği kullanılır.
  var iOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var AC = window.AudioContext || window.webkitAudioContext;
  var waUygun = !!AC && (!iOS || !!navigator.audioSession);
  var ctx = null;
  var tamponlar = {}; // n -> AudioBuffer

  function motoruAc() {
    if (!waUygun) return;
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) {}
    try {
      if (!ctx) ctx = new AC();
      if (ctx.state !== 'running') ctx.resume();
      if (!tamponlar[1]) {
        [1, 3].forEach(function (n) {
          var veri = ornekler(n);
          var b = ctx.createBuffer(1, veri.length, ORAN);
          b.getChannelData(0).set(veri);
          tamponlar[n] = b;
        });
      }
      // Bir dokunuş içinde kısa sessiz bir çalma: Safari motoru böylece açar.
      var sessiz = ctx.createBufferSource();
      sessiz.buffer = ctx.createBuffer(1, 1, ORAN);
      sessiz.connect(ctx.destination);
      sessiz.start(0);
    } catch (e) {}
  }

  function waCal(n) {
    if (!ctx || ctx.state !== 'running' || !tamponlar[n]) return false;
    try {
      var kaynak = ctx.createBufferSource();
      kaynak.buffer = tamponlar[n];
      kaynak.connect(ctx.destination);
      kaynak.start(0);
      return true;
    } catch (e) {
      return false;
    }
  }

  // iPhone: ses öğelerini bir dokunuş içinde sessizce çalıp durdurarak "aç".
  function sesleriAc() {
    if (!sesAcik) return;
    motoruAc(); // her dokunuşta: kesintiden (ör. telefon araması) sonra da yeniden açılsın
    if (acildi) return;
    acildi = true;
    [1, 3].forEach(function (n) {
      var a = ses(n);
      a.muted = true;
      var p = a.play();
      var bitir = function () {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        hazir[n] = true;
      };
      if (p && p.then) {
        p.then(bitir).catch(function () {
          a.muted = false;
          acildi = false; // olmadıysa sonraki dokunuşta tekrar dene
        });
      } else {
        bitir();
      }
    });
  }
  document.addEventListener('touchend', sesleriAc, true);
  document.addEventListener('click', sesleriAc, true);

  window.zkSesAyari = function (acik) {
    sesAcik = !!acik;
  };

  function cal(n) {
    var a = ses(n);
    a.muted = false;
    try {
      a.currentTime = 0;
    } catch (e) {}
    var p = a.play();
    if (p && p.catch) {
      p.catch(function () {
        // İzin yoksa bir sonraki dokunuşta çal.
        bekleyenler.push(function () {
          a.play().catch(function () {});
        });
      });
    }
  }

  window.zkBip = function (n) {
    n = (n | 0) >= 3 ? 3 : 1;
    // En hızlı yol: açık Web Audio motoru (sayıyla aynı anda).
    if (waCal(n)) return true;
    // Yedek: <audio>. Ses bir kez açıldıysa bekletmeden çal;
    // açılmadıysa parmak kalktığı ana (Safari'nin izin verdiği an) ertele.
    if (hazir[n]) cal(n);
    else
      etkilesimde(function () {
        cal(n);
      });
    return true;
  };
})();
