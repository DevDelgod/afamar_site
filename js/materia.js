var db = firebase.firestore();

var conteudoEl = document.getElementById('materia-conteudo');
var erroEl = document.getElementById('materia-erro');

function mostrarErro(){
  conteudoEl.style.display = 'none';
  erroEl.classList.add('is-visible');
}

// Agrupa as imagens em um layout editorial alternado: uma foto grande
// full-width, seguida de duas lado a lado, repetindo até esgotar o array
// (o último grupo "pair" vira "full" se sobrar só 1 imagem).
function agruparGaleria(imagens){
  var grupos = [];
  var i = 0;
  var querFull = true;

  while(i < imagens.length){
    if(querFull || i + 1 >= imagens.length){
      grupos.push({ tipo: 'full', itens: [imagens[i]] });
      i += 1;
    } else {
      grupos.push({ tipo: 'pair', itens: [imagens[i], imagens[i + 1]] });
      i += 2;
    }
    querFull = !querFull;
  }

  return grupos;
}

function montarGaleria(imagens){
  var grupos = agruparGaleria(imagens || []);
  return grupos.map(function(grupo){
    var imgsHtml = grupo.itens.map(function(img){
      return '<img src="' + escaparHtml(img.url) + '" alt="' + escaparHtml(img.alt) + '">';
    }).join('');
    return '<div class="galeria-grupo ' + grupo.tipo + '">' + imgsHtml + '</div>';
  }).join('');
}

function montarCorpoTexto(texto){
  var paragrafos = String(texto || '').split(/\n+/).map(function(p){ return p.trim(); }).filter(Boolean);
  return paragrafos.map(function(p){ return '<p>' + escaparHtml(p) + '</p>'; }).join('');
}

function renderizarMateria(noticia){
  var titulo = noticia.titulo || 'Notícia';
  document.getElementById('materia-page-title').textContent = titulo + ' — AFAMAR';
  document.getElementById('materia-titulo').textContent = titulo;
  document.getElementById('materia-data').textContent = formatarData(noticia.data);
  document.getElementById('materia-galeria').innerHTML = montarGaleria(noticia.imagens || []);
  document.getElementById('materia-corpo').innerHTML = montarCorpoTexto(noticia.texto);
}

// Captura estrita do parâmetro ?id= — nada de parsing manual da query string.
var params = new URLSearchParams(window.location.search);
var noticiaIdBruto = params.get('id');
console.log('[materia] ID capturado da URL:', noticiaIdBruto, '| query string completa:', window.location.search);

// Normaliza para string e remove espaços — protege contra o caso em que o
// valor chega com tipo/formatação inesperada antes de comparar com o Firestore.
var noticiaId = noticiaIdBruto ? String(noticiaIdBruto).trim() : '';
var idInvalido = !noticiaId || noticiaId === 'undefined' || noticiaId === 'null' || noticiaId === '[object Object]';

if(idInvalido){
  console.error('[materia] ID ausente ou inválido na URL — exibindo estado de erro sem consultar o Firestore. Valor recebido:', JSON.stringify(noticiaIdBruto));
  mostrarErro();
} else {
  console.log('[materia] Consultando Firestore em noticias/' + noticiaId + ' …');
  db.collection('noticias').doc(noticiaId).get()
    .then(function(doc){
      // Só decide "não encontrada" depois que a Promise do Firestore resolveu de fato.
      console.log('[materia] Resposta do Firestore recebida. doc.exists =', doc.exists);
      if(!doc.exists){
        mostrarErro();
        return;
      }
      renderizarMateria(doc.data());
    })
    .catch(function(err){
      console.error('[materia] Erro ao consultar o Firestore para o id "' + noticiaId + '":', err);
      mostrarErro();
    });
}
