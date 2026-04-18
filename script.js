// ============================================================
// 1. CONFIGURAÇÃO DO SUPABASE
// ============================================================
const supabaseUrl = 'https://qzycmnnjtzuvshkasypr.supabase.co';
const supabaseKey = 'sb_publishable_aLM2nvWKe0Tay9v9GStaDQ_T1nKI0tJ';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ============================================================
// 2. TOKEN DO AUTOR (identifica quem criou o ponto, sem login)
// ============================================================
let meuToken = localStorage.getItem('meu_token_autor');
if (!meuToken) {
  meuToken = crypto.randomUUID();
  localStorage.setItem('meu_token_autor', meuToken);
}

// ============================================================
// 3. CORES E LABELS DAS CATEGORIAS
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
// 4. INICIALIZAÇÃO DO MAPA
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
// 5. LEGENDA
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
// 6. ESTADO LOCAL
// ============================================================
let markers = []; // { marker, cat, id, autorToken }
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
// 7. ADICIONAR MARCADOR NA TELA
// (usado tanto ao salvar um novo quanto ao carregar do banco)
// ============================================================
function adicionarMarcador({ id, lat, lng, categoria, descricao, autor_token }) {
  const cor = catColors[categoria] || '#999';
  const marker = L.marker([lat, lng], { icon: makeIcon(cor) });

  const ehAutor = autor_token === meuToken;
  const popupContent = `
    <strong>${catLabels[categoria] || categoria}</strong>
    ${descricao ? `<p style="margin:4px 0 0">${descricao}</p>` : ''}
    ${ehAutor
      ? `<button onclick="excluirPonto('${id}')"
           style="margin-top:8px;padding:3px 10px;background:#e53935;color:white;
                  border:none;border-radius:4px;cursor:pointer;font-size:11px;">
           Excluir
         </button>`
      : ''}
  `;
  marker.bindPopup(popupContent);

  // Respeita o filtro que estiver ativo no momento
  if (filtroAtivo === 'todos' || filtroAtivo === categoria) {
    marker.addTo(map);
  }

  markers.push({ marker, cat: categoria, id, autorToken: autor_token });
  updateCounter();
}

// ============================================================
// 8. EXCLUIR PONTO (só o autor consegue, graças ao autor_token)
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
// 9. CARREGAR PONTOS EXISTENTES DO SUPABASE AO ABRIR A PÁGINA
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
// 10. CLICAR NO MAPA → ABRIR MODAL
// ============================================================
map.on('click', function(e) {
  pendingLatLng = e.latlng;
  document.getElementById('cat-select').value = '';
  document.getElementById('desc-input').value = '';
  document.getElementById('modal').classList.add('open');
});

document.getElementById('btn-cancel').onclick = () =>
  document.getElementById('modal').classList.remove('open');

// ============================================================
// 11. SALVAR NOVO PONTO NO SUPABASE
// ============================================================
document.getElementById('btn-save').onclick = async function() {
  const cat  = document.getElementById('cat-select').value;
  const desc = document.getElementById('desc-input').value.trim();
  if (!cat) return alert('Selecione uma categoria!');

  // Desabilita o botão para evitar duplo clique
  this.disabled = true;
  this.textContent = 'Salvando...';

  const { data, error } = await supabaseClient
    .from('registros')
    .insert({
      lat:         pendingLatLng.lat,
      lng:         pendingLatLng.lng,
      categoria:   cat,
      descricao:   desc || null,
      autor_token: meuToken
    })
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
// 12. FILTROS POR CATEGORIA
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
// 13. FECHAR HINT
// ============================================================
document.getElementById('close-hint').addEventListener('click', function(e) {
  e.stopPropagation();
  document.getElementById('hint-box').style.display = 'none';
});

// ============================================================
// 14. INICIAR
// ============================================================
carregarRegistros();