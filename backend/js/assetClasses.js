(function (global) {
  "use strict";

  // As duas tabelas da etapa 2 (RF e RV) e as categorias fixas de cada uma —
  // a aluna não cria, renomeia nem apaga categoria: ela só põe investimentos
  // dentro delas. "key" é o que vai gravado em profiles.investments, então
  // mudar uma key exige migrar os dados já salvos.
  //
  // A ordem daqui é a ordem na tela e no gráfico da carteira, e cada posição
  // tem uma cor fixa no styles.css — mexer na ordem troca as cores.
  var MAX_PER_CATEGORY = 5;

  var GROUPS = [
    {
      key: "rf",
      abbr: "RF",
      name: "Renda Fixa",
      categories: [
        { key: "rf_pos", name: "Renda Fixa Pós" },
        { key: "rf_pre", name: "Renda Fixa Prefixada" },
        { key: "rf_inflacao", name: "Renda Fixa Inflação" }
      ]
    },
    {
      key: "rv",
      abbr: "RV",
      name: "Renda Variável",
      categories: [
        { key: "multimercado", name: "Multimercado" },
        { key: "rv_brasil", name: "Renda Variável Brasil" },
        { key: "rv_internacional", name: "Renda Variável Internacional" },
        { key: "rf_internacional", name: "Renda Fixa Internacional" },
        { key: "ouro", name: "Ouro" }
      ]
    }
  ];

  // todas as categorias das duas tabelas, na ordem em que aparecem na tela
  var LIST = [];
  GROUPS.forEach(function (g) {
    g.categories.forEach(function (c) { LIST.push(c); });
  });

  function byKey(key) {
    return LIST.filter(function (c) { return c.key === key; })[0] || null;
  }

  global.AssetClasses = {
    groups: GROUPS,
    list: LIST,
    byKey: byKey,
    maxPerCategory: MAX_PER_CATEGORY
  };
})(window);
