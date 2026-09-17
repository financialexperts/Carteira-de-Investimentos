(function () {
  "use strict";

  function showView(name) {
    ["loading", "setup", "auth", "onboarding", "portfolio"].forEach(function (v) {
      var el = document.getElementById("view-" + v);
      if (el) el.hidden = v !== name;
    });
  }

  /* ============ tema ============ */
  var root = document.documentElement;
  var metaTheme = document.getElementById("meta-theme-color");
  function syncThemeColor() {
    if (!metaTheme) return;
    metaTheme.setAttribute("content", root.getAttribute("data-theme") === "dark" ? "#171435" : "#F7F7FA");
  }
  var stored = null;
  try { stored = localStorage.getItem("tema"); } catch (err) { stored = null; }
  if (stored === "dark" || stored === "light") {
    root.setAttribute("data-theme", stored);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    root.setAttribute("data-theme", "dark");
  }
  syncThemeColor();
  document.getElementById("tema").addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    syncThemeColor();
    try { localStorage.setItem("tema", next); } catch (err) {}
  });

  /* ============ liquid glass: brilho que segue o ponteiro ============ */
  document.addEventListener("pointermove", function (e) {
    var el = e.target.closest && e.target.closest(".glass");
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty("--gx", ((e.clientX - r.left) / r.width * 100) + "%");
    el.style.setProperty("--gy", ((e.clientY - r.top) / r.height * 100) + "%");
  });

  /* ============ configuração do Supabase ============ */
  if (!window.DB.isConfigured) {
    showView("setup");
    return;
  }

  var db = window.DB.client;

  /* ============ roteamento por sessão ============ */
  function showOnboarding(session, profile, step) {
    showView("onboarding");
    window.OnboardingView.show(session.user, profile, step, function () { route(session); });
  }

  function route(session) {
    if (!session) {
      document.getElementById("userbox").hidden = true;
      window.AuthView.reset();
      showView("auth");
      return;
    }

    var metaName = session.user.user_metadata && session.user.user_metadata.full_name;
    document.getElementById("userbox-email").textContent = metaName || session.user.email;
    document.getElementById("userbox").hidden = false;

    db.from("profiles").select("*").eq("id", session.user.id).single().then(function (res) {
      var profile = res.data;
      if (!metaName && profile && profile.full_name) {
        document.getElementById("userbox-email").textContent = profile.full_name;
      }
      // quem decide se as etapas aparecem são as próprias colunas delas: um
      // perfil válido salvo pula a etapa 01, e investimentos salvos pulam a 02
      if (!profile || !window.InvestorProfiles.byKey(profile.investor_profile)) {
        showOnboarding(session, profile, 1);
        return;
      }
      // escolheu o perfil mas ainda não montou a carteira: cai direto na
      // etapa 02, sem repetir a escolha do perfil.
      if (!window.Investments.isFilled(profile)) {
        showOnboarding(session, profile, 2);
        return;
      }
      showView("portfolio");
      window.PortfolioView.show(session.user, profile, function (step) { showOnboarding(session, profile, step); });
    });
  }

  db.auth.onAuthStateChange(function (event, session) {
    if (event === "PASSWORD_RECOVERY") {
      showView("auth");
      window.AuthView.showRecovery();
      return;
    }
    // TOKEN_REFRESHED dispara sozinho em segundo plano pra renovar a sessão,
    // sem o usuário fazer nada — se recarregássemos a tela aqui, o aluno
    // poderia ser tirado do meio de uma escolha minutos depois, sem nenhuma
    // ação dele.
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    route(session);
  });

  document.getElementById("btn-logout").addEventListener("click", function () {
    db.auth.signOut();
  });

  window.App = {
    refresh: function () { db.auth.getSession().then(function (res) { route(res.data.session); }); }
  };

  window.AuthView.mount();
  window.OnboardingView.mount();
  window.PortfolioView.mount();

  showView("loading");
  db.auth.getSession().then(function (res) { route(res.data.session); });
})();
