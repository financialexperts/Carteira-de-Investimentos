(function (global) {
  "use strict";

  // Os 3 perfis de investidor, do menos ao mais arriscado. "key" é o valor
  // gravado em profiles.investor_profile (o banco só aceita esses três) —
  // não mude sem atualizar as linhas já salvas e a regra "check" da coluna.
  // risk: 1 a 3, quantas barrinhas do medidor de risco ficam acesas.
  //
  // "suggested": a alocação sugerida para o perfil, em % da carteira, com as
  // chaves das categorias de assetClasses.js. É o que vira o segundo gráfico
  // da carteira, ao lado do que a aluna montou. Cada perfil precisa somar 100
  // e listar as 8 categorias — é isso que assertSuggested() confere aqui
  // embaixo, pra um erro de digitação não virar um gráfico torto na tela.
  var LIST = [
    {
      key: "conservador",
      name: "Conservador",
      tagline: "Segurança em primeiro lugar",
      risk: 1,
      riskLabel: "Risco baixo",
      examples: "Tesouro Selic, CDB, LCI e LCA",
      suggested: {
        rf_pos: 72.5,
        rf_pre: 5,
        rf_inflacao: 10,
        multimercado: 7.5,
        rv_brasil: 0,
        rv_internacional: 3,
        rf_internacional: 1.5,
        ouro: 0.5
      }
    },
    {
      key: "moderado",
      name: "Moderado",
      tagline: "Equilíbrio entre segurança e retorno",
      risk: 2,
      riskLabel: "Risco médio",
      examples: "Renda fixa, fundos imobiliários e um pouco de ações",
      suggested: {
        rf_pos: 55,
        rf_pre: 5,
        rf_inflacao: 20,
        multimercado: 7.5,
        rv_brasil: 2.5,
        rv_internacional: 6,
        rf_internacional: 3,
        ouro: 1
      }
    },
    {
      key: "arrojado",
      name: "Arrojado",
      tagline: "Foco em crescer no longo prazo",
      risk: 3,
      riskLabel: "Risco alto",
      examples: "Ações, ETFs e fundos imobiliários",
      suggested: {
        rf_pos: 25,
        rf_pre: 5,
        rf_inflacao: 40,
        multimercado: 5,
        rv_brasil: 5,
        rv_internacional: 12,
        rf_internacional: 6,
        ouro: 2
      }
    }
  ];

  // Confere a tabela de sugestões na carga da página: uma categoria esquecida
  // ou uma soma que não fecha em 100 aparece na hora, no console, em vez de
  // virar um gráfico errado que ninguém percebe.
  function assertSuggested() {
    var chaves = global.AssetClasses.list.map(function (c) { return c.key; });
    LIST.forEach(function (p) {
      var soma = 0;
      chaves.forEach(function (k) {
        if (typeof p.suggested[k] !== "number") {
          console.error("Perfil " + p.key + ": falta a sugestão de " + k);
          return;
        }
        soma += p.suggested[k];
      });
      soma = Math.round(soma * 10) / 10;
      if (soma !== 100) {
        console.error("Perfil " + p.key + ": a sugestão soma " + soma + "%, devia somar 100%");
      }
    });
  }
  if (global.AssetClasses) assertSuggested();

  function byKey(key) {
    return LIST.filter(function (p) { return p.key === key; })[0] || null;
  }

  global.InvestorProfiles = {
    list: LIST,
    byKey: byKey
  };
})(window);
