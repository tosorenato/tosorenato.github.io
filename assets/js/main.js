(() => {
  const PAGES = ['home','ads','people','personal','gallery','bio','contact'];
  const MENU_ROUTES = ['home','ads','people','personal','bio','contact'];
  const SECTIONS = ['ads','people','personal'];
  const MOBILE = matchMedia('(max-width: 768px)');   // mesmo breakpoint do CSS
  const $ = id => document.getElementById(id);
  const nav = $('nav'), content = $('content'), hamburger = $('hamburger');
  const mainImage = $('mainImage'), mainFrame = $('mainFrame'), thumbs = $('galleryThumbs');
  const gTitle = $('galleryTitle'), gCount = $('galleryCount');

  // Manifest gerado por tools/publish.py (assets/projects.json):
  // { sizes:{l,m,s}, sections:{ads:[{slug,title,date,images:[{src,w,h}]}], people:[…], personal:[…]} }
  // Cada imagem existe em src-l.jpg (2560), src-m.jpg (1280) e src-s.jpg (480).
  // A primeira imagem de cada projeto é a capa (abas e home).
  // (O campo "home" do manifest vem da pasta _home e não é mais usado.)
  let SIZES = {l:2560, m:1280, s:480};
  const projects = {};          // "ads/slug" -> projeto
  let current = null, currentIndex = 0, lastSection = 'ads';

  const url = (img, k) => `${img.src}-${k}.jpg`;
  function srcset(img, keys){
    const long = Math.max(img.w, img.h);
    return keys.map(k => `${url(img,k)} ${Math.round(img.w * Math.min(1, SIZES[k] / long))}w`).join(', ');
  }
  function picture(img, keys, sizes, eager){
    const el = document.createElement('img');
    el.width = img.w; el.height = img.h;     // reserva o espaço (sem salto de layout)
    el.sizes = sizes;
    el.srcset = srcset(img, keys);
    el.src = url(img, keys[keys.length - 1]);
    el.alt = '';
    el.decoding = 'async';
    if(!eager) el.loading = 'lazy';
    return el;
  }

  const ready = fetch('/assets/projects.json', {cache:'no-cache'})
    .then(r => r.json())
    .then(m => {
      if(m.sizes) SIZES = m.sizes;
      SECTIONS.forEach(sec => buildSection(sec, (m.sections || {})[sec] || []));
      // home: capas de todos os trabalhos, sorteadas; cada uma abre a galeria do projeto
      buildHome(Object.values(projects).map(p => ({img: p.images[0], key: p.key, title: p.title})));
    })
    .catch(err => console.error('projects.json', err));

  // ─── HOME ───
  let slides = [];
  function buildHome(list){
    // ordem aleatória a cada visita (Fisher–Yates)
    list = list.slice();
    for(let i = list.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    const box = $('homeSlides');
    const sizes = '(max-width: 768px) 100vw, 65vw';  // home ocupa todo o painel
    slides = list.map(({img, key, title}, i) => {
      const el = document.createElement('img');
      el.sizes = sizes;
      el.alt = title;
      el.decoding = 'async';
      el._set = () => { if(!el.srcset){ el.srcset = srcset(img, ['m','l']); el.src = url(img,'l'); } };
      const f = document.createElement('a');
      f.className = 'slide';
      f.href = `#${key}/1`;
      f.dataset.key = key;
      f.appendChild(el);
      f._img = el;
      if(i === 0){ el._set(); f.classList.add('active'); el.fetchPriority = 'high'; }
      box.appendChild(f);
      return f;
    });
    if(slides[1]) window.addEventListener('load', () => slides[1]._img._set());
  }

  let si = 0;
  setInterval(() => {
    if(slides.length < 2 || !$('home').classList.contains('active') || document.hidden) return;
    const nxt = slides[(si + 1) % slides.length]._img;
    if(!nxt.srcset || !nxt.complete){ nxt._set(); return; }
    slides[si].classList.remove('active');
    si = (si + 1) % slides.length;
    slides[si].classList.add('active');
    slides[(si + 1) % slides.length]._img._set();
  }, 5000);

  // ─── SEÇÕES ───
  function buildSection(sec, list){
    const grid = document.querySelector(`.project-list[data-section="${sec}"]`);
    const sub = document.querySelector(`.submenu[data-section="${sec}"]`);
    const link = document.querySelector(`.menu a[data-route="${sec}"]`);
    const stage = document.querySelector(`.stage[data-section="${sec}"]`);
    if(!list.length && link) link.hidden = true;
    list.forEach((p, i) => {
      const key = `${sec}/${p.slug}`;
      projects[key] = {...p, key, section: sec};

      // capa na faixa lateral (desktop) / no feed vertical (celular)
      const card = document.createElement('a');
      card.className = 'project';
      card.href = `#${key}/1`;
      card.dataset.key = key;
      const cover = picture(p.images[0], ['s','m','l'],
        '(max-width: 768px) 100vw, 160px', i < 4);
      cover.alt = p.title;
      const name = document.createElement('span');
      name.className = 'project-name';          // visível só no celular
      name.textContent = p.title;
      card.append(cover, name);
      if(MOBILE.matches) cover.addEventListener('load', () => edgeTone(cover, card), {once:true});
      card.addEventListener('mouseenter', () => showStage(stage, projects[key]));
      card.addEventListener('focus', () => showStage(stage, projects[key]));
      grid.appendChild(card);

      const a = document.createElement('a');
      a.href = `#${key}/1`;
      a.dataset.key = key;
      a.textContent = p.title;
      sub.appendChild(a);
    });
    if(list.length) showStage(stage, projects[`${sec}/${list[0].slug}`], true);
  }

  // Mede a claridade da faixa esquerda da capa (área do nome no celular)
  // e escolhe texto preto ou branco. Mesma origem: o canvas não fica bloqueado.
  function edgeTone(img, card){
    try{
      const w = img.naturalWidth, h = img.naturalHeight;
      const vw = Math.min(w, h * .8), x0 = (w - vw) / 2;     // recorte 4:5 centralizado
      const c = document.createElement('canvas'); c.width = 8; c.height = 24;
      const g = c.getContext('2d', {willReadFrequently:true});
      g.drawImage(img, x0, h * .2, vw * .14, h * .6, 0, 0, 8, 24);
      const d = g.getImageData(0, 0, 8, 24).data;
      let l = 0;
      for(let i = 0; i < d.length; i += 4) l += .2126*d[i] + .7152*d[i+1] + .0722*d[i+2];
      card.classList.toggle('light-edge', l / (d.length / 4) > 150);
    }catch(e){}
  }

  // Palco: capa do projeto em sangria total; o título aparece no hover
  function showStage(stage, p, initial){
    if(!stage || stage.dataset.key === p.key && !initial) return;
    stage.dataset.key = p.key;
    stage.href = `#${p.key}/1`;
    const img = stage.querySelector('img');
    const cover = p.images[0];
    img.sizes = '(max-width: 768px) 100vw, 55vw';
    img.srcset = srcset(cover, ['m','l']);
    img.src = url(cover, 'l');
    img.alt = p.title;
    stage.querySelector('.stage-title').textContent = p.title;
    document.querySelectorAll(`.project-list[data-section="${p.section}"] .project`).forEach(c =>
      c.classList.toggle('current', c.dataset.key === p.key));
  }

  // ─── TEMA / PÁGINAS ───
  function render(route){
    if(!PAGES.includes(route)) route = 'home';
    const gray = route === 'home' || route === 'contact';
    nav.classList.toggle('gray', gray);
    nav.classList.toggle('white', !gray);
    content.classList.toggle('theme-gray', gray);
    content.classList.toggle('theme-white', !gray);
    const menuRoute = route === 'gallery' ? lastSection : route;
    document.querySelectorAll('.menu > a').forEach(a =>
      a.classList.toggle('active', a.dataset.route === menuRoute));
    document.querySelectorAll('.submenu').forEach(s =>
      s.classList.toggle('open', s.dataset.section === menuRoute));
    document.querySelectorAll('.submenu a').forEach(a =>
      a.classList.toggle('active', route === 'gallery' && current && a.dataset.key === current.key));
    PAGES.forEach(p => $(p)?.classList.toggle('active', p === route));
    nav.classList.remove('menu-open');
  }

  // ─── ROTAS: #ads  ·  #ads/notorious-fish/3 ───
  function apply(){
    const [route, slug, n] = location.hash.replace(/^#\/?/, '').split('/');
    if(slug){
      ready.then(() => {
        const p = projects[`${route}/${slug}`];
        if(!p){ render(route); return; }
        lastSection = route;
        openGallery(p, (parseInt(n, 10) || 1) - 1);
      });
      return;
    }
    render(MENU_ROUTES.includes(route) ? route : 'home');
  }
  window.addEventListener('popstate', apply);

  function navigate(hash, replace){
    if(location.hash === hash) return apply();
    history[replace ? 'replaceState' : 'pushState'](null, '', hash);
    apply();
  }

  // ─── GALERIA ───
  function openGallery(p, index){
    if(!current || current.key !== p.key){
      current = p;
      thumbs.innerHTML = '';
      p.images.forEach((img, i) => {
        const t = document.createElement('img');
        t.src = url(img, 's');
        t.srcset = `${url(img,'s')} 1x, ${url(img,'m')} 2x`;
        t.alt = '';
        t.loading = 'lazy';
        t.decoding = 'async';
        const cell = document.createElement('button');
        cell.className = 'cell';
        cell.type = 'button';
        cell.setAttribute('aria-label', `foto ${i + 1}`);
        cell.appendChild(t);
        cell.onclick = () => go(i);
        thumbs.appendChild(cell);
      });
      gTitle.textContent = p.title;
    }
    setImage(Math.min(Math.max(index, 0), p.images.length - 1));
    render('gallery');
  }

  function setImage(index){
    currentIndex = index;
    const img = current.images[index];
    mainImage.removeAttribute('srcset');
    // horizontais: sem corte (encostam nas laterais); verticais: sangria total
    mainFrame.classList.toggle('landscape', img.w / img.h > 1.05);
    mainImage.sizes = '(max-width: 768px) 100vw, 55vw';
    mainImage.srcset = srcset(img, ['m','l']);
    mainImage.src = url(img, 'l');
    mainImage.alt = current.title;
    gCount.textContent = `${index + 1} / ${current.images.length}`;
    [...thumbs.children].forEach((t, i) => t.classList.toggle('active', i === index));
    // mantém a miniatura ativa visível, rolando só a faixa (nunca a página)
    const c = thumbs.children[index];
    if(c) thumbs.scrollTo({
      top: c.offsetTop - (thumbs.clientHeight - c.offsetHeight) / 2,
      left: c.offsetLeft - (thumbs.clientWidth - c.offsetWidth) / 2,
      behavior: 'smooth'});
    // pré-carrega a próxima no tamanho que o navegador escolheria
    const nxt = current.images[(index + 1) % current.images.length];
    if(nxt){ const pre = new Image(); pre.sizes = mainImage.sizes; pre.srcset = srcset(nxt, ['m','l']); }
  }

  function go(index){
    const n = (index + current.images.length) % current.images.length;
    history.replaceState(history.state, '', `#${current.key}/${n + 1}`);
    setImage(n);
  }
  const next = () => go(currentIndex + 1);
  const prev = () => go(currentIndex - 1);

  function closeGallery(){
    if(history.state && history.state.fromSection) history.back();
    else navigate('#' + lastSection, true);
  }
  $('backBtn')?.addEventListener('click', closeGallery);

  // ─── MENU MOBILE ───
  hamburger?.addEventListener('click', e => { e.stopPropagation(); nav.classList.toggle('menu-open'); });

  // ─── CLIQUES ───
  document.addEventListener('click', e => {
    if(nav.classList.contains('menu-open') && !e.target.closest('.menu') && !e.target.closest('.hamburger'))
      nav.classList.remove('menu-open');

    const link = e.target.closest('.menu > a');
    if(link){ e.preventDefault(); navigate('#' + link.dataset.route); return; }

    const target = e.target.closest('[data-key]');
    if(target && projects[target.dataset.key]){
      e.preventDefault();
      const p = projects[target.dataset.key];
      const fromGallery = $('gallery').classList.contains('active');
      lastSection = p.section;
      history[fromGallery ? 'replaceState' : 'pushState'](
        fromGallery ? history.state : {fromSection:true}, '', `#${p.key}/1`);
      openGallery(p, 0);
      return;
    }

    if(e.target.closest('.nav-arrow.next')) next();
    if(e.target.closest('.nav-arrow.prev')) prev();
  });

  // ─── SWIPE ───
  let sx = 0, sy = 0, swiping = false;
  const viewer = document.querySelector('.viewer');
  viewer?.addEventListener('touchstart', e => {
    if(e.touches.length === 1){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true; }
  }, {passive:true});
  viewer?.addEventListener('touchend', e => {
    if(!swiping) return;
    swiping = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
  }, {passive:true});

  // ─── TECLADO ───
  document.addEventListener('keydown', e => {
    if(!$('gallery')?.classList.contains('active')) return;
    if(e.key === 'ArrowRight') next();
    if(e.key === 'ArrowLeft') prev();
    if(e.key === 'Escape') closeGallery();
  });

  apply();
})();
