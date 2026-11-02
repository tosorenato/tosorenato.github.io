(() => {
  'use strict';

  // Mesmo critério do CSS: celular e tablet em pé usam o feed em largura total.
  const MOBILE = matchMedia('(max-width: 768px), (max-width: 1100px) and (orientation: portrait)');
  const HOVER = matchMedia('(hover: hover)');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
  const PAGES = ['home', 'work', 'contact', 'about'];
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const nav = $('nav'), content = $('content'), feed = $('feed');
  const submenu = $('submenu'), hamburger = $('hamburger'), homeBox = $('homeSlides');

  // Manifest gerado por tools/publish.py (assets/projects.json):
  // { ext, sizes:{l,m,s}, work:[{slug,title,date,images:[{src,w,h}]}] }
  // Cada imagem existe em src-l.<ext> (2560), src-m.<ext> (1280) e src-s.<ext> (480).
  // A primeira imagem de cada trabalho é a capa (feed e home).
  let SIZES = {l: 2560, m: 1280, s: 480}, EXT = 'webp';
  const works = [], bySlug = {};
  let page = '';      // página visível
  let cur = -1;       // trabalho em foco no feed

  history.scrollRestoration = 'manual';

  // ─── ENDEREÇOS ───
  // /  ·  /trabalhos/  ·  /trabalhos/<trabalho>/ (foto n no hash: #n)  ·  /contato/
  // Cada caminho existe como página estática (tools/build_pages.py), com o mesmo JS.
  const WORK = '/trabalhos/';
  const ROUTE_PATH = {work: WORK, contact: '/contato/', about: '/sobre/'};
  const pathOf = slug => slug ? `${WORK}${slug}/` : WORK;
  const here = () => location.pathname + location.hash;
  let TITLES = {};
  try{ TITLES = JSON.parse($('seo-titles').textContent); }catch(e){}
  const setTitle = path => { if(TITLES[path]) document.title = TITLES[path]; };

  // ─── IMAGENS ───
  const url = (img, k) => `${img.src}-${k}.${EXT}`;
  const ratio = img => img.w / img.h;
  function srcset(img){
    const long = Math.max(img.w, img.h);
    return ['s', 'm', 'l'].map(k =>
      `${url(img, k)} ${Math.round(img.w * Math.min(1, SIZES[k] / long))}w`).join(', ');
  }
  // largura exibida: celular = tela toda; desktop = foto na caixa 5:4 (altura toda ou ~60vw)
  const sizes = img =>
    `(max-width: 768px) 100vw, (max-width: 1100px) and (orientation: portrait) 100vw, ` +
    `min(${(Math.min(ratio(img), 1.25) * 100).toFixed(1)}vh, 60vw)`;

  function makeImg(img, alt){
    const el = new Image();
    el.alt = alt;
    el.decoding = 'async';
    el.draggable = false;
    el.width = img.w;
    el.height = img.h;
    el._img = img;
    return el;
  }

  // Pede a foto uma única vez. Quando ela chega (já decodificada), surge em fade;
  // se veio do cache (ex.: a mesma capa da home), aparece na hora, sem piscar.
  function load(el, high){
    if(!el || el._t) return;
    el._t = performance.now();
    if(high) el.fetchPriority = 'high';
    el.sizes = sizes(el._img);
    el.srcset = srcset(el._img);
    el.src = url(el._img, 'm');
    const show = () => {
      if(el._instant || performance.now() - el._t < 70) el.classList.add('instant');
      el.classList.add('on');
      if(el._ready) el._ready();
    };
    el.decode().then(show, () => el.complete ? show() : el.addEventListener('load', show, {once: true}));
  }

  // ─── MANIFEST ───
  // Se falhar (rede instável), tenta de novo 3 vezes (1, 2 e 4 s) e depois
  // mostra um aviso discreto.
  function loadManifest(tries = 0){
    return fetch('/assets/projects.json', {cache: 'no-cache'})
      .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
      .catch(err => {
        if(tries < 3) return new Promise(res => setTimeout(res, 1000 * 2 ** tries)).then(() => loadManifest(tries + 1));
        throw err;
      });
  }

  const ready = loadManifest()
    .then(m => {
      if(m.sizes) SIZES = m.sizes;
      if(m.ext) EXT = m.ext;
      (m.work || []).forEach((w, i) => {
        // tipografia: " - " do nome da pasta vira travessão curto (–)
        Object.assign(w, {i, idx: 0, to: 0, title: w.title.replace(/ - /g, ' \u2013 ')});
        works.push(w);
        bySlug[w.slug] = w;
      });
      buildFeed();
      buildHome();
    })
    .catch(err => {
      console.error('projects.json', err);
      const n = document.createElement('p');
      n.className = 'load-error';
      n.innerHTML = 'Não foi possível carregar as imagens. <a href="">Tentar de novo</a>';
      content.appendChild(n);
    });

  // ─── HOME: capas sorteadas a cada visita; o clique abre o trabalho ───
  let slides = [], si = 0;
  function buildHome(){
    const list = works.slice();
    for(let i = list.length - 1; i > 0; i--){          // Fisher–Yates
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    slides = list.map(w => {
      const a = document.createElement('a');
      a.className = 'slide fit';
      a.href = pathOf(w.slug);
      a.dataset.slug = w.slug;
      a.style.setProperty('--r', ratio(w.images[0]).toFixed(4));
      a._img = makeImg(w.images[0], w.title);
      a.appendChild(a._img);
      homeBox.appendChild(a);
      return a;
    });
    if(!slides.length) return;
    slides[0].classList.add('active');
    if(page === 'home'){ startHome(); scheduleHome(); }
  }

  // A home só baixa fotos quando está à vista: a capa atual e, depois que a
  // página terminou de carregar, a próxima da home e a primeira capa do feed.
  function startHome(){
    if(!slides.length || slides[si]._img._t) return;
    load(slides[si]._img, true);
    const later = () => { load(slides[(si + 1) % slides.length]._img); load(works[0].imgs[0]); };
    if(document.readyState === 'complete') setTimeout(later, 400);
    else addEventListener('load', later, {once: true});
  }

  // Slideshow de 5 s. O relógio recomeça sempre que a home volta à tela, e a
  // troca só acontece com a próxima foto já carregada.
  let homeTimer = 0;
  function scheduleHome(ms = 5000){
    clearTimeout(homeTimer);
    if(page === 'home' && slides.length > 1) homeTimer = setTimeout(advanceHome, ms);
  }
  function advanceHome(){
    if(page !== 'home') return;
    const nxt = slides[(si + 1) % slides.length]._img;
    if(document.hidden){ scheduleHome(); return; }
    if(!nxt.classList.contains('on')){ load(nxt); scheduleHome(600); return; }
    slides[si].classList.remove('active');
    si = (si + 1) % slides.length;
    slides[si].classList.add('active');
    load(slides[(si + 1) % slides.length]._img);
    scheduleHome();
  }

  // ─── FEED ───
  function buildFeed(){
    const frag = document.createDocumentFragment();
    works.forEach(w => {
      const post = document.createElement('article');
      post.className = 'post';
      post.dataset.slug = w.slug;
      // celular: o post tem a proporção da capa (foto inteira, sem corte)
      post.style.setProperty('--pr', Math.min(1.91, Math.max(.5, ratio(w.images[0]))).toFixed(4));
      const track = document.createElement('div');
      track.className = 'track';
      const n = w.images.length;
      w.imgs = w.images.map((img, k) => {
        const pg = document.createElement('div');
        pg.className = 'pg';
        const frame = document.createElement('figure');
        frame.className = 'frame fit';
        frame.style.setProperty('--r', ratio(img).toFixed(4));
        const el = makeImg(img, k ? '' : w.title);
        el._ready = () => tone(pg, el);
        const cap = document.createElement('figcaption');
        cap.className = 'cap';
        const t = document.createElement('span');
        t.className = 'cap-t';
        t.textContent = w.title;
        cap.appendChild(t);
        if(n > 1){
          const c = document.createElement('span');
          c.className = 'cap-n';
          c.textContent = `${k + 1}/${n}`;
          cap.appendChild(c);
        }
        if(k) cap.setAttribute('aria-hidden', 'true');
        frame.append(el, cap);
        pg.appendChild(frame);
        track.appendChild(pg);
        return el;
      });
      post.appendChild(track);
      frag.appendChild(post);
      w.el = post;
      w.track = track;
      track.addEventListener('scroll', () => onTrack(w), {passive: true});

      const a = document.createElement('a');
      a.href = pathOf(w.slug);
      a.dataset.slug = w.slug;
      a.textContent = w.title;
      submenu.appendChild(a);
    });
    feed.appendChild(frag);
  }

  // Celular: o nome fica sobre a foto. Mede a claridade da faixa esquerda (como
  // a foto aparece inteira no post, com o fundo branco em volta) e escolhe texto
  // preto ou branco. Mesma origem: o canvas não fica bloqueado.
  function tone(pg, el){
    if(!MOBILE.matches || pg._tone || !pg.clientWidth) return;
    try{
      const W = el.naturalWidth, H = el.naturalHeight;
      const bw = 40, bh = Math.max(10, Math.round(40 * pg.clientHeight / pg.clientWidth));
      const c = document.createElement('canvas');
      c.width = bw; c.height = bh;
      const g = c.getContext('2d', {willReadFrequently: true});
      g.fillStyle = '#fff';
      g.fillRect(0, 0, bw, bh);
      const s = Math.min(bw / W, bh / H);
      g.drawImage(el, (bw - W * s) / 2, (bh - H * s) / 2, W * s, H * s);
      const d = g.getImageData(0, Math.round(bh * .2), 6, Math.round(bh * .6)).data;
      let l = 0;
      for(let i = 0; i < d.length; i += 4) l += .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
      pg.classList.toggle('light', l / (d.length / 4) > 150);
      pg._tone = true;
    }catch(e){}
  }

  // posição do carrossel: durante uma animação, vale o destino
  const at = w => glides.has(w.track) ? w.to : w.idx;

  function onTrack(w){
    if(w.raf) return;
    w.raf = requestAnimationFrame(() => {
      w.raf = 0;
      const x = w.track.scrollLeft / (w.track.clientWidth || 1);
      load(w.imgs[Math.floor(x)]);
      load(w.imgs[Math.ceil(x)]);
      const k = Math.round(x);
      if(k !== w.idx){
        w.idx = k;
        load(w.imgs[k + 1]);
        load(w.imgs[k - 1]);
        if(w.i === cur) syncURL();
      }
      if(!glides.has(w.track)) w.to = w.idx;
      cursor(w);
    });
  }

  // Trabalho em foco: o post cujo centro está mais perto do centro do feed
  let spyRaf = 0;
  feed.addEventListener('scroll', () => { if(!spyRaf) spyRaf = requestAnimationFrame(spy); }, {passive: true});
  let lastSize = '';
  function spy(){
    spyRaf = 0;
    if(!works.length || page !== 'work') return;   // feed escondido: nada a baixar
    // O layout mudou (girar o aparelho, redimensionar): a rolagem antiga não vale
    // mais; mantém o trabalho em foco e deixa realign() recentralizar.
    const size = feed.clientWidth + 'x' + feed.clientHeight;
    if(lastSize && size !== lastSize){ lastSize = size; clearTimeout(rz); rz = setTimeout(realign, 150); return; }
    lastSize = size;
    const mid = feed.scrollTop + feed.clientHeight / 2;
    let best = 0, d = Infinity;
    works.forEach((w, i) => {
      const c = Math.abs(w.el.offsetTop + w.el.offsetHeight / 2 - mid);
      if(c < d){ d = c; best = i; }
    });
    mark(best);
    if(!glides.has(feed)) setFocus(best);   // durante o deslize, só acompanha no menu
  }

  function mark(i){
    [...submenu.children].forEach((a, k) => a.classList.toggle('active', k === i));
  }

  function setFocus(i){
    if(i === cur) return;
    cur = i;
    const w = works[i];
    load(w.imgs[0], true);
    load(w.imgs[w.idx]);
    load(w.imgs[w.idx + 1]);
    if(works[i + 1]) load(works[i + 1].imgs[0]);
    if(works[i - 1]) load(works[i - 1].imgs[0]);
    mark(i);
    syncURL();
  }

  // O endereço acompanha o feed (sem criar histórico): /trabalhos/<trabalho>/#<foto>.
  // Em /trabalhos/, o primeiro trabalho na capa mantém o endereço da lista.
  // Espera a rolagem assentar (o Safari limita a frequência de replaceState).
  let urlT = 0;
  function syncURL(){
    clearTimeout(urlT);
    urlT = setTimeout(() => {
      if(page !== 'work' || cur < 0) return;
      const w = works[cur];
      const onList = location.pathname === WORK;
      const h = onList && cur === 0 && w.idx === 0 ? WORK : pathOf(w.slug) + (w.idx ? `#${w.idx + 1}` : '');
      if(here() !== h){ history.replaceState(history.state, '', h); setTitle(location.pathname); }
    }, 200);
  }

  // ─── DESLIZES ───
  // Animação própria (curva suave) para cliques, teclado e menu. O encaixe
  // nativo fica desligado durante o movimento e volta no fim; qualquer gesto
  // do usuário interrompe e devolve o controle ao navegador.
  const glides = new Map();
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function glide(el, prop, to, dur){
    stop(el);
    const from = el[prop];
    if(REDUCED.matches || Math.abs(to - from) < 1){ el[prop] = to; return; }
    el.style.scrollSnapType = 'none';
    const t0 = performance.now(), g = {};
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      el[prop] = from + (to - from) * easeInOut(t);
      if(t < 1) g.raf = requestAnimationFrame(step);
      else stop(el);
    };
    glides.set(el, g);
    g.raf = requestAnimationFrame(step);
  }

  function stop(el){
    const g = glides.get(el);
    if(!g) return;
    cancelAnimationFrame(g.raf);
    glides.delete(el);
    el.style.scrollSnapType = '';
    if(el === feed) spy();
  }

  ['wheel', 'touchstart'].forEach(type =>
    addEventListener(type, () => [...glides.keys()].forEach(stop), {passive: true}));

  function goPage(w, k){
    k = Math.max(0, Math.min(k, w.images.length - 1));
    w.to = k;
    load(w.imgs[k], true);
    load(w.imgs[k + 1]);
    const W = w.track.clientWidth;
    const dist = Math.abs(k * W - w.track.scrollLeft);
    glide(w.track, 'scrollLeft', k * W, Math.min(900, 360 + dist * .24));
  }

  // centraliza o post do trabalho no feed
  const topOf = w => Math.max(0, Math.min(
    w.el.offsetTop - (feed.clientHeight - w.el.offsetHeight) / 2,
    feed.scrollHeight - feed.clientHeight));

  function goWork(i){
    const w = works[i];
    if(!w) return;
    load(w.imgs[at(w)], true);
    const to = topOf(w);
    const dist = Math.abs(to - feed.scrollTop);
    glide(feed, 'scrollTop', to, Math.min(1400, 520 + dist * .2));
  }

  // Posiciona na hora (link direto, clique na home, voltar do navegador)
  function reveal(w, k){
    k = Math.max(0, Math.min(k, w.images.length - 1));
    stop(w.track);
    stop(feed);
    load(w.imgs[k], true);
    w.track.scrollLeft = k * w.track.clientWidth;
    w.idx = w.to = k;
    feed.scrollTop = topOf(w);
    cur = -1;
    setFocus(w.i);
  }

  // Abre um trabalho pelo menu: o feed desliza até ele, que volta para a capa
  function openWork(w){
    if(at(w)) goPage(w, 0);
    if(w.i !== cur) goWork(w.i);
  }

  // ─── CLIQUE NA FOTO ───
  // capa: abre o carrossel (próxima foto); depois, metade esquerda volta e
  // metade direita avança; na última foto, segue para o próximo trabalho.
  let mx = 0;
  function action(w, x){
    const k = at(w), last = w.images.length - 1;
    const r = w.track.getBoundingClientRect();
    if(k === 0) return last ? 'next' : (works[w.i + 1] ? 'down' : '');
    if(x < r.left + r.width / 2) return 'prev';
    if(k < last) return 'next';
    return works[w.i + 1] ? 'down' : '';
  }

  function cursor(w){
    if(HOVER.matches && w) w.el.dataset.cur = action(w, mx);
  }

  feed.addEventListener('mousemove', e => {
    mx = e.clientX;
    const p = e.target.closest('.post');
    if(p) cursor(bySlug[p.dataset.slug]);
  });

  feed.addEventListener('click', e => {
    const p = e.target.closest('.post');
    if(!p) return;
    const w = bySlug[p.dataset.slug];
    mx = e.clientX;
    const act = action(w, e.clientX);
    if(act === 'next') goPage(w, at(w) + 1);
    else if(act === 'prev') goPage(w, at(w) - 1);
    else if(act === 'down') goWork(w.i + 1);
    cursor(w);
  });

  // ─── TECLADO ───
  // ← → fotos do trabalho em foco · ↑ ↓ (PgUp/PgDn, espaço) trabalhos · Esc volta à capa
  document.addEventListener('keydown', e => {
    if(page !== 'work' || cur < 0 || e.metaKey || e.ctrlKey || e.altKey) return;
    const w = works[cur], k = at(w), last = w.images.length - 1;
    let ok = true;
    switch(e.key){
      case 'ArrowRight': k < last ? goPage(w, k + 1) : goWork(cur + 1); break;
      case 'ArrowLeft': goPage(w, k - 1); break;
      case 'ArrowDown': case 'PageDown': goWork(cur + 1); break;
      case 'ArrowUp': case 'PageUp': goWork(cur - 1); break;
      case ' ': goWork(cur + (e.shiftKey ? -1 : 1)); break;
      case 'Home': goWork(0); break;
      case 'End': goWork(works.length - 1); break;
      case 'Escape': goPage(w, 0); break;
      default: ok = false;
    }
    if(ok) e.preventDefault();
  });

  // ─── PÁGINAS ───
  function show(route){
    if(route === page) return;
    const first = !page;
    page = route;
    if(first) root.classList.add('no-anim');
    const gray = route !== 'work';
    nav.classList.toggle('gray', gray);
    nav.classList.toggle('white', !gray);
    content.classList.toggle('theme-gray', gray);
    content.classList.toggle('theme-white', !gray);
    document.querySelectorAll('.menu > a').forEach(a =>
      a.classList.toggle('active', a.dataset.route === route));
    submenu.classList.toggle('open', route === 'work');
    PAGES.forEach(p => $(p).classList.toggle('active', p === route));
    closeMenu();
    if(route === 'home') startHome();
    scheduleHome();
    if(first) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim')));
  }

  // ─── ROTAS: / · /trabalhos/ · /trabalhos/<trabalho>/#<foto> · /contato/ ───
  // Links antigos com # (#work, #work/<trabalho>/<foto>, #ads/..., #contact, #home,
  // #people, #personal) são levados ao caminho novo (migrate); #bio vai para /sobre/.
  function parse(){
    const p = location.pathname.replace(/index\.html$/, '');
    const m = p.match(/^\/trabalhos\/(?:([^/]+)\/?)?$/);
    if(m) return {route: 'work', slug: m[1] || '', n: parseInt(location.hash.slice(1), 10) || 1};
    if(/^\/contato\/?$/.test(p)) return {route: 'contact'};
    if(/^\/sobre\/?$/.test(p)) return {route: 'about'};
    const [r = '', slug = '', n = ''] = location.hash.replace(/^#\/?/, '').split('/');
    if(r === 'work' || r === 'ads') return {route: 'work', slug, n: parseInt(n, 10) || 1, legacy: true};
    if(r === 'contact') return {route: 'contact', legacy: true};
    if(r === 'bio') return {route: 'about', legacy: true};
    return {route: 'home', legacy: r !== ''};
  }

  // link antigo sem o ano (#work/melissa/2) acha o trabalho atual (2026-melissa)
  const findWork = slug => bySlug[slug] || (slug && works.find(x => x.slug.endsWith('-' + slug)));

  function migrate({route, slug, n}){
    if(route === 'home') return location.replace('/');
    if(route === 'contact' || route === 'about') return location.replace(ROUTE_PATH[route]);
    if(!slug) return location.replace(WORK);
    ready.then(() => {
      const w = findWork(slug);
      location.replace(w ? pathOf(w.slug) + (n > 1 ? `#${n}` : '') : WORK);
    });
  }

  function apply(){
    const r = parse();
    if(r.legacy){ migrate(r); return; }
    const {route, slug, n} = r;
    show(route);
    setTitle(location.pathname);
    if(route !== 'work') return;
    ready.then(() => {
      if(page !== 'work' || !works.length) return;
      const w = findWork(slug);
      if(w) reveal(w, n - 1);
      else if(cur < 0) reveal(works[0], 0);   // primeira visita: o primeiro trabalho
      else { spy(); syncURL(); }
    });
  }

  function navigate(to){
    if(here() === to){ apply(); return; }
    history.pushState(null, '', to);
    apply();
  }

  window.addEventListener('popstate', apply);

  // ─── MENU DO CELULAR ───
  function closeMenu(){
    nav.classList.remove('menu-open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
  hamburger.addEventListener('click', e => {
    e.stopPropagation();
    hamburger.setAttribute('aria-expanded', String(nav.classList.toggle('menu-open')));
  });

  // ─── LINKS ───
  document.addEventListener('click', e => {
    if(nav.classList.contains('menu-open') && !e.target.closest('.menu, .hamburger')) closeMenu();
    const a = e.target.closest('a');
    if(!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    if(a.classList.contains('logo')){ e.preventDefault(); navigate('/'); return; }

    const route = a.dataset.route;
    if(route){
      e.preventDefault();
      if(route === 'work' && page === 'work'){ closeMenu(); goWork(0); }   // de novo: volta ao início
      else navigate(ROUTE_PATH[route]);
      return;
    }

    const w = bySlug[a.dataset.slug];
    if(w){                                       // trabalho no menu ou capa da home
      e.preventDefault();
      // a capa da home já está na tela: no feed ela aparece na hora, sem fade
      if(a.classList.contains('slide') && a._img.classList.contains('on')) w.imgs[0]._instant = true;
      if(page === 'work'){ closeMenu(); openWork(w); }
      else navigate(pathOf(w.slug));
    }
  });

  // ─── TAMANHO DA JANELA ───
  // Mantém cada carrossel na sua foto e, no desktop, o trabalho em foco centralizado.
  // (No celular, só recentraliza quando o layout muda, ex.: ao girar o aparelho;
  // a barra do navegador que aparece e some não mexe no feed.)
  let rz = 0, wasMobile = MOBILE.matches;
  function realign(){
    works.forEach(w => { stop(w.track); w.track.scrollLeft = w.idx * w.track.clientWidth; });
    const turned = wasMobile !== MOBILE.matches;
    wasMobile = MOBILE.matches;
    if(cur >= 0 && (!MOBILE.matches || turned)){ stop(feed); feed.scrollTop = topOf(works[cur]); }
  }
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(realign, 150); });
  MOBILE.addEventListener('change', () => {
    works.forEach(w => w.imgs.forEach(el => el.classList.contains('on') && tone(el.closest('.pg'), el)));
  });

  apply();
})();
