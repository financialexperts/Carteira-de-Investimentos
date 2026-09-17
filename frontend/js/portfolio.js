(function (global) {
  "use strict";

  var Profiles = global.InvestorProfiles;
  var Classes = global.AssetClasses;
  var Investments = global.Investments;
  var Format = global.Format;
  var onEdit = null;

  // O gráfico é um anel desenhado com o contorno de um círculo só: o raio é a
  // linha do meio da rosca e a espessura vem do stroke-width no CSS. Cada
  // fatia é um tracejado de um traço só (stroke-dasharray), posicionado pelo
  // stroke-dashoffset — é o que dá o respiro entre as fatias de graça.
  var CX = 110, CY = 110, R = 81;
  var RING = 2 * Math.PI * R;
  var GAP = 5;

  var temMouse = !window.matchMedia || window.matchMedia("(hover: hover)").matches;

  // os dois anéis da tela: o que a aluna montou e o sugerido pro perfil dela
  var grafAluno = null;
  var grafSugerido = null;

  // as três abas. "sub" é a linha de explicação, e a da sugerida depende do
  // perfil, então é montada na hora (por isso função em vez de texto fixo).
  var VIEWS = [
    {
      key: "minha",
      title: "Seus investimentos",
      sub: function () { return "O que você escolheu para cada categoria."; }
    },
    {
      key: "sugerida",
      title: "Carteira sugerida",
      sub: function (p) {
        return "Como a carteira de um perfil " + p.name.toLowerCase() + " costuma ficar.";
      }
    },
    {
      key: "diferenca",
      title: "Diferença entre elas",
      sub: function () {
        return "O que mudar em cada categoria para chegar na carteira sugerida.";
      }
    }
  ];

  var perfilAtual = null;

  function mostrarView(key) {
    VIEWS.forEach(function (v) {
      var aba = document.getElementById("pf-tab-" + v.key);
      var painel = document.getElementById("pf-pane-" + v.key);
      var ativa = v.key === key;

      painel.hidden = !ativa;
      aba.setAttribute("aria-selected", String(ativa));
      aba.tabIndex = ativa ? 0 : -1;   // Tab entra no seletor, setas andam nele

      if (ativa) {
        document.getElementById("pf-view-title").textContent = v.title;
        document.getElementById("pf-view-sub").textContent = v.sub(perfilAtual);
      }
    });
  }

  function mount() {
    // os dois botões voltam pro onboarding, cada um na sua etapa
    document.getElementById("pf-change").addEventListener("click", function () {
      if (onEdit) onEdit(1);
    });
    document.getElementById("pf-edit-inv").addEventListener("click", function () {
      if (onEdit) onEdit(2);
    });

    VIEWS.forEach(function (v, i) {
      var aba = document.getElementById("pf-tab-" + v.key);
      aba.addEventListener("click", function () { mostrarView(v.key); });
      // setas esquerda/direita andam entre as abas, como se espera de um
      // seletor de verdade
      aba.addEventListener("keydown", function (e) {
        var passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!passo) return;
        e.preventDefault();
        var alvo = VIEWS[(i + passo + VIEWS.length) % VIEWS.length];
        mostrarView(alvo.key);
        document.getElementById("pf-tab-" + alvo.key).focus();
      });
    });

    grafAluno = criarGrafico(document.getElementById("pf-investments"), "da carteira");
    grafSugerido = criarGrafico(document.getElementById("pf-suggested"), "sugerido");
  }

  /* ============ desenho do anel ============ */
  function segmentHTML(slice, from, length, gap) {
    var dash = Math.max(length - gap, 1);
    var texto = slice.name + ", " + Investments.pctText(slice.percent) + "%";
    // role/tabindex porque a fatia é clicável: no celular não existe "passar o
    // mouse em cima", então tocar nela é que destaca a categoria
    return '<circle class="pieseg" data-cat="' + slice.key + '" role="button" tabindex="0" ' +
      'aria-label="' + Format.esc(texto) + '" aria-pressed="false" cx="' + CX + '" cy="' + CY +
      '" r="' + R + '" stroke-dasharray="' + dash.toFixed(2) + " " + (RING - dash).toFixed(2) +
      '" stroke-dashoffset="' + (-(from + gap / 2)).toFixed(2) + '">' +
      "<title>" + Format.esc(texto) + "</title>" +
      "</circle>";
  }

  function pieHTML(slices, total, titulo) {
    var used = slices.filter(function (s) { return s.percent > 0; });

    if (!used.length) {
      return '<svg class="pie" viewBox="0 0 220 220" role="img" ' +
        'aria-label="Nenhum investimento cadastrado ainda.">' +
        '<circle class="pieseg pieseg--empty" cx="' + CX + '" cy="' + CY + '" r="' + R + '"></circle></svg>';
    }

    // mesma leitura da legenda, pra quem usa leitor de tela
    var label = used.map(function (s) {
      return s.name + " " + Investments.pctText(s.percent) + "%";
    }).join(", ");

    // uma categoria sozinha ocupa a volta inteira: aí não há vizinha de quem
    // se separar, e o respiro viraria um corte solto no meio do anel.
    var gap = used.length > 1 ? GAP : 0;
    var at = 0;
    var segs = slices.map(function (s) {
      if (!s.percent) return "";
      var length = s.percent / total * RING;
      var from = at;
      at += length;
      return segmentHTML(s, from, length, gap);
    }).join("");

    // -90° põe o começo do anel no alto, onde a leitura começa
    return '<svg class="pie" viewBox="0 0 220 220" role="img" ' +
      'aria-label="' + Format.esc(titulo) + ": " + Format.esc(label) + '">' +
      '<g transform="rotate(-90 ' + CX + " " + CY + ')">' + segs + "</g></svg>";
  }

  /* ============ legenda: as categorias dentro de RF e RV ============ */
  // cada linha é um botão de verdade: serve pro toque no celular e pro teclado
  function legendRowHTML(cat, percent) {
    return "<li>" +
      '<button class="invlegend__row" type="button" data-cat="' + cat.key + '" aria-pressed="false">' +
        '<span class="invlegend__dot" aria-hidden="true"></span>' +
        '<span class="invlegend__name">' + Format.esc(cat.name) + "</span>" +
        '<span class="invlegend__pct">' + Investments.pctText(percent) + "%</span>" +
      "</button></li>";
  }

  function legendGroupHTML(g, pct) {
    var total = 0;
    var rows = g.categories.map(function (cat) {
      total += pct[cat.key];
      return legendRowHTML(cat, pct[cat.key]);
    }).join("");
    return '<div class="invlegend__group">' +
      '<p class="invlegend__title">' +
        '<span class="invlegend__abbr">' + Format.esc(g.abbr) + "</span>" +
        Format.esc(g.name) +
        '<span class="invlegend__grouppct">' + Investments.pctText(total) + "%</span>" +
      "</p>" +
      '<ul class="invlegend__rows">' + rows + "</ul>" +
      "</div>";
  }

  /* ============ um anel com sua legenda ============ */
  // São dois na tela, e cada um guarda o próprio destaque — por isso é uma
  // função que devolve o gráfico pronto, em vez de variáveis soltas aqui fora.
  //
  // O destaque tem dois estados de propósito: "escolhida" (clique, toque ou
  // teclado, fica acesa até desmarcar) e "de passagem" (mouse ou foco, some
  // sozinha). No celular existe só a primeira — passar o dedo por cima não
  // existe, e o pointerover do toque acenderia e apagaria no mesmo gesto.
  function criarGrafico(box, rodape) {
    var fatias = {};
    var total = 0;
    var escolhida = null;
    var passagem = null;

    function setCenter(key) {
      var fatia = key && fatias[key];
      box.querySelector(".pie__value").textContent =
        Investments.pctText(fatia ? fatia.percent : total) + "%";
      box.querySelector(".pie__label").textContent = fatia ? fatia.name : rodape;
    }

    function paint() {
      var key = escolhida || passagem;
      box.classList.toggle("is-hover", !!key);
      box.querySelectorAll("[data-cat]").forEach(function (el) {
        var on = el.getAttribute("data-cat") === key;
        el.classList.toggle("is-on", on);
        el.setAttribute("aria-pressed", on && escolhida ? "true" : "false");
      });
      setCenter(key);
    }

    function alternar(key) {
      escolhida = key && key !== escolhida ? key : null;
      passagem = null;
      paint();
    }

    function catDe(e) {
      var el = e.target.closest ? e.target.closest("[data-cat]") : null;
      return el ? el.getAttribute("data-cat") : null;
    }

    box.addEventListener("click", function (e) { alternar(catDe(e)); });

    // a fatia não é um <button>, então o Enter/Espaço dela vem na mão (a linha
    // da legenda é, e já dispara o click sozinha)
    box.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var el = e.target.closest ? e.target.closest("[data-cat]") : null;
      if (!el || el.tagName === "BUTTON") return;
      e.preventDefault();
      alternar(el.getAttribute("data-cat"));
    });

    // o anel de foco do navegador não serve pra fatia (a caixa dela é o
    // círculo inteiro, então viraria um retângulo em volta do gráfico todo):
    // quem chega de teclado acende a fatia, que é o destaque de verdade
    box.addEventListener("focusin", function (e) {
      if (escolhida) return;
      passagem = catDe(e);
      paint();
    });
    box.addEventListener("focusout", function () {
      if (escolhida) return;
      passagem = null;
      paint();
    });

    if (temMouse) {
      box.addEventListener("pointerover", function (e) {
        if (e.pointerType === "touch" || escolhida) return;
        passagem = catDe(e);
        paint();
      });
      box.addEventListener("pointerleave", function () {
        if (escolhida) return;
        passagem = null;
        paint();
      });
    }

    // tocar/clicar fora do gráfico desmarca
    document.addEventListener("click", function (e) {
      if (!escolhida || box.contains(e.target)) return;
      escolhida = null;
      paint();
    });

    return {
      // pct: { chave da categoria: porcentagem }
      render: function (pct, titulo) {
        fatias = {};
        total = 0;
        escolhida = null;
        passagem = null;

        var slices = Classes.list.map(function (cat) {
          var percent = pct[cat.key] || 0;
          total += percent;
          fatias[cat.key] = { name: cat.name, percent: percent };
          return { key: cat.key, name: cat.name, percent: percent };
        });
        total = Math.round(total * 10) / 10;

        box.innerHTML =
          '<figure class="invchart__pie">' + pieHTML(slices, total, titulo) +
            '<div class="pie__center">' +
              '<p class="pie__value"></p>' +
              '<p class="pie__label"></p>' +
            "</div>" +
          "</figure>" +
          '<div class="invlegend">' +
            Classes.groups.map(function (g) { return legendGroupHTML(g, pct); }).join("") +
          "</div>";

        setCenter(null);
      }
    };
  }

  /* ============ as porcentagens de cada gráfico ============ */
  // A etapa 2 é preenchida em reais; aqui a carteira já aparece só em
  // porcentagem — nenhum valor em dinheiro chega a esta tela.
  function pctDoAluno(profile) {
    var dados = Investments.parse(profile.investments);
    var pct = {};
    Classes.list.forEach(function (cat) {
      pct[cat.key] = Investments.percentOf(Investments.sumOf(dados.items[cat.key]), dados.total);
    });
    return pct;
  }

  // a sugestão já vem em porcentagem, de investorProfiles.js
  function pctSugerido(p) {
    var pct = {};
    Classes.list.forEach(function (cat) {
      pct[cat.key] = p.suggested[cat.key] || 0;
    });
    return pct;
  }

  /* ============ diferença entre as duas carteiras ============ */
  // Aqui é tabela, não gráfico: a diferença tem sinal e as partes não somam
  // 100, então não existe fatia de "−30%". O que a aluna precisa é ler os três
  // números lado a lado — o dela, o sugerido e o quanto falta ou sobra.
  function round1(n) { return Math.round(n * 10) / 10; }

  // A conta é sugerida menos a dela, de propósito: o número responde "o que eu
  // faço?", não "o que aconteceu?". Positivo é o que falta pôr, negativo é o
  // que precisa sair — e quem diz isso é a palavra, não o sinal.
  function diffCellHTML(falta) {
    if (falta === 0) {
      return '<td class="difftable__falta difftable__falta--ok">no ponto</td>';
    }
    var classe = falta > 0 ? "difftable__falta--aumentar" : "difftable__falta--diminuir";
    var verbo = falta > 0 ? "aumentar" : "diminuir";
    return '<td class="difftable__falta ' + classe + '">' +
      '<span class="difftable__verbo">' + verbo + "</span>" +
      '<span class="difftable__quanto">' + Investments.pctText(Math.abs(falta)) + "%</span>" +
      "</td>";
  }

  function diffGroupHTML(g, pctAluno, pctSug) {
    var linhas = g.categories.map(function (cat) {
      var falta = round1(pctSug[cat.key] - pctAluno[cat.key]);
      return '<tr data-cat="' + cat.key + '">' +
        '<th scope="row" class="difftable__cat">' +
          '<span class="difftable__dot" aria-hidden="true"></span>' + Format.esc(cat.name) +
        "</th>" +
        "<td>" + Investments.pctText(pctAluno[cat.key]) + "%</td>" +
        "<td>" + Investments.pctText(pctSug[cat.key]) + "%</td>" +
        diffCellHTML(falta) +
        "</tr>";
    }).join("");

    return "<tbody>" +
      '<tr class="difftable__group"><th colspan="4" scope="colgroup">' +
        '<span class="invlegend__abbr">' + Format.esc(g.abbr) + "</span>" +
        Format.esc(g.name) +
      "</th></tr>" + linhas + "</tbody>";
  }

  function diffHTML(pctAluno, pctSug) {
    // soma do que está fora do lugar, contada uma vez só: o que sobra numa
    // categoria é exatamente o que falta noutra, então divide por dois
    var distancia = 0;
    Classes.list.forEach(function (cat) {
      distancia += Math.abs(round1(pctAluno[cat.key] - pctSug[cat.key]));
    });
    distancia = round1(distancia / 2);

    var resumo = distancia === 0
      ? "Sua carteira está igualzinha à sugerida para o seu perfil."
      : "Para chegar na sugerida, <strong>" + Investments.pctText(distancia) +
        "%</strong> da carteira precisaria mudar de categoria.";

    return '<p class="difftable__resumo">' + resumo + "</p>" +
      '<table class="difftable">' +
        "<thead><tr>" +
          '<th scope="col">Categoria</th>' +
          '<th scope="col">Sua carteira</th>' +
          '<th scope="col">Sugerida</th>' +
          '<th scope="col">Para chegar lá</th>' +
        "</tr></thead>" +
        Classes.groups.map(function (g) {
          return diffGroupHTML(g, pctAluno, pctSug);
        }).join("") +
      "</table>";
  }

  // a carteira mostra o perfil escolhido na etapa 01, o gráfico do que a aluna
  // montou na etapa 02 e, embaixo, o gráfico sugerido pro perfil dela.
  function show(user, profile, editCallback) {
    onEdit = editCallback;
    var p = Profiles.byKey(profile.investor_profile);
    perfilAtual = p;

    document.getElementById("pf-name").textContent = p.name;
    document.getElementById("pf-tagline").textContent = p.tagline;
    document.getElementById("pf-risk").className = "risk risk--" + p.risk;
    document.getElementById("pf-risk-label").textContent = p.riskLabel;
    document.getElementById("pf-desc").textContent = p.description;
    document.getElementById("pf-examples").textContent = p.examples;

    var doAluno = pctDoAluno(profile);
    var sugerido = pctSugerido(p);

    grafAluno.render(doAluno, "Sua carteira");
    grafSugerido.render(sugerido, "Sugestão para o perfil " + p.name);
    document.getElementById("pf-diff").innerHTML = diffHTML(doAluno, sugerido);

    mostrarView("minha");
  }

  global.PortfolioView = { mount: mount, show: show };
})(window);
