(function (global) {
  "use strict";

  var Profiles = global.InvestorProfiles;
  var Investments = global.Investments;
  var Format = global.Format;
  var FINISH_LABEL = "Concluir e ver minha carteira";
  var currentUser = null;
  var currentProfile = null;
  var currentStep = 1;
  var onComplete = null;

  // duas etapas: perfil de investidor e investimentos por categoria. Pra
  // acrescentar outra, crie "step-tab-3" e "step-3" no index.html e coloque
  // o 3 aqui.
  function setStep(n) {
    currentStep = n;
    [1, 2].forEach(function (i) {
      document.getElementById("step-" + i).hidden = n !== i;
      var tab = document.getElementById("step-tab-" + i);
      tab.classList.toggle("is-active", n === i);
      tab.classList.toggle("is-done", n > i);
      if (n === i) {
        tab.setAttribute("aria-current", "step");
      } else {
        tab.removeAttribute("aria-current");
      }
    });
  }

  function setFieldError(id, msg) {
    var err = document.getElementById(id + "-err");
    if (err) { err.textContent = msg || ""; err.classList.toggle("is-on", !!msg); }
  }

  // as duas etapas salvam do mesmo jeito: upsert (não update), igual ao Fluxo
  // de Caixa. Se a linha da aluna em "profiles" ainda não existir, um update
  // simples casaria zero linhas — sem erro nenhum — e ela voltaria pra etapa
  // sem explicação. Só vão o id e o campo da etapa: as colunas do Fluxo de
  // Caixa ficam intactas.
  function save(patch, btn, label, errId, done) {
    btn.disabled = true;
    btn.textContent = "Salvando…";

    patch.id = currentUser.id;
    global.DB.client.from("profiles")
      .upsert(patch, { onConflict: "id" })
      .select()
      .then(function (res) {
        btn.disabled = false;
        btn.textContent = label;
        if (res.error || !res.data || !res.data.length) {
          var error = res.error || { message: "nada foi salvo (nenhuma linha retornada)." };
          setFieldError(errId, "Não deu para salvar agora: " + error.message);
          return;
        }
        currentProfile = res.data[0];
        done();
      });
  }

  /* ============ etapa 1: perfil de investidor ============ */
  // cada perfil é um radio de verdade (setas do teclado e leitor de tela de
  // graça); o input fica invisível e o cartão ao lado mostra o estado marcado.
  function optionHTML(p) {
    var id = "ob-profile-" + p.key;
    return '<label class="profileopt">' +
      '<input type="radio" name="ob-profile" class="profileopt__input" value="' + p.key + '" ' +
      'aria-labelledby="' + id + '-name" aria-describedby="' + id + '-details">' +
      '<span class="profileopt__card">' +
      '<span class="profileopt__head">' +
      '<span class="profileopt__name" id="' + id + '-name">' + Format.esc(p.name) + '</span>' +
      '<span class="profileopt__check" aria-hidden="true"></span>' +
      '</span>' +
      '<span class="profileopt__details" id="' + id + '-details">' +
      '<span class="risk risk--' + p.risk + '">' +
      '<span class="risk__bars" aria-hidden="true"><span class="risk__bar"></span><span class="risk__bar"></span><span class="risk__bar"></span></span>' +
      '<span class="risk__label">' + Format.esc(p.riskLabel) + '</span>' +
      '</span>' +
      '</span>' +
      '</span></label>';
  }

  function selectedKey() {
    var checked = document.querySelector('input[name="ob-profile"]:checked');
    return checked ? checked.value : null;
  }

  function nextFromStep1() {
    var key = selectedKey();
    if (!key) {
      setFieldError("ob-profile", "Escolha um perfil para continuar.");
      return;
    }
    setFieldError("ob-profile", "");

    // o perfil é salvo já aqui: se ela fechar a página no meio da etapa 2,
    // na volta a escolha ainda está lá.
    save(
      { investor_profile: key },
      document.getElementById("ob-step1-next"),
      "Continuar",
      "ob-profile",
      function () { goToStep2(); }
    );
  }

  /* ============ etapa 2: investimentos por categoria ============ */
  function goToStep2() {
    Investments.fill(currentProfile && currentProfile.investments);
    setFieldError("ob-alloc", "");
    setStep(2);
  }

  function finish() {
    var result = Investments.read();
    if (result.error) {
      setFieldError("ob-alloc", result.error);
      return;
    }
    setFieldError("ob-alloc", "");

    save(
      { investments: result.data },
      document.getElementById("ob-step2-finish"),
      FINISH_LABEL,
      "ob-alloc",
      function () { if (onComplete) onComplete(); }
    );
  }

  function mount() {
    document.getElementById("ob-profiles").innerHTML = Profiles.list.map(optionHTML).join("");
    document.getElementById("ob-profiles").addEventListener("change", function () { setFieldError("ob-profile", ""); });
    document.getElementById("ob-step1-next").addEventListener("click", nextFromStep1);

    // as abas também navegam: a 01 volta sempre, e a 02 faz o mesmo que
    // "Continuar" (valida e salva o perfil antes de avançar).
    document.getElementById("step-tab-1").addEventListener("click", function () {
      if (currentStep !== 1) setStep(1);
    });
    document.getElementById("step-tab-2").addEventListener("click", function () {
      if (currentStep === 1) nextFromStep1();
    });

    Investments.mount(document.getElementById("ob-allocations"), function () {
      setFieldError("ob-alloc", "");
    });
    document.getElementById("ob-step2-back").addEventListener("click", function () { setStep(1); });
    document.getElementById("ob-step2-finish").addEventListener("click", finish);
  }

  // profile pode já ter perfil e investimentos salvos (a aluna clicou em
  // "Alterar perfil" ou "Editar investimentos"): nesse caso tudo já vem
  // preenchido, e "step" diz em qual das duas etapas ela entra.
  function show(user, profile, step, doneCallback) {
    currentUser = user;
    currentProfile = profile;
    onComplete = doneCallback;

    var current = profile && profile.investor_profile;
    document.querySelectorAll('input[name="ob-profile"]').forEach(function (input) {
      input.checked = input.value === current;
    });
    setFieldError("ob-profile", "");

    if (step === 2) {
      goToStep2();
      return;
    }
    // a etapa 2 fica pronta desde já: se ela avançar, não pisca nada.
    Investments.fill(profile && profile.investments);
    setFieldError("ob-alloc", "");
    setStep(1);
  }

  global.OnboardingView = { mount: mount, show: show };
})(window);
