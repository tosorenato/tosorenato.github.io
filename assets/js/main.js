(() => {
  const PAGES = ['home','ads','people','personal','gallery','bio','contact'];
  const MENU_ROUTES = ['home','ads','people','personal','bio','contact'];
  const nav = document.getElementById('nav');
  const content = document.getElementById('content');
  const hamburger = document.getElementById('hamburger');
  const backBtn = document.getElementById('backBtn');
  const mainImage = document.getElementById('mainImage');
  const thumbs = document.getElementById('galleryThumbs');

  let currentImages = [];
  let currentIndex = 0;
  let currentProject = null;   // key do projeto aberto na galeria
  let lastSection = 'ads';     // seção de onde a galeria foi aberta

  // ─── PROJETOS ───
  // Cada .project ganha uma lista de imagens em proj._images.
  // Só a capa entra no DOM (as demais só carregam quando a galeria abre).
  const projects = {};         // key -> elemento .project

  function projectKey(el){ return el.dataset.prefix || el.dataset.project; }

  function setupProject(el, images){
    el._images = images;
    projects[projectKey(el)] = el;
    if(!images.length){ el.style.display = 'none'; return; }
    el.innerHTML = '';
    const cover = document.createElement('img');
    cover.src = images[0];
    cover.alt = el.dataset.title || '';
    cover.loading = 'lazy';
    cover.decoding = 'async';
    el.appendChild(cover);
  }

  // Projetos fixos: lista em data-images (separada por vírgula)
  document.querySelectorAll('.project[data-images]').forEach(el => {
    setupProject(el, el.dataset.images.split(',').map(s => s.trim()).filter(Boolean));
  });

  // Projetos auto-discovery: lê assets/projects.json (gerado por tools/build_manifest.py).
  // Se o manifest falhar, cai no método antigo de testar _1, _2, _3…
  const discoverable = [...document.querySelectorAll('.project[data-prefix]')];

  function fromCount(el, count){
    const ext = el.dataset.ext || 'jpeg';
    const list = [];
    for(let n = 1; n <= count; n++) list.push(`${el.dataset.path}${el.dataset.prefix}_${n}.${ext}`);
    setupProject(el, list);
  }

  function probeProject(el){
    return new Promise(resolve => {
      const ext = el.dataset.ext || 'jpeg';
      let n = 1;
      const step = () => {
        // HEAD evita baixar a imagem inteira só para saber se ela existe
        fetch(`${el.dataset.path}${el.dataset.prefix}_${n}.${ext}`, {method:'HEAD'})
          .then(r => { if(r.ok){ n++; step(); } else { fromCount(el, n - 1); resolve(); } })
          .catch(() => { fromCount(el, n - 1); resolve(); });
      };
      step();
    });
  }

  const ready = fetch('/assets/projects.json', {cache:'no-cache'})
    .then(r => { if(!r.ok) throw 0; return r.json(); })
    .then(m => discoverable.forEach(el => fromCount(el, m[el.dataset.prefix] || 0)))
    .catch(() => Promise.all(discoverable.map(probeProject)));

  // ─── TEMA / PÁGINAS ───
  function setTheme(route){
    const gray = route === 'home' || route === 'contact';
    nav.classList.toggle('gray', gray);
    nav.classList.toggle('white', !gray);
    content.classList.toggle('theme-gray', gray);
    content.classList.toggle('theme-white', !gray);
  }

  function render(route){
    if(!PAGES.includes(route)) route = 'home';
    setTheme(route);
    const menuRoute = route === 'gallery' ? lastSection : route;
    document.querySelectorAll('.menu a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === menuRoute);
    });
    PAGES.forEach(p => document.getElementById(p)?.classList.toggle('active', p === route));
    nav.classList.remove('menu-open');
  }

  // ─── ROTAS COM HASH (#ads, #personal, #ads/ads_a/3) ───
  // Permite link direto e o botão "voltar" do navegador/celular.
  function parseHash(){
    const [route, key, n] = location.hash.replace(/^#\/?/, '').split('/');
    return { route: route || 'home', key, n: parseInt(n, 10) || 1 };
  }

  function apply(){
    const { route, key, n } = parseHash();
    // #<seção>/<projeto>/<n> → galeria
    if(key){
      ready.then(() => {
        const el = projects[key];
        if(!el || !el._images?.length){ render(route); return; }
        lastSection = route;
        openGallery(el, n - 1);
      });
      return;
    }
    render(MENU_ROUTES.includes(route) ? route : 'home');
  }

  function navigate(hash, replace){
    if(location.hash === hash) return apply();
    if(replace) history.replaceState(null, '', hash);
    else history.pushState(null, '', hash);
    apply();
  }

  window.addEventListener('popstate', apply);

  // ─── GALERIA ───
  function openGallery(el, index){
    const key = projectKey(el);
    if(currentProject !== key){
      currentProject = key;
      currentImages = el._images;
      thumbs.innerHTML = '';
      currentImages.forEach((src, i) => {
        const t = document.createElement('img');
        t.src = src;
        t.alt = '';
        t.loading = 'lazy';
        t.decoding = 'async';
        t.onclick = () => go(i);
        thumbs.appendChild(t);
      });
    }
    setImage(Math.min(Math.max(index, 0), currentImages.length - 1));
    render('gallery');
  }

  function setImage(index){
    currentIndex = index;
    mainImage.src = currentImages[index];
    [...thumbs.children].forEach((t, i) => t.classList.toggle('active', i === index));
    // pré-carrega a próxima
    const nxt = currentImages[(index + 1) % currentImages.length];
    if(nxt) (new Image()).src = nxt;
  }

  // troca de foto dentro da galeria: atualiza o hash sem empilhar histórico
  function go(index){
    const n = (index + currentImages.length) % currentImages.length;
    history.replaceState(history.state, '', `#${lastSection}/${currentProject}/${n + 1}`);
    setImage(n);
  }
  const next = () => go(currentIndex + 1);
  const prev = () => go(currentIndex - 1);

  function closeGallery(){
    // se a galeria foi aberta por clique, volta no histórico; se veio de link direto, troca o hash
    if(history.state && history.state.fromSection) history.back();
    else navigate('#' + lastSection, true);
  }

  backBtn?.addEventListener('click', closeGallery);

  // ─── MENU MOBILE ───
  hamburger?.addEventListener('click', e => {
    e.stopPropagation();
    nav.classList.toggle('menu-open');
  });

  // ─── CLIQUES ───
  document.addEventListener('click', e => {
    if(nav.classList.contains('menu-open') && !e.target.closest('.menu') && !e.target.closest('.hamburger')){
      nav.classList.remove('menu-open');
    }

    const link = e.target.closest('.menu a');
    if(link){
      e.preventDefault();
      navigate('#' + link.dataset.route);
      return;
    }

    const project = e.target.closest('.project');
    if(project && project._images?.length){
      const section = project.closest('.page')?.id || 'ads';
      lastSection = section;
      history.pushState({fromSection:true}, '', `#${section}/${projectKey(project)}/1`);
      openGallery(project, 0);
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
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
  }, {passive:true});

  // ─── TECLADO ───
  document.addEventListener('keydown', e => {
    if(!document.getElementById('gallery')?.classList.contains('active')) return;
    if(e.key === 'ArrowRight') next();
    if(e.key === 'ArrowLeft') prev();
    if(e.key === 'Escape') closeGallery();
  });

  // ─── SLIDESHOW DA HOME ───
  // Só a 1ª imagem tem src no HTML; as outras (data-src) carregam depois.
  const slides = [...document.querySelectorAll('.home img')];
  const loadSlide = s => { if(s && s.dataset.src && !s.getAttribute('src')) s.src = s.dataset.src; };
  window.addEventListener('load', () => loadSlide(slides[1]));
  let si = 0;
  if(slides.length > 1){
    setInterval(() => {
      if(!document.getElementById('home').classList.contains('active') || document.hidden) return;
      const nextSlide = slides[(si + 1) % slides.length];
      if(!nextSlide.complete || !nextSlide.getAttribute('src')){ loadSlide(nextSlide); return; }
      slides[si].classList.remove('active');
      si = (si + 1) % slides.length;
      slides[si].classList.add('active');
      loadSlide(slides[(si + 1) % slides.length]);
    }, 5000);
  }

  apply();
})();
