var auth = firebase.auth();
var db = firebase.firestore();

var CLOUDINARY_CLOUD_NAME = 'kler5har';
var CLOUDINARY_UPLOAD_PRESET = 'afamar_pdfs';
var CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/raw/upload';
var CLOUDINARY_UPLOAD_URL_IMG = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload';

var loginForm = document.getElementById('login-form');
var loginScreen = document.getElementById('login-screen');
var adminDashboard = document.getElementById('admin-dashboard');
var btnSair = document.getElementById('btn-sair');
var uploadForm = document.getElementById('upload-form');

loginForm.addEventListener('submit', function(e){
  e.preventDefault();
  var email = document.getElementById('login-email').value;
  var senha = document.getElementById('login-senha').value;
  auth.signInWithEmailAndPassword(email, senha)
    .catch(function(err){
      alert('Erro ao entrar: ' + err.message);
    });
});

btnSair.addEventListener('click', function(){
  auth.signOut();
});

auth.onAuthStateChanged(function(user){
  if(user){
    loginScreen.style.display = 'none';
    adminDashboard.classList.add('is-visible');
  } else {
    adminDashboard.classList.remove('is-visible');
    loginScreen.style.display = 'flex';
  }
});

// ---- Status do edital (configuração escalável) ----
// Único lugar para adicionar/renomear um status: o <select> dos formulários
// abaixo é gerado a partir daqui. A tag exibida no site público (js/main.js)
// usa uma cópia deste dicionário — mantenha os dois em sincronia.
var EDITAL_STATUSES = { aberto: 'Aberto', resultado: 'Resultado', andamento: 'Em Andamento' };
// Categorias de documento que representam editais e por isso ganham o campo de status.
var CATEGORIAS_EDITAL = ['merenda', 'farinha', 'geral'];

function categoriaEhEdital(categoria){
  return CATEGORIAS_EDITAL.indexOf(categoria) !== -1;
}

function popularSelectStatus(selectEl, statusMap){
  Object.keys(statusMap).forEach(function(chave){
    var opt = document.createElement('option');
    opt.value = chave;
    opt.textContent = statusMap[chave];
    selectEl.appendChild(opt);
  });
}

// Mostra o campo de status só quando a categoria escolhida é um edital;
// nas demais (CNDs, atas, calendário etc.) o campo não faz sentido.
function atualizarCampoStatus(categoria, campoEl, selectEl){
  var ehEdital = categoriaEhEdital(categoria);
  campoEl.style.display = ehEdital ? 'block' : 'none';
  selectEl.required = ehEdital;
  if(!ehEdital) selectEl.value = '';
}

var docCategoria = document.getElementById('doc-categoria');
var docStatusField = document.getElementById('doc-status-field');
var docStatus = document.getElementById('doc-status');
popularSelectStatus(docStatus, EDITAL_STATUSES);
docCategoria.addEventListener('change', function(){
  atualizarCampoStatus(docCategoria.value, docStatusField, docStatus);
});

uploadForm.addEventListener('submit', function(e){
  e.preventDefault();

  var titulo = document.getElementById('doc-titulo').value;
  var categoria = document.getElementById('doc-categoria').value;
  var status = categoriaEhEdital(categoria) ? docStatus.value : '';
  var fileInput = document.getElementById('doc-file');
  var file = fileInput.files[0];

  if(!file){
    alert('Selecione um arquivo PDF.');
    return;
  }

  var submitBtn = uploadForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  var formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData
  })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if(!data.secure_url){
        throw new Error(data.error ? data.error.message : 'Falha no upload para o Cloudinary.');
      }
      var novoDocumento = {
        titulo: titulo,
        categoria: categoria,
        url: data.secure_url,
        publicId: data.public_id,
        data: firebase.firestore.FieldValue.serverTimestamp()
      };
      if(status) novoDocumento.status = status;
      return db.collection('documentos').add(novoDocumento);
    })
    .then(function(){
      alert('Documento enviado com sucesso!');
      uploadForm.reset();
      docStatusField.style.display = 'none';
    })
    .catch(function(err){
      alert('Erro ao enviar documento: ' + err.message);
    })
    .finally(function(){
      submitBtn.disabled = false;
      submitBtn.textContent = 'Fazer upload';
    });
});

// ---- Gerenciamento de documentos existentes (listar, editar, excluir) ----
// Não reutiliza nem altera nada da lógica de login/upload acima; só adiciona.
var gerenciarCategoria = document.getElementById('gerenciar-categoria');
var docManageList = document.getElementById('doc-manage-list');
var docManageVazio = document.getElementById('doc-manage-vazio');
var docManageHint = document.getElementById('doc-manage-hint');

function formatarDataAdmin(timestamp){
  if(!timestamp || !timestamp.toDate) return '';
  var d = timestamp.toDate();
  var meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var dia = String(d.getDate()).padStart(2, '0');
  return dia + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
}

function criarLinhaDocumento(id, dados){
  var row = document.createElement('div');
  row.className = 'doc-manage-row';

  var info = document.createElement('div');
  info.className = 'info';
  var titleEl = document.createElement('span');
  titleEl.className = 'title';
  titleEl.textContent = dados.titulo || 'Documento';
  var dateEl = document.createElement('span');
  dateEl.className = 'date';
  dateEl.textContent = formatarDataAdmin(dados.data);
  info.appendChild(titleEl);
  info.appendChild(dateEl);

  var actions = document.createElement('div');
  actions.className = 'actions';

  var btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'btn btn-ghost btn-sm';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', function(){ abrirModalEdicao(id, dados); });

  var btnExcluir = document.createElement('button');
  btnExcluir.type = 'button';
  btnExcluir.className = 'btn btn-danger btn-sm';
  btnExcluir.textContent = 'Excluir';
  btnExcluir.addEventListener('click', function(){ excluirDocumento(id, dados); });

  actions.appendChild(btnEditar);
  actions.appendChild(btnExcluir);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function carregarDocumentosDaCategoria(categoria){
  docManageHint.style.display = 'none';
  docManageVazio.style.display = 'none';
  docManageList.innerHTML = '<div class="doc-manage-row"><span class="title">Carregando…</span></div>';

  // Filtra só por igualdade (sem orderBy combinado) para não depender de um
  // índice composto no Firestore; a ordenação por data é feita aqui no cliente.
  db.collection('documentos').where('categoria', '==', categoria).get()
    .then(function(snapshot){
      if(snapshot.empty){
        docManageList.innerHTML = '';
        docManageVazio.style.display = 'block';
        return;
      }
      var docs = [];
      snapshot.forEach(function(doc){ docs.push({ id: doc.id, dados: doc.data() }); });
      docs.sort(function(a, b){
        var ta = a.dados.data && a.dados.data.toMillis ? a.dados.data.toMillis() : 0;
        var tb = b.dados.data && b.dados.data.toMillis ? b.dados.data.toMillis() : 0;
        return tb - ta;
      });
      docManageList.innerHTML = '';
      docs.forEach(function(item){
        docManageList.appendChild(criarLinhaDocumento(item.id, item.dados));
      });
    })
    .catch(function(err){
      docManageList.innerHTML = '';
      alert('Erro ao carregar documentos: ' + err.message);
    });
}

gerenciarCategoria.addEventListener('change', function(){
  if(gerenciarCategoria.value){
    carregarDocumentosDaCategoria(gerenciarCategoria.value);
  } else {
    docManageList.innerHTML = '';
    docManageVazio.style.display = 'none';
    docManageHint.style.display = 'block';
  }
});

function excluirDocumento(id, dados){
  var ok = confirm('Excluir "' + (dados.titulo || 'este documento') + '"? Essa ação não pode ser desfeita — o documento some imediatamente da página pública.');
  if(!ok) return;

  // A exclusão real de um arquivo no Cloudinary (endpoint /destroy) sempre exige
  // autenticação assinada com a API secret da conta — não existe uma rota unsigned
  // para apagar um recurso já publicado (o "delete_token" do Cloudinary só vale por
  // 10 minutos após o upload, então não serve aqui). Colocar a secret neste painel
  // estático exporia o controle total da conta a qualquer visitante, então essa
  // chamada não é feita. Em vez disso, guardamos o public_id numa fila de limpeza
  // para remoção manual (Media Library) ou, futuramente, uma Cloud Function que
  // guarde a secret no servidor e processe essa fila com segurança.
  db.collection('documentos').doc(id).delete()
    .then(function(){
      if(dados.publicId){
        return db.collection('cloudinary_pendente_exclusao').add({
          publicId: dados.publicId,
          titulo: dados.titulo || '',
          url: dados.url || '',
          excluidoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    })
    .then(function(){
      if(dados.publicId){
        alert('Documento removido do site.\n\nO arquivo ainda ocupa espaço no Cloudinary — o ID "' + dados.publicId + '" foi salvo na coleção "cloudinary_pendente_exclusao" do Firestore para você remover pela Media Library do Cloudinary (ou automatizar a limpeza depois).');
      } else {
        alert('Documento removido do site.\n\nEste registro não tinha um public_id salvo (foi enviado antes desta atualização), então não é possível rastrear o arquivo correspondente no Cloudinary automaticamente.');
      }
      carregarDocumentosDaCategoria(gerenciarCategoria.value);
    })
    .catch(function(err){
      alert('Erro ao excluir documento: ' + err.message);
    });
}

var modalEditar = document.getElementById('modal-editar');
var formEditar = document.getElementById('form-editar');
var btnCancelarEdicao = document.getElementById('btn-cancelar-edicao');
var editandoId = null;

var editCategoria = document.getElementById('edit-categoria');
var editStatusField = document.getElementById('edit-status-field');
var editStatus = document.getElementById('edit-status');
popularSelectStatus(editStatus, EDITAL_STATUSES);
editCategoria.addEventListener('change', function(){
  atualizarCampoStatus(editCategoria.value, editStatusField, editStatus);
});

function abrirModalEdicao(id, dados){
  editandoId = id;
  document.getElementById('edit-titulo').value = dados.titulo || '';
  document.getElementById('edit-categoria').value = dados.categoria || '';
  document.getElementById('edit-file').value = '';
  editStatus.value = dados.status || '';
  atualizarCampoStatus(dados.categoria, editStatusField, editStatus);
  modalEditar.classList.add('is-open');
}

function fecharModalEdicao(){
  modalEditar.classList.remove('is-open');
  editandoId = null;
}

btnCancelarEdicao.addEventListener('click', fecharModalEdicao);
modalEditar.addEventListener('click', function(e){
  if(e.target === modalEditar) fecharModalEdicao();
});

formEditar.addEventListener('submit', function(e){
  e.preventDefault();
  if(!editandoId) return;

  var novoTitulo = document.getElementById('edit-titulo').value;
  var novaCategoria = document.getElementById('edit-categoria').value;
  var novoArquivo = document.getElementById('edit-file').files[0];

  var salvarBtn = formEditar.querySelector('button[type="submit"]');
  salvarBtn.disabled = true;
  salvarBtn.textContent = 'Salvando...';

  var atualizacao = {
    titulo: novoTitulo,
    categoria: novaCategoria
  };
  if(categoriaEhEdital(novaCategoria)){
    atualizacao.status = editStatus.value;
  } else {
    atualizacao.status = firebase.firestore.FieldValue.delete();
  }

  var preparo;
  if(novoArquivo){
    var formData = new FormData();
    formData.append('file', novoArquivo);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    preparo = fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData })
      .then(function(res){ return res.json(); })
      .then(function(data){
        if(!data.secure_url){
          throw new Error(data.error ? data.error.message : 'Falha no upload do novo PDF.');
        }
        atualizacao.url = data.secure_url;
        atualizacao.publicId = data.public_id;
      });
  } else {
    preparo = Promise.resolve();
  }

  preparo
    .then(function(){
      return db.collection('documentos').doc(editandoId).update(atualizacao);
    })
    .then(function(){
      alert('Documento atualizado com sucesso!');
      fecharModalEdicao();
      carregarDocumentosDaCategoria(gerenciarCategoria.value);
    })
    .catch(function(err){
      alert('Erro ao salvar alterações: ' + err.message);
    })
    .finally(function(){
      salvarBtn.disabled = false;
      salvarBtn.textContent = 'Salvar alterações';
    });
});

// ---- Gestão de Balancetes (upload de PDF, Firestore, listar/editar/excluir) ----
// Mesma arquitetura da Gestão de Editais acima (status em dicionário, fila de
// limpeza do Cloudinary) mais o chip de arquivo removível pedido para o PDF;
// independente dela, só adiciona.
var BALANCETE_STATUSES = { aprovado: 'Aprovado', analise: 'Em Análise', pendente: 'Pendente' };

function formatarReferenciaBalancete(referencia){
  if(!referencia) return '';
  var partes = String(referencia).split('-');
  var meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var mes = meses[parseInt(partes[1], 10) - 1];
  return mes ? (mes + '/' + partes[0]) : referencia;
}

// Chip visual (nome do arquivo + botão "×") reaproveitado tanto para o PDF
// recém-selecionado (criação) quanto para o PDF já salvo (edição — com link
// "Ver PDF"). onRemover decide o que acontece em cada caso.
function criarChipArquivo(nome, onRemover, linkUrl){
  var chip = document.createElement('div');
  chip.className = 'file-chip';

  var icone = document.createElement('span');
  icone.className = 'icone';
  icone.setAttribute('aria-hidden', 'true');
  icone.textContent = '📄';
  chip.appendChild(icone);

  var nomeEl = document.createElement('span');
  nomeEl.className = 'nome';
  nomeEl.textContent = nome;
  chip.appendChild(nomeEl);

  if(linkUrl){
    var link = document.createElement('a');
    link.href = linkUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Ver PDF';
    chip.appendChild(link);
  }

  var btnRemover = document.createElement('button');
  btnRemover.type = 'button';
  btnRemover.className = 'file-chip-remove';
  btnRemover.setAttribute('aria-label', 'Remover arquivo');
  btnRemover.textContent = '×';
  btnRemover.addEventListener('click', onRemover);
  chip.appendChild(btnRemover);

  return chip;
}

var balanceteForm = document.getElementById('balancete-form');
var balanceteFileInput = document.getElementById('balancete-file');
var balanceteFilePreview = document.getElementById('balancete-file-preview');
var balanceteStatus = document.getElementById('balancete-status');
popularSelectStatus(balanceteStatus, BALANCETE_STATUSES);

// Arquivo único selecionado para o novo balancete. Diferente da galeria de
// imagens da notícia (que precisa de um DataTransfer por ter vários arquivos),
// aqui basta uma variável simples: só existe um PDF por vez.
var selectedBalanceteFile = null;

balanceteFileInput.addEventListener('change', function(){
  var file = balanceteFileInput.files[0] || null;
  selectedBalanceteFile = file;
  balanceteFilePreview.innerHTML = '';
  if(!file) return;

  balanceteFilePreview.appendChild(criarChipArquivo(file.name, function(){
    balanceteFileInput.value = '';
    selectedBalanceteFile = null;
    balanceteFilePreview.innerHTML = '';
  }));
});

balanceteForm.addEventListener('submit', function(e){
  e.preventDefault();

  var titulo = document.getElementById('balancete-titulo').value;
  var referencia = document.getElementById('balancete-referencia').value;
  var status = balanceteStatus.value;
  var file = selectedBalanceteFile;

  if(!file){
    alert('Selecione um arquivo PDF.');
    return;
  }

  var submitBtn = balanceteForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  var formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if(!data.secure_url){
        throw new Error(data.error ? data.error.message : 'Falha no upload para o Cloudinary.');
      }
      return db.collection('balancetes').add({
        titulo: titulo,
        referencia: referencia,
        status: status,
        url: data.secure_url,
        publicId: data.public_id,
        data: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(function(){
      alert('Balancete enviado com sucesso!');
      balanceteForm.reset();
      balanceteFilePreview.innerHTML = '';
      selectedBalanceteFile = null;
      carregarBalancetes();
    })
    .catch(function(err){
      alert('Erro ao enviar balancete: ' + err.message);
    })
    .finally(function(){
      submitBtn.disabled = false;
      submitBtn.textContent = 'Fazer upload';
    });
});

var balanceteManageList = document.getElementById('balancete-manage-list');
var balanceteManageVazio = document.getElementById('balancete-manage-vazio');

function criarLinhaBalancete(id, dados){
  var row = document.createElement('div');
  row.className = 'doc-manage-row';

  var info = document.createElement('div');
  info.className = 'info';
  var titleEl = document.createElement('span');
  titleEl.className = 'title';
  titleEl.textContent = dados.titulo || 'Balancete';
  var dateEl = document.createElement('span');
  dateEl.className = 'date';
  dateEl.textContent = formatarReferenciaBalancete(dados.referencia);
  info.appendChild(titleEl);
  info.appendChild(dateEl);

  var actions = document.createElement('div');
  actions.className = 'actions';

  var btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'btn btn-ghost btn-sm';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', function(){ abrirModalEdicaoBalancete(id, dados); });

  var btnExcluir = document.createElement('button');
  btnExcluir.type = 'button';
  btnExcluir.className = 'btn btn-danger btn-sm';
  btnExcluir.textContent = 'Excluir';
  btnExcluir.addEventListener('click', function(){ excluirBalancete(id, dados); });

  actions.appendChild(btnEditar);
  actions.appendChild(btnExcluir);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function carregarBalancetes(){
  balanceteManageVazio.style.display = 'none';
  balanceteManageList.innerHTML = '<div class="doc-manage-row"><span class="title">Carregando…</span></div>';

  db.collection('balancetes').orderBy('referencia', 'desc').get()
    .then(function(snapshot){
      if(snapshot.empty){
        balanceteManageList.innerHTML = '';
        balanceteManageVazio.style.display = 'block';
        return;
      }
      balanceteManageList.innerHTML = '';
      snapshot.forEach(function(doc){
        balanceteManageList.appendChild(criarLinhaBalancete(doc.id, doc.data()));
      });
    })
    .catch(function(err){
      balanceteManageList.innerHTML = '';
      alert('Erro ao carregar balancetes: ' + err.message);
    });
}

carregarBalancetes();

function excluirBalancete(id, dados){
  var ok = confirm('Excluir "' + (dados.titulo || 'este balancete') + '"? Essa ação não pode ser desfeita — o balancete some imediatamente da página pública.');
  if(!ok) return;

  db.collection('balancetes').doc(id).delete()
    .then(function(){
      if(dados.publicId){
        return db.collection('cloudinary_pendente_exclusao').add({
          publicId: dados.publicId,
          titulo: dados.titulo || '',
          url: dados.url || '',
          excluidoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    })
    .then(function(){
      if(dados.publicId){
        alert('Balancete removido do site.\n\nO arquivo ainda ocupa espaço no Cloudinary — o ID "' + dados.publicId + '" foi salvo na coleção "cloudinary_pendente_exclusao" do Firestore para você remover pela Media Library do Cloudinary (ou automatizar a limpeza depois).');
      } else {
        alert('Balancete removido do site.');
      }
      carregarBalancetes();
    })
    .catch(function(err){
      alert('Erro ao excluir balancete: ' + err.message);
    });
}

var modalEditarBalancete = document.getElementById('modal-editar-balancete');
var formEditarBalancete = document.getElementById('form-editar-balancete');
var btnCancelarEdicaoBalancete = document.getElementById('btn-cancelar-edicao-balancete');
var editBalanceteStatus = document.getElementById('edit-balancete-status');
popularSelectStatus(editBalanceteStatus, BALANCETE_STATUSES);
var editBalanceteArquivoAtual = document.getElementById('edit-balancete-arquivo-atual');
var editBalanceteFileField = document.getElementById('edit-balancete-file-field');
var editBalanceteFileInput = document.getElementById('edit-balancete-file');
var editandoBalanceteId = null;
var editandoBalanceteDados = null;
var editandoBalanceteArquivoRemovido = false;

// Mostra o PDF já salvo como um chip removível; só revela o campo de upload
// (e passa a exigi-lo) se o admin clicar no "×" para trocar o arquivo.
function renderizarArquivoAtualBalancete(dados){
  editandoBalanceteArquivoRemovido = false;
  editBalanceteFileField.style.display = 'none';
  editBalanceteFileInput.required = false;
  editBalanceteFileInput.value = '';
  editBalanceteArquivoAtual.innerHTML = '';

  editBalanceteArquivoAtual.appendChild(criarChipArquivo(dados.titulo || 'Balancete atual', function(){
    editandoBalanceteArquivoRemovido = true;
    editBalanceteArquivoAtual.innerHTML = '';
    editBalanceteFileField.style.display = 'block';
    editBalanceteFileInput.required = true;
  }, dados.url));
}

function abrirModalEdicaoBalancete(id, dados){
  editandoBalanceteId = id;
  editandoBalanceteDados = dados;
  document.getElementById('edit-balancete-titulo').value = dados.titulo || '';
  document.getElementById('edit-balancete-referencia').value = dados.referencia || '';
  editBalanceteStatus.value = dados.status || '';
  renderizarArquivoAtualBalancete(dados);
  modalEditarBalancete.classList.add('is-open');
}

function fecharModalEdicaoBalancete(){
  modalEditarBalancete.classList.remove('is-open');
  editandoBalanceteId = null;
  editandoBalanceteDados = null;
}

btnCancelarEdicaoBalancete.addEventListener('click', fecharModalEdicaoBalancete);
modalEditarBalancete.addEventListener('click', function(e){
  if(e.target === modalEditarBalancete) fecharModalEdicaoBalancete();
});

formEditarBalancete.addEventListener('submit', function(e){
  e.preventDefault();
  if(!editandoBalanceteId) return;

  var novoArquivo = editBalanceteFileInput.files[0];
  if(editandoBalanceteArquivoRemovido && !novoArquivo){
    alert('Selecione o novo arquivo PDF.');
    return;
  }

  var dadosAnteriores = editandoBalanceteDados;
  var atualizacao = {
    titulo: document.getElementById('edit-balancete-titulo').value,
    referencia: document.getElementById('edit-balancete-referencia').value,
    status: editBalanceteStatus.value
  };

  var salvarBtn = formEditarBalancete.querySelector('button[type="submit"]');
  salvarBtn.disabled = true;
  salvarBtn.textContent = 'Salvando...';

  var preparo;
  if(novoArquivo){
    var formData = new FormData();
    formData.append('file', novoArquivo);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    preparo = fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData })
      .then(function(res){ return res.json(); })
      .then(function(data){
        if(!data.secure_url){
          throw new Error(data.error ? data.error.message : 'Falha no upload do novo PDF.');
        }
        atualizacao.url = data.secure_url;
        atualizacao.publicId = data.public_id;
      });
  } else {
    preparo = Promise.resolve();
  }

  preparo
    .then(function(){
      return db.collection('balancetes').doc(editandoBalanceteId).update(atualizacao);
    })
    .then(function(){
      // Arquivo trocado: o PDF antigo fica órfão no Cloudinary — mesma fila
      // de limpeza usada em excluirDocumento()/excluirBalancete().
      if(novoArquivo && dadosAnteriores.publicId){
        return db.collection('cloudinary_pendente_exclusao').add({
          publicId: dadosAnteriores.publicId,
          titulo: dadosAnteriores.titulo || '',
          url: dadosAnteriores.url || '',
          excluidoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    })
    .then(function(){
      alert('Balancete atualizado com sucesso!');
      fecharModalEdicaoBalancete();
      carregarBalancetes();
    })
    .catch(function(err){
      alert('Erro ao salvar alterações: ' + err.message);
    })
    .finally(function(){
      salvarBtn.disabled = false;
      salvarBtn.textContent = 'Salvar alterações';
    });
});

// ---- Navegação do painel (sidebar / abas) ----
var sidebarLinks = document.querySelectorAll('.sidebar-link[data-tab]');
var tabPanels = document.querySelectorAll('.tab-panel[data-tab-panel]');
var adminPageTitle = document.getElementById('admin-page-title');
var tituloPorAba = { editais: 'Gestão de Editais', balancetes: 'Gestão de Balancetes', noticias: 'Gestão de Notícias' };

var sidebarEl = document.getElementById('sidebar');
var sidebarOverlay = document.getElementById('sidebar-overlay');
var btnMenuMobile = document.getElementById('btn-menu-mobile');

function fecharSidebarMobile(){
  sidebarEl.classList.remove('is-open');
  sidebarOverlay.classList.remove('is-open');
}

function abrirSidebarMobile(){
  sidebarEl.classList.add('is-open');
  sidebarOverlay.classList.add('is-open');
}

function mostrarAbaAdmin(tab){
  sidebarLinks.forEach(function(link){ link.classList.toggle('is-active', link.getAttribute('data-tab') === tab); });
  tabPanels.forEach(function(panel){ panel.classList.toggle('is-active', panel.getAttribute('data-tab-panel') === tab); });
  if(adminPageTitle) adminPageTitle.textContent = tituloPorAba[tab] || '';
  fecharSidebarMobile();
}

sidebarLinks.forEach(function(link){
  link.addEventListener('click', function(){ mostrarAbaAdmin(link.getAttribute('data-tab')); });
});

btnMenuMobile.addEventListener('click', abrirSidebarMobile);
sidebarOverlay.addEventListener('click', fecharSidebarMobile);

// ---- Modo escuro (apenas visual + localStorage; não mexe em auth/upload/exclusão) ----
(function(){
  var TEMA_KEY = 'afamar-admin-tema';
  var btnTema = document.getElementById('btn-tema');
  var btnTemaIcon = document.getElementById('btn-tema-icon');
  var btnTemaLabel = document.getElementById('btn-tema-label');

  function lerTemaSalvo(){
    try { return localStorage.getItem(TEMA_KEY); } catch(e){ return null; }
  }
  function salvarTema(tema){
    try { localStorage.setItem(TEMA_KEY, tema); } catch(e){}
  }

  function aplicarTema(tema){
    if(tema === 'dark'){
      document.documentElement.setAttribute('data-theme', 'dark');
      if(btnTemaIcon) btnTemaIcon.textContent = '☀️';
      if(btnTemaLabel) btnTemaLabel.textContent = 'Modo claro';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if(btnTemaIcon) btnTemaIcon.textContent = '🌙';
      if(btnTemaLabel) btnTemaLabel.textContent = 'Modo escuro';
    }
  }

  aplicarTema(lerTemaSalvo() === 'dark' ? 'dark' : 'light');

  if(btnTema){
    btnTema.addEventListener('click', function(){
      var atual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var novo = atual === 'dark' ? 'light' : 'dark';
      aplicarTema(novo);
      salvarTema(novo);
    });
  }
})();

// ---- Gestão de Notícias (upload de imagens, Firestore, listar/editar/excluir) ----
// Independente da lógica de Editais/Documentos acima; só adiciona.
var noticiaForm = document.getElementById('noticia-form');
var noticiaImagensInput = document.getElementById('noticia-imagens');
var noticiaImagensPreview = document.getElementById('noticia-imagens-preview');
var noticiaManageList = document.getElementById('noticia-manage-list');
var noticiaManageVazio = document.getElementById('noticia-manage-vazio');

// Gerenciador de estado das imagens selecionadas para a nova notícia. O
// FileList nativo do <input type="file"> é somente leitura — não dá para
// remover um item individual dele —, então mantemos aqui um DataTransfer,
// que expõe uma FileList (via .files) e pode ser reatribuído de volta ao
// input (input.files = ...) para manter os dois em sincronia.
var selectedNewsFiles = new DataTransfer();

function atualizarInputImagensNoticia(){
  noticiaImagensInput.files = selectedNewsFiles.files;
}

function renumerarPreviewsImagens(container){
  var labels = container.querySelectorAll('.idx-label');
  labels.forEach(function(label, indice){ label.textContent = 'Imagem ' + (indice + 1); });
}

function lerArquivoComoDataURL(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){ resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function criarItemPreviewImagem(dataUrl){
  var item = document.createElement('div');
  item.className = 'img-preview-item';

  var btnRemover = document.createElement('button');
  btnRemover.type = 'button';
  btnRemover.className = 'img-preview-remove';
  btnRemover.setAttribute('aria-label', 'Remover imagem');
  btnRemover.textContent = '×';
  btnRemover.addEventListener('click', function(){
    var indice = Array.prototype.indexOf.call(noticiaImagensPreview.children, item);
    if(indice === -1) return;
    selectedNewsFiles.items.remove(indice);
    atualizarInputImagensNoticia();
    item.remove();
    renumerarPreviewsImagens(noticiaImagensPreview);
  });

  var img = document.createElement('img');
  img.src = dataUrl;
  img.alt = '';

  var label = document.createElement('span');
  label.className = 'idx-label';

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'noticia-alt-input';
  input.placeholder = 'Texto alternativo (descreva a imagem)';
  input.required = true;

  item.appendChild(btnRemover);
  item.appendChild(img);
  item.appendChild(label);
  item.appendChild(input);
  return item;
}

noticiaImagensInput.addEventListener('change', function(){
  var novosArquivos = Array.prototype.slice.call(noticiaImagensInput.files);
  if(novosArquivos.length === 0) return;

  if(selectedNewsFiles.files.length + novosArquivos.length > 5){
    alert('Você pode selecionar no máximo 5 imagens no total.');
    atualizarInputImagensNoticia();
    return;
  }

  Promise.all(novosArquivos.map(lerArquivoComoDataURL)).then(function(dataUrls){
    novosArquivos.forEach(function(file, indice){
      selectedNewsFiles.items.add(file);
      noticiaImagensPreview.appendChild(criarItemPreviewImagem(dataUrls[indice]));
    });
    atualizarInputImagensNoticia();
    renumerarPreviewsImagens(noticiaImagensPreview);
  });
});

function coletarAltsNoticia(){
  var inputs = noticiaImagensPreview.querySelectorAll('.noticia-alt-input');
  return Array.prototype.map.call(inputs, function(input){ return input.value; });
}

function uploadImagemCloudinary(file){
  var formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  return fetch(CLOUDINARY_UPLOAD_URL_IMG, { method: 'POST', body: formData })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if(!data.secure_url){
        throw new Error(data.error ? data.error.message : 'Falha no upload de uma imagem.');
      }
      return { url: data.secure_url, public_id: data.public_id };
    });
}

noticiaForm.addEventListener('submit', function(e){
  e.preventDefault();

  var titulo = document.getElementById('noticia-titulo').value;
  var texto = document.getElementById('noticia-texto').value;
  var files = Array.prototype.slice.call(selectedNewsFiles.files);
  var alts = coletarAltsNoticia();

  if(files.length < 1 || files.length > 5){
    alert('Selecione de 1 a 5 imagens.');
    return;
  }

  var submitBtn = noticiaForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publicando...';

  Promise.all(files.map(uploadImagemCloudinary))
    .then(function(resultados){
      var imagens = resultados.map(function(res, indice){
        return { url: res.url, public_id: res.public_id, alt: alts[indice] || '' };
      });
      return db.collection('noticias').add({
        titulo: titulo,
        texto: texto,
        data: firebase.firestore.FieldValue.serverTimestamp(),
        imagens: imagens
      });
    })
    .then(function(){
      alert('Notícia publicada com sucesso!');
      noticiaForm.reset();
      noticiaImagensPreview.innerHTML = '';
      selectedNewsFiles = new DataTransfer();
      carregarNoticias();
    })
    .catch(function(err){
      alert('Erro ao publicar notícia: ' + err.message);
    })
    .finally(function(){
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publicar notícia';
    });
});

function criarLinhaNoticia(id, dados){
  var row = document.createElement('div');
  row.className = 'doc-manage-row';

  var primeiraImagem = (dados.imagens && dados.imagens[0]) || {};
  var thumb = document.createElement('img');
  thumb.className = 'thumb';
  thumb.src = primeiraImagem.url || '';
  thumb.alt = '';

  var info = document.createElement('div');
  info.className = 'info';
  var titleEl = document.createElement('span');
  titleEl.className = 'title';
  titleEl.textContent = dados.titulo || 'Notícia';
  var dateEl = document.createElement('span');
  dateEl.className = 'date';
  dateEl.textContent = formatarDataAdmin(dados.data);
  info.appendChild(titleEl);
  info.appendChild(dateEl);

  var actions = document.createElement('div');
  actions.className = 'actions';

  var btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'btn btn-ghost btn-sm';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', function(){ abrirModalEdicaoNoticia(id, dados); });

  var btnExcluir = document.createElement('button');
  btnExcluir.type = 'button';
  btnExcluir.className = 'btn btn-danger btn-sm';
  btnExcluir.textContent = 'Excluir';
  btnExcluir.addEventListener('click', function(){ excluirNoticia(id, dados); });

  actions.appendChild(btnEditar);
  actions.appendChild(btnExcluir);
  row.appendChild(thumb);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function carregarNoticias(){
  noticiaManageVazio.style.display = 'none';
  noticiaManageList.innerHTML = '<div class="doc-manage-row"><span class="title">Carregando…</span></div>';

  db.collection('noticias').orderBy('data', 'desc').get()
    .then(function(snapshot){
      if(snapshot.empty){
        noticiaManageList.innerHTML = '';
        noticiaManageVazio.style.display = 'block';
        return;
      }
      noticiaManageList.innerHTML = '';
      snapshot.forEach(function(doc){
        noticiaManageList.appendChild(criarLinhaNoticia(doc.id, doc.data()));
      });
    })
    .catch(function(err){
      noticiaManageList.innerHTML = '';
      alert('Erro ao carregar notícias: ' + err.message);
    });
}

carregarNoticias();

function excluirNoticia(id, dados){
  var ok = confirm('Excluir "' + (dados.titulo || 'esta notícia') + '"? Essa ação não pode ser desfeita — a notícia some imediatamente da página pública.');
  if(!ok) return;

  db.collection('noticias').doc(id).delete()
    .then(function(){
      // Mesmo motivo do excluirDocumento acima: sem expor a API secret do
      // Cloudinary não é possível apagar o arquivo publicado automaticamente.
      var imagens = dados.imagens || [];
      if(!imagens.length) return;
      return Promise.all(imagens.map(function(imagem){
        return db.collection('cloudinary_pendente_exclusao').add({
          publicId: imagem.public_id || '',
          titulo: dados.titulo || '',
          url: imagem.url || '',
          excluidoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }));
    })
    .then(function(){
      alert('Notícia removida do site.\n\nAs imagens ainda ocupam espaço no Cloudinary — os IDs foram salvos na coleção "cloudinary_pendente_exclusao" do Firestore para remoção pela Media Library (ou automação futura).');
      carregarNoticias();
    })
    .catch(function(err){
      alert('Erro ao excluir notícia: ' + err.message);
    });
}

var modalEditarNoticia = document.getElementById('modal-editar-noticia');
var formEditarNoticia = document.getElementById('form-editar-noticia');
var btnCancelarEdicaoNoticia = document.getElementById('btn-cancelar-edicao-noticia');
var editNoticiaImagensPreview = document.getElementById('edit-noticia-imagens-preview');
var editandoNoticiaId = null;
var editandoNoticiaImagens = null;

function criarItemPreviewImagemEdicao(imagem){
  var item = document.createElement('div');
  item.className = 'img-preview-item';

  var btnRemover = document.createElement('button');
  btnRemover.type = 'button';
  btnRemover.className = 'img-preview-remove';
  btnRemover.setAttribute('aria-label', 'Remover imagem');
  btnRemover.textContent = '×';
  btnRemover.addEventListener('click', function(){
    var indice = Array.prototype.indexOf.call(editNoticiaImagensPreview.children, item);
    if(indice === -1) return;
    editandoNoticiaImagens.splice(indice, 1);
    item.remove();
    renumerarPreviewsImagens(editNoticiaImagensPreview);
  });

  var img = document.createElement('img');
  img.src = imagem.url;
  img.alt = '';

  var label = document.createElement('span');
  label.className = 'idx-label';

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'noticia-alt-input-edicao';
  input.placeholder = 'Texto alternativo (descreva a imagem)';
  input.value = imagem.alt || '';

  item.appendChild(btnRemover);
  item.appendChild(img);
  item.appendChild(label);
  item.appendChild(input);
  return item;
}

function abrirModalEdicaoNoticia(id, dados){
  editandoNoticiaId = id;
  editandoNoticiaImagens = (dados.imagens || []).slice();

  document.getElementById('edit-noticia-titulo').value = dados.titulo || '';
  document.getElementById('edit-noticia-texto').value = dados.texto || '';

  editNoticiaImagensPreview.innerHTML = '';
  editandoNoticiaImagens.forEach(function(imagem){
    editNoticiaImagensPreview.appendChild(criarItemPreviewImagemEdicao(imagem));
  });
  renumerarPreviewsImagens(editNoticiaImagensPreview);

  modalEditarNoticia.classList.add('is-open');
}

function fecharModalEdicaoNoticia(){
  modalEditarNoticia.classList.remove('is-open');
  editandoNoticiaId = null;
  editandoNoticiaImagens = null;
}

btnCancelarEdicaoNoticia.addEventListener('click', fecharModalEdicaoNoticia);
modalEditarNoticia.addEventListener('click', function(e){
  if(e.target === modalEditarNoticia) fecharModalEdicaoNoticia();
});

formEditarNoticia.addEventListener('submit', function(e){
  e.preventDefault();
  if(!editandoNoticiaId) return;

  if(editandoNoticiaImagens.length === 0){
    alert('A notícia precisa ter pelo menos 1 imagem.');
    return;
  }

  var novoTitulo = document.getElementById('edit-noticia-titulo').value;
  var novoTexto = document.getElementById('edit-noticia-texto').value;
  var altInputs = editNoticiaImagensPreview.querySelectorAll('.noticia-alt-input-edicao');
  var novasImagens = editandoNoticiaImagens.map(function(imagem, indice){
    var altInput = altInputs[indice];
    return {
      url: imagem.url,
      public_id: imagem.public_id,
      alt: altInput ? altInput.value : (imagem.alt || '')
    };
  });

  var salvarBtnNoticia = formEditarNoticia.querySelector('button[type="submit"]');
  salvarBtnNoticia.disabled = true;
  salvarBtnNoticia.textContent = 'Salvando...';

  db.collection('noticias').doc(editandoNoticiaId).update({
    titulo: novoTitulo,
    texto: novoTexto,
    imagens: novasImagens
  })
    .then(function(){
      alert('Notícia atualizada com sucesso!');
      fecharModalEdicaoNoticia();
      carregarNoticias();
    })
    .catch(function(err){
      alert('Erro ao salvar alterações: ' + err.message);
    })
    .finally(function(){
      salvarBtnNoticia.disabled = false;
      salvarBtnNoticia.textContent = 'Salvar alterações';
    });
});
