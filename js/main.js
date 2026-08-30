function goto(pageName){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.toggle('is-active', p.getAttribute('data-page') === pageName); });
  document.querySelectorAll('.navlinks a').forEach(function(a){ a.classList.toggle('active', a.getAttribute('data-goto') === pageName); });
  window.scrollTo({top:0, behavior:'instant'});
}
document.querySelectorAll('[data-goto]').forEach(function(el){
  el.addEventListener('click', function(){ goto(el.getAttribute('data-goto')); });
});
goto('home');

// Permite deep-link a partir de noticias.html/materia.html (ex: index.html#sobre).
if(window.location.hash){
  var paginaViaHash = window.location.hash.slice(1);
  if(document.querySelector('.page[data-page="' + paginaViaHash + '"]')) goto(paginaViaHash);
}

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

// formatarData vem de js/noticias-utils.js (compartilhado com noticias.js e materia.js)

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

// Rótulos das tags de status exibidas nos editais reais (Firestore). Cópia
// de EDITAL_STATUSES em js/admin.js — um status novo precisa ser acrescentado
// nos dois arquivos.
var EDITAL_STATUS_CONFIG = { aberto: 'Aberto', resultado: 'Resultado', andamento: 'Em Andamento' };

function montarTagStatusEdital(status){
  var rotulo = EDITAL_STATUS_CONFIG[status];
  return rotulo ? '<span class="badge ' + status + '">' + rotulo + '</span>' : '';
}

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
        '<div class="edital-right">' + montarTagStatusEdital(doc.status) + '<a class="dl-e" href="' + url + '" target="_blank" rel="noopener">PDF ↓</a></div>' +
        '</div>';
    });
  });
  if(htmlDocsReais){
    editalList.insertAdjacentHTML('afterbegin', htmlDocsReais);
  }
  aplicarFiltroEditais();
  revelarConteudoDinamico();
});

// ---- Notícias (prévia na Home — lista completa mora em noticias.html) ----
// montarCardNoticia/renderizarNoticiasGrid etc. vêm de js/noticias-utils.js
db.collection('noticias').orderBy('data', 'desc').limit(3).get()
  .then(function(snapshot){
    var lista = [];
    snapshot.forEach(function(doc){ lista.push(Object.assign({ id: doc.id }, doc.data())); });
    console.log('[home] Notícias carregadas com os IDs:', lista.map(function(n){ return n.id; }));
    renderizarNoticiasGrid('noticias-home-grid', 'noticias-home-vazio', lista);
  })
  .catch(function(err){
    console.error('Erro ao carregar notícias:', err);
    renderizarNoticiasGrid('noticias-home-grid', 'noticias-home-vazio', []);
  });

// ---- Formulário de contato (EmailJS) ----
// Substitua os três valores abaixo pelas credenciais da sua conta EmailJS
// (Account > API Keys para a public key; Email Services e Email Templates
// para os IDs). Nada mais no código precisa mudar depois disso.
var EMAILJS_PUBLIC_KEY = 'w2j-Ye1POs-l7OuzO';
var EMAILJS_SERVICE_ID = 'service_gidputj';
var EMAILJS_TEMPLATE_ID = 'template_wfpumqc';

if(window.emailjs) emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// ---- reCAPTCHA v2 (anti-spam do formulário de contato) ----
// Gere a site key em https://www.google.com/recaptcha/admin (cadastre o
// domínio do site) e substitua abaixo. Depois, no painel do EmailJS, ative
// "reCAPTCHA v2" nas configurações do seu Email Service e informe a mesma
// site key + a secret key gerada junto — é o EmailJS quem valida o token.
var RECAPTCHA_SITE_KEY = '6LeldKAtAAAAAIVHXPZlElfqlYy1uwNu1WWjrzVa';
var recaptchaWidgetId = null;
var recaptchaContainer = document.getElementById('contato-recaptcha');

function renderizarRecaptcha(){
  if(!recaptchaContainer || !window.grecaptcha || !grecaptcha.render) return;
  recaptchaWidgetId = grecaptcha.render(recaptchaContainer, {
    sitekey: RECAPTCHA_SITE_KEY,
    theme: 'dark'
  });
}

// grecaptcha existe assim que o script carrega, mas o método render() só
// fica pronto de fato um instante depois — sem o grecaptcha.ready(), a
// primeira chamada aqui podia falhar silenciosamente (widgetId ficava null).
if(recaptchaContainer && window.grecaptcha && grecaptcha.ready){
  grecaptcha.ready(renderizarRecaptcha);
} else {
  renderizarRecaptcha();
}

var toastEl = document.getElementById('toast');
var toastTimeoutId = null;

function mostrarToast(mensagem, tipo){
  if(!toastEl) return;
  toastEl.textContent = mensagem;
  toastEl.classList.remove('toast-erro');
  if(tipo === 'erro') toastEl.classList.add('toast-erro');
  toastEl.classList.add('is-visible');

  if(toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(function(){
    toastEl.classList.remove('is-visible');
  }, 5000);
}

var contatoForm = document.getElementById('contato-form');

function validarEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function marcarErroCampo(input, temErro){
  var campo = input.closest('.form-field');
  if(campo) campo.classList.toggle('has-error', temErro);
}

function validarFormularioContato(dados){
  var valido = true;

  [
    ['nome', dados.nome.trim().length > 0],
    ['email', validarEmail(dados.email.trim())],
    ['telefone', dados.telefone.trim().length > 0],
    ['assunto', dados.assunto.trim().length > 0],
    ['mensagem', dados.mensagem.trim().length > 0]
  ].forEach(function(par){
    var input = document.getElementById('contato-' + par[0]);
    var campoValido = par[1];
    marcarErroCampo(input, !campoValido);
    if(!campoValido) valido = false;
  });

  return valido;
}

if(contatoForm){
  contatoForm.addEventListener('submit', function(e){
    e.preventDefault();

    var dados = {
      nome: document.getElementById('contato-nome').value,
      email: document.getElementById('contato-email').value,
      telefone: document.getElementById('contato-telefone').value,
      assunto: document.getElementById('contato-assunto').value,
      mensagem: document.getElementById('contato-mensagem').value
    };

    var formularioValido = validarFormularioContato(dados);

    var recaptchaToken = recaptchaWidgetId !== null ? grecaptcha.getResponse(recaptchaWidgetId) : '';
    var recaptchaOk = recaptchaWidgetId === null || recaptchaToken !== '';
    var recaptchaCampo = document.getElementById('contato-recaptcha-field');
    if(recaptchaCampo) recaptchaCampo.classList.toggle('has-error', !recaptchaOk);
    if(!recaptchaOk) formularioValido = false;

    if(!formularioValido){
      mostrarToast('Confira os campos destacados antes de enviar.', 'erro');
      return;
    }

    var templateParams = {
      name: dados.nome,
      email: dados.email,
      phone: dados.telefone,
      title: dados.assunto,
      message: dados.mensagem,
      time: new Date().toLocaleString('pt-BR')
    };
    if(recaptchaWidgetId !== null) templateParams['g-recaptcha-response'] = recaptchaToken;

    var botaoEnviar = document.getElementById('btn-contato-enviar');
    var textoOriginal = botaoEnviar.textContent;
    botaoEnviar.disabled = true;
    botaoEnviar.textContent = 'Enviando...';

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
      .then(function(){
        mostrarToast('Mensagem enviada! Em breve entraremos em contato.', 'sucesso');
        contatoForm.reset();
      })
      .catch(function(err){
        console.error('Erro ao enviar mensagem de contato:', err);
        mostrarToast('Não foi possível enviar sua mensagem agora. Tente novamente em instantes.', 'erro');
      })
      .finally(function(){
        botaoEnviar.disabled = false;
        botaoEnviar.textContent = textoOriginal;
        if(recaptchaWidgetId !== null) grecaptcha.reset(recaptchaWidgetId);
      });
  });
}
