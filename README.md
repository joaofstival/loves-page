# Kat & João — nosso pra sempre 💌

## Visão geral

Uma landing page imersiva e romântica, feita com HTML, CSS e JavaScript puros (ES modules), **sem etapa de build**. Ela conta a história do casal em cinco atos:

1. **Hero** — vídeo de fundo, título e um convite para rolar.
2. **Nossa história** — capítulos que surgem conforme a rolagem.
3. **Galeria** — os momentos, com data, lugar e legenda.
4. **Nosso tempo** — um contador ao vivo desde o início do namoro, com um coração que bate.
5. **Céu de Origami** — corações de papel com recados; dá para desdobrar e escrever novos.

Ao fundo, corações 3D (Three.js) reagem à rolagem e ao ponteiro; frases flutuam pela tela e botões soltam confete de corações. Todo o conteúdo sai de um único arquivo: `js/config.js`.

## Estrutura de arquivos

```
loves-page/
├── index.html            # Esqueleto da página: seções vazias, import map do Three.js, CSS e main.js
├── README.md             # Este guia
├── assets/
│   ├── img/              # Fotos (casal3, casal4, flower, iendo, momento1, momento2, rodeio)
│   └── video/            # Vídeos (casal1.mp4, casal2.mp4)
├── css/
│   ├── variables.css     # Tokens de design: cores, fontes, tamanhos, sombras, durações, camadas
│   ├── base.css          # Reset, tipografia, .section/.container, botões, [data-reveal], rodapé
│   ├── hero.css          # Estilos da primeira tela (vídeo, título, dica de rolagem)
│   ├── story.css         # Estilos dos capítulos da história
│   ├── gallery.css       # Estilos da galeria de momentos
│   ├── counter.css       # Estilos do contador e do coração pulsante
│   ├── messages.css      # Estilos do Céu de Origami (recados)
│   └── micro.css         # Micro-interações, frases flutuantes e detalhes finais
└── js/
    ├── config.js         # ✏️ TODO o conteúdo editável (nomes, datas, textos, fotos, vídeos)
    ├── core.js           # Loop único de animação, estado de rolagem/ponteiro, revelação ao rolar
    ├── main.js           # Ponto de entrada: inicia o loop e cada módulo de forma isolada
    ├── hearts3d.js       # Corações 3D ao fundo com Three.js (carregado dinamicamente)
    ├── hero.js           # Renderiza a seção hero
    ├── story.js          # Renderiza os capítulos da história
    ├── gallery.js        # Renderiza a galeria de fotos
    ├── counter.js        # Contador de tempo juntos
    ├── messages.js       # Recados em corações de origami (+ adaptador de armazenamento)
    ├── confetti.js       # Confete de corações para botões com [data-confetti]
    └── floating.js       # Frases românticas que flutuam pela tela
```

## Como rodar

ES modules não funcionam abrindo o arquivo direto (`file://`). Use qualquer servidor estático na pasta do projeto:

```bash
npx serve .
# ou
python3 -m http.server 8080
```

Depois abra `http://localhost:3000` (serve) ou `http://localhost:8080` (Python).

## Como personalizar

1. **Textos e nomes** — abra `js/config.js` e procure os marcadores ✏️. Títulos, capítulos, legendas, frases flutuantes e recados iniciais estão todos lá.
2. **Data de início** — altere `couple.startDate` (formato `AAAA-MM-DDTHH:MM:SS`). O contador usa essa data.
3. **Fotos** — coloque os arquivos em `assets/img/` e atualize `src`, `alt`, `date`, `place` e `caption` em `gallery`. Prefira JPGs com até ~1600px no lado maior (fica leve e nítido).
4. **Vídeos** — coloque em `assets/video/` e ajuste `hero.video` ou o `media` de um capítulo. Para converter e comprimir (e remover o áudio):
   ```bash
   ffmpeg -i in.mov -vcodec libx264 -crf 26 -an -movflags +faststart out.mp4
   ```
   `+faststart` faz o vídeo começar a tocar antes de baixar por completo.
5. **Imagem de capa** — `hero.poster` aparece enquanto o vídeo carrega. Se trocar, atualize também o `<link rel="preload">` no `index.html`.
6. **Cores** — edite `css/variables.css` (`--c-red`, `--c-pink`, `--c-bg`…). A página inteira acompanha.
7. **Ritmo do coração** — `counter.bpm` define a batida (também usada na animação do rodapé).

## Recados (Céu de Origami)

Por padrão, os recados novos ficam salvos no **`localStorage` do navegador** — ou seja, cada pessoa vê apenas os recados escritos naquele aparelho/navegador (mais os recados iniciais de `messages.seed`).

Para torná-los **colaborativos de verdade** (os dois vendo os recados um do outro), implemente o adaptador de armazenamento em `js/messages.js`. Ele tem um formato simples — carregar a lista e salvar um recado — então basta trocar a implementação local por um serviço:

- **Supabase**: crie uma tabela `messages (id, author, text, created_at)`, habilite RLS permitindo `select`/`insert` anônimos e use `@supabase/supabase-js` via CDN (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`) no adaptador.
- **Firebase**: crie uma coleção `messages` no Firestore e use o SDK modular via CDN (`https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js`).

> Dica: chaves públicas (anon key do Supabase, config do Firebase) podem ficar no front-end, mas proteja a escrita com regras de segurança.

## Publicar (deploy)

É um site estático — qualquer hospedagem serve:

- **Netlify**: acesse app.netlify.com/drop e arraste a pasta do projeto.
- **Vercel**: `npx vercel` na pasta, ou importe o repositório pelo painel.
- **GitHub Pages**: envie para um repositório, vá em *Settings → Pages* e escolha a branch `main` / raiz.

## Acessibilidade e performance

- Respeita `prefers-reduced-motion`: animações são desligadas ou reduzidas e o conteúdo aparece sem transições.
- Canvases e camadas decorativas usam `aria-hidden`; imagens têm `alt` vindo do config — mantenha-os descritivos.
- Botões têm foco visível e área de toque de pelo menos 48px.
- Um único `requestAnimationFrame` (`js/core.js`) move todas as animações; a rolagem é lida uma vez por frame.
- O Three.js é carregado dinamicamente: se o CDN falhar, a página continua funcionando sem os corações 3D. Cada módulo é iniciado isoladamente, então um erro em um não derruba os outros.
- Vídeos devem ser curtos, sem áudio e comprimidos (veja o comando `ffmpeg` acima); a imagem de capa do hero é pré-carregada.
