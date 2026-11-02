# toso.studio

Portfólio de Renato Toso. Site estático (HTML, CSS e JS puros, sem build) publicado pelo GitHub Pages a partir da `main`.

## Como o conteúdo entra

As fotos **não** são editadas aqui. A fonte é a pasta do Dropbox `_website/`:

- `_selected work/`: uma subpasta por trabalho;
- `_home/`: só a primeira foto é usada, como imagem de compartilhamento (`og:image`);
- `_arquivo/`: trabalhos fora do site (o publish ignora).

`tools/publish.py` roda no Mac e gera:

- `assets/img/work/<slug>/NN-{l,m,s}.jpg`: lado maior com 2560, 1280 e 480 px, JPEG sRGB
- `assets/img/og.jpg`: 1200 px
- `assets/projects.json`: `{ sizes, work: [{slug, title, date, images: [{src, w, h}]}] }`

Regras:
- nome da pasta = título do trabalho, exibido como está (ex.: `2026_luiza_barcelos`);
- ordem natural dos arquivos = ordem das fotos; a primeira foto é a capa (feed e home);
- ordem dos trabalhos: pastas que começam com `_` ficam fixadas no topo (ordem do Finder); depois, por ano do início do nome (`2026_`, `2025_`), do mais novo para o mais antigo; dentro do ano, mais recente primeiro, com a data registrada em `_build/order.json`;
- para tirar um trabalho do site, mova a pasta para `_arquivo/`.

Nunca edite `assets/img/` ou `projects.json` à mão. Rode o publish de novo.

## Mapa do código

| Arquivo | O que faz |
|---|---|
| `index.html` | esqueleto: menu (`selected work` com a lista de trabalhos, `contact`), home, feed e contato. O conteúdo vem do JS |
| `assets/js/main.js` | lê o manifest → `buildFeed` (posts, carrosséis, submenu) → `buildHome` (capas sorteadas) → rotas por hash → foco do feed, deslizes, clique, teclado |
| `assets/css/style.css` | desktop (menu 30% \| conteúdo 70%) e um único layout para celular e tablet em pé (`MOBILE` no JS, mesma media query) |
| `assets/fonts/` | Bodoni Moda (SIL OFL): nome dos trabalhos |

Rotas: (vazio) home · `#work` feed · `#work/<slug>/<n>` trabalho na foto n · `#contact`. Links antigos (`#ads/...`, `#people`, `#bio`..., ou slug sem o ano, como `#work/melissa/2`) são redirecionados.

Peças principais:
- `.fit`: a foto na proporção exata dentro de uma caixa 4x5 horizontal (5:4) centralizada no conteúdo. Verticais têm a altura toda, horizontais têm a largura da caixa, e nada é cortado. Vale para a home (`.slide`) e para o feed (`.frame`).
- `.feed`: rolagem vertical com encaixe (um trabalho por tela no desktop). Cada `.post` tem um `.track`, o carrossel lateral, com uma `.pg` por foto.
- `.cap`: nome do trabalho na vertical, ao lado da foto (desktop) ou sobre a borda esquerda (celular, preto ou branco conforme `tone()`), com o contador `n/total`.
- `glide()`: deslize com curva suave para cliques, teclado e menu. O encaixe nativo fica desligado durante o movimento; qualquer gesto do usuário interrompe.
- Páginas empilhadas (`.page`): a que entra surge por cima da que sai. Da home para o trabalho, a foto continua no lugar.

## Testar antes de publicar

```
python3 -m http.server 8000
```
Testar com Playwright em 1918×932, 1440×900, 1280×800 e 390×844: zero erros no console e zero 404. Conferir rolagem, clique, teclado, menu, voltar do navegador e links diretos.

Backups de layout ficam em branches `backup-*`.
