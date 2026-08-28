var auth = firebase.auth();
var db = firebase.firestore();

var CLOUDINARY_CLOUD_NAME = 'kler5har';
var CLOUDINARY_UPLOAD_PRESET = 'afamar_pdfs';
var CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/raw/upload';

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
    adminDashboard.style.display = 'block';
  } else {
    adminDashboard.style.display = 'none';
    loginScreen.style.display = 'flex';
  }
});

uploadForm.addEventListener('submit', function(e){
  e.preventDefault();

  var titulo = document.getElementById('doc-titulo').value;
  var categoria = document.getElementById('doc-categoria').value;
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
      return db.collection('documentos').add({
        titulo: titulo,
        categoria: categoria,
        url: data.secure_url,
        publicId: data.public_id,
        data: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(function(){
      alert('Documento enviado com sucesso!');
      uploadForm.reset();
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

function abrirModalEdicao(id, dados){
  editandoId = id;
  document.getElementById('edit-titulo').value = dados.titulo || '';
  document.getElementById('edit-categoria').value = dados.categoria || '';
  document.getElementById('edit-file').value = '';
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
