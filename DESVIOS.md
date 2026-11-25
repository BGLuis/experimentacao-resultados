# Registro de Desvios ao Protocolo Pré-Registrado (`DESVIOS.md`)

Conforme exigido na **Seção 8 (Plano de Divulgação, Período de Coleta e Comprovação de Anterioridade)** do documento [`Protocolo de Survey Pré-Registrado.pdf`](./Protocolo%20de%20Survey%20Pr%C3%A9-Registrado.pdf), o protocolo original de planejamento (Parte 1) não é editado retroativamente. Todas as divergências, ajustes operacionais, regras de contingência acionadas e limitações constatadas durante a execução da coleta e da análise (Parte 2) são registradas abaixo com transparência.

---

## Sumário Executivo dos Desvios

| ID | Data do registro | Seção afetada | Resumo do desvio | Status / Ação aplicada |
| :--- | :--- | :--- | :--- | :--- |
| **D-01** | 25/11/2026 | Sec. 2 (Amostragem) | Amostra final de **26 válidas** (`33 brutas`) vs mínimo de 50 / meta de 60 | Limitação declarada; margem de erro recalculada (`±19,22 p.p.`) |
| **D-02** | 25/11/2026 | Sec. 2 e Sec. 8 (Coleta) | Início tardio (`17/11 23:23`) e **14 válidas coletadas após `24/11 12:00`** (até `25/11 14:06`) | Coleta estendida na prática; análise comparativa Iniciais vs Tardias |
| **D-03** | 25/11/2026 | Sec. 2 e Sec. 5.1 (Limpeza) | *Skip logic* do `.gs` gravou **4 respostas inelegíveis** (`R10, R16, R23, R30`) | Adicionada **Etapa 0 (Elegibilidade)** antes da Etapa 1 no pipeline |
| **D-04** | 25/11/2026 | Sec. 5.1 (Limpeza) | Ausência de log de início / tempo total (`< 120s`) no Google Forms nativo | Limitação já prevista na Sec. 5.1; descarte via `ITEM_18` e *straightlining* |
| **D-05** | 25/11/2026 | Sec. 3 (Instrumento) | `setShuffleQuestions(true)` embaralha todas as páginas e não garante distância do `ITEM_16` | Limitação documentada no `.gs`; análise de sensibilidade sem `ITEM_16` |
| **D-06** | 25/11/2026 | Sec. 3 e Sec. 6 (`M_TOOL`) | 2 ocorrências de `"kiro aws"` (`R06`, `R17`) com menção indireta a empresa | Normalização `"kiro aws" -> "Kiro"` (com toggle bruto/normalizado) |
| **D-07** | 25/11/2026 | Sec. 5.3 (QP3) | `Júnior = 6 < 8` e `Pleno = 6 < 8` abaixo do limiar mínimo por estrato | Regra de contingência aplicada: fusão `Jr+Pl (12) vs Sr (14)` (Mann-Whitney) |
| **D-08** | 25/11/2026 | Sec. 5.4 (Abertas) | Codificação temática automatizada por livro de códigos sem $\kappa$ de Cohen humano | Livro de códigos transparente no dashboard; validação humana do $\kappa$ pendente |
| **D-09** | 25/11/2026 | Sec. 8 (Anterioridade) | Repositório Git sem *commit* assinado / *tag* publicada antes da 1ª resposta | Divergência formal de rastreabilidade Git registrada |

---

## Detalhamento dos Desvios

### D-01 — Tamanho da Amostra Final Abaixo do Mínimo Pré-Registrado
- **Data:** 25/11/2026
- **Seção afetada:** Seção 2 (*População e Amostragem — Tamanho pretendido e Margem de erro*)
- **Planejado vs. Executado:**
  - **Planejado:** Meta de `60` respostas válidas (mínimo aceitável: `50` válidas), com expectativa de `≥ 80` respostas brutas para absorver descartes. Margem de erro indicativa (95%, $z = 1{,}96$, pior caso $p = 0{,}5$) de `±13,86 p.p.` para $n = 50$ (`±12,65 p.p.` para $n = 60$).
  - **Executado:** Foram obtidas `33` respostas brutas (`R01`–`R33`), resultando em `29` respostas elegíveis (`4` descartes por inelegibilidade na Etapa 0) e **`26` respostas válidas** (`3` descartes na Etapa 1 por falha no item de atenção `ITEM_18`). Para $n = 26$, a margem de erro indicativa passa a **`±19,22 p.p.`** ($1{,}96 \times \sqrt{0{,}25 / 26} \times 100$).
- **Justificativa:** Baixa taxa de conversão na amostragem não probabilística por conveniência e bola de neve dentro da janela acadêmica disponível até o prazo de entrega dos resultados (`26/11 às 12h`), conforme contingência prevista na própria regra de parada da Seção 2 (*"persistindo, reporta-se a limitação"*).
- **Impacto nas conclusões:** Redução substancial do poder estatístico nos testes confirmatórios (especialmente QP3 e QP4 para efeitos pequenos a moderados), intervalos de confiança de Wilson e de *bootstrap* mais amplos (`±19,22 p.p.` na estimativa global), e necessidade de interpretar os resultados como evidência descritiva/exploratória da amostra obtida, sem generalização estatística.

---

### D-02 — Atraso no Início e Coleta Após o Limite da Prorrogação
- **Data:** 25/11/2026
- **Seção afetada:** Seção 2 (*Regra de parada*) e Seção 8 (*Período de coleta e Cronograma*)
- **Planejado vs. Executado:**
  - **Planejado:** Coleta de 10 dias corridos entre `12/11/2026` (Dia 0) e `22/11/2026 às 23h59`, com uma única prorrogação permitida até `24/11/2026 às 12h00` caso houvesse `< 50` respostas válidas.
  - **Executado:** A primeira resposta bruta foi registrada apenas em **`17/11/2026 23:23:14`** (`R01`, posteriormente descartada em `ITEM_18`; primeira resposta válida `R02` em `18/11/2026 14:38:10`). Até o encerramento original (`22/11 23:59`), havia apenas `9` respostas brutas (`8` válidas: `R02`–`R09`). Durante a janela da prorrogação (`23/11 00:00` a `24/11 12:00`), entraram mais `7` brutas (`4` válidas: `R11, R12, R13, R15`), totalizando `12` válidas no limite oficial. Como o formulário permaneceu aberto para alcançar volume mínimo analisável antes da consolidação final, **14 respostas válidas** (`17` brutas: `R17`–`R33`, sendo `R23` e `R30` inelegíveis e `R26` reprovada em `ITEM_18`) foram coletadas **após `24/11/2026 12:00`**, com o último registro em **`25/11/2026 14:06:51`** (`R33`).
- **Justificativa:** O atraso inicial de 5 dias na obtenção de respostas comprimiu a janela efetiva para menos de metade do previsto; mantendo-se a coleta aberta até a tarde de `25/11`, foi possível mais que dobrar o tamanho da amostra válida (`12 -> 26`), viabilizando as análises não paramétricas previstas sem comprometer a entrega de `26/11 às 12h`.
- **Impacto nas conclusões:** Viabilizou o alcance de `n = 26` e a formação do grupo `Jr+Pl (n = 12)` vs `Sr (n = 14)` na QP3, mas configura violação formal da regra de parada da Seção 2. Para mitigar viés temporal/onda de divulgação, o dashboard inclui análise comparativa explícita entre respostas **Iniciais vs. Tardias** (por mediana temporal e por corte `24/11 12:00`, conforme Seção 7).

---

### D-03 — *Skip Logic* do Google Forms Gravando Respostas Inelegíveis
- **Data:** 25/11/2026
- **Seção afetada:** Seção 2 (*Exclusão*) e Seção 5.1 (*Limpeza*)
- **Planejado vs. Executado:**
  - **Planejado:** *"Os ITEM_01–04 usam skip logic: quem não é elegível encerra o formulário e nada é gravado."* (Seção 2). Por essa premissa, o pipeline da Seção 5.1 iniciava diretamente na verificação de atenção (`ITEM_18 ≠ 2`).
  - **Executado:** No script `criar_formulario_survey_ia.gs` (linhas 226–257), os desvios condicionais de `ITEM_01–04` redirecionam respondentes fora do perfil para `paginaAgradecimento` configurada com `.setGoToPage(FormApp.PageNavigationType.SUBMIT)` e botão *"Enviar"*. Com isso, **4 respostas inelegíveis foram gravadas** no `questions.csv` com `ITEM_05–22` em branco:
    - `R10` (`23/11/2026 13:33:42`): `ITEM_04 = Sim` (matriculado na disciplina);
    - `R16` (`24/11/2026 11:48:03`): `ITEM_04 = Sim` (matriculado na disciplina);
    - `R23` (`24/11/2026 16:15:44`): `ITEM_01 = Não` (não atua profissionalmente remunerado);
    - `R30` (`25/11/2026 09:30:12`): `ITEM_04 = Sim` (matriculado na disciplina).
  - **Adaptação no pipeline:** Foi adicionada uma **Etapa 0 (Elegibilidade)** anterior à Etapa 1 (`ITEM_18 ≠ 2`), filtrando `ITEM_01..03 == "Sim"` e `ITEM_04 == "Não"` no fluxo `33 brutas -> 29 elegíveis -> 26 válidas`.
- **Justificativa:** Comportamento estrutural da interface do Google Forms ao exibir tela acolhedora de encerramento com pedido de compartilhamento antes do envio final; se não houvesse Etapa 0, as 4 linhas em branco falhariam erroneamente na Etapa 1 (`ITEM_18` vazio), distorcendo a contagem de descartes por desatenção.
- **Impacto nas conclusões:** Nenhum viés sobre os resultados válidos (nenhum inelegível respondeu `ITEM_05–22`), porém altera a contabilidade do funil de limpeza, separando corretamente exclusão por perfil (`n = 4`) de falha no controle de atenção (`n = 3`: `R01`, `R14`, `R26`).

---

### D-04 — Ausência de Temporização por Resposta (`< 120s`)
- **Data:** 25/11/2026
- **Seção afetada:** Seção 5.1 (*Limpeza — Critério 2*)
- **Planejado vs. Executado:**
  - **Planejado:** Descarte de respostas com tempo total `< 120s` (~5 s/item) quando mensurável por complemento de temporização; caso contrário, aplicar apenas os critérios 1 e 3 e reportar a limitação da plataforma.
  - **Executado:** O formulário utilizou Google Forms nativo sem *add-on* de cronometragem. O `questions.csv` registra apenas o `Carimbo de data/hora` de envio. Assim, a Etapa 2 retorna `N/A` (não mensurável) e nenhum respondente foi descartado por duração.
- **Justificativa:** Limitação nativa prevista e explicitamente contingenciada no texto da Seção 5.1 do protocolo.
- **Impacto nas conclusões:** Eventuais respostas apressadas que tenham acertado o `ITEM_18` por acaso e evitado *straightlining* exato (`DP = 0`) não são detectáveis por tempo. Na prática, as 2 respostas com texto aberto manifestamente de teste/ruído (`R01` com `"asdasd"` e `R14` com `"teste"`) já foram eliminadas pelo critério 1 (`ITEM_18 ≠ 2`).

---

### D-05 — Embaralhamento Global via `setShuffleQuestions(true)`
- **Data:** 25/11/2026
- **Seção afetada:** Seção 3 (*Questionário com Rastreabilidade*)
- **Planejado vs. Executado:**
  - **Planejado:** *"Os ITEM_08–18 aparecem em bloco único, em ordem aleatória quando a plataforma permitir (com o ITEM_18 de verificação de atenção integrado ao bloco e o ITEM_16 nunca adjacente a outro item de qualidade)."*
  - **Executado:** No arquivo `criar_formulario_survey_ia.gs` (linhas 30 e 268), `EMBARALHAR_LIKERT = true` aciona `form.setShuffleQuestions(true)`, que na API do Google Forms embaralha a ordem das perguntas **em todas as páginas com mais de um item** (não apenas a página Likert), além de não oferecer restrição de adjacência — logo, não garante que `ITEM_16` fique separado de `ITEM_12–15, 17` nem impede que `ITEM_18` apareça na 1ª posição do bloco Likert (limitação alertada nos comentários das linhas 26–29 do próprio `.gs`).
- **Justificativa:** Limitação da API do Google Apps Script (`FormApp`), que só disponibiliza embaralhamento global por formulário e não suporta restrições de adjacência entre itens na mesma página.
- **Impacto nas conclusões:** Pode atenuar parcialmente a detecção de *straightlining* caso itens de qualidade fiquem adjacentes ao item invertido `ITEM_16`, ou alterar discretamente o padrão de leitura na página de perfil/revisão. Para verificar robustez, a análise de sensibilidade da QP4 avalia `C_QUAL` removendo `ITEM_16` separadamente (Seção 5.3).

---

### D-06 — Normalização de Ferramenta (`M_TOOL`) e Menção Indireta a Empresa
- **Data:** 25/11/2026
- **Seção afetada:** Seção 3 (`ITEM_06` — *Ferramenta M_TOOL*) e Seção 6 (*Ética e LGPD — Anonimização*)
- **Planejado vs. Executado:**
  - **Planejado:** `ITEM_06` listava opções fixas (`Copilot`, `ChatGPT`, `Claude`, `Cursor`, `Gemini`) e `"Outra, descreva sem citar empresas"`.
  - **Executado:** Dois respondentes válidos (`R06` e `R17`) informaram `"kiro aws"` no campo aberto, enquanto outros 7 informaram exatamente `"Kiro"` (`R02, R04, R07, R11, R21, R25, R32`). No dashboard, `"kiro aws"` é normalizado para `"Kiro"`, elevando a categoria para `9/26 (34,6%)`, com **alternador (toggle) bruto/normalizado** para auditabilidade completa. Ademais, registra-se o alerta ético de que `"aws"` cita indiretamente a empresa fornecedora da ferramenta (Amazon Web Services), contrariando a instrução do item, embora não identifique o empregador nem a pessoa respondente.
- **Justificativa:** Evitar fragmentação artificial de uma mesma ferramenta por variação de grafia/sufixo de fornecedor nas estatísticas exploratórias de `M_TOOL` e no teste de contingência `M_TOOL × M_SEN`.
- **Impacto nas conclusões:** A normalização não afeta nenhuma questão confirmatória (QP3/QP4); na análise exploratória de ferramenta, consolida o Kiro como ferramenta mais citada na amostra (`34,6%`). Por transparência LGPD, o sufixo `"aws"` é sinalizado nos desvios e não constitui dado pessoal identificável.

---

### D-07 — Fusão de Grupos de Senioridade na QP3 (`Jr+Pl vs Sr`)
- **Data:** 25/11/2026
- **Seção afetada:** Seção 5.3 (*Testes — QP3*)
- **Planejado vs. Executado:**
  - **Planejado:** Kruskal-Wallis entre os 3 estratos (`Júnior`, `Pleno`, `Sênior`) com $\alpha = 0{,}025$ cada (`C_VEL` e `C_QUAL`), seguido de pós-teste de Dunn com Bonferroni, com regra pré-registrada: *"Se algum nível tiver < 8 respondentes, fundem-se os adjacentes menores (e.g., Jr+Pl vs. Sr) e aplica-se Mann-Whitney (efeito r), registrando a fusão."*
  - **Executado:** A amostra válida resultou em `Júnior = 6` (`< 1 ano`: 1; `1–3 anos`: 5), `Pleno = 6` (`> 3–6 anos`: 6) e `Sênior = 14` (`> 6 anos`: 14). Como dois níveis ficaram abaixo de `8` respondentes (`6 < 8`), acionou-se a regra de fusão: **`Jr+Pl (n = 12)` vs `Sr (n = 14)`** com teste U de Mann-Whitney ($\alpha = 0{,}025$) e tamanho de efeito $r$. O dashboard também disponibiliza a visualização dos 3 grupos separados para inspeção.
- **Justificativa:** Cumprimento estrito de contingência prevista no protocolo pré-registrado para evitar estimativas instáveis em estratos muito pequenos.
- **Impacto nas conclusões:** Perde-se a capacidade de distinguir diferenças específicas entre `Júnior` e `Pleno`, passando a testar apenas o contraste entre profissionais até 6 anos de experiência (`Jr+Pl`) e profissionais acima de 6 anos (`Sr`).

---

### D-08 — Codificação Temática das Respostas Abertas sem $\kappa$ de Cohen Humano
- **Data:** 25/11/2026
- **Seção afetada:** Seção 5.4 (*Respostas abertas `ITEM_21–22`*)
- **Planejado vs. Executado:**
  - **Planejado:** Análise temática indutiva por dois pesquisadores independentes, com dupla codificação de ao menos 20% das respostas, cálculo do $\kappa$ de Cohen (meta $\kappa \ge 0{,}60$) e resolução de divergências por consenso.
  - **Executado:** Das 26 respostas válidas, 23 possuem relatos textuais preenchidos (`R07`, `R20` e `R32` deixaram `ITEM_21` e `ITEM_22` vazias). Para viabilizar o livro de códigos no dashboard interativo dentro do prazo, implementou-se uma categorização temática determinística e auditável por regras lexicais explícitas (`dashboard/src/stats/openCoding.ts`). **A validação formal do $\kappa$ de Cohen por dois avaliadores humanos independentes permanece pendente** (o dashboard exibe explicitamente o livro de códigos e essa pendência, sem simular um valor fictício de $\kappa$).
- **Justificativa:** Compressão do cronograma pós-coleta em decorrência do prolongamento da coleta até `25/11 14:06` (desvio D-02).
- **Impacto nas conclusões:** Os temas exibidos para riscos (`ITEM_21`) e benefícios (`ITEM_22`) são determinísticos e reprodutíveis a partir do livro de códigos, porém ainda carecem de aferição formal de concordância interavaliadores ($\kappa$ de Cohen) antes de eventual publicação científica externa.

---

### D-09 — Status do Registro de Anterioridade no Repositório Git
- **Data:** 25/11/2026
- **Seção afetada:** Seção 8 (*Comprovação de anterioridade e Cronograma*)
- **Planejado vs. Executado:**
  - **Planejado:** *"este documento é versionado no GitHub do grupo, com commit assinado e tag publicados antes da primeira resposta (o hash é registrado no README)."* (previsto para `12/11/2026`).
  - **Executado:** Na auditoria do histórico Git local (`git log` / `git tag`), consta apenas o commit inicial `e2a1b2b650c11042627552c5af9331c5e7ef6c93` (`feat: initial commit`, em `27/10/2026`, contendo apenas o título em `README.md`), sem *tags* criadas e sem *commit* assinado do PDF do protocolo antes do início da coleta (`17/11/2026`). Os arquivos `Protocolo de Survey Pré-Registrado.pdf`, `criar_formulario_survey_ia.gs` e `questions.csv` encontravam-se não rastreados na árvore de trabalho no momento da consolidação dos resultados.
- **Justificativa:** O envio formal do PDF de pré-registro foi realizado na plataforma da disciplina dentro da Parte 1, porém o espelhamento por *tag* e *commit* assinado no repositório Git não foi executado antes da abertura do formulário.
- **Impacto nas conclusões:** Não afeta os cálculos estatísticos, mas reduz a força da prova criptográfica de anterioridade via GitHub. A mitigação adotada é a preservação integral e imutável de `Protocolo de Survey Pré-Registrado.pdf` ao lado de `latex/` (reprodução fiel do protocolo) e o registro explícito desta lacuna neste documento e no `README.md`.
