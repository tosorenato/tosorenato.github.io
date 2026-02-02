(() => {
  const pages = ['home','ads','people','personal','gallery','bio','contact'];
  const nav = document.getElementById('nav');
  const content = document.getElementById('content');

  function show(id){
    pages.forEach(p=>{
      const el=document.getElementById(p);
      if(el) el.classList.remove('active');
    });
    document.getElementById(id)?.classList.add('active');
  }

  function setTheme(route){
    if(route==='home' || route==='contact'){
      nav.className='nav gray';
      content.className='content theme-gray';
    } else {
      nav.className='nav white';
      content.className='content theme-white';
    }
  }

  function go(route){
    setTheme(route);
    document.querySelectorAll('.menu a').forEach(a=>{
      a.classList.toggle('active', a.dataset.route===route);
    });
    show(route);
  }

  document.addEventListener('click',e=>{
    const link=e.target.closest('.menu a');
    if(link){ go(link.dataset.route); return; }

    if(e.target.dataset.open==='gallery'){ go('gallery'); return; }

    if(e.target.dataset.swap){
      document.querySelectorAll('.gallery-thumbs img').forEach(i=>i.classList.remove('active'));
      e.target.classList.add('active');
      const main=document.getElementById('mainImage');
      if(main) main.src=e.target.src.replace('400/300','1400/900');
    }
  });

  // HOME SLIDESHOW
  let i=0;
  const slides=document.querySelectorAll('.home img');
  setInterval(()=>{
    slides[i].classList.remove('active');
    i=(i+1)%slides.length;
    slides[i].classList.add('active');
  },5000);
})();
