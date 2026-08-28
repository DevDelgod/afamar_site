function goto(pageName){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.toggle('is-active', p.getAttribute('data-page') === pageName); });
  document.querySelectorAll('.navlinks a').forEach(function(a){ a.classList.toggle('active', a.getAttribute('data-goto') === pageName); });
  window.scrollTo({top:0, behavior:'instant'});
}
document.querySelectorAll('[data-goto]').forEach(function(el){
  el.addEventListener('click', function(){ goto(el.getAttribute('data-goto')); });
});
goto('home');

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
});
