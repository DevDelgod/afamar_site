var db = firebase.firestore();

db.collection('noticias').get()
  .then(function(snapshot){
    var lista = [];
    snapshot.forEach(function(doc){ lista.push(Object.assign({ id: doc.id }, doc.data())); });

    // Ordena da mais recente para a mais antiga.
    lista.sort(function(a, b){
      var ta = a.data && a.data.toMillis ? a.data.toMillis() : 0;
      var tb = b.data && b.data.toMillis ? b.data.toMillis() : 0;
      return tb - ta;
    });

    console.log('[noticias] Notícias carregadas com os IDs:', lista.map(function(n){ return n.id; }));
    renderizarNoticiasGrid('noticias-grid', 'noticias-vazio', lista);
  })
  .catch(function(err){
    console.error('Erro ao carregar notícias:', err);
    renderizarNoticiasGrid('noticias-grid', 'noticias-vazio', []);
  });
