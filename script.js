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
// 4. CORES E LABELS  (nova categoria: imovel_abandonado)
// ============================================================
const catColors = {
  alagamento:        '#F47700',
  pavimentacao:      '#F2B513',
  calcada:           '#13BFF2',
  iluminacao:        '#625DB4',
  acessibilidade:    '#AC1149',
  lixo:              '#93CC16',
  sinalizacao:       '#41889D',
  meio_ambiente:     '#D51EDC',
  imovel_abandonado: '#437363'
};

const catLabels = {
  alagamento:        'Alagamento',
  pavimentacao:      'Pavimentação',
  calcada:           'Calçada',
  iluminacao:        'Iluminação',
  acessibilidade:    'Acessibilidade',
  lixo:              'Lixo',
  sinalizacao:       'Sinalização',
  meio_ambiente:     'Meio Ambiente',
  imovel_abandonado: 'Imóvel Abandonado'
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
// 7. ESTADO LOCAL + CLUSTER
// ============================================================
let markers = [];
let pendingLatLng = null;
let filtroAtivo = 'todos';

// Cluster group — agrupa marcadores próximos com círculo numérico
const clusterGroup = L.markerClusterGroup({
  maxClusterRadius: 50,
  showCoverageOnHover: false,
  iconCreateFunction: function(cluster) {
    const count = cluster.getChildCount();
    let size = 32, fontSize = 13;
    if (count >= 50) { size = 46; fontSize = 16; }
    else if (count >= 20) { size = 40; fontSize = 15; }
    else if (count >= 10) { size = 36; fontSize = 14; }
    return L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:rgba(29,158,117,0.85);
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:700;font-size:${fontSize}px;
        font-family:system-ui,sans-serif;
      ">${count}</div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  }
});
clusterGroup.addTo(map);

function makeIcon(color, denunciado) {
  if (denunciado && adminLogado) {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:#e53935;border:2px solid white;
        box-shadow:0 0 0 3px rgba(229,57,53,0.35),0 1px 5px rgba(0,0,0,0.35);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }
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
// 8. FLUXO DE BOAS-VINDAS
// ============================================================
function mostrarHintInstrucao() {
  document.getElementById('hint-box').style.display = 'flex';
}

function fecharBoasVindas(viaOK) {
  if (viaOK && document.getElementById('nao-mostrar-novamente').checked) {
    localStorage.setItem('uc_nao_mostrar_boasvindas', '1');
  }
  document.getElementById('modal-sobre').classList.remove('open');
  mostrarHintInstrucao();
}

document.getElementById('btn-fechar-sobre').addEventListener('click', () => fecharBoasVindas(false));
document.getElementById('btn-fechar-sobre-ok').addEventListener('click', () => fecharBoasVindas(true));
document.getElementById('modal-sobre').addEventListener('click', function(e) {
  if (e.target === this) fecharBoasVindas(false);
});

document.getElementById('titulo-urbano-comum').addEventListener('click', () => {
  document.getElementById('hint-box').style.display = 'none';
  document.getElementById('modal-sobre').classList.add('open');
});

window.addEventListener('load', () => {
  const naoMostrar = localStorage.getItem('uc_nao_mostrar_boasvindas');
  if (naoMostrar === '1') {
    mostrarHintInstrucao();
  } else {
    document.getElementById('modal-sobre').classList.add('open');
  }
});

// ============================================================
// 9. FECHAR HINT
// ============================================================
document.getElementById('close-hint').addEventListener('click', function(e) {
  e.stopPropagation();
  document.getElementById('hint-box').style.display = 'none';
});

// ============================================================
// 10. CAMPOS EXTRAS DE ALAGAMENTO
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

function setupSelectOutro(selectId, inputId) {
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(inputId);
  sel.addEventListener('change', function() {
    if (this.value === 'outro') { inp.style.display = 'block'; inp.focus(); }
    else { inp.style.display = 'none'; inp.value = ''; }
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
  if (!sel.value) return null;
  if (sel.value === 'outro') {
    const texto = document.getElementById(outroId).value.trim();
    return texto ? `Outro: ${texto}` : 'Outro';
  }
  return sel.value;
}

// ============================================================
// 11. ADICIONAR MARCADOR
// ============================================================
function adicionarMarcador({ id, lat, lng, categoria, descricao, autor_token,
    alag_frequencia, alag_caracteristica, alag_origem, denuncias, denunciasTokens }) {

  const tokens = Array.isArray(denunciasTokens) ? denunciasTokens
               : Array.isArray(denuncias)        ? denuncias
               : [];
  const qtd = tokens.length;
  const denunciado = qtd > 0;
  const cor = catColors[categoria] || '#999';

  const marker = L.marker([lat, lng], { icon: makeIcon(cor, denunciado) });

  marker._registroData = {
    id, lat, lng, categoria, descricao, autor_token,
    alag_frequencia, alag_caracteristica, alag_origem,
    denuncias: qtd, denunciasTokens: tokens, denunciado
  };
  marker.bindPopup(montarPopup(marker._registroData));

  clusterGroup.addLayer(marker);
  markers.push({ marker, cat: categoria, id, autorToken: autor_token, denunciado });
  updateCounter();
}

// ============================================================
// 12. MONTAR POPUP
// ============================================================
function montarPopup(data) {
  const ehAutor = data.autor_token === meuToken;

  const btnExcluir = (ehAutor || adminLogado)
    ? `<button onclick="excluirPonto('${data.id}')"
         style="margin-top:8px;padding:3px 10px;background:#e53935;color:white;
                border:none;border-radius:4px;cursor:pointer;font-size:11px;">
         Excluir
       </button>`
    : '';

  const jaDenunciou = Array.isArray(data.denunciasTokens)
    && data.denunciasTokens.includes(meuToken);

  const btnDenunciar = (!ehAutor && !adminLogado)
    ? (jaDenunciou
        ? `<button onclick="denunciarPonto('${data.id}')"
              style="margin-top:8px;margin-left:4px;padding:3px 10px;
                     background:#e53935;color:white;border:1px solid #e53935;
                     border-radius:4px;font-size:11px;cursor:pointer;">
              ⚑ Denunciado
           </button>`
        : `<button onclick="denunciarPonto('${data.id}')"
              style="margin-top:8px;margin-left:4px;padding:3px 10px;
                     background:white;color:#e53935;border:1px solid #e53935;
                     border-radius:4px;cursor:pointer;font-size:11px;">
              ⚑ Denunciar
           </button>`)
    : '';

  const btnIgnorarDenuncia = (adminLogado && data.denunciado)
    ? `<button onclick="ignorarDenuncias('${data.id}')"
          style="margin-top:8px;margin-left:4px;padding:3px 10px;
                 background:white;color:#888;border:1px solid #ccc;
                 border-radius:4px;cursor:pointer;font-size:11px;">
          ✕ Ignorar denúncias
       </button>`
    : '';

  const badgeDenuncias = (adminLogado && data.denunciado)
    ? `<div style="margin-top:6px;">
         <span style="display:inline-block;padding:2px 8px;
           background:#e53935;color:white;border-radius:10px;font-size:10px;font-weight:600;">
           ⚑ ${data.denuncias} denúncia${data.denuncias > 1 ? 's' : ''}
         </span>
       </div>`
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
    ${badgeDenuncias}
    <div style="display:flex;flex-wrap:wrap;gap:0;">${btnExcluir}${btnDenunciar}${btnIgnorarDenuncia}</div>
  `;
}

// ============================================================
// 13. ATUALIZAR TODOS OS POPUPS (após login/logout admin)
// ============================================================
function atualizarTodosPopups() {
  markers.forEach(({ marker }) => {
    if (!marker._registroData) return;
    const d = marker._registroData;
    const cor = catColors[d.categoria] || '#999';
    marker.setIcon(makeIcon(cor, d.denunciado));
    marker.setPopupContent(montarPopup(d));
  });
}

// ============================================================
// 14. EXCLUIR PONTO
// ============================================================
window.excluirPonto = async function(id) {
  if (!confirm('Excluir este registro?')) return;

  const { error } = await supabaseClient.from('registros').delete().eq('id', id);
  if (error) { alert('Erro ao excluir: ' + error.message); return; }

  const idx = markers.findIndex(m => m.id === id);
  if (idx !== -1) {
    clusterGroup.removeLayer(markers[idx].marker);
    markers.splice(idx, 1);
    updateCounter();
  }
};

// ============================================================
// 15. DENUNCIAR PONTO
// ============================================================
window.denunciarPonto = async function(id) {
  const item = markers.find(m => m.id === id);
  if (!item) return;

  const { data: registro, error: errGet } = await supabaseClient
    .from('registros').select('denuncias').eq('id', id).single();

  if (errGet) { alert('Erro ao buscar registro.'); return; }

  const atual = Array.isArray(registro.denuncias) ? registro.denuncias : [];
  const jaDenunciou = atual.includes(meuToken);

  // Toggle: remove se já denunciou, adiciona se não
  const novos = jaDenunciou
    ? atual.filter(t => t !== meuToken)
    : [...atual, meuToken];

  const { error: errUpd } = await supabaseClient
    .from('registros').update({ denuncias: novos }).eq('id', id);

  if (errUpd) { alert('Erro ao atualizar denúncia.'); return; }

  // Atualiza estado local e UI
  const d = item.marker._registroData;
  d.denuncias = novos.length;
  d.denunciasTokens = novos;
  d.denunciado = novos.length > 0;
  item.denunciado = d.denunciado;

  const cor = catColors[d.categoria] || '#999';
  item.marker.setIcon(makeIcon(cor, adminLogado && d.denunciado));
  item.marker.setPopupContent(montarPopup(d));
  item.marker.closePopup();
  item.marker.openPopup();
};

// ============================================================
// 15b. ADMIN — IGNORAR DENÚNCIAS
// ============================================================
window.ignorarDenuncias = async function(id) {
  const item = markers.find(m => m.id === id);
  if (!item) return;

  const { error } = await supabaseClient
    .from('registros').update({ denuncias: [] }).eq('id', id);

  if (error) { alert('Erro ao ignorar denúncias.'); return; }

  const d = item.marker._registroData;
  d.denuncias = 0;
  d.denunciasTokens = [];
  d.denunciado = false;
  item.denunciado = false;

  const cor = catColors[d.categoria] || '#999';
  item.marker.setIcon(makeIcon(cor, false));
  item.marker.setPopupContent(montarPopup(d));
  item.marker.closePopup();
  item.marker.openPopup();
};

// ============================================================
// 16. CARREGAR PONTOS DO SUPABASE
// ============================================================
async function carregarRegistros() {
  const { data, error } = await supabaseClient
    .from('registros').select('*').order('criado_em', { ascending: true });

  if (error) { console.error('Erro ao carregar registros:', error.message); return; }

  data.forEach(r => {
    const tokens = Array.isArray(r.denuncias) ? r.denuncias : [];
    adicionarMarcador({ ...r, denuncias: tokens, denunciasTokens: tokens });
  });
}

// ============================================================
// 17. CLICAR NO MAPA → ABRIR MODAL
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
// 18. SALVAR NOVO PONTO
// ============================================================
document.getElementById('btn-save').onclick = async function() {
  const cat  = document.getElementById('cat-select').value;
  const desc = document.getElementById('desc-input').value.trim();
  if (!cat) return alert('Selecione uma categoria!');

  this.disabled = true;
  this.textContent = 'Salvando...';

  const novoRegistro = {
    lat: pendingLatLng.lat, lng: pendingLatLng.lng,
    categoria: cat, descricao: desc || null,
    autor_token: meuToken, denuncias: []
  };

  if (cat === 'alagamento') {
    novoRegistro.alag_frequencia     = lerCampoAlagamento('select-frequencia',    'frequencia-outro');
    novoRegistro.alag_caracteristica = lerCampoAlagamento('select-caracteristica','caracteristica-outro');
    novoRegistro.alag_origem         = lerCampoAlagamento('select-origem',        'origem-outro');
  }

  const { data, error } = await supabaseClient
    .from('registros').insert(novoRegistro).select().single();

  this.disabled = false;
  this.textContent = 'Salvar';

  if (error) { alert('Erro ao salvar: ' + error.message); return; }

  adicionarMarcador({ ...data, denuncias: [], denunciasTokens: [] });
  document.getElementById('modal').classList.remove('open');
};

// ============================================================
// 19. FILTROS
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

    clusterGroup.clearLayers();
    markers.forEach(m => {
      if (filtroAtivo === 'todos' || m.cat === filtroAtivo) {
        clusterGroup.addLayer(m.marker);
      }
    });
  });
});

// ============================================================
// 20. ADMIN — ABRIR MODAL DE LOGIN
// ============================================================
document.getElementById('btn-admin-login').addEventListener('click', () => {
  document.getElementById('admin-erro').style.display = 'none';
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-senha').value = '';
  document.getElementById('modal-admin').classList.add('open');
});

document.getElementById('btn-admin-cancel').addEventListener('click', () =>
  document.getElementById('modal-admin').classList.remove('open'));

// ============================================================
// 21. ADMIN — LOGIN
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

  this.disabled = true; this.textContent = 'Entrando...';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });

  this.disabled = false; this.textContent = 'Entrar';

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
// 22. ADMIN — LOGOUT
// ============================================================
document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  adminLogado = false;
  document.getElementById('btn-admin-login').style.display = 'inline-block';
  document.getElementById('admin-status').style.display = 'none';
  atualizarTodosPopups();
});

// ============================================================
// 23. VERIFICAR SESSÃO SALVA
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
// 24. INICIAR
// ============================================================
carregarRegistros();