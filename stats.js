// Zikirmatik anonim kullanım sayacı (GoatCounter).
// - Çerez yok, kimlik yok: yalnızca "bir ziyaret oldu" bilgisi, sayfa adı, ekran boyutu
//   ve nereden gelindiği (referrer) gönderilir. Ülke/bölgeyi GoatCounter kendisi çıkarır.
// - Kod (abdullahturer) derleme betiği tarafından doldurulur; doldurulmazsa hiçbir şey göndermez.
// - Yerelde (localhost) ve internet yokken sessizce hiçbir şey yapmaz.
(function () {
  var code = 'abdullahturer';
  if (!code || code.indexOf('__') === 0) {
    window.zkSay = function () {};
    return;
  }
  var host = location.hostname;
  var local = host === 'localhost' || host === '127.0.0.1' || host === '';

  function send(path, title, isEvent) {
    if (local) return;
    var q =
      'p=' + encodeURIComponent(path) +
      '&t=' + encodeURIComponent(title || document.title) +
      '&r=' + encodeURIComponent(document.referrer || '') +
      '&s=' + encodeURIComponent(screen.width + ',' + screen.height + ',' + (window.devicePixelRatio || 1)) +
      (isEvent ? '&e=true' : '') +
      '&rnd=' + Math.random().toString(36).slice(2);
    // Tek yöntem (görünmez resim isteği): sendBeacon "gönderemedim" deyip yine de
    // gönderebildiği için yedekle birlikte kullanmak çift sayıma yol açıyordu.
    new Image().src = 'https://' + code + '.goatcounter.com/count?' + q;
  }

  window.zkSay = send;

  // Ana ekrana eklenip uygulama gibi açıldıysa ayrı say (kurulum göstergesi).
  var standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;
  var page = document.documentElement.getAttribute('data-sayfa') || location.pathname;
  if (page === '/' && standalone) {
    send('ana-ekrandan-acilis', 'Ana ekrandan açılış (uygulama olarak)', true);
  } else {
    send(page, document.title, false);
  }
})();
