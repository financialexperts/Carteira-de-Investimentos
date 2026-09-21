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
  // O link de "esqueci a senha" chega com o token no #, e o Supabase cria uma
  // sessão de verdade com ele antes de avisar PASSWORD_RECOVERY. Sem essa
  // trava, o getSession() lá embaixo (e a consulta a profiles, que é assíncrona)
  // veriam essa mesma sessão e mandariam a aluna direto pra carteira, passando
  // por cima do formulário de senha nova. Só sai daqui quando a senha for salva.
  var emRecuperacao = false;

  // de quem é a tela que está aberta agora (null = ninguém logado)
  var usuarioNaTela = null;

  function abrirRecuperacao() {
    emRecuperacao = true;
    showView("auth");
    window.AuthView.showRecovery();
  }

  function showOnboarding(session, profile, step) {
    showView("onboarding");
    window.OnboardingView.show(session.user, profile, step, function () { route(session); });
  }

  function route(session) {
    if (emRecuperacao) return;

    usuarioNaTela = session ? session.user.id : null;

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
      // a consulta pode voltar depois do PASSWORD_RECOVERY ter aberto o
      // formulário de senha nova; nesse caso não é pra navegar pra lugar nenhum
      if (emRecuperacao) return;

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
      // ou tem um rascunho que ainda não foi salvo (o celular descarregou a
      // aba no meio da edição): volta pra etapa 02 com ele, em vez de
      // esconder o que ele digitou atrás da carteira antiga.
      if (!window.Investments.isFilled(profile) || window.OnboardingView.hasDraft(session.user.id)) {
        showOnboarding(session, profile, 2);
        return;
      }
      showView("portfolio");
      window.PortfolioView.show(session.user, profile, function (step) { showOnboarding(session, profile, step); });
    });
  }

  db.auth.onAuthStateChange(function (event, session) {
    if (event === "PASSWORD_RECOVERY") {
      abrirRecuperacao();
      return;
    }
    // TOKEN_REFRESHED dispara sozinho em segundo plano pra renovar a sessão,
    // sem o usuário fazer nada — se recarregássemos a tela aqui, o aluno
    // poderia ser tirado do meio de uma escolha minutos depois, sem nenhuma
    // ação dele.
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    // o Supabase também repete SIGNED_IN toda vez que a aba volta a ficar
    // visível (no celular, é só ir em outra aba e voltar). Não é login novo:
    // redesenhar aqui apagaria o que o aluno digitou e ainda não salvou.
    if (event === "SIGNED_IN" && session && session.user.id === usuarioNaTela) return;
    route(session);
  });

  document.getElementById("btn-logout").addEventListener("click", function () {
    db.auth.signOut();
  });

  window.App = {
    // chamado pelo auth.js depois de salvar a senha nova: é o fim da
    // recuperação, então a navegação normal volta a valer
    refresh: function () {
      emRecuperacao = false;
      db.auth.getSession().then(function (res) { route(res.data.session); });
    }
  };

  window.AuthView.mount();
  window.OnboardingView.mount();
  window.PortfolioView.mount();

  showView("loading");
  db.auth.getSession().then(function (res) { route(res.data.session); });
})();
