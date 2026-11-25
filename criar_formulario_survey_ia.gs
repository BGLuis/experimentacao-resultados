/**
 * Cria o Google Forms do "Protocolo de Survey Pré-Registrado:
 * Qualidade e Velocidade com Assistentes de IA".
 *
 * Como usar:
 *  1. Acesse https://script.google.com e crie um novo projeto.
 *  2. Cole este código, salve e execute a função criarFormulario().
 *  3. Autorize o acesso ao Google Forms/Drive quando solicitado.
 *  4. Os links (edição, resposta e link curto) aparecem em Ver > Registros de execução.
 *  5. Abra o link de edição e aplique o visual personalizado (leva ~30s, pois a API
 *     do Google Forms não permite alterar cores/fontes/capa via código):
 *       - Ícone "Personalizar tema" (paleta no topo direito):
 *       - Cabeçalho > Escolher imagem > Fazer upload: envie "capa_formulario_ia.png"
 *       - Cor do tema: + > #1E3A8A  |  Plano de fundo: #F1F5F9 (cinza-azulado suave)
 *       - Fonte do cabeçalho: Space Grotesk ou Lexend (Médio, tam. 20)
 *       - Fonte das perguntas: Inter ou Plus Jakarta Sans (tam. 12)
 *       - Fonte do texto: Inter ou Roboto (tam. 11)
 *  6. Em contas institucionais (@sga.pucminas.br), clique em "Publicar > Gerenciar"
 *     e confirme que "Visualização de respondentes" está como
 *     "Qualquer pessoa com o link" (para não restringir apenas à PUC Minas).
 *
 * Os IDs do protocolo (ITEM_xx) ficam nos comentários e NÃO aparecem
 * para o respondente.
 */

// true = ordem aleatória por página (ITEM_08–18 ficam em página própria).
// Atenção: com true não dá para garantir que o ITEM_16 nunca fique ao lado
// de outro item de qualidade (nem que o ITEM_18 não caia na 1ª posição).
// Com false, usa-se uma ordem fixa planejada que respeita esse distanciamento.
const EMBARALHAR_LIKERT = true;

const EMAIL_GRUPO = 'gabriel.souza.1523286@sga.pucminas.br'; // confira se será mantido este e-mail antes de publicar

const LIKERT = [
  'Discordo Totalmente',
  'Discordo Parcialmente',
  'Neutro',
  'Concordo Parcialmente',
  'Concordo Totalmente',
];
const FREQ = ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre'];
const NA = 'Não se aplica';

function criarFormulario() {
  const form = FormApp.create(
    'Qualidade e Velocidade com Assistentes de IA no Desenvolvimento de Software'
  );

  // Garante publicação nos formulários com o novo modelo de permissões do Google Forms
  try {
    if (
      typeof form.supportsAdvancedResponderPermissions === 'function' &&
      form.supportsAdvancedResponderPermissions()
    ) {
      form.setPublished(true);
    } else {
      form.setRequireLogin(false);
    }
  } catch (e) {
    // Ignora restrições de domínio que exigem ajuste manual na interface
  }

  const urlPublicada = form.getPublishedUrl();
  let linkCompartilhamento = urlPublicada;
  try {
    linkCompartilhamento = form.shortenFormUrl(urlPublicada);
  } catch (e) {
    // Mantém a URL completa caso o encurtador não esteja disponível
  }

  // ---------- Texto de inicialização ----------
  form.setDescription(
    'Olá! Convidamos você a participar deste estudo acadêmico conduzido na disciplina de ' +
    'Medição e Experimentação em Engenharia de Software, que investiga como pessoas ' +
    'desenvolvedoras percebem a velocidade e a qualidade do código ao usar assistentes de IA.\n\n' +
    'Como funciona a participação:\n' +
    '• Tempo estimado: cerca de 4 minutos.\n' +
    '• 100% anônima: não coletamos nome, e-mail, empresa, endereço IP nem localização.\n' +
    '• Voluntária: você pode fechar a página e desistir a qualquer momento antes do envio.\n\n' +
    'Observações éticas: por ser totalmente anônima, a resposta não poderá ser identificada ' +
    'nem excluída após o envio. Não há riscos previsíveis além de eventual desconforto leve ' +
    'ao refletir sobre a rotina de trabalho.\n\n' +
    'Dúvidas ou contato com a equipe: ' + EMAIL_GRUPO
  );

  form.setCollectEmail(false)
      .setLimitOneResponsePerUser(false)
      .setAllowResponseEdits(false)
      .setShowLinkToRespondAgain(false)
      .setProgressBar(true);

  // ---------- Consentimento ----------
  const consent = form.addCheckboxItem();
  consent.setTitle('Termo de consentimento')
    .setHelpText('Ao marcar a caixa abaixo, declaro ter 18 anos ou mais e concordar em participar.')
    .setChoices([consent.createChoice('Declaro ter 18 anos ou mais e concordo em participar.')])
    .setRequired(true);

  // ---------- Elegibilidade (skip logic) ----------
  // Cada pergunta fica em sua própria página para o salto funcionar.
  // As opções de navegação são vinculadas ao final, após criar a seção de agradecimento.
  const SEGUE = FormApp.PageNavigationType.CONTINUE;

  // ITEM_01
  form.addPageBreakItem().setTitle('Contexto inicial (1/4)');
  const i01 = form.addMultipleChoiceItem()
    .setTitle('Você atua profissionalmente (remunerado) em desenvolvimento de software?')
    .setRequired(true);

  // ITEM_02
  form.addPageBreakItem().setTitle('Contexto inicial (2/4)');
  const i02 = form.addMultipleChoiceItem()
    .setTitle('Usou ferramentas de IA para código nos últimos 6 meses?')
    .setRequired(true);

  // ITEM_03
  form.addPageBreakItem().setTitle('Contexto inicial (3/4)');
  const i03 = form.addMultipleChoiceItem()
    .setTitle('Você atua profissionalmente no Brasil?')
    .setRequired(true);

  // ITEM_04 (Sim vai para a seção de agradecimento)
  form.addPageBreakItem().setTitle('Contexto inicial (4/4)');
  const i04 = form.addMultipleChoiceItem()
    .setTitle('Você está matriculado(a) na disciplina de Medição e Experimentação em Eng. de Software (turma deste estudo)?')
    .setRequired(true);

  // ---------- Perfil e caracterização (ITEM_05–07) ----------
  form.addPageBreakItem().setTitle('Seu perfil');

  // ITEM_05 — Senioridade por tempo de atuação (M_SEN)
  form.addMultipleChoiceItem()
    .setTitle('Tempo de atuação em desenvolvimento de software:')
    .setChoiceValues(['Menos de 1 ano', '1 a 3 anos', 'Mais de 3 a 6 anos', 'Mais de 6 anos'])
    .setRequired(true);

  // ITEM_06 — Ferramenta mais usada (M_TOOL)
  form.addMultipleChoiceItem()
    .setTitle('Qual ferramenta de IA você mais usa?')
    .setHelpText('Escolha uma. Se marcar "Outra", descreva sem citar empresas.')
    .setChoiceValues(['Copilot', 'ChatGPT', 'Claude', 'Cursor', 'Gemini'])
    .showOtherOption(true)
    .setRequired(true);

  // ITEM_07 — Frequência de uso (M_USO)
  form.addMultipleChoiceItem()
    .setTitle('Com que frequência você usa IA no trabalho?')
    .setChoiceValues([
      'Menos de 1 dia por semana',
      '1 a 3 dias por semana',
      '4 a 5 dias por semana',
      'Todos os dias úteis',
    ])
    .setRequired(true);

  // ---------- Bloco Likert (ITEM_08–18) ----------
  form.addPageBreakItem()
    .setTitle('Percepções sobre o uso de IA')
    .setHelpText('Indique o quanto você concorda com cada afirmação. Se não se aplicar ao seu caso, escolha "Não se aplica".');

  const likert = {
    // Velocidade (C_VEL)
    i08: ['O uso de IA reduz o tempo que gasto implementando novas funcionalidades.', true],               // ITEM_08 C_VEL1
    i09: ['Consigo depurar bugs mais rapidamente com IA.', true],                                          // ITEM_09 C_VEL2
    i10: ['Consigo refatorar trechos de código mais rapidamente com IA.', true],                           // ITEM_10 C_VEL3
    i11: ['O volume das minhas entregas aumentou depois que adotei IA.', true],                            // ITEM_11 C_VEL4
    // Qualidade (C_QUAL)
    i12: ['O código gerado por IA atende aos padrões de legibilidade e arquitetura do meu time.', true],   // ITEM_12 C_QUAL1
    i13: ['O código escrito com apoio de IA é fácil de manter e evoluir.', true],                          // ITEM_13 C_QUAL2
    i14: ['O código escrito com apoio de IA tem menos defeitos do que o que eu escreveria sem IA.', true], // ITEM_14 C_QUAL3
    i15: ['O assistente me ajuda a escrever testes unitários mais abrangentes.', true],                    // ITEM_15 C_QUAL4
    i16: ['O código gerado por IA costuma conter falhas que exigem correção significativa da minha parte.', true], // ITEM_16 C_QUAL5 (invertido na análise: 6 − x)
    i17: ['No geral, a qualidade do código que entrego melhorou com a IA.', true],                         // ITEM_17 C_QUAL6
    // Verificação de atenção — sem "Não se aplica"
    i18: ['Atenção: para confirmar que está lendo, assinale exatamente "Discordo Parcialmente".', false],  // ITEM_18 (descarta se ≠ 2)
  };

  // Ordem fixa que mantém o ITEM_16 longe de outros itens de qualidade
  // (usada quando EMBARALHAR_LIKERT = false)
  const ordem = ['i08', 'i12', 'i09', 'i13', 'i10', 'i14', 'i11', 'i16', 'i18', 'i15', 'i17'];

  ordem.forEach(function (k) {
    const texto = likert[k][0];
    const comNA = likert[k][1];
    const opcoes = comNA ? LIKERT.concat([NA]) : LIKERT.slice();
    form.addMultipleChoiceItem()
      .setTitle(texto)
      .setChoiceValues(opcoes)
      .setRequired(true);
  });

  // ---------- Rigor de revisão (ITEM_19–20) ----------
  form.addPageBreakItem().setTitle('Revisão do código gerado por IA');

  // ITEM_19 — M_REV1
  form.addMultipleChoiceItem()
    .setTitle('Com que frequência você lê e revisa o código gerado por IA linha a linha antes de aprová-lo?')
    .setChoiceValues(FREQ.concat([NA]))
    .setRequired(true);

  // ITEM_20 — M_REV2
  form.addMultipleChoiceItem()
    .setTitle('Com que frequência você executa testes sobre o código gerado por IA antes de aprová-lo?')
    .setChoiceValues(FREQ.concat([NA]))
    .setRequired(true);

  // ---------- Abertas (ITEM_21–22) ----------
  form.addPageBreakItem().setTitle('Para finalizar');

  // ITEM_21
  form.addParagraphTextItem()
    .setTitle('Qual o principal risco que a IA trouxe ao seu trabalho/time?')
    .setHelpText('Não cite nomes de pessoas ou empresas.')
    .setRequired(false);

  // ITEM_22
  form.addParagraphTextItem()
    .setTitle('Qual o principal benefício técnico que a IA trouxe ao seu trabalho/time?')
    .setHelpText('Não cite nomes de pessoas ou empresas.')
    .setRequired(false);

  // ---------- Encerramento acolhedor para fora do recorte da pesquisa ----------
  // setGoToPage(SUBMIT) neste PageBreak faz com que quem conclui a seção anterior
  // ("Para finalizar") envie o formulário direto, sem passar por esta tela.
  // Apenas quem é redirecionado nas perguntas iniciais chega até aqui.
  const paginaAgradecimento = form.addPageBreakItem()
    .setTitle('Muito obrigado pela sua atenção e disponibilidade!')
    .setHelpText(
      'Agradecemos de verdade por dedicar seu tempo para abrir nossa pesquisa.\n\n' +
      'Nesta etapa do estudo, estamos coletando respostas especificamente de profissionais ' +
      'que atuam de forma remunerada com desenvolvimento de software no Brasil, utilizaram ' +
      'ferramentas de IA nos últimos 6 meses e não integram a turma responsável pela condução da pesquisa.\n\n' +
      'Ainda assim, você pode nos ajudar muito! Se puder compartilhar este formulário com ' +
      'colegas, times ou comunidades de pessoas desenvolvedoras, fará uma grande diferença ' +
      'para alcançarmos a amostra do estudo:\n\n' +
      'Link para compartilhar: ' + linkCompartilhamento + '\n\n' +
      'Clique em "Enviar" abaixo para registrar e concluir. Muito obrigado pelo apoio!'
    )
    .setGoToPage(FormApp.PageNavigationType.SUBMIT);

  // Vincula o salto condicional das perguntas iniciais para a tela acolhedora
  i01.setChoices([
    i01.createChoice('Sim', SEGUE),
    i01.createChoice('Não', paginaAgradecimento),
  ]);
  i02.setChoices([
    i02.createChoice('Sim', SEGUE),
    i02.createChoice('Não', paginaAgradecimento),
  ]);
  i03.setChoices([
    i03.createChoice('Sim', SEGUE),
    i03.createChoice('Não', paginaAgradecimento),
  ]);
  i04.setChoices([
    i04.createChoice('Sim', paginaAgradecimento),
    i04.createChoice('Não', SEGUE),
  ]);

  // ---------- Mensagem final pós-envio ----------
  form.setConfirmationMessage(
    'Resposta registrada! Muito obrigado por contribuir com nossa pesquisa acadêmica.\n\n' +
    'Se puder dar mais uma força, compartilhe este link com colegas desenvolvedores(as) ' +
    'no WhatsApp, Slack, Discord ou LinkedIn:\n' +
    linkCompartilhamento
  );

  // Embaralha a ordem das perguntas dentro de cada página
  form.setShuffleQuestions(EMBARALHAR_LIKERT);

  Logger.log('Editar:     ' + form.getEditUrl());
  Logger.log('Publicado:  ' + urlPublicada);
  Logger.log('Link curto: ' + linkCompartilhamento);
  Logger.log(
    'ATENÇÃO (Workspace/PUC Minas): abra o link de edição > clique em "Publicar" / "Gerenciar" ' +
    'e confirme que "Quem pode responder" está definido como "Qualquer pessoa com o link".'
  );
}
