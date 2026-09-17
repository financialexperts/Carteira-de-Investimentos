# Carteira de Investimentos

App onde o aluno descobre o próprio perfil de investidor, monta a carteira dele e compara com a alocação sugerida para esse perfil.

Não tem build nem instalação: é `index.html` + alguns arquivos `.js` e `.css` estáticos, com [Supabase](https://supabase.com) cuidando do login e de guardar os dados. Para rodar, basta abrir o `index.html` num servidor estático (ou publicar a pasta no GitHub Pages).

---

## O caminho do aluno

1. **Entrar.** Login com e-mail e senha. Quem ainda não tem conta cria uma na mesma tela, e quem esqueceu a senha recebe um link por e-mail.

2. **Etapa 01 — Seu perfil.** Ele escolhe entre **Conservador**, **Moderado** e **Arrojado**. Cada opção mostra só o nome e o nível de risco, num medidor de três barrinhas.

3. **Etapa 02 — Seus investimentos.** Ele informa o **total investido, em reais**, e distribui esse dinheiro entre as categorias. Em cada categoria cabem **até 5 investimentos**, cada um com o nome e o valor, também em reais. A soma precisa fechar exatamente no total informado.

4. **A carteira.** Duas roscas, uma embaixo da outra: a **dele**, montada na etapa 02, e a **sugerida** para o perfil dele. Os botões "Alterar perfil" e "Editar investimentos" voltam para cada etapa.

As duas etapas só aparecem na primeira vez. Depois, o aluno cai direto na carteira.

### Entra em reais, sai em porcentagem

O aluno **nunca digita uma porcentagem**. Ele digita dinheiro, e o sistema calcula cada fatia tomando o total informado como 100%. O caminho de volta não existe: a tela da carteira mostra só porcentagens, e **nenhum valor em dinheiro chega até ela**.

Os reais ficam guardados no banco porque é o que permite ao aluno voltar depois e editar exatamente os números que digitou.

---

## As categorias

São 8, fixas — o aluno não cria, não renomeia e não apaga nenhuma. Ficam em [`backend/js/assetClasses.js`](backend/js/assetClasses.js):

| RF — Renda Fixa | RV — Renda Variável |
| --- | --- |
| Renda Fixa Pós | Multimercado |
| Renda Fixa Prefixada | Renda Variável Brasil |
| Renda Fixa Inflação | Renda Variável Internacional |
| | Renda Fixa Internacional |
| | Ouro |

**A ordem dessa lista importa.** Cada posição tem uma cor fixa nos gráficos, definida no bloco "Cores das categorias" do [`styles.css`](frontend/css/styles.css). Trocar a ordem em `assetClasses.js` troca as cores da tela.

As cores vêm de uma paleta categórica escolhida para continuar distinguível por quem tem daltonismo, com uma variação própria para o tema escuro. A mesma cor acompanha a categoria nos três lugares onde ela aparece: a faixa na etapa 02, a fatia da rosca e o ponto da legenda.

---

## A alocação sugerida

É a tabela que vira a segunda rosca da carteira. Fica em `suggested`, dentro de cada perfil em [`backend/js/investorProfiles.js`](backend/js/investorProfiles.js):

| Classe de ativos | Conservador | Moderado | Arrojado |
| --- | ---: | ---: | ---: |
| Renda Fixa Pós | 72,5% | 55,0% | 25,0% |
| Renda Fixa Prefixada | 5,0% | 5,0% | 5,0% |
| Renda Fixa Inflação | 10,0% | 20,0% | 40,0% |
| Multimercado | 7,5% | 7,5% | 5,0% |
| Renda Variável Brasil | 0% | 2,5% | 5,0% |
| Renda Variável Internacional | 3,0% | 6,0% | 12,0% |
| Renda Fixa Internacional | 1,5% | 3,0% | 6,0% |
| Ouro | 0,5% | 1,0% | 2,0% |
| **Total** | **100%** | **100%** | **100%** |

Cada perfil precisa listar as 8 categorias e somar 100. O próprio `investorProfiles.js` confere isso quando a página carrega e reclama no console do navegador se algo não bater — assim um erro de digitação aparece na hora, em vez de virar um gráfico torto que ninguém percebe.

---

## Estrutura de arquivos

```
index.html                      as telas: login, as duas etapas e a carteira
frontend/
  css/styles.css                todo o visual, incluindo as cores das categorias
  img/                          logos e favicon
  js/config.js                  URL e chave do Supabase
  js/supabaseClient.js          inicializa o cliente Supabase
  js/format.js                  formatação de dinheiro e leitura do que foi digitado
  js/auth.js                    entrar / criar conta / esqueci a senha
  js/investments.js             a etapa 02: monta as tabelas, soma, limita e valida
  js/onboarding.js              as duas etapas e o que é salvo em cada uma
  js/portfolio.js               a carteira: as duas roscas e suas legendas
  js/app.js                     roteamento por sessão, tema, liga tudo
backend/
  js/investorProfiles.js        os 3 perfis e a alocação sugerida de cada um
  js/assetClasses.js            as categorias de RF e RV e o limite de 5
```

Os dois arquivos em `backend/js/` não tocam no DOM: são só dados. É neles que se mexe para mudar textos, categorias ou a tabela de sugestões.

---

## Modelo de dados

Uma linha por aluno na tabela **profiles**, com duas colunas — uma por etapa:

- **`investor_profile`** (`text`): o perfil escolhido na etapa 01 — `conservador`, `moderado` ou `arrojado`. Enquanto estiver vazia, o aluno vê a etapa 01.

- **`investments`** (`jsonb`): a etapa 02 — o total e uma lista por categoria, tudo **em reais**. Enquanto não tiver total e pelo menos um investimento, o aluno cai na etapa 02 (mas não repete a 01).

```json
{
  "total": 50000,
  "items": {
    "rf_pos":           [{ "name": "Tesouro Selic 2029", "amount": 15000 }],
    "rf_pre":           [],
    "rf_inflacao":      [{ "name": "IPCA+ 2035", "amount": 10000 }],
    "multimercado":     [],
    "rv_brasil":        [{ "name": "BOVA11", "amount": 15000 }],
    "rv_internacional": [{ "name": "IVVB11", "amount": 5000 }],
    "rf_internacional": [],
    "ouro":             [{ "name": "GOLD11", "amount": 5000 }]
  }
}
```

As chaves de `items` são as `key` de `assetClasses.js`, e os `amount` somam exatamente o `total`. **Nenhuma porcentagem é gravada** — todas são calculadas na hora de mostrar.

Cada aluno só enxerga a própria linha: o acesso é protegido por RLS no banco.

### O SQL que precisa rodar

Uma vez, no SQL Editor do Supabase:

```sql
alter table public.profiles
  add column if not exists investor_profile text
    check (investor_profile in ('conservador', 'moderado', 'arrojado'));

alter table public.profiles
  add column if not exists investments jsonb;

-- as duas etapas salvam com upsert, que precisa de permissão de INSERT:
-- cada aluno só pode criar a própria linha.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- faz a API do Supabase enxergar as colunas novas na hora
notify pgrst, 'reload schema';
```

Sem esse SQL o aluno consegue entrar, mas ao concluir uma etapa aparece "Não deu para salvar agora".

---

## Regras que valem a pena saber

**O limite de 5 por categoria.** Ao chegar no quinto investimento, o botão "Adicionar investimento" trava e avisa o motivo. Está em `MAX_PER_CATEGORY`, no `assetClasses.js`.

**O limitador do total.** A soma dos investimentos nunca passa do total da carteira: o que o aluno digita a mais é cortado no que ainda cabe, com um aviso dizendo quanto era. Se ele **baixar o total** depois de distribuir tudo, aí sim a soma fica maior — nesse caso o sistema não mexe no que ele digitou, mostra em vermelho quanto passou e não deixa concluir. Diminuir o número de alguém é escolha dele, não do sistema.

**Tocar, não só apontar.** Cada fatia e cada linha da legenda são alvos de clique, toque e teclado. No celular não existe "passar o mouse em cima", então o destaque fica aceso até o aluno desmarcar. Os dois gráficos guardam o próprio destaque, sem um mexer no outro.

**O que é salvo e quando.** O perfil é salvo ao sair da etapa 01, antes da etapa 02 — assim, se o aluno fechar a página no meio do caminho, a escolha dele ainda está lá quando voltar.

---

## Onde mexer para mudar cada coisa

| Para mudar… | Edite |
| --- | --- |
| Nome, descrição ou exemplos de um perfil | `backend/js/investorProfiles.js` |
| A alocação sugerida de um perfil | `suggested`, no mesmo arquivo |
| Nomes das categorias, ordem ou o limite de 5 | `backend/js/assetClasses.js` |
| As cores das categorias | bloco "Cores das categorias" no `styles.css` |
| Os textos das telas | `index.html` |

Trocar a `key` de uma categoria exige migrar o que já estiver salvo em `profiles.investments`, porque são essas chaves que estão gravadas lá.

---

## Login e senha

O login é do Supabase Auth. As contas ficam em `auth.users`, num schema separado do `public`, e a senha é guardada como **hash bcrypt** — não dá para ler a senha de um aluno, nem pelo painel do Supabase. É de propósito.

Quando um aluno não consegue entrar, os caminhos são:

- ele mesmo usa o "Esqueceu a senha?" na tela de login; ou
- você vai em **Authentication → Users** no painel do Supabase, acha o e-mail e manda um link de recuperação.

O link de recuperação volta para a página de onde o pedido saiu. Para isso funcionar, o endereço do app precisa estar em **Authentication → URL Configuration → Redirect URLs** — senão o Supabase manda o aluno para o **Site URL** do projeto.

---

## Rodando na sua máquina

1. Preencha `frontend/js/config.js` com a URL e a chave anônima do seu projeto Supabase (em **Project Settings → API**). Enquanto isso não estiver preenchido, o app abre numa tela explicando o que falta.
2. Rode o SQL acima uma vez.
3. Sirva a pasta por HTTP — abrir o arquivo direto pelo `file://` não funciona por causa das restrições do navegador. Qualquer servidor estático serve, por exemplo a extensão Live Server do VS Code.
