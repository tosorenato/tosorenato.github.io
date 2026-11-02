# toso.studio

Portfólio de Renato Toso. Site estático (HTML, CSS e JS puros, sem build) publicado pelo GitHub Pages a partir da `main`.

## Como o conteúdo entra

As fotos **não** são editadas aqui. A fonte é a pasta do Dropbox `_website/` (`_ads/`, `_ppl/`, `_pers/`, uma subpasta por trabalho). `tools/publish.py` roda no Mac e gera:

- `assets/img/<seção>/<slug>/NN-{l,m,s}.jpg`: lado maior com 2560, 1280 e 480 px, JPEG sRGB
- `assets/projects.json`: títulos, datas, ordem e dimensões

Regras:
- nome da pasta = título do trabalho;
- ordem natural dos arquivos = ordem das fotos;
- a primeira foto é a capa;
- trabalhos do mais recente para o mais antigo, com a data registrada em `_build/order.json`.

Nunca edite `assets/img/` ou `projects.json` à mão. Rode o publish de novo.

## Mapa do código

| Arquivo | O que faz |
|---|---|
| `index.html` | esqueleto: menu, home, as 3 abas (`.strip` + `.stage`), galeria, bio e contato. O conteúdo vem do JS |
| `assets/js/main.js` | lê o manifest → `buildSection` (capas, submenu, palco) → `buildHome` (capas sorteadas) → rotas por hash (`#ads/<slug>/<n>`) → galeria, teclado, swipe |
| `assets/css/style.css` | desktop (menu 35% e conteúdo 65% sem margem) e um único breakpoint para celular, em `768px` |

Peças principais:
- `.slide` (home): sangria total no desktop; 4:5 em largura total no celular.
- `.stage` (abas): capa grande que troca no hover, com o título em `.stage-title`.
- `.strip` (abas e galeria): coluna lateral com scroll vertical no desktop. No celular vira um feed de capas, ou uma linha de miniaturas embaixo da foto.
- `.frame` (galeria): foto com `cover`. Recebe a classe `.landscape` quando a proporção passa de 1,05, e aí usa `contain`, sem corte.
- `edgeTone()`: no celular, decide se o nome vertical sobre a capa fica preto ou branco.

## Testar antes de publicar

```
python3 -m http.server 8000
```
Testar com Playwright em 1440×900 e 390×844: zero erros no console, zero 404.

Backups de layout ficam em branches `backup-*`.
