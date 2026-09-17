(function (global) {
  "use strict";

  var Classes = global.AssetClasses;
  var Format = global.Format;
  var MAX = Classes.maxPerCategory;

  var ICON_X = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';

  var root = null;       // o container das duas tabelas
  var onChange = null;   // avisa a etapa 2 que algo mudou (pra limpar o erro)

  /* ============ números ============ */
  // A aluna digita em reais; a porcentagem é sempre calculada em cima do total
  // que ela informou. Dinheiro arredonda em centavos, porcentagem numa casa.
  function round2(n) { return Math.round(n * 100) / 100; }

  function money(n) { return Format.fmtNum.format(n || 0); }

  // "40" em vez de "40,0" e "72,5" em vez de "72,50": casa decimal só quando
  // ela existe de verdade.
  function pctText(n) {
    return (Math.round(n * 10) / 10).toFixed(1).replace(".", ",").replace(/,0$/, "");
  }

  function percentOf(valor, total) {
    return total > 0 ? valor / total * 100 : 0;
  }

  /* ============ montagem da tela ============ */
  function categoryHTML(cat) {
    return '<div class="alloccat" data-cat="' + cat.key + '">' +
      '<div class="alloccat__head">' +
        '<h4 class="alloccat__name">' + Format.esc(cat.name) + "</h4>" +
        '<span class="alloccat__total">' +
          '<span class="alloccat__pct" data-pct="' + cat.key + '">0%</span>' +
          '<span class="alloccat__money" data-money="' + cat.key + '">R$ 0,00</span>' +
        "</span>" +
      "</div>" +
      '<div class="alloccat__rows"></div>' +
      '<button class="allocadd" type="button" data-add="' + cat.key + '">Adicionar investimento</button>' +
      "</div>";
  }

  function groupHTML(g) {
    return '<div class="card alloc">' +
      '<div class="card__head">' +
        '<p class="card__kicker">' + Format.esc(g.abbr) + "</p>" +
        '<h3 class="card__title">' + Format.esc(g.name) + "</h3>" +
      "</div>" +
      '<div class="card__body">' +
        '<div class="alloc__cols"><span>Investimento</span><span>Valor investido</span><span></span></div>' +
        g.categories.map(categoryHTML).join("") +
      "</div>" +
      "</div>";
  }

  function catEl(key) { return root.querySelector('.alloccat[data-cat="' + key + '"]'); }
  function rowsEl(key) { return catEl(key).querySelector(".alloccat__rows"); }
  function rowsOf(key) { return [].slice.call(rowsEl(key).children); }
  function nameInput(row) { return row.querySelector(".allocrow__name input"); }
  function valInput(row) { return row.querySelector(".allocrow__val input"); }

  function addRow(key, item, focus) {
    var wrap = rowsEl(key);
    if (wrap.children.length >= MAX) return;

    var row = document.createElement("div");
    row.className = "allocrow";
    row.innerHTML =
      '<div class="input allocrow__name"><input type="text" placeholder="Nome do investimento" aria-label="Nome do investimento"></div>' +
      '<div class="input allocrow__val"><span class="input__affix">R$</span>' +
        '<input type="text" inputmode="decimal" placeholder="0,00" aria-label="Valor investido, em reais"></div>' +
      '<button class="allocrow__del" type="button" aria-label="Remover investimento">' + ICON_X + "</button>";

    // valores por propriedade (não por atributo no HTML): um nome com aspas
    // ou "<" entra do jeito que a aluna digitou, sem escapar nada.
    if (item) {
      nameInput(row).value = item.name || "";
      if (typeof item.amount === "number" && isFinite(item.amount)) {
        valInput(row).value = money(item.amount);
      }
    }

    wrap.appendChild(row);
    syncCategory(key);
    if (focus) nameInput(row).focus();
  }

  /* ============ o total da carteira ============ */
  function totalInput() { return document.getElementById("alloc-total-input"); }

  function carteira() {
    var n = Format.parseNumber(totalInput().value);
    return isFinite(n) && n > 0 ? round2(n) : 0;
  }

  function categorySum(key) {
    var soma = 0;
    rowsOf(key).forEach(function (row) {
      var n = Format.parseNumber(valInput(row).value);
      if (isFinite(n) && n > 0) soma += n;
    });
    return round2(soma);
  }

  function grandSum() {
    var soma = 0;
    Classes.list.forEach(function (cat) { soma += categorySum(cat.key); });
    return round2(soma);
  }

  // quanto ainda cabe, ignorando a linha que está sendo digitada
  function roomFor(row) {
    var usado = 0;
    Classes.list.forEach(function (cat) {
      rowsOf(cat.key).forEach(function (other) {
        if (other === row) return;
        var n = Format.parseNumber(valInput(other).value);
        if (isFinite(n) && n > 0) usado += n;
      });
    });
    return round2(carteira() - usado);
  }

  // O limitador: a soma dos investimentos não passa do total da carteira, então
  // o que a aluna digita a mais é cortado no que ainda cabe. Devolve o aviso a
  // mostrar, ou "". Enquanto ela não informar o total, não há o que limitar.
  function capRow(row) {
    var total = carteira();
    if (!total) return "";

    var input = valInput(row);
    var raw = input.value.trim();
    if (!raw) return "";

    var n = Format.parseNumber(raw);
    if (!isFinite(n) || n <= 0) return "";

    var room = roomFor(row);
    if (round2(n) <= room) return "";

    if (room <= 0) {
      input.value = "";
      return "Você já distribuiu os R$ " + money(total) +
        " da carteira. Diminua outro investimento para caber mais.";
    }
    input.value = money(room);
    return "Cabia só R$ " + money(room) + " aqui: a soma não passa do total da carteira.";
  }

  function setCapNotice(msg) {
    var el = document.getElementById("alloc-total-cap");
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  /* ============ totais na tela ============ */
  function syncCategory(key) {
    var el = catEl(key);
    var count = rowsEl(key).children.length;
    var soma = categorySum(key);

    el.querySelector('[data-pct="' + key + '"]').textContent =
      pctText(percentOf(soma, carteira())) + "%";
    el.querySelector('[data-money="' + key + '"]').textContent = "R$ " + money(soma);

    var add = el.querySelector("[data-add]");
    add.disabled = count >= MAX;
    add.textContent = count >= MAX
      ? "Limite de " + MAX + " investimentos nesta categoria"
      : "Adicionar investimento";

    syncTotal();
  }

  function syncAllCategories() {
    Classes.list.forEach(function (cat) { syncCategory(cat.key); });
  }

  function syncTotal() {
    var box = document.getElementById("alloc-total");
    if (!box) return;

    var total = carteira();
    var usado = grandSum();
    var falta = round2(total - usado);
    var pct = percentOf(usado, total);

    document.getElementById("alloc-total-value").textContent = pctText(pct) + "%";
    document.getElementById("alloc-total-fill").style.width = Math.min(pct, 100) + "%";
    document.getElementById("alloc-total-hint").textContent = !total
      ? "Informe o total investido para começar a distribuir."
      : falta > 0
        ? "R$ " + money(usado) + " de R$ " + money(total) + " — faltam R$ " + money(falta) + "."
        : falta === 0
          ? "R$ " + money(usado) + ": tudo distribuído."
          : "Passou R$ " + money(-falta) + " do total da carteira.";

    // no começo, com a etapa ainda em branco, fica neutro: laranja só depois
    // que ela começa a preencher.
    box.classList.toggle("is-partial", total > 0 && usado > 0 && falta > 0);
    box.classList.toggle("is-ok", total > 0 && usado > 0 && falta === 0);
    box.classList.toggle("is-over", total > 0 && falta < 0);
  }

  /* ============ eventos ============ */
  function handleClick(e) {
    var add = e.target.closest("[data-add]");
    if (add) {
      addRow(add.getAttribute("data-add"), null, true);
      setCapNotice("");
      if (onChange) onChange();
      return;
    }
    var del = e.target.closest(".allocrow__del");
    if (del) {
      var row = del.closest(".allocrow");
      var key = row.closest(".alloccat").getAttribute("data-cat");
      row.remove();
      syncCategory(key);
      setCapNotice("");
      if (onChange) onChange();
    }
  }

  function handleInput(e) {
    var row = e.target.closest(".allocrow");
    if (!row) return;
    // corta antes de somar, pra barra e os totais nunca passarem do total
    setCapNotice(e.target.closest(".allocrow__val") ? capRow(row) : "");
    syncCategory(row.closest(".alloccat").getAttribute("data-cat"));
    if (onChange) onChange();
  }

  // mudar o total muda a porcentagem de toda a tela, então recalcula tudo.
  // Aqui não corta nada: se ela baixou o total e a soma ficou maior, o certo é
  // mostrar quanto passou e deixar ela escolher o que diminuir.
  function handleTotalInput() {
    setCapNotice("");
    syncAllCategories();
    if (onChange) onChange();
  }

  // ao sair do campo, "1500" e "1.500,5" viram "1.500,50" — a aluna digita
  // como quiser e a coluna fica toda no mesmo formato.
  function handleBlur(e) {
    var isTotal = e.target === totalInput();
    if (!isTotal && !e.target.closest(".allocrow__val")) return;

    var raw = e.target.value.trim();
    if (!raw) return;
    var n = Format.parseNumber(raw);
    if (!isFinite(n) || n < 0) return;

    e.target.value = money(round2(n));
    if (isTotal) syncAllCategories();
  }

  /* ============ API ============ */
  // Monta as duas tabelas dentro de "container" (uma vez só) e liga os eventos.
  function mount(container, changeCallback) {
    root = container;
    onChange = changeCallback || null;
    root.innerHTML = Classes.groups.map(groupHTML).join("");
    root.addEventListener("click", handleClick);
    root.addEventListener("input", handleInput);
    root.addEventListener("focusout", handleBlur);

    totalInput().addEventListener("input", handleTotalInput);
    totalInput().addEventListener("focusout", handleBlur);
  }

  // Preenche com o que já estava salvo. Categoria sem nada começa com uma
  // linha em branco, pra deixar claro que é ali que se digita.
  function fill(saved) {
    setCapNotice("");
    var dados = parse(saved);
    totalInput().value = dados.total > 0 ? money(dados.total) : "";

    Classes.list.forEach(function (cat) {
      rowsEl(cat.key).innerHTML = "";
      var items = dados.items[cat.key];
      if (!items.length) {
        addRow(cat.key, null, false);
      } else {
        items.slice(0, MAX).forEach(function (item) { addRow(cat.key, item, false); });
      }
    });
    syncAllCategories();
  }

  // Lê a tela. Devolve { data } ou { error } — linha totalmente em branco é
  // ignorada, linha pela metade é erro (senão some sem a aluna perceber).
  function read() {
    var total = carteira();
    if (!total) return { error: "Informe o total investido na carteira." };

    var items = {};
    var error = null;
    var soma = 0;
    var quantos = 0;

    function fail(msg) { if (!error) error = msg; }

    Classes.list.forEach(function (cat) {
      var lista = [];
      rowsOf(cat.key).forEach(function (row) {
        var name = nameInput(row).value.trim();
        var raw = valInput(row).value.trim();
        if (!name && !raw) return;

        if (!name) {
          fail('Falta o nome de um investimento em "' + cat.name + '".');
          return;
        }
        var n = Format.parseNumber(raw);
        if (!isFinite(n) || n <= 0) {
          fail('Coloque quanto você tem em "' + name + '".');
          return;
        }
        lista.push({ name: name, amount: round2(n) });
        soma += n;
        quantos++;
      });
      items[cat.key] = lista;
    });

    if (error) return { error: error };
    if (!quantos) return { error: "Adicione pelo menos um investimento para continuar." };

    var falta = round2(total - round2(soma));
    if (falta > 0) {
      return { error: "Ainda faltam R$ " + money(falta) + " para distribuir o total da carteira." };
    }
    if (falta < 0) {
      return { error: "A soma dos investimentos passou R$ " + money(-falta) + " do total da carteira." };
    }
    return { data: { total: total, items: items } };
  }

  /* ============ leitura do que está salvo ============ */
  // Aceita o jsonb vindo do banco (ou já um objeto) e devolve sempre
  // { total, items: { chave da categoria: [ {name, amount} ] } }, ignorando o
  // que não bate com esse formato.
  function parse(saved) {
    var raw = saved;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (err) { raw = null; }
    }

    var total = raw && isFinite(raw.total) ? round2(Number(raw.total)) : 0;
    var origem = raw && raw.items && typeof raw.items === "object" ? raw.items : {};
    var items = {};

    Classes.list.forEach(function (cat) {
      var lista = Array.isArray(origem[cat.key]) ? origem[cat.key] : [];
      items[cat.key] = lista.filter(function (item) {
        return item && typeof item.name === "string" && isFinite(item.amount) && item.amount > 0;
      }).map(function (item) {
        return { name: item.name, amount: round2(Number(item.amount)) };
      });
    });

    return { total: total > 0 ? total : 0, items: items };
  }

  // A etapa 2 já foi concluída? (total informado e pelo menos um investimento)
  function isFilled(profile) {
    var dados = parse(profile && profile.investments);
    if (!dados.total) return false;
    return Classes.list.some(function (cat) { return dados.items[cat.key].length > 0; });
  }

  // soma em reais de uma lista de investimentos
  function sumOf(items) {
    var soma = 0;
    (items || []).forEach(function (item) { soma += item.amount; });
    return round2(soma);
  }

  global.Investments = {
    mount: mount,
    fill: fill,
    read: read,
    parse: parse,
    isFilled: isFilled,
    sumOf: sumOf,
    percentOf: percentOf,
    pctText: pctText
  };
})(window);
