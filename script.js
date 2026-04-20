// ============================================================
// 1. CONFIGURAÇÃO DO SUPABASE
// ============================================================
const supabaseUrl = 'https://qzycmnnjtzuvshkasypr.supabase.co';
const supabaseKey = 'sb_publishable_aLM2nvWKe0Tay9v9GStaDQ_T1nKI0tJ';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ============================================================
// 2. TOKEN DO AUTOR
// ============================================================
let meuToken = localStorage.getItem('meu_token_autor');
if (!meuToken) {
  meuToken = crypto.randomUUID();
  localStorage.setItem('meu_token_autor', meuToken);
}

// ============================================================
// 3. ESTADO DO ADMIN
// ============================================================
let adminLogado = false;

// ============================================================
// 4. CORES E LABELS
// ============================================================
const catColors = {
  alagamento:    '#4b23ff',
  pavimentacao:  '#5e5e5e',
  calcada:       '#acacac',
  iluminacao:    '#fffc57',
  acessibilidade:'#00c3ff',
  lixo:          '#3B6D11',
  sinalizacao:   '#ff9100',
  meio_ambiente: '#00db63'
};

const catLabels = {
  alagamento:    'Alagamento',
  pavimentacao:  'Pavimentação',
  calcada:       'Calçada',
  iluminacao:    'Iluminação',
  acessibilidade:'Acessibilidade',
  lixo:          'Lixo',
  sinalizacao:   'Sinalização',
  meio_ambiente: 'Meio Ambiente'
};

// ============================================================
// 5. MAPA
// ============================================================
const limitesPatoBranco = [[-26.33, -52.83], [-26.05, -52.55]];

const map = L.map('map', {
  maxZoom: 20,
  minZoom: 13,
  maxBounds: limitesPatoBranco,
  maxBoundsViscosity: 1.0
}).setView([-26.2289, -52.6703], 14);

L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  subdomains: '0123',
  attribution: '© Google Maps',
  maxZoom: 20,
  maxNativeZoom: 20
}).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 20,
  maxNativeZoom: 19,
  opacity: 0.6
}).addTo(map);

// ============================================================
// 6. LEGENDA
// ============================================================
const legendDiv = document.getElementById('map-legend');
legendDiv.innerHTML = '<strong>Categorias</strong>';
Object.keys(catColors).forEach(cat => {
  const item = document.createElement('div');
  item.className = 'leg-item';
  item.innerHTML = `<span class="leg-dot" style="background:${catColors[cat]}"></span>${catLabels[cat]}`;
  legendDiv.appendChild(item);
});

// ============================================================
// 7. ESTADO LOCAL
// ============================================================
let markers = [];
let pendingLatLng = null;
let filtroAtivo = 'todos';

function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.35);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function updateCounter() {
  document.getElementById('counter').textContent = `${markers.length} registros no mapa`;
}

// ============================================================
// 8. LÓGICA DOS CAMPOS EXTRAS DE ALAGAMENTO (selects + outro)
// ============================================================
document.getElementById('cat-select').addEventListener('change', function() {
  const campos = document.getElementById('alagamento-fields');
  if (this.value === 'alagamento') {
    campos.style.display = 'block';
  } else {
    campos.style.display = 'none';
    limparCamposAlagamento();
  }
});

// Mostra campo de texto quando "outro" é selecionado no select
function setupSelectOutro(selectId, inputId) {
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(inputId);
  sel.addEventListener('change', function() {
    if (this.value === 'outro') {
      inp.style.display = 'block';
      inp.focus();
    } else {
      inp.style.display = 'none';
      inp.value = '';
    }
  });
}

setupSelectOutro('select-frequencia',    'frequencia-outro');
setupSelectOutro('select-caracteristica','caracteristica-outro');
setupSelectOutro('select-origem',        'origem-outro');

function limparCamposAlagamento() {
  ['select-frequencia', 'select-caracteristica', 'select-origem'].forEach(id => {
    document.getElementById(id).value = '';
  });
  ['frequencia-outro', 'caracteristica-outro', 'origem-outro'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.style.display = 'none';
  });
}

function lerCampoAlagamento(selectId, outroId) {
  const sel = document.getElementById(selectId);
  if (!sel.value || sel.value === '') return null;
  if (sel.value === 'outro') {
    const texto = document.getElementById(outroId).value.trim();
    return texto ? `Outro: ${texto}` : 'Outro';
  }
  return sel.value;
}

// ============================================================
// 9. ADICIONAR MARCADOR NA TELA
// ============================================================
function adicionarMarcador({ id, lat, lng, categoria, descricao, autor_token, alag_frequencia, alag_caracteristica, alag_origem }) {
  const cor = catColors[categoria] || '#999';
  const marker = L.marker([lat, lng], { icon: makeIcon(cor) });

  marker._registroData = { id, lat, lng, categoria, descricao, autor_token, alag_frequencia, alag_caracteristica, alag_origem };
  marker.bindPopup(montarPopup(marker._registroData));

  if (filtroAtivo === 'todos' || filtroAtivo === categoria) {
    marker.addTo(map);
  }

  markers.push({ marker, cat: categoria, id, autorToken: autor_token });
  updateCounter();
}

function montarPopup(data) {
  const ehAutor = data.autor_token === meuToken;
  const btnExcluir = (ehAutor || adminLogado)
    ? `<button onclick="excluirPonto('${data.id}')"
         style="margin-top:8px;padding:3px 10px;background:#e53935;color:white;
                border:none;border-radius:4px;cursor:pointer;font-size:11px;">
         Excluir
       </button>`
    : '';

  let extras = '';
  if (data.categoria === 'alagamento') {
    if (data.alag_frequencia)     extras += `<p style="margin:4px 0 0"><strong>Frequência:</strong> ${data.alag_frequencia}</p>`;
    if (data.alag_caracteristica) extras += `<p style="margin:4px 0 0"><strong>Características:</strong> ${data.alag_caracteristica}</p>`;
    if (data.alag_origem)         extras += `<p style="margin:4px 0 0"><strong>Origem:</strong> ${data.alag_origem}</p>`;
  }

  return `
    <strong>${catLabels[data.categoria] || data.categoria}</strong>
    ${extras}
    ${data.descricao ? `<p style="margin:4px 0 0">${data.descricao}</p>` : ''}
    ${btnExcluir}
  `;
}

// ============================================================
// 10. ATUALIZAR TODOS OS POPUPS
// ============================================================
function atualizarTodosPopups() {
  markers.forEach(({ marker }) => {
    if (marker._registroData) {
      marker.setPopupContent(montarPopup(marker._registroData));
    }
  });
}

// ============================================================
// 11. EXCLUIR PONTO
// ============================================================
window.excluirPonto = async function(id) {
  if (!confirm('Excluir este registro?')) return;

  const { error } = await supabaseClient
    .from('registros')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Erro ao excluir: ' + error.message);
    return;
  }

  const idx = markers.findIndex(m => m.id === id);
  if (idx !== -1) {
    map.removeLayer(markers[idx].marker);
    markers.splice(idx, 1);
    updateCounter();
  }
};

// ============================================================
// 12. CARREGAR PONTOS DO SUPABASE
// ============================================================
async function carregarRegistros() {
  const { data, error } = await supabaseClient
    .from('registros')
    .select('*')
    .order('criado_em', { ascending: true });

  if (error) {
    console.error('Erro ao carregar registros:', error.message);
    return;
  }

  data.forEach(registro => adicionarMarcador(registro));
}

// ============================================================
// 13. CLICAR NO MAPA → ABRIR MODAL
// ============================================================
map.on('click', function(e) {
  pendingLatLng = e.latlng;
  document.getElementById('cat-select').value = '';
  document.getElementById('desc-input').value = '';
  document.getElementById('alagamento-fields').style.display = 'none';
  limparCamposAlagamento();
  document.getElementById('modal').classList.add('open');
});

document.getElementById('btn-cancel').onclick = () =>
  document.getElementById('modal').classList.remove('open');

// ============================================================
// 14. SALVAR NOVO PONTO
// ============================================================
document.getElementById('btn-save').onclick = async function() {
  const cat  = document.getElementById('cat-select').value;
  const desc = document.getElementById('desc-input').value.trim();
  if (!cat) return alert('Selecione uma categoria!');

  this.disabled = true;
  this.textContent = 'Salvando...';

  const novoRegistro = {
    lat:         pendingLatLng.lat,
    lng:         pendingLatLng.lng,
    categoria:   cat,
    descricao:   desc || null,
    autor_token: meuToken
  };

  if (cat === 'alagamento') {
    novoRegistro.alag_frequencia     = lerCampoAlagamento('select-frequencia',    'frequencia-outro');
    novoRegistro.alag_caracteristica = lerCampoAlagamento('select-caracteristica','caracteristica-outro');
    novoRegistro.alag_origem         = lerCampoAlagamento('select-origem',        'origem-outro');
  }

  const { data, error } = await supabaseClient
    .from('registros')
    .insert(novoRegistro)
    .select()
    .single();

  this.disabled = false;
  this.textContent = 'Salvar';

  if (error) {
    alert('Erro ao salvar: ' + error.message);
    return;
  }

  adicionarMarcador(data);
  document.getElementById('modal').classList.remove('open');
};

// ============================================================
// 15. FILTROS
// ============================================================
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    filtroAtivo = this.dataset.cat;

    document.querySelectorAll('.cat-btn').forEach(b => {
      b.classList.remove('active');
      b.style.background = 'white';
      b.style.color = '#333';
    });
    this.classList.add('active');
    this.style.background = filtroAtivo === 'todos' ? '#1D9E75' : catColors[filtroAtivo];
    this.style.color = 'white';

    markers.forEach(m => {
      if (filtroAtivo === 'todos' || m.cat === filtroAtivo) m.marker.addTo(map);
      else map.removeLayer(m.marker);
    });
  });
});

// ============================================================
// 16. FECHAR HINT
// ============================================================
document.getElementById('close-hint').addEventListener('click', function(e) {
  e.stopPropagation();
  document.getElementById('hint-box').style.display = 'none';
});

// ============================================================
// 17. ADMIN — ABRIR MODAL DE LOGIN
// ============================================================
document.getElementById('btn-admin-login').addEventListener('click', () => {
  document.getElementById('admin-erro').style.display = 'none';
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-senha').value = '';
  document.getElementById('modal-admin').classList.add('open');
});

document.getElementById('btn-admin-cancel').addEventListener('click', () => {
  document.getElementById('modal-admin').classList.remove('open');
});

// ============================================================
// 18. ADMIN — LOGIN
// ============================================================
document.getElementById('btn-admin-entrar').addEventListener('click', async function() {
  const email = document.getElementById('admin-email').value.trim();
  const senha = document.getElementById('admin-senha').value;
  const erroEl = document.getElementById('admin-erro');

  if (!email || !senha) {
    erroEl.textContent = 'Preencha email e senha.';
    erroEl.style.display = 'block';
    return;
  }

  this.disabled = true;
  this.textContent = 'Entrando...';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });

  this.disabled = false;
  this.textContent = 'Entrar';

  if (error) {
    erroEl.textContent = 'Email ou senha incorretos.';
    erroEl.style.display = 'block';
    return;
  }

  adminLogado = true;
  document.getElementById('modal-admin').classList.remove('open');
  document.getElementById('btn-admin-login').style.display = 'none';
  document.getElementById('admin-status').style.display = 'flex';
  document.getElementById('admin-email-label').textContent = data.user.email;
  atualizarTodosPopups();
});

// ============================================================
// 19. ADMIN — LOGOUT
// ============================================================
document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  adminLogado = false;
  document.getElementById('btn-admin-login').style.display = 'inline-block';
  document.getElementById('admin-status').style.display = 'none';
  atualizarTodosPopups();
});

// ============================================================
// 20. VERIFICAR SESSÃO SALVA
// ============================================================
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    adminLogado = true;
    document.getElementById('btn-admin-login').style.display = 'none';
    document.getElementById('admin-status').style.display = 'flex';
    document.getElementById('admin-email-label').textContent = data.session.user.email;
  }
});

// ============================================================
// 21. INICIAR
// ============================================================
carregarRegistros();