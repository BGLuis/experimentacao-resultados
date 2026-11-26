<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/graph.svg?title=Survey+IA+PUC+Minas&subtitle=Qualidade+e+velocidade+com+IA+na+engenharia+de+software&align=left&mode=dark" /><img alt="Survey IA PUC Minas" src="https://shieldcn.dev/header/graph.svg?title=Survey+IA+PUC+Minas&subtitle=Qualidade+e+velocidade+com+IA+na+engenharia+de+software&align=left&mode=light" /></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/stars/BGLuis/experimentacao-resultados.svg?variant=secondary&size=sm&mode=dark" /><img alt="GitHub Stars" src="https://shieldcn.dev/github/stars/BGLuis/experimentacao-resultados.svg?variant=secondary&size=sm&mode=light" /></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/forks/BGLuis/experimentacao-resultados.svg?variant=secondary&size=sm&mode=dark" /><img alt="GitHub Forks" src="https://shieldcn.dev/github/forks/BGLuis/experimentacao-resultados.svg?variant=secondary&size=sm&mode=light" /></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/watchers/BGLuis/experimentacao-resultados.svg?variant=secondary&size=sm&mode=dark" /><img alt="Watchers" src="https://shieldcn.dev/github/watchers/BGLuis/experimentacao-resultados.svg?variant=secondary&size=sm&mode=light" /></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/contributors/BGLuis/experimentacao-resultados.svg?theme=emerald&size=sm&mode=dark" /><img alt="Contributors" src="https://shieldcn.dev/github/contributors/BGLuis/experimentacao-resultados.svg?theme=emerald&size=sm&mode=light" /></picture>
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/license/BGLuis/experimentacao-resultados.svg?variant=ghost&size=sm&mode=dark" /><img alt="License" src="https://shieldcn.dev/github/license/BGLuis/experimentacao-resultados.svg?variant=ghost&size=sm&mode=light" /></picture>
</p>

<p align="center">
  <img alt="TypeScript" src="https://shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&variant=branded&size=sm" />
  <img alt="React" src="https://shieldcn.dev/badge/Framework-React-61DAFB.svg?logo=react&variant=branded&size=sm" />
  <img alt="Vite" src="https://shieldcn.dev/badge/Tool-Vite-646CFF.svg?logo=vite&variant=branded&size=sm" />
  <img alt="Tailwind CSS" src="https://shieldcn.dev/badge/Framework-Tailwind_CSS-06B6D4.svg?logo=tailwindcss&variant=branded&size=sm" />
  <img alt="LaTeX" src="https://shieldcn.dev/badge/Language-LaTeX-008080.svg?logo=latex&variant=branded&size=sm" />
  <img alt="Docker" src="https://shieldcn.dev/badge/Tool-Docker-2496ED.svg?logo=docker&variant=branded&size=sm" />
</p>

# 📖 Sobre

Repositório oficial do estudo **Qualidade e Velocidade com Assistentes de IA no Desenvolvimento de Software**, desenvolvido com metodologia de *survey* pré-registrado para investigar o impacto percebido de assistentes de IA generativa na velocidade de entrega e na qualidade do código entre desenvolvedores profissionais atuantes no Brasil.

O repositório integra duas frentes principais:

1. **Parte 1 — Planejamento (Pré-registro):** protocolo metodológico completo do *survey* (GQM, amostragem, instrumento com rastreabilidade, pré-teste, plano de análise, ética/LGPD e ameaças à validade), mantido intacto em [`Protocolo de Survey Pré-Registrado.pdf`](./Protocolo%20de%20Survey%20Pr%C3%A9-Registrado.pdf) e estruturado em código-fonte modular LaTeX em [`latex/`](./latex/).
2. **Parte 2 — Execução, Análise Estatística e Dashboard:** script de geração do formulário em Google Apps Script (`criar_formulario_survey_ia.gs`), base bruta coletada (`questions.csv`), pipeline de limpeza, confiabilidade, testes não paramétricos confirmatórios/exploratórios e codificação temática implementados em TypeScript/Vitest e visualizados em um dashboard interativo React + Apache ECharts em [`dashboard/`](./dashboard/).

**Integrantes:** Gabriel Assis, Gustavo Lima, João Pedro Peres, Luis Henrique Gonçalves, Marcela Mendes.

### Estrutura do Repositório

```text
experimentacao-resultados/
├── Protocolo de Survey Pré-Registrado.pdf   # Documento original da Parte 1 (imutável)
├── criar_formulario_survey_ia.gs            # Script Google Apps Script que gerou o Google Forms
├── questions.csv                            # Base bruta exportada do Google Forms (33 respostas)
├── LICENSE                                  # Licença MIT do repositório
├── README.md                                # Visão geral, comandos e síntese do estudo
├── latex/                                   # Fonte modular LaTeX do protocolo (<= 6 páginas)
│   ├── main.tex
│   ├── config/                              # preambulo.tex e metadados.tex
│   ├── secoes/                              # 01_objetivo_qps.tex .. 08_divulgacao_cronograma.tex
│   ├── referencias.bib
│   └── Justfile / Dockerfile / .latexmkrc
└── dashboard/                               # Aplicação web interativa + motor estatístico testado
    ├── package.json
    ├── public/questions.csv                 # Sincronizado a partir de ../questions.csv
    └── src/
        ├── stats/                           # Parser, limpeza, estatística não paramétrica e testes
        ├── charts/                          # Opções de gráficos ECharts (dumbbell, sankey, raincloud)
        ├── components/                      # Componentes visuais, filtros e painéis de BI
        ├── pages/                           # Visão BI interativa e 6 abas analíticas de relatório
        ├── styles/
        └── utils/
```

### Anterioridade e Versionamento

Conforme descrito na Seção 8 do protocolo, o único *commit* prévio na branch `main` antes da consolidação da Parte 2 é:

- **Commit inicial do repositório:** `e2a1b2b650c11042627552c5af9331c5e7ef6c93` (`27/10/2026`, `feat: initial commit`).
- Não houve criação de *tag* assinada específica do protocolo antes da primeira resposta em `17/11/2026`; a rastreabilidade do planejamento apoia-se no PDF da Parte 1.

### Resumo dos Resultados Principais

#### Fluxo da Amostra e Limpeza (Seção 5.1 + Etapa 0)
- **Respostas brutas coletadas (`questions.csv`):** `33` (`17/11/2026 23:23:14` a `25/11/2026 14:06:51`)
- **Etapa 0 — Elegibilidade (`ITEM_01..04`):** `-4` descartes (`R10`, `R16`, `R30` por `ITEM_04 = Sim`; `R23` por `ITEM_01 = Não`) → **`29` elegíveis**
- **Etapa 1 — Controle de atenção (`ITEM_18 ≠ 2`):** `-3` descartes (`R01`, `R14`, `R26`) → **`26` válidas**
- **Etapas 2, 3 e 4:** Tempo `< 120s` = `N/A` (Forms nativo sem log de início); *Straightlining* (`DP = 0`) = `0` descartes; Duplicatas completas exatas (`ITEM_01–22`) = `0` descartes.
- **Precisão amostral (`n = 26`):** margem de erro indicativa (95%, pior caso $p=0{,}5$) de **`±19,22 p.p.`** (vs `±13,86 p.p.` para o mínimo planejado de $n=50$).

#### Síntese das Questões de Pesquisa e Confiabilidade
- **Confiabilidade (Sec. 5.2):** ambos os construtos e o indicador de revisão atingiram os limiares pré-registrados (`C_VEL` $\alpha \approx 0{,}708$; `C_QUAL` $\alpha \approx 0{,}786$; `M_REV` Spearman $\rho \approx 0{,}612$, $p \approx 0{,}0009$), sem acionamento do *fallback* item a item.
- **QP1 (Velocidade percebida — `C_VEL`):** mediana `5,00` e `96,2%` de concordância, evidenciando percepção fortemente positiva de ganho de velocidade.
- **QP2 (Qualidade percebida — `C_QUAL`):** mediana `4,00` e `53,8%` de concordância (com `ITEM_13` — manutenibilidade — em mediana `3,50` e `50,0%` de concordância), indicando percepção mais moderada e cautelosa em qualidade do que em velocidade (`C_VEL > C_QUAL` em `26/26` respondentes na comparação pareada exploratória).
- **QP3 (Senioridade — $\alpha = 0{,}025$):** com `Júnior = 6`, `Pleno = 6` e `Sênior = 14`, aplicou-se a fusão pré-registrada **`Jr+Pl (12) vs Sr (14)`** com Mann-Whitney; **não** houve diferença estatisticamente significativa nem para `C_VEL` ($U = 65{,}5$, $p \approx 0{,}255$) nem para `C_QUAL` ($U = 85{,}5$, $p \approx 0{,}959$).
- **QP4 (Rigor de revisão × Qualidade — $\alpha = 0{,}05$):** correlação de Spearman negativa fraca/moderada não significativa ($\rho \approx -0{,}348$, $p \approx 0{,}081$), mantida nas análises de sensibilidade.

# 📋 Motivo

Trabalho Final da disciplina **Medição e Experimentação em Engenharia de Software** (PUC Minas — 2º Semestre / 2026), criado para planejar, executar e analisar de forma transparente e reprodutível um *survey* pré-registrado sobre qualidade e velocidade com assistentes de IA no desenvolvimento de software.

# 💻 Como iniciar

### Requisitos

- [Node.js](https://nodejs.org/) (execução local — dashboard)
- [npm](https://www.npmjs.com/) (execução local — dashboard)
- [Docker](https://www.docker.com/) (opção Docker — compilação LaTeX; imagem base `debian:bookworm-slim`)
- [TeX Live](https://www.tug.org/texlive/) com `latexmk` (execução local — compilação LaTeX)
- [Just](https://github.com/casey/just) (opcional — automação de comandos LaTeX via `Justfile`)

### Instalação

1. Clone o repositório:

   ```sh
   git clone https://github.com/BGLuis/experimentacao-resultados.git
   ```

2. Entre no diretório do projeto:

   ```sh
   cd experimentacao-resultados
   ```

#### Opção 1: Docker (Protocolo LaTeX)

3. Construa a imagem TeX Live e compile `latex/main.pdf`:

   ```sh
   cd latex
   just docker-build
   just docker-pdf
   ```

#### Opção 2: Execução local (Dashboard + LaTeX)

3. Instale as dependências, execute os testes e suba o dashboard interativo (os scripts `predev` e `prebuild` executam `npm run sync-csv` para copiar `../questions.csv` para `dashboard/public/questions.csv`):

   ```sh
   cd dashboard
   npm install
   npm test
   npm run dev
   ```

   Para gerar e pré-visualizar o build de produção do dashboard:

   ```sh
   npm run build
   npm run preview -- --port 4173
   ```

   Para compilar o protocolo LaTeX localmente (limite estrito de até 6 páginas):

   ```sh
   cd latex
   latexmk -pdf main.tex
   pdfinfo main.pdf | grep Pages
   ```

# 🤝 Contribuidores

<a href="https://github.com/BGLuis/experimentacao-resultados/graphs/contributors">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/contributors/BGLuis/experimentacao-resultados.svg?title=false&preset=transparent&border=false&mode=dark" /><img alt="Contribuidores" src="https://shieldcn.dev/contributors/BGLuis/experimentacao-resultados.svg?title=false&preset=transparent&border=false&mode=light" /></picture>
</a>

# 📄 Licença

Distribuído sob a licença [MIT](LICENSE).
