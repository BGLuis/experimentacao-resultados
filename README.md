# Qualidade e Velocidade com Assistentes de IA no Desenvolvimento de Software

Repositório oficial do Trabalho Final da disciplina **Medição e Experimentação em Engenharia de Software** (PUC Minas — 2º Semestre / 2026), integrando:

1. **Parte 1 — Planejamento (Pré-registro):** protocolo metodológico completo do *survey* (GQM, amostragem, instrumento com rastreabilidade, pré-teste, plano de análise, ética/LGPD e ameaças à validade), mantido intacto em [`Protocolo de Survey Pré-Registrado.pdf`](./Protocolo%20de%20Survey%20Pr%C3%A9-Registrado.pdf) e estruturado em código-fonte modular LaTeX em [`latex/`](./latex/).
2. **Parte 2 — Execução, Análise Estatística e Dashboard:** pipeline de limpeza, confiabilidade, testes confirmatórios/exploratórios e codificação temática implementados em TypeScript/Vitest e visualizados em um dashboard interativo React + ECharts em [`dashboard/`](./dashboard/).
3. **Registro de Desvios:** documentação transparente de todas as divergências entre o protocolo pré-registrado e a execução real em [`DESVIOS.md`](./DESVIOS.md).

**Integrantes:** Gabriel Assis, Gustavo Lima, João Pedro Peres, Luis Henrique Gonçalves, Marcela Mendes.

---

## Estrutura do Repositório

```text
experimentacao-resultados/
├── Protocolo de Survey Pré-Registrado.pdf   # Documento original da Parte 1 (imutável)
├── criar_formulario_survey_ia.gs            # Script Google Apps Script que gerou o Google Forms
├── questions.csv                            # Base bruta exportada do Google Forms (33 linhas)
├── DESVIOS.md                               # Registro formal de desvios ao protocolo (Seção 8)
├── README.md                                # Visão geral, comandos e síntese do estudo
├── latex/                                   # Fonte modular LaTeX do protocolo (<= 6 páginas)
│   ├── main.tex
│   ├── config/                              # preambulo.tex e metadados.tex
│   ├── secoes/                              # 01_objetivo_qps.tex .. 08_divulgacao_cronograma.tex
│   ├── referencias.bib
│   ├── Justfile / Dockerfile / .latexmkrc
└── dashboard/                               # Aplicação web interativa + motor estatístico testado
    ├── package.json
    ├── public/questions.csv                 # Sincronizado a partir de ../questions.csv
    └── src/
        ├── stats/                           # Parser, limpeza, estatística não paramétrica e testes
        ├── components/                      # Componentes visuais, filtros e gráficos ECharts
        ├── pages/                           # 6 abas analíticas do dashboard
        ├── styles/
        └── utils/
```

---

## Anterioridade e Versionamento

Conforme descrito na Seção 8 do protocolo e detalhado no desvio **D-09** em [`DESVIOS.md`](./DESVIOS.md), o único *commit* prévio na branch `main` antes da consolidação da Parte 2 é:

- **Commit inicial do repositório:** `e2a1b2b650c11042627552c5af9331c5e7ef6c93` (`27/10/2026`, `feat: initial commit`).
- Não houve criação de *tag* assinada específica do protocolo antes da primeira resposta em `17/11/2026`; a rastreabilidade do planejamento apoia-se no PDF da Parte 1 e no registro integral de desvios em [`DESVIOS.md`](./DESVIOS.md).

---

## Como Compilar o Protocolo em LaTeX (`latex/`)

Pré-requisitos locais: `latexmk`, `pdflatex` (TeX Live com suporte a `babel` português, `abntex2`/`geometry`/`booktabs`/`longtable`/`fancyhdr`) ou Docker + Just.

```bash
# Compilação local direta
cd latex
latexmk -pdf main.tex

# Conferir contagem de páginas (limite estrito: <= 6 páginas)
pdfinfo main.pdf | grep Pages
```

Alternativamente, utilizando `Justfile` / Docker em `latex/`:

```bash
cd latex
just pdf          # compila localmente
just docker-build # constrói imagem TeX Live reproducível
just docker-pdf   # compila main.pdf dentro do container
```

---

## Como Executar, Testar e Construir o Dashboard (`dashboard/`)

Pré-requisitos: Node.js e npm. Os scripts `predev` e `prebuild` executam `npm run sync-csv` automaticamente para copiar `../questions.csv` para `dashboard/public/questions.csv`.

```bash
cd dashboard

# 1. Instalar dependências
npm install

# 2. Executar suíte de testes unitários e validação do motor estatístico (Vitest)
npm test

# 3. Subir servidor de desenvolvimento local
npm run dev

# 4. Gerar build de produção (TypeScript check + Vite bundle)
npm run build

# 5. Pré-visualizar o build de produção localmente
npm run preview -- --port 4173
```

---

## Resumo dos Resultados e Desvios Principais

### Fluxo da Amostra e Limpeza (Seção 5.1 + Etapa 0)
- **Respostas brutas coletadas (`questions.csv`):** `33` (`17/11/2026 23:23:14` a `25/11/2026 14:06:51`)
- **Etapa 0 — Elegibilidade (`ITEM_01..04`):** `-4` descartes (`R10`, `R16`, `R30` por `ITEM_04 = Sim`; `R23` por `ITEM_01 = Não`) → **`29` elegíveis**
- **Etapa 1 — Controle de atenção (`ITEM_18 ≠ 2`):** `-3` descartes (`R01`, `R14`, `R26`) → **`26` válidas**
- **Etapas 2, 3 e 4:** Tempo `< 120s` = `N/A` (Forms nativo sem log de início); *Straightlining* (`DP = 0`) = `0` descartes; Duplicatas completas exatas (`ITEM_01–22`) = `0` descartes.
- **Precisão amostral (`n = 26`):** margem de erro indicativa (95%, pior caso $p=0{,}5$) de **`±19,22 p.p.`** (vs `±13,86 p.p.` para o mínimo planejado de $n=50$).

### Síntese das Questões de Pesquisa e Confiabilidade
- **Confiabilidade (Sec. 5.2):** ambos os construtos e o indicador de revisão atingiram os limiares pré-registrados (`C_VEL` $\alpha \approx 0{,}708$; `C_QUAL` $\alpha \approx 0{,}786$; `M_REV` Spearman $\rho \approx 0{,}612$, $p \approx 0{,}0009$), sem acionamento do *fallback* item a item.
- **QP1 (Velocidade percebida — `C_VEL`):** mediana `5,00` e `96,2%` de concordância, evidenciando percepção fortemente positiva de ganho de velocidade.
- **QP2 (Qualidade percebida — `C_QUAL`):** mediana `4,00` e `53,8%` de concordância (com `ITEM_13` — manutenibilidade — em mediana `3,50` e `50,0%` de concordância), indicando percepção mais moderada e cautelosa em qualidade do que em velocidade (`C_VEL > C_QUAL` em `26/26` respondentes na comparação pareada exploratória).
- **QP3 (Senioridade — $\alpha = 0{,}025$):** com `Júnior = 6`, `Pleno = 6` e `Sênior = 14`, aplicou-se a fusão pré-registrada **`Jr+Pl (12) vs Sr (14)`** com Mann-Whitney; **não** houve diferença estatisticamente significativa nem para `C_VEL` ($U = 65{,}5$, $p \approx 0{,}255$) nem para `C_QUAL` ($U = 85{,}5$, $p \approx 0{,}959$).
- **QP4 (Rigor de revisão × Qualidade — $\alpha = 0{,}05$):** correlação de Spearman negativa fraca/moderada não significativa ($\rho \approx -0{,}348$, $p \approx 0{,}081$), mantida nas análises de sensibilidade.

### Principais Desvios Documentados ([`DESVIOS.md`](./DESVIOS.md))
1. **Amostra final (`26` vs mínimo `50`):** baixo poder estatístico e margem de erro ampliada (`±19,22 p.p.`).
2. **Janela estendida (`17/11` a `25/11 14:06`):** `14` das `26` respostas válidas foram coletadas após o limite da prorrogação (`24/11 12:00`).
3. **Gravação de inelegíveis no CSV:** o `.gs` usou `setGoToPage(SUBMIT)` na tela de agradecimento, exigindo a inserção da Etapa 0 no pipeline.
4. **Fusão de grupos na QP3 (`Jr+Pl vs Sr`) e codificação aberta:** fusão aplicada conforme Seção 5.3; livro de códigos determinístico implementado no dashboard, com validação formal do $\kappa$ de Cohen por dois avaliadores humanos ainda pendente.
