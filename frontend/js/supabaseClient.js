(function (global) {
  "use strict";

  var cfg = global.SUPABASE_CONFIG || {};
  var isConfigured = !!(cfg.url && cfg.anonKey && cfg.url.indexOf("COLE_AQUI") === -1);

  // Lido antes do createClient: o Supabase consome e apaga o #hash do
  // endereço ao iniciar.
  var hash = global.location.hash || "";
  var linkError = null;

  // A volta do "Continuar com o Google" (o google-auth.js marca a ida nesta
  // aba). Erro na volta vira o aviso da tela de login e sai do endereço, pra
  // não aparecer de novo ao recarregar a página; desistir na tela do Google
  // (access_denied) só traz a pessoa de volta, sem aviso.
  var oauthReturn = false;
  try {
    oauthReturn = global.sessionStorage.getItem("oauth-google") === "1";
    global.sessionStorage.removeItem("oauth-google");
  } catch (err) {}
  var returned = (global.location.search || "") + hash;
  function oauthParam(name) {
    var parts = [global.location.search || "", hash || ""];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].replace(/^[?#]/, "");
      if (!part) continue;
      try {
        var value = new URLSearchParams(part).get(name);
        if (value) return value;
      } catch (err) {}
    }
    return "";
  }

  function oauthErrorMessage() {
    var code = oauthParam("error_code");
    var error = oauthParam("error");
    var description = oauthParam("error_description");
    var normalized = (code + " " + error + " " + description).toLowerCase();

    // O Google usa access_denied quando a pessoa fecha ou cancela a escolha.
    if (error === "access_denied" && !code && !description) return "";
    if (/redirect.*(allow|url)|redirect_to|redirect uri/.test(normalized)) {
      return "O endereço de retorno desta página não está autorizado no Supabase. Adicione a URL atual em Authentication → URL Configuration → Redirect URLs.";
    }
    if (/provider.*(disabled|not enabled)|google.*(disabled|not enabled)/.test(normalized)) {
      return "O provedor Google está desativado no Supabase. Confira Authentication → Sign In / Providers → Google.";
    }
    if (/invalid.*(client|credentials)|unauthorized_client|client_id/.test(normalized)) {
      return "O Client ID do Google não foi aceito. Confira o Client ID e o Client Secret configurados no provedor Google do Supabase.";
    }
    if (/exchange.*(code|external)|code.*(exchange|verif)/.test(normalized)) {
      return "O Google não aceitou a troca do código de login. Confira no Google Cloud se a URI autorizada é https://xorqsuqjmvkyzgagdxfz.supabase.co/auth/v1/callback e se o Client ID e o Client Secret correspondem.";
    }
    if (description) {
      return "Falha no login com Google: " + description.replace(/[<>]/g, "").slice(0, 180);
    }
    return "Não foi possível entrar com o Google (" + (code || error || "erro sem código") + "). Confira as configurações OAuth no Supabase e no Google Cloud.";
  }

  if (oauthReturn && !linkError && /(^|[?&#])error=/.test(returned)) {
    oauthReturn = false;
    linkError = oauthErrorMessage() || null;
    try { global.history.replaceState(null, "", global.location.pathname); } catch (err) {}
  }

  var client = isConfigured
    ? global.supabase.createClient(cfg.url, cfg.anonKey)
    : null;

  global.DB = {
    isConfigured: isConfigured,
    client: client,
    linkError: linkError,
    oauthReturn: oauthReturn
  };
})(window);
