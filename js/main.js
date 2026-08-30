function goto(pageName){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.toggle('is-active', p.getAttribute('data-page') === pageName); });
  document.querySelectorAll('.navlinks a').forEach(function(a){ a.classList.toggle('active', a.getAttribute('data-goto') === pageName); });
  window.scrollTo({top:0, behavior:'instant'});
}
document.querySelectorAll('[data-goto]').forEach(function(el){
  el.addEventListener('click', function(){ goto(el.getAttribute('data-goto')); });
});
goto('home');

// ---- Header: reduz e ganha sombra ao rolar a página ----
var headerEl = document.querySelector('header');
function atualizarHeaderScroll(){
  headerEl.classList.toggle('header-scrolled', window.scrollY > 50);
}
window.addEventListener('scroll', atualizarHeaderScroll);
atualizarHeaderScroll();

// ---- Animação de entrada da hero (home) ----
var textoHero = document.querySelector('.hero-inner > div:first-child');
var fotoHero = document.querySelector('.hero-art');
var statsHero = document.querySelectorAll('.hero-stats .stat');

if(textoHero) textoHero.classList.add('fade-in-left');
if(fotoHero) fotoHero.classList.add('fade-in-right');
statsHero.forEach(function(stat, i){
  stat.classList.add('fade-in-up');
  stat.style.animationDelay = (0.4 + i * 0.15) + 's';
});

// ---- Revelação ao rolar (IntersectionObserver) ----
// Elementos ganham a classe "hidden-scroll" (estado inicial, via JS) e, ao
// entrar no viewport, recebem "show-scroll" para disparar a transição do CSS.
var scrollRevealObserver = new IntersectionObserver(function(entries){
  entries.forEach(function(entry){
    if(entry.isIntersecting){
      entry.target.classList.add('show-scroll');
      scrollRevealObserver.unobserve(entry.target);
    }
  });
}, { threshold:0.15 });

function observarRevelacao(seletor, opcoes){
  opcoes = opcoes || {};
  var passo = opcoes.staggerStep || 0.08;
  document.querySelectorAll(seletor + ':not(.hidden-scroll)').forEach(function(el){
    el.classList.add('hidden-scroll');
    if(opcoes.stagger){
      var indice = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = (indice * passo) + 's';
    }
    scrollRevealObserver.observe(el);
  });
}

// Chamada de novo sempre que conteúdo novo entra no DOM (editais e
// documentos vindos do Firestore), para que também sejam observados.
function revelarConteudoDinamico(){
  observarRevelacao('.proj-card', { stagger:true });
  observarRevelacao('.capacidade-card', { stagger:true });
  observarRevelacao('.transp-item', { stagger:true });
  observarRevelacao('.edital-row', { stagger:true, staggerStep:0.06 });
  observarRevelacao('.doc-row', { stagger:true, staggerStep:0.06 });
}
revelarConteudoDinamico();

// ---- Timeline orgânica: a linha se desenha sozinha (tempo fixo) ao entrar na tela ----
document.querySelectorAll('.timeline .tl-item').forEach(function(item){
  item.classList.add('hidden-scroll');
});

// getTotalLength() funciona mesmo com a página ainda escondida (display:none),
// então já preparamos os dois traçados (desktop/mobile) no carregamento.
document.querySelectorAll('.timeline .tl-path').forEach(function(path){
  var comprimento = path.getTotalLength();
  path.style.strokeDasharray = comprimento;
  path.style.strokeDashoffset = comprimento;
  path.style.setProperty('--tl-len', comprimento);
});

var timelineEl = document.querySelector('.timeline');
var timelineObserver = null;

function tlPathAtivo(){
  var path = null;
  timelineEl.querySelectorAll('.tl-path').forEach(function(candidato){
    if(!path && getComputedStyle(candidato).display !== 'none') path = candidato;
  });
  return path;
}

// Reseta a timeline para o estado inicial (linha e pontos invisíveis) e volta
// a observá-la, para que a próxima vez que ela entrar na tela anime do zero.
// Chamado pela navegação do menu — o scroll natural NÃO reseta (ver observer abaixo).
function resetTimelineAnimation(){
  if(!timelineEl) return;

  var path = tlPathAtivo();
  if(path) path.classList.remove('start-drawing');

  timelineEl.querySelectorAll('.tl-item').forEach(function(item){
    item.classList.remove('show-scroll');
  });

  if(timelineObserver) timelineObserver.observe(timelineEl);
}

if(timelineEl){
  timelineObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting) return;

      var path = tlPathAtivo();
      if(path) path.classList.add('start-drawing');

      entry.target.querySelectorAll('.tl-item').forEach(function(item){
        item.classList.add('show-scroll');
      });

      timelineObserver.unobserve(entry.target);
    });
  }, { threshold:0.3 });
  timelineObserver.observe(timelineEl);
}

// Navegar pelo menu principal "limpa o palco": qualquer clique reseta a
// timeline, garantindo que ela anime de novo quando o usuário voltar a vê-la.
document.querySelectorAll('.navlinks a').forEach(function(link){
  link.addEventListener('click', resetTimelineAnimation);
});

var db = firebase.firestore();

// O card único "Editais institucionais" da Transparência agrega as 3 categorias
// de edital usadas no admin e na página de Editais (merenda/farinha/geral).
// Toda outra categoria usa o mesmo slug no admin, na Transparência e no Firestore.
var categoriaParaFirestore = {
  'editais-institucionais': ['merenda', 'farinha', 'geral']
};

function formatarData(timestamp){
  if(!timestamp || !timestamp.toDate) return '';
  var d = timestamp.toDate();
  var meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var dia = String(d.getDate()).padStart(2, '0');
  return dia + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
}

var docsPorCategoria = {};
var documentosProntos = db.collection('documentos').orderBy('data', 'desc').get()
  .then(function(snapshot){
    snapshot.forEach(function(doc){
      var d = doc.data();
      var lista = docsPorCategoria[d.categoria] || (docsPorCategoria[d.categoria] = []);
      lista.push(d);
    });
  })
  .catch(function(err){
    console.error('Erro ao carregar documentos do Firestore:', err);
  });

function renderizarDocumentos(categoriaSlug){
  var container = document.getElementById('lista-documentos-doclist');
  var vazio = document.getElementById('lista-documentos-vazio');
  container.innerHTML = '<div class="doc-row"><span class="title">Carregando documentos…</span></div>';
  vazio.style.display = 'none';

  documentosProntos.then(function(){
    var categoriasFirestore = categoriaParaFirestore[categoriaSlug] || [categoriaSlug];
    var docs = [];
    categoriasFirestore.forEach(function(cat){
      docs = docs.concat(docsPorCategoria[cat] || []);
    });
    docs.sort(function(a, b){
      var ta = a.data && a.data.toMillis ? a.data.toMillis() : 0;
      var tb = b.data && b.data.toMillis ? b.data.toMillis() : 0;
      return tb - ta;
    });

    if(docs.length === 0){
      container.innerHTML = '';
      vazio.style.display = 'block';
      return;
    }

    container.innerHTML = docs.map(function(doc){
      var titulo = (doc.titulo || 'Documento').replace(/</g, '&lt;');
      var data = formatarData(doc.data);
      var url = doc.url || '#';
      return '<div class="doc-row"><span class="title">' + titulo + '</span><span class="date">' + data + '</span><a class="dl" href="' + url + '" target="_blank" rel="noopener">PDF ↓</a></div>';
    }).join('');
    revelarConteudoDinamico();
  });
}

document.querySelectorAll('.transp-item[data-categoria]').forEach(function(item){
  item.addEventListener('click', function(){
    var nomeEl = item.querySelector('b');
    var categoriaSlug = item.getAttribute('data-categoria');
    var nome = nomeEl ? nomeEl.textContent : categoriaSlug;
    document.getElementById('titulo-categoria-doc').textContent = nome;
    goto('lista-documentos');
    renderizarDocumentos(categoriaSlug);
  });
});

var tabs = document.querySelectorAll('.tab');
var editalList = document.getElementById('editalList');
var empty = document.getElementById('editalEmpty');

function filtroEditalAtivo(){
  var ativa = document.querySelector('.tab.is-active');
  return ativa ? ativa.getAttribute('data-tab') : 'todos';
}

function aplicarFiltroEditais(){
  var filter = filtroEditalAtivo();
  var visibleCount = 0;
  document.querySelectorAll('.edital-row').forEach(function(row){
    var match = filter === 'todos' || row.getAttribute('data-proj') === filter;
    row.classList.toggle('show', match);
    if(match) visibleCount++;
  });
  empty.style.display = visibleCount === 0 ? 'block' : 'none';
}

tabs.forEach(function(tab){
  tab.addEventListener('click', function(){
    tabs.forEach(function(t){ t.classList.remove('is-active'); });
    tab.classList.add('is-active');
    aplicarFiltroEditais();
  });
});

// Injeta na lista de Editais os documentos reais enviados pelo admin,
// usando a mesma categoria (merenda/farinha/geral) como data-proj para
// que o filtro por abas já existente funcione sem mudanças.
documentosProntos.then(function(){
  var projetos = ['merenda', 'farinha', 'geral'];
  var htmlDocsReais = '';
  projetos.forEach(function(proj){
    (docsPorCategoria[proj] || []).forEach(function(doc){
      var titulo = (doc.titulo || 'Documento').replace(/</g, '&lt;');
      var data = formatarData(doc.data);
      var url = doc.url || '#';
      htmlDocsReais += '<div class="edital-row show" data-proj="' + proj + '">' +
        '<div class="edital-left"><span class="num">' + data + '</span><span class="title">' + titulo + '</span></div>' +
        '<div class="edital-right"><a class="dl-e" href="' + url + '" target="_blank" rel="noopener">PDF ↓</a></div>' +
        '</div>';
    });
  });
  if(htmlDocsReais){
    editalList.insertAdjacentHTML('afterbegin', htmlDocsReais);
  }
  aplicarFiltroEditais();
  revelarConteudoDinamico();
});

// ---- Notícias (carrossel de imagens) ----
function escaparHtml(str){
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncarTexto(str, max){
  var texto = String(str || '');
  if(texto.length <= max) return texto;
  return texto.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

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

  return '<div class="noticia-card">' +
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
  if(prev) prev.addEventListener('click', function(){ mostrar(idx - 1); });
  if(next) next.addEventListener('click', function(){ mostrar(idx + 1); });
  dots.forEach(function(dot, i){ dot.addEventListener('click', function(){ mostrar(i); }); });
}

function renderizarNoticias(containerId, vazioId, lista){
  var container = document.getElementById(containerId);
  var vazio = document.getElementById(vazioId);
  if(!container) return;

  if(!lista.length){
    container.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
    return;
  }

  if(vazio) vazio.style.display = 'none';
  container.innerHTML = lista.map(montarCardNoticia).join('');
  container.querySelectorAll('.noticia-card').forEach(iniciarCarrossel);
}

db.collection('noticias').orderBy('data', 'desc').get()
  .then(function(snapshot){
    var lista = [];
    snapshot.forEach(function(doc){ lista.push(doc.data()); });
    renderizarNoticias('noticias-home-grid', 'noticias-home-vazio', lista.slice(0, 3));
    renderizarNoticias('noticias-full-grid', 'noticias-full-vazio', lista);
  })
  .catch(function(err){
    console.error('Erro ao carregar notícias:', err);
    renderizarNoticias('noticias-home-grid', 'noticias-home-vazio', []);
    renderizarNoticias('noticias-full-grid', 'noticias-full-vazio', []);
  });
