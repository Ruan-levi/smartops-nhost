// ============================================================================
// INSTANCIAÇÃO NATIVE DO CLIENTE NHOST
// ============================================================================
// ATENÇÃO: Substitua pelos valores do seu projeto (Project Settings > General)
const NHOST_SUBDOMAIN = 'SEU_SUBDOMAIN_AQUI'; 
const NHOST_REGION = 'SUA_REGION_AQUI';       

const NhostClient = window.nhost?.NhostClient || window.NhostClient;
const nhost = new NhostClient({
  subdomain: NHOST_SUBDOMAIN,
  region: NHOST_REGION
});

// Mapeamento dos elementos DOM
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const userEmailSpan = document.getElementById('user-email');
const btnLogout = document.getElementById('btn-logout');
const formOcorrencia = document.getElementById('form-ocorrencia');
const listaOcorrencias = document.getElementById('lista-ocorrencias');
const btnServerless = document.getElementById('btn-serverless');
const serverlessResult = document.getElementById('serverless-result');

// ============================================================================
// 1. AUTENTICAÇÃO E SESSÃO (REQUISITO 2 - AUTH & ACCESS CONTROL)
// ============================================================================
nhost.auth.onAuthStateChanged((event, session) => {
  if (session) {
    userEmailSpan.textContent = session.user.email;
    authSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    btnLogout.classList.remove('hidden');
    
    // Inicia a escuta reativa WebSocket assim que o usuário faz login
    iniciarSubscriptionRealtime();
  } else {
    userEmailSpan.textContent = '';
    authSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
    btnLogout.classList.add('hidden');
  }
});

// Login de Usuário
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();

  if (!email || !password) return alert('Informe o e-mail e a senha.');

  const { error } = await nhost.auth.signIn({ email, password });
  if (error) alert('Erro ao autenticar: ' + error.message);
});

// Cadastro de Novo Usuário
document.getElementById('btn-signup').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();

  if (!email || !password) return alert('Informe e-mail e senha para cadastro.');

  const { error } = await nhost.auth.signUp({ email, password });
  if (error) alert('Erro no cadastro: ' + error.message);
  else alert('Conta criada com sucesso! Faça login.');
});

// Logout
btnLogout.addEventListener('click', () => {
  nhost.auth.signOut();
});

// ============================================================================
// 2. CRIAÇÃO DE DADOS & UPLOAD DE ARQUIVOS (REQUISITOS 1 E 3 - CRUD & STORAGE)
// ============================================================================
formOcorrencia.addEventListener('submit', async (e) => {
  e.preventDefault();

  const titulo = document.getElementById('titulo').value;
  const categoria = document.getElementById('categoria').value;
  const descricao = document.getElementById('descricao').value;
  const fileInput = document.getElementById('imagem');
  let imagem_id = null;

  // Envio do arquivo para o Nhost Storage
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const uploadRes = await nhost.storage.upload({ file });

    if (uploadRes.error) {
      alert('Erro ao enviar imagem: ' + uploadRes.error.message);
      return;
    }
    imagem_id = uploadRes.fileMetadata.id;
  }

  // Mutação GraphQL para Inserir Ocorrência
  const INSERT_MUTATION = `
    mutation ($titulo: String!, $categoria: String!, $descricao: String!, $imagem_id: uuid) {
      insert_ocorrencias_one(object: {
        titulo: $titulo,
        categoria: $categoria,
        descricao: $descricao,
        imagem_id: $imagem_id
      }) {
        id
      }
    }
  `;

  const { error } = await nhost.graphql.request(INSERT_MUTATION, {
    titulo, categoria, descricao, imagem_id
  });

  if (error) {
    alert('Erro ao salvar no banco: ' + error.message);
  } else {
    formOcorrencia.reset();
  }
});

// ============================================================================
// 3. ATUALIZAÇÃO EM TEMPO REAL (REQUISITO 5 - REALTIME / WEBSOCKETS)
// ============================================================================
function iniciarSubscriptionRealtime() {
  const REALTIME_SUBSCRIPTION = `
    subscription {
      ocorrencias(order_by: {created_at: desc}) {
        id
        titulo
        categoria
        descricao
        status
        prioridade
        imagem_id
        created_at
      }
    }
  `;

  nhost.graphql.subscribe({
    query: REALTIME_SUBSCRIPTION
  }, (response) => {
    if (response.data) {
      renderizarLista(response.data.ocorrencias);
    }
  });
}

function renderizarLista(ocorrencias) {
  listaOcorrencias.innerHTML = '';

  if (ocorrencias.length === 0) {
    listaOcorrencias.innerHTML = '<p class="subtitle">Nenhuma ocorrência cadastrada até o momento.</p>';
    return;
  }

  ocorrencias.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';

    // Recupera a URL da imagem pública no Storage
    let imgHtml = '';
    if (item.imagem_id) {
      const publicUrl = nhost.storage.getPublicUrl({ fileId: item.imagem_id });
      imgHtml = `<img src="${publicUrl}" alt="Evidência Fotográfica">`;
    }

    const dataFormatada = new Date(item.created_at).toLocaleString('pt-BR');

    card.innerHTML = `
      <h3>${item.titulo}</h3>
      <div class="item-meta">
        <strong>Categoria:</strong> ${item.categoria} | 
        <strong>Status:</strong> ${item.status} | 
        <strong>Criado em:</strong> ${dataFormatada}
      </div>
      <p>${item.descricao}</p>
      ${imgHtml}
      <div class="item-actions">
        <button onclick="atualizarStatus('${item.id}', 'Em Análise')" class="btn-warning">Em Análise</button>
        <button onclick="atualizarStatus('${item.id}', 'Concluído')" class="btn-primary">Concluir</button>
        <button onclick="deletarOcorrencia('${item.id}')" class="btn-danger">Excluir</button>
      </div>
    `;
    listaOcorrencias.appendChild(card);
  });
}

// ============================================================================
// 4. ATUALIZAR E DELETAR (REQUISITO 1 - CRUD UPDATE & DELETE)
// ============================================================================
async function atualizarStatus(id, novoStatus) {
  const UPDATE_MUTATION = `
    mutation ($id: uuid!, $status: String!) {
      update_ocorrencias_by_pk(pk_columns: {id: $id}, _set: {status: $status}) {
        id
      }
    }
  `;
  await nhost.graphql.request(UPDATE_MUTATION, { id, status: novoStatus });
}

async function deletarOcorrencia(id) {
  if (!confirm('Deseja realmente remover esta ocorrência?')) return;

  const DELETE_MUTATION = `
    mutation ($id: uuid!) {
      delete_ocorrencias_by_pk(id: $id) {
        id
      }
    }
  `;
  await nhost.graphql.request(DELETE_MUTATION, { id });
}

// ============================================================================
// 5. CHAMADA DA FUNÇÃO SERVERLESS (REQUISITO 4 - CLOUD FUNCTIONS)
// ============================================================================
btnServerless.addEventListener('click', async () => {
  serverlessResult.classList.remove('hidden');
  serverlessResult.textContent = 'Solicitando cálculo de SLA na Nhost Cloud Function...';

  const categoriaAtual = document.getElementById('categoria').value;

  const res = await nhost.functions.call('calcular-prioridade', {
    categoria: categoriaAtual
  });

  if (res.error) {
    serverlessResult.textContent = 'Retorno da Função: ' + JSON.stringify(res.error, null, 2);
  } else {
    serverlessResult.textContent = JSON.stringify(res.data, null, 2);
  }
});