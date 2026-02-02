const pages=['home','ads','people','personal','gallery','bio','contact'];

function show(id){
  pages.forEach(p=>document.getElementById(p).classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function go(w){
  document.querySelectorAll('.menu a').forEach(a=>a.classList.remove('active'));
  event.target.classList.add('active');

  if(w==='home'){
    nav.className='nav gray';
    content.className='content theme-gray';
  }
  if(['ads','people','personal','bio'].includes(w)){
    nav.className='nav white';
    content.className='content theme-white';
  }
  if(w==='contact'){
    nav.className='nav gray';
    content.className='content theme-gray';
  }
  show(w);
}

function openGallery(){
  show('gallery');
}

function swap(el){
  document.querySelectorAll('.gallery-thumbs img').forEach(i=>i.classList.remove('active'));
  el.classList.add('active');
  mainImage.src = el.src.replace('400/300','1400/900');
}

/* home slideshow */
let i=0;
const slides=document.querySelectorAll('.home img');
setInterval(()=>{
  slides[i].classList.remove('active');
  i=(i+1)%slides.length;
  slides[i].classList.add('active');
},5000);
