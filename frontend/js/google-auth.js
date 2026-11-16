(function (global) {
  "use strict";

  // "Continuar com o Google": o botão do alto de "Entrar" e de "Criar conta",
  // o mesmo em todos os sistemas da Financial Experts (o mesmo projeto
  // Supabase, as mesmas contas). O clique leva à tela de contas do Google; na
  // volta, o Supabase lê o login do endereço e a página segue como num login
  // por e-mail. Quem ainda não tem conta ganha uma na hora, e quem já tem
  // conta com o mesmo e-mail do Google entra nela mesma.
  //
  // O botão é qualquer elemento com [data-google] (o data-err diz em qual
  // aviso de erro escrever). O clique é ouvido no documento inteiro, então
  // vale tanto para o HTML fixo quanto para a tela montada pelo auth.js.
  //
  // Para funcionar, o Google precisa estar ligado no Supabase (Authentication
  // -> Sign In / Providers -> Google) e o endereço desta página precisa estar
  // nos Redirect URLs (Authentication -> URL Configuration), como já é
  // preciso para o link do "Esqueceu a senha?".

  var DB = global.DB || {};
  // a mesma chave que o supabaseClient.js lê na volta do Google
  var FLAG = "oauth-google";
  var LABEL = "Continuar com o Google";
  var LABEL_BUSY = "Conectando ao Google…";

  var busy = false;

  // o endereço da página, sem o #hash e sem o ?busca: é pra onde o Google
  // devolve a pessoa
  function pageUrl() {
    return global.location.href.split("#")[0].split("?")[0];
  }

  // os dois botões (o de Entrar e o de Criar conta) carregam juntos
  function setBusy(on) {
    busy = on;
    var buttons = document.querySelectorAll("[data-google]");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      btn.disabled = on;
      btn.classList.toggle("is-loading", on);
      if (on) btn.setAttribute("aria-busy", "true");
      else btn.removeAttribute("aria-busy");
      var text = btn.querySelector(".gbtn__text");
      if (text) text.textContent = on ? LABEL_BUSY : LABEL;
    }
  }

  function setMsg(btn, msg) {
    var el = document.getElementById(btn.getAttribute("data-err"));
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-on", !!msg);
  }

  /* ============ o Google está ligado no Supabase? ============ */
  // Desligado, o Supabase abriria uma página de erro crua (em inglês) no
  // lugar da tela do Google; perguntando antes, vira um aviso aqui mesmo.
  // Pergunta uma vez só, quando a pessoa chega perto do botão. Sem resposta
  // (sem internet, servidor lento), segue para o Google assim mesmo.
  var providerCheck = null;

  function checkProvider() {
    if (providerCheck) return providerCheck;
    var cfg = global.SUPABASE_CONFIG || {};
    if (!cfg.url || !global.fetch) {
      providerCheck = Promise.resolve(true);
      return providerCheck;
    }
    providerCheck = global.fetch(String(cfg.url).replace(/\/+$/, "") + "/auth/v1/settings", {
      headers: { apikey: cfg.anonKey }
    }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (settings) {
      return !(settings && settings.external && settings.external.google === false);
    }).catch(function () {
      return true;
    });
    return providerCheck;
  }

  function withTimeout(promise, ms, fallback) {
    return Promise.race([promise, new Promise(function (resolve) {
      setTimeout(function () { resolve(fallback); }, ms);
    })]);
  }

  /* ============ o clique ============ */
  function start(btn) {
    if (busy || !DB.client) return;
    setMsg(btn, "");
    setBusy(true);
    withTimeout(checkProvider(), 2500, true).then(function (enabled) {
      if (!enabled) {
        setBusy(false);
        setMsg(btn, "O login com o Google ainda não está disponível. Por enquanto, use seu e-mail e senha.");
        return;
      }
      try { global.sessionStorage.setItem(FLAG, "1"); } catch (err) {}
      return DB.client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: pageUrl(),
          // sempre mostra a escolha de conta: quem usa mais de uma conta do
          // Google escolhe com qual entrar
          queryParams: { prompt: "select_account" }
        }
      }).then(function (res) {
        // sem erro, o navegador já está indo para o Google: o botão continua
        // carregando até a página trocar
        if (res && res.error) throw res.error;
      });
    }).catch(function () {
      try { global.sessionStorage.removeItem(FLAG); } catch (err) {}
      setBusy(false);
      setMsg(btn, "Não deu para abrir o login do Google. Confira a internet e tente de novo.");
    });
  }

  function googleButton(e) {
    return e.target && e.target.closest ? e.target.closest("[data-google]") : null;
  }

  document.addEventListener("click", function (e) {
    var btn = googleButton(e);
    if (btn) start(btn);
  });
  // a pergunta ao Supabase sai antes do clique, pra o clique não esperar
  document.addEventListener("pointerover", function (e) { if (googleButton(e)) checkProvider(); });
  document.addEventListener("focusin", function (e) { if (googleButton(e)) checkProvider(); });

  // Voltou da tela do Google pela seta "voltar" do navegador: a página pode
  // voltar da memória do jeito que estava, com o botão ainda carregando.
  global.addEventListener("pageshow", function (e) {
    if (e.persisted && busy) setBusy(false);
  });

  /* ============ a volta do Google ============ */
  // Entrou: o Supabase já guardou o login e limpou o endereço, mas sobra um
  // "#" no fim dele, que sai daqui. E o nome da conta do Google vai para o
  // perfil (tabela profiles), como o "Nome completo" do Criar conta, se o
  // perfil ainda não tiver nome.
  if (DB.client && DB.oauthReturn) {
    var handled = false;
    DB.client.auth.onAuthStateChange(function (event, session) {
      // só a primeira notícia do login interessa
      if (handled) return;
      handled = true;
      if (!session) return;
      if (global.location.href.slice(-1) === "#") {
        try { global.history.replaceState(global.history.state, "", global.location.href.slice(0, -1)); } catch (err) {}
      }
      // o Supabase pede pra não chamar ele de novo aqui dentro
      setTimeout(function () { saveName(session.user); }, 0);
    });
  }

  function saveName(user) {
    var meta = (user && user.user_metadata) || {};
    var name = String(meta.full_name || meta.name || "").replace(/\s+/g, " ").trim();
    if (!name) return;
    var db = DB.client;
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then(function (res) {
      if (res.error || (res.data && res.data.full_name)) return;
      db.from("profiles").upsert({ id: user.id, full_name: name }, { onConflict: "id" }).then(function () {}, function () {});
    }, function () {});
  }
})(window);
