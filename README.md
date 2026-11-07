# toso.studio

Portfólio de Renato Toso. Site estático (HTML, CSS e JS puros, sem build) publicado pelo GitHub Pages a partir da `main`.

## Como o conteúdo entra

As fotos **não** são editadas aqui. A fonte é a pasta do Dropbox `_website/`:

- `_selected work/`: uma subpasta por trabalho;
- `_home/`: só a primeira foto é usada, como imagem de compartilhamento (`og:image`);
- `_arquivo/`: trabalhos fora do site (o publish ignora).

`tools/publish.py` roda no Mac e gera:

- `assets/img/work/<slug>/<slug>-NN-{l,m,s}.webp`: lado maior com 2560, 1280 e 480 px, WebP sRGB
- `assets/img/og/<slug>.jpg` e `assets/img/og.jpg`: 1200 px, JPEG (preview de WhatsApp e Instagram)
- `assets/projects.json`: `{ ext, sizes, work: [{slug, title, titulo, date, lastmod, desc, cat, og, images: [{src, w, h}]}] }`

Textos opcionais ficam em `_build/textos.json` (Dropbox): chave = nome da pasta, valor `{"titulo", "descricao", "categoria"}`.

Depois do publish, **rode `python3 tools/build_pages.py`** (gera as páginas, o sitemap e o robots) e `python3 tools/build_pages.py --check` (confere o HTML sem JavaScript). Commite as páginas geradas junto.

Regras:
- nome da pasta = título do trabalho, exibido como está (ex.: `2026_luiza_barcelos`);
- ordem natural dos arquivos = ordem das fotos; a primeira foto é a capa (grade, feed e home);
- ordem dos trabalhos: pastas que começam com `_` ficam fixadas no topo (ordem do Finder); depois, por ano do início do nome (`2026_`, `2025_`), do mais novo para o mais antigo; dentro do ano, mais recente primeiro, com a data registrada em `_build/order.json`;
- para tirar um trabalho do site, mova a pasta para `_arquivo/`.

Nunca edite `assets/img/` ou `projects.json` à mão. Rode o publish de novo.

## Mapa do código

| Arquivo | O que faz |
|---|---|
| `index.html` | molde e página inicial: menu (`selected work`, a lista de trabalhos e `contact`), home, grade, feed, contato e sobre. O conteúdo vem do JS. As regiões `<!--seo:head-->` e `<!--seo:body-->` são geradas |
| `tools/build_pages.py` | gera `/trabalhos/`, `/trabalhos/<slug>/` (um por trabalho), `/contato/`, `/sobre/`, `404.html`, `sitemap.xml`, `robots.txt` e `.nojekyll`, com title, description, canonical, Open Graph, JSON-LD, H1 e fotos com alt no HTML |
| `assets/js/main.js` | lê o manifest → `buildFeed` (posts, carrosséis, submenu) → `buildGrid` (capas em 3 colunas) → `buildHome` (capas sorteadas) → rotas por caminho → foco do feed, deslizes, clique, teclado |
| `assets/css/style.css` | desktop (menu 30% \| conteúdo 70%) e um único layout para celular e tablet em pé (`MOBILE` no JS, mesma media query) |
| `assets/fonts/` | Bodoni Moda (SIL OFL): nome dos trabalhos |

Rotas (cada uma existe como página estática, com o mesmo JS): `/` home · `/trabalhos/` grade · `/trabalhos/<slug>/` trabalho no feed (foto n em `#n`) · `/contato/` · `/sobre/`. Links antigos com `#` (`#work`, `#work/<slug>/<n>`, `#ads/...`, `#contact`, `#people`, `#bio`..., ou slug sem o ano, como `#work/melissa/2`) são levados ao caminho novo. O slug é a URL pública do trabalho: não renomeie pastas depois de indexadas.

Peças principais:
- `.grid`: a grade de "selected work". As capas em 3 colunas, em células 4:5, como no Instagram: na grade, a capa preenche a célula e perde o que passar de 4:5; ao abrir o trabalho, a foto aparece inteira. No desktop, 3×3 células ocupam o mesmo retângulo da capa vertical (4:5 com a altura toda do conteúdo) e as demais linhas aparecem na rolagem; o nome sob o cursor aparece ao lado (`.grid-cap`). No celular, largura total com fio de 3 px. As capas só são baixadas com a grade à vista.
- Menu: no desktop, a lista de trabalhos só aparece dentro de um trabalho (na grade, as capas são o índice). No celular, a barra superior tem o logo e os dois links, sem hambúrguer. Clicar em "selected work" dentro de um trabalho volta à grade (com o "voltar" do navegador, se o trabalho foi aberto pela grade); na grade, volta ao topo.
- `.fit`: a foto na proporção exata dentro de uma caixa 4x5 horizontal (5:4) centralizada no conteúdo. Verticais têm a altura toda, horizontais têm a largura da caixa, e nada é cortado. Vale para a home (`.slide`) e para o feed (`.frame`). No celular também não há corte: a home mostra a capa na proporção exata, e cada post do feed tem a proporção da capa (`--pr`), com todas as fotos inteiras (`contain`).
- `.feed`: rolagem vertical com encaixe (um trabalho por tela no desktop). Cada `.post` tem um `.track`, o carrossel lateral, com uma `.pg` por foto.
- `.cap`: nome do trabalho na vertical, ao lado da foto (desktop) ou sobre a borda esquerda (celular, preto ou branco conforme `tone()`), com o contador `n/total`.
- `glide()`: deslize com curva suave para cliques, teclado e menu. O encaixe nativo fica desligado durante o movimento; qualquer gesto do usuário interrompe.
- Páginas empilhadas (`.page`): a que entra surge por cima da que sai. Da home para o trabalho, a foto continua no lugar.

## Testar antes de publicar

```
python3 tools/build_pages.py --check
python3 -m http.server 8000
```
Testar com Playwright em 1918×932, 1440×900, 1280×800 e 390×844: zero erros no console e zero 404. Conferir rolagem, clique, teclado, menu, voltar do navegador e links diretos, e o caminho grade → trabalho → "selected work" → grade (mesma rolagem).

Backups de layout ficam em branches `backup-*`.
