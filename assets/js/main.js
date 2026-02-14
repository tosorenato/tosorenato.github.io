(() => {
  const pages = ['home','ads','people','personal','gallery','bio','contact'];
  const nav = document.getElementById('nav');
  const content = document.getElementById('content');
  const hamburger = document.getElementById('hamburger');
  const backBtn = document.getElementById('backBtn');

  let currentImages = [];
  let currentIndex = 0;
  let lastSection = 'home'; // remember where gallery was opened from

  // ─── ROUTING ───
  function show(id){
    pages.forEach(p=>{
      document.getElementById(p)?.classList.remove('active');
    });
    document.getElementById(id)?.classList.add('active');
  }

  function setTheme(route){
    // Preserve menu-open class on mobile
    const menuOpen = nav.classList.contains('menu-open');
    if(route === 'home' || route === 'contact'){
      nav.className = 'nav gray';
      content.className = 'content theme-gray';
    } else {
      nav.className = 'nav white';
      content.className = 'content theme-white';
    }
    if(menuOpen) nav.classList.add('menu-open');
  }

  function go(route){
    setTheme(route);
    document.querySelectorAll('.menu a').forEach(a=>{
      a.classList.toggle('active', a.dataset.route === route);
    });
    show(route);
    // Close mobile menu after navigation
    nav.classList.remove('menu-open');
  }

  // ─── HAMBURGER TOGGLE ───
  hamburger?.addEventListener('click', e => {
    e.stopPropagation();
    nav.classList.toggle('menu-open');
  });

  // Close menu if tapping outside on mobile
  document.addEventListener('click', e => {
    if(nav.classList.contains('menu-open') &&
       !e.target.closest('.menu') &&
       !e.target.closest('.hamburger')){
      nav.classList.remove('menu-open');
    }
  });

  // ─── GALLERY ───
  function openGallery(projectEl){
    // Remember which section we came from
    const parentSection = projectEl.closest('.page');
    if(parentSection) lastSection = parentSection.id;

    currentImages = [...projectEl.querySelectorAll('img')].map(img => img.src);
    currentIndex = 0;

    const main = document.getElementById('mainImage');
    const thumbs = document.getElementById('galleryThumbs');

    main.src = currentImages[0];
    thumbs.innerHTML = '';

    currentImages.forEach((src, i)=>{
      const t = document.createElement('img');
      t.src = src;
      if(i === 0) t.classList.add('active');
      t.onclick = () => setImage(i);
      thumbs.appendChild(t);
    });

    go('gallery');
  }

  function setImage(index){
    currentIndex = index;
    document.getElementById('mainImage').src = currentImages[index];
    document.querySelectorAll('#galleryThumbs img').forEach((img,i)=>{
      img.classList.toggle('active', i === index);
    });
  }

  function next(){
    setImage((currentIndex + 1) % currentImages.length);
  }

  function prev(){
    setImage((currentIndex - 1 + currentImages.length) % currentImages.length);
  }

  // ─── BACK BUTTON (gallery → section) ───
  backBtn?.addEventListener('click', () => {
    go(lastSection);
  });

  // ─── CLICK DELEGATION ───
  document.addEventListener('click', e => {
    const menu = e.target.closest('.menu a');
    if(menu){
      go(menu.dataset.route);
      return;
    }

    const project = e.target.closest('.project');
    if(project){
      openGallery(project);
      return;
    }

    if(e.target.classList.contains('next')) next();
    if(e.target.classList.contains('prev')) prev();
  });

  // ─── SWIPE GESTURES (gallery) ───
  let touchStartX = 0;
  let touchStartY = 0;
  let swiping = false;

  const viewer = document.querySelector('.viewer');

  viewer?.addEventListener('touchstart', e => {
    if(e.touches.length === 1){
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      swiping = true;
    }
  }, {passive: true});

  viewer?.addEventListener('touchend', e => {
    if(!swiping) return;
    swiping = false;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    // Only trigger if horizontal swipe > 50px and more horizontal than vertical
    if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)){
      if(dx < 0) next();
      else prev();
    }
  }, {passive: true});

  // ─── KEYBOARD NAVIGATION (gallery) ───
  document.addEventListener('keydown', e => {
    const galleryPage = document.getElementById('gallery');
    if(!galleryPage?.classList.contains('active')) return;

    if(e.key === 'ArrowRight') next();
    if(e.key === 'ArrowLeft') prev();
    if(e.key === 'Escape') go(lastSection);
  });

  // ─── AUTO-DISCOVERY ───
  function initProjects(){
    document.querySelectorAll('.project[data-prefix]').forEach(proj => {
      const prefix = proj.dataset.prefix;
      const path = proj.dataset.path;
      const ext = proj.dataset.ext || 'jpeg';

      function probe(n){
        const img = new Image();
        img.onload = function(){
          const el = document.createElement('img');
          el.src = img.src;
          el.alt = '';
          proj.appendChild(el);
          probe(n + 1);
        };
        img.onerror = function(){
          if(proj.querySelectorAll('img').length === 0){
            proj.style.display = 'none';
          }
        };
        img.src = path + prefix + '_' + n + '.' + ext;
      }

      probe(1);
    });
  }

  initProjects();

  // ─── HOME SLIDESHOW ───
  let i = 0;
  const slides = document.querySelectorAll('.home img');
  if(slides.length > 0){
    setInterval(()=>{
      slides[i].classList.remove('active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('active');
    }, 5000);
  }
})();
