(function (global) {
  "use strict";

  /* ============ cookies ============ */
  // Leitura e gravação de cookies. O "Secure" só vai quando a página está em
  // https: aberto por http://localhost o navegador descartaria o cookie.
  function set(name, value, days) {
    var parts = [
      encodeURIComponent(name) + "=" + encodeURIComponent(value),
      "max-age=" + Math.round(days * 24 * 60 * 60),
      "path=/",
      "SameSite=Lax"
    ];
    if (location.protocol === "https:") parts.push("Secure");
    document.cookie = parts.join("; ");
  }

  function get(name) {
    var key = encodeURIComponent(name) + "=";
    var found = document.cookie.split("; ").filter(function (c) { return c.indexOf(key) === 0; })[0];
    if (!found) return null;
    try { return decodeURIComponent(found.slice(key.length)); } catch (err) { return null; }
  }

  function remove(name) {
    document.cookie = encodeURIComponent(name) + "=; max-age=0; path=/";
  }

  /* ============ aviso de cookies (LGPD) ============ */
  // Tudo o que o sistema guarda no navegador é necessário para ele funcionar
  // (a sessão do login, o tema e o rascunho da carteira), então a LGPD pede só
  // que o aluno seja avisado, sem opção de recusar. Se um dia entrar analytics
  // ou pixel de anúncio, aí precisa de um botão "Recusar" e só carregar esses
  // scripts depois do "Aceitar".
  var AVISO = "aviso_cookies";

  function mountBanner() {
    var banner = document.getElementById("cookie-banner");
    if (!banner || get(AVISO)) return;

    banner.hidden = false;
    document.getElementById("cookie-ok").addEventListener("click", function () {
      set(AVISO, "ok", 365);
      banner.hidden = true;
    });
  }

  global.Cookies = { set: set, get: get, remove: remove };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountBanner);
  } else {
    mountBanner();
  }
})(window);
