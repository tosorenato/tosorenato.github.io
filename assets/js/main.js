(() => {
  /* =========================
     ROUTES / PAGES
  ========================= */
  const pages = ['home','ads','people','personal','gallery','bio','contact'];
  const nav = document.getElementById('nav');
  const content = document.getElementById('content');

  function show(id){
    pages.forEach(p => {
      const el = document.getElementById(p);
      if(el) el.classList.remove('active');
    });
    document.getElementById(id)?.classList.add('active');
  }

  function setTheme(route){
    if(route === 'home' || route === 'contact'){
      nav.className = 'nav gray';
      content.className = 'content theme-gray';
    } else {
      nav.className = 'nav white';
      content.className = 'content theme-white';
    }
  }

  function go(route){
    setTheme(route);
    document.querySelectorAll('.menu a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === route);
    });
    show(route);
  }

  /* =========================
     PROJECTS DATA
  ========================= */
  const projects = {
    "ads-theordinary": [
      "/assets/img/ads/ads-theordinary-1.jpg",
      "/assets/img/ads/ads-theordinary-2.jpg",
      "/assets/img/ads/ads-theordinary-3.jpg",
      "/assets/img/ads/ads-theordinary-4.jpg",
      "/assets/img/ads/ads-theordinary-5.jpg"
    ]
  };

  /* =========================
     GALLERY STATE
  ========================= */
  let currentImages = [];
  let currentIndex = 0;

  const mainImage = document.getElementById('mainImage');
  const thumbsContainer = document.getElementById('galleryThumbs');

  function openProjectGallery(key){
    if(!projects[key]) return;

    currentImages = projects[key];
    currentIndex = 0;

    // imagem principal
    mainImage.src = currentImages[0];

    // thumbs
    thumbsContainer.innerHTML = '';
    currentImages.forEach((src, index) => {
      const img = document.createElement('img');
      img.src = src;
      if(index === 0) img.classList.add('active');

      img.addEventListener('click', () => showImage(index));
      thumbsContainer.appendChild(img);
    });

    go('gallery');
  }

  function showImage(index){
    if(!currentImages.length) return;

    currentIndex = (index + currentImages.length) % currentImages.length;
    mainImage.src = currentImages[currentIndex];

    document
      .querySelectorAll('.gallery-thumbs img')
      .forEach((img, i) => img.classList.toggle('active', i === currentIndex));
  }

  /* =========================
     EVENTS
  ========================= */
  document.addEventListener('click', e => {
    // menu
    const link = e.target.closest('.menu a');
    if(link){
      go(link.dataset.route);
      return;
    }

    // abrir galeria do projeto
    const project = e.target.closest('[data-project]');
    if(project){
      openProjectGallery(project.dataset.project);
      return;
    }

    // setas da galeria
    if(e.target.classList.contains('prev')){
      showImage(currentIndex - 1);
      return;
    }

    if(e.target.classList.contains('next')){
      showImage(currentIndex + 1);
      return;
    }
  });

  /* =========================
     HOME SLIDESHOW
  ========================= */
  let slideIndex = 0;
  const slides = document.querySelectorAll('.home img');

  if(slides.length){
    setInterval(() => {
      slides[slideIndex].classList.remove('active');
      slideIndex = (slideIndex + 1) % slides.length;
      slides[slideIndex].classList.add('active');
    }, 5000);
  }

})();
