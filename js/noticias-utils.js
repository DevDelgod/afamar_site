// ---- Utilitários compartilhados por index.html, noticias.html e materia.html ----

function escaparHtml(str){
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncarTexto(str, max){
  var texto = String(str || '');
  if(texto.length <= max) return texto;
  return texto.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

function formatarData(timestamp){
  if(!timestamp || !timestamp.toDate) return '';
  var d = timestamp.toDate();
  var meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var dia = String(d.getDate()).padStart(2, '0');
  return dia + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
}

// ---- Card de notícia (carrossel + dados) — usado na Home e no Arquivo ----
function montarCarrosselNoticia(imagens){
  var slidesHtml = imagens.map(function(img, i){
    return '<img class="noticia-slide' + (i === 0 ? ' is-active' : '') + '" src="' + escaparHtml(img.url) + '" alt="' + escaparHtml(img.alt) + '">';
  }).join('');

  var navHtml = '';
  if(imagens.length > 1){
    var dotsHtml = imagens.map(function(_, i){ return '<span class="car-dot' + (i === 0 ? ' is-active' : '') + '"></span>'; }).join('');
    navHtml = '<button type="button" class="car-arrow prev" aria-label="Imagem anterior">‹</button>' +
      '<button type="button" class="car-arrow next" aria-label="Próxima imagem">›</button>' +
      '<div class="car-dots">' + dotsHtml + '</div>';
  }

  return '<div class="noticia-carousel">' + slidesHtml + navHtml + '</div>';
}

function montarCardNoticia(noticia){
  var titulo = escaparHtml(noticia.titulo || 'Notícia');
  var texto = truncarTexto(escaparHtml(noticia.texto), 140);
  var data = formatarData(noticia.data);
  var imagens = noticia.imagens || [];

  // Debug: se o doc.id não foi anexado ao objeto antes de chamar montarCardNoticia,
  // o card nasce sem data-id e o clique não terá para onde navegar.
  if(!noticia.id){
    console.error('[noticias] Notícia sem ID de documento — o card não terá link para materia.html:', noticia);
  }

  return '<div class="noticia-card" data-id="' + escaparHtml(noticia.id || '') + '">' +
    montarCarrosselNoticia(imagens) +
    '<div class="noticia-body"><div class="date">' + data + '</div><h4>' + titulo + '</h4><p>' + texto + '</p></div>' +
    '</div>';
}

function iniciarCarrossel(card){
  var slides = card.querySelectorAll('.noticia-slide');
  if(slides.length <= 1) return;

  var dots = card.querySelectorAll('.car-dot');
  var idx = 0;

  function mostrar(novoIdx){
    idx = (novoIdx + slides.length) % slides.length;
    slides.forEach(function(slide, i){ slide.classList.toggle('is-active', i === idx); });
    dots.forEach(function(dot, i){ dot.classList.toggle('is-active', i === idx); });
  }

  var prev = card.querySelector('.car-arrow.prev');
  var next = card.querySelector('.car-arrow.next');
  if(prev) prev.addEventListener('click', function(e){ e.stopPropagation(); mostrar(idx - 1); });
  if(next) next.addEventListener('click', function(e){ e.stopPropagation(); mostrar(idx + 1); });
  dots.forEach(function(dot, i){ dot.addEventListener('click', function(e){ e.stopPropagation(); mostrar(i); }); });
}

// Clique no card (fora do carrossel) leva para a matéria completa.
function ativarNavegacaoCardsNoticia(container){
  container.addEventListener('click', function(e){
    if(e.target.closest('.car-arrow') || e.target.closest('.car-dot')) return;
    var card = e.target.closest('.noticia-card');
    if(!card) return;

    var id = (card.getAttribute('data-id') || '').trim();
    // Guarda contra id vazio/ausente ou strings-lixo que indicariam falha na
    // geração do link (ex: "undefined", "null", "[object Object]").
    if(!id || id === 'undefined' || id === 'null' || id === '[object Object]'){
      console.error('[noticias] Card clicado sem um ID de notícia válido — navegação cancelada. data-id="' + id + '"', card);
      return;
    }

    var destino = 'materia.html?id=' + encodeURIComponent(id);
    console.log('[noticias] Navegando para a matéria:', destino);
    window.location.href = destino;
  });
}

function renderizarNoticiasGrid(containerId, vazioId, lista){
  var container = document.getElementById(containerId);
  var vazio = vazioId ? document.getElementById(vazioId) : null;
  if(!container) return;

  if(!lista.length){
    container.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
    return;
  }

  if(vazio) vazio.style.display = 'none';
  container.innerHTML = lista.map(montarCardNoticia).join('');
  container.querySelectorAll('.noticia-card').forEach(iniciarCarrossel);
  ativarNavegacaoCardsNoticia(container);
}

// ---- Header: reduz e ganha sombra ao rolar (compartilhado por todas as páginas) ----
(function(){
  var headerEl = document.querySelector('header');
  if(!headerEl) return;
  function atualizarHeaderScroll(){ headerEl.classList.toggle('header-scrolled', window.scrollY > 50); }
  window.addEventListener('scroll', atualizarHeaderScroll);
  atualizarHeaderScroll();
})();
