(() => {
  const pages = ['home','ads','people','personal','gallery','bio','contact'];
  const nav = document.getElementById('nav');
  const content = document.getElementById('content');

  let currentImages = [];
  let currentIndex = 0;

  function show(id){
    pages.forEach(p=>{
      document.getElementById(p)?.classList.remove('active');
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
    document.querySelectorAll('.menu a').forEach(a=>{
      a.classList.toggle('active', a.dataset.route === route);
    });
    show(route);
  }

  function openGallery(projectEl){
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

  // HOME SLIDESHOW
  let i = 0;
  const slides = document.querySelectorAll('.home img');
  setInterval(()=>{
    slides[i].classList.remove('active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('active');
  }, 5000);
})();
