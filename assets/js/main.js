(() => {
  const pages = ['home','ads','people','personal','gallery','bio','contact'];

  const nav = document.getElementById('nav');
  const content = document.getElementById('content');
  const mainImage = document.getElementById('mainImage');

  function show(id){
    pages.forEach(p => {
      const el = document.getElementById(p);
      if (el) el.classList.remove('active');
    });
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
  }

  function setThemeFor(route){
    if(route === 'home'){
      nav.className = 'nav gray';
      content.className = 'content theme-gray';
      return;
    }
    if(['ads','people','personal','bio','gallery'].includes(route)){
      nav.className = 'nav white';
      content.className = 'content theme-white';
      return;
    }
    if(route === 'contact'){
      nav.className = 'nav gray';
      content.className = 'content theme-gray';
      return;
    }
  }

  function setActiveMenu(route){
    document.querySelectorAll('.menu a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === route);
    });
  }

  function go(route){
    setThemeFor(route);
    setActiveMenu(route);
    show(route);
    if (route !== 'home') stopHomeSlideshow(); // opcional: mantém CPU quieto fora da home
    if (route === 'home') startHomeSlideshow();
  }

  function openGallery(){
    go('gallery');
  }

  function swapThumb(el){
    document.querySelectorAll('.gallery-thumbs img').forEach(i => i.classList.remove('active'));
    el.classList.add('active');

    if (mainImage) {
      mainImage.src = el.src.replace('400/300','1400/900');
    }
  }

  // --- Home slideshow ---
  let slideshowTimer = null;
  let slideIndex = 0;

  function startHomeSlideshow(){
    const slides = document.querySelectorAll('.home img');
    if (!slides.length) return;

    // evita duplicar timers
    stopHomeSlideshow();

    slideshowTimer = setInterval(() => {
      slides[slideIndex].classList.remove('active');
      slideIndex = (slideIndex + 1) % slides.length;
      slides[slideIndex].classList.add('active');
    }, 5000);
  }

  function stopHomeSlideshow(){
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      slideshowTimer = null;
    }
  }

  // --- Wiring ---
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.menu a[data-route]');
    if (link) {
      e.preventDefault();
      go(link.dataset.route);
      return;
    }

    const open = e.target.closest('[data-open="gallery"]');
    if (open) {
      e.preventDefault();
      openGallery();
      return;
    }

    const thumb = e.target.closest('[data-swap]');
    if (thumb) {
      e.preventDefault();
      swapThumb(thumb);
      return;
    }
  });

  // Initial route
  document.addEventListener('DOMContentLoaded', () => {
    // Se URL tiver hash (#ads etc), respeita
    const hash = (location.hash || '').replace('#','').trim();
    const initial = pages.includes(hash) ? hash : 'home';
    go(initial);
  });
})();
