/**
 * ============================================================================
 *  CONFIG — o único arquivo que você precisa editar para personalizar a página
 * ============================================================================
 *  Procure pelos marcadores ✏️ : são os lugares pensados para você mudar.
 *  Todos os textos, fotos, vídeos e datas da página saem daqui.
 *
 *  Dicas rápidas:
 *  - Caminhos de mídia são relativos ao index.html (ex.: 'assets/img/foto.jpg').
 *  - Datas usam o formato ISO: 'AAAA-MM-DDTHH:MM:SS' (horário local).
 *  - Mantenha as vírgulas e aspas — é JavaScript, não texto livre.
 * ============================================================================
 */
export const CONFIG = {
  /* ------------------------------------------------------------------------
   * O casal
   * ---------------------------------------------------------------------- */
  couple: {
    nameA: 'Kat',                    // ✏️ nome dela/dele
    nameB: 'João',                   // ✏️ seu nome
    startDate: '2026-08-11T00:00:00' // ✏️ ajuste a hora se quiser precisão (HH:MM) quando tudo começou (usado no contador)
  },

  /* ------------------------------------------------------------------------
   * Hero — a primeira tela
   * ---------------------------------------------------------------------- */
  hero: {
    title: 'Duas vidas, um só coração',          // ✏️ título principal
    subtitle: 'bem-vindos ao nosso mundo',       // ✏️ frase em letra cursiva
    video: 'assets/video/casal2.mp4',            // ✏️ vídeo de fundo (vertical funciona bem)
    poster: 'assets/img/momento1.jpg',           // ✏️ imagem enquanto o vídeo carrega
    scrollHint: 'role devagar'                   // ✏️ convite para rolar
  },

  /* ------------------------------------------------------------------------
   * Nossa história — capítulos que aparecem um a um na rolagem
   *  kicker: rótulo pequeno acima do texto
   *  text:   a frase do capítulo
   *  media (opcional): { type: 'image' | 'video', src, alt }
   * ---------------------------------------------------------------------- */
  story: [
    {
      kicker: 'Capítulo um',
      text: 'Tudo começou com um olhar...'                                    // ✏️
    },
    {
      kicker: 'Capítulo dois',
      text: 'Depois vieram as conversas que não queriam acabar.',             // ✏️
      media: { type: 'video', src: 'assets/video/casal1.mp4', alt: 'Nós dois rindo juntos no shopping' }
    },
    {
      kicker: 'Capítulo três',
      text: 'E de repente, segurar a sua mão virou o meu lugar favorito.',    // ✏️
      media: { type: 'image', src: 'assets/img/iendo.jpg', alt: 'Nossas mãos dadas dentro do carro' }
    },
    {
      kicker: 'Capítulo quatro',
      text: 'Hoje, cada dia ao seu lado é um capítulo novo.'                  // ✏️
    }
  ],

  /* ------------------------------------------------------------------------
   * Galeria — nossos momentos
   *  ✏️ Troque datas e lugares pelos reais. Para adicionar uma foto,
   *     coloque o arquivo em assets/img/ e copie um bloco { ... }.
   * ---------------------------------------------------------------------- */
  gallery: [
    {
      src: 'assets/img/casal3.jpg',
      alt: 'Nós dois abraçados em frente ao espelho',
      date: 'Junho de 2024',          // ✏️
      place: 'Em algum lugar nosso',  // ✏️
      caption: 'Onde quer que estejamos, o reflexo é sempre o mesmo: nós.'
    },
    {
      src: 'assets/img/flower.jpg',
      alt: 'O casal sorrindo com um buquê de flores rosas',
      date: 'Agosto de 2024',         // ✏️
      place: 'Um dia qualquer',       // ✏️
      caption: 'Flores murcham, mas o que eu sinto por você só floresce.'
    },
    {
      src: 'assets/img/momento2.jpg',
      alt: 'Buquê de rosas cor-de-rosa',
      date: 'Setembro de 2024',       // ✏️
      place: 'Para você',             // ✏️
      caption: 'Cada pétala é um "eu te amo" que eu não consegui dizer em voz alta.'
    },
    {
      src: 'assets/img/iendo.jpg',
      alt: 'Mãos dadas dentro do carro',
      date: 'Outubro de 2024',        // ✏️
      place: 'Na estrada',            // ✏️
      caption: 'Qualquer caminho fica curto quando é a sua mão que eu seguro.'
    },
    {
      src: 'assets/img/momento1.jpg',
      alt: 'Selfie do casal à noite',
      date: 'Novembro de 2024',       // ✏️
      place: 'Sob as estrelas',       // ✏️
      caption: 'A noite fica mais bonita quando o seu sorriso aparece nela.'
    },
    {
      src: 'assets/img/rodeio.jpg',
      alt: 'Noite de rodeio com amigos',
      date: 'Janeiro de 2025',        // ✏️
      place: 'Noite de rodeio',       // ✏️
      caption: 'Entre luzes, música e poeira, eu só via você.'
    },
    {
      src: 'assets/img/casal4.jpg',
      alt: 'Selfie do casal no espelho',
      date: 'Hoje',                   // ✏️
      place: 'Do nosso jeitinho',     // ✏️
      caption: 'Meu lugar preferido no mundo é ao seu lado.'
    }
  ],

  /* ------------------------------------------------------------------------
   * Contador — quanto tempo estamos juntos
   *  message: {anos} é substituído pelo tempo (ex.: "1 ano e 5 meses")
   *  bpm: batidas por minuto do coração pulsante (também define --heartbeat)
   * ---------------------------------------------------------------------- */
  counter: {
    title: 'Nosso tempo',                                            // ✏️
    message: '{anos} desde que minha vida ganhou mais cor',          // ✏️
    bpm: 72                                                          // ✏️
  },

  /* ------------------------------------------------------------------------
   * Recados — "Céu de Origami"
   *  seed: recados que já aparecem na primeira visita
   *  maxLength: limite de caracteres de cada novo recado
   *  Por padrão, recados novos ficam salvos no navegador (localStorage).
   *  Veja o README para torná-los compartilhados de verdade.
   * ---------------------------------------------------------------------- */
  messages: {
    title: 'Céu de Origami',                                                         // ✏️
    intro: 'Cada coração guarda um recado. Toque para desdobrar — ou dobre o seu.',  // ✏️
    seed: [                                                                          // ✏️
      { author: 'João', text: 'Você é o meu pensamento favorito antes de dormir e o primeiro ao acordar.' },
      { author: 'Kat',  text: 'Obrigada por transformar dias comuns em lembranças que eu quero guardar pra sempre.' },
      { author: 'João', text: 'Se eu pudesse escolher de novo, escolheria você. Em todas as vidas.' }
    ],
    maxLength: 220
  },

  /* ------------------------------------------------------------------------
   * Frases que flutuam pela tela de vez em quando
   * ---------------------------------------------------------------------- */
  floatingPhrases: [                                // ✏️
    'Você é a minha escolha de todos os dias',
    'Meu lugar favorito é você',
    'Te amo mais que ontem',
    'Pra sempre é pouco',
    'Meu coração é seu'
  ],

  /* ------------------------------------------------------------------------
   * Rodapé
   * ---------------------------------------------------------------------- */
  footer: {
    text: 'Feito com amor, para o nosso pra sempre.' // ✏️
  }
};

export default CONFIG;
