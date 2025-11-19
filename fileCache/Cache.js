// =========================
// Memory Cache Central
// =========================

const memoryCache = {
  musics_obj: { data: [], lastFetch: 0 },
  musics:     { data: [], lastFetch: 0 },
  players:    { data: [], lastFetch: 0 },
  online:     { data: [], lastFetch: 0 }
};

// TTL global: 5 horas
const CACHE_TTL = 5 * 60 * 60 * 1000;


// =========================
// TTL por chave
// =========================
const CACHE_CONFIG = {
  musics:      5 * 60 * 60 * 1000,
  musics_obj:  5 * 60 * 60 * 1000,
  players:     60 * 1000,
  online:      60 * 1000,
};

// =====================================================
// 🔍 Verifica se uma chave está expirada
// =====================================================
function isExpired(key) {
  if (!memoryCache[key]) return true;

  const ttl = CACHE_CONFIG[key] || 0;
  return Date.now() - memoryCache[key].lastFetch > ttl;
}

// =====================================================
// 🔥 Limpa todo o cache (sem perder referências)
// =====================================================
function clearAllCache() {
  for (const key in memoryCache) {
    memoryCache[key].data.length = 0;
    memoryCache[key].lastFetch = 0;
  }
}

// =====================================================
// 🔍 Retorna a tabela de uma chave
//    (ou null se expirado)
// =====================================================
function GetKeyDt(key) {
  if (!memoryCache[key]) return null;
  if (isExpired(key)) return null;
  return memoryCache[key];
}

// =====================================================
// ❌ Apaga somente uma chave do cache
// =====================================================
function DelKeyDt(key) {
  if (!memoryCache[key]) return false;

  memoryCache[key].data.length = 0;
  memoryCache[key].lastFetch = 0;
  return true;
}

// =====================================================
// ✏ Atualiza os dados da chave mantendo referência
// =====================================================
function UpdKeyDt(key, table) {
  if (!memoryCache[key]) return false;
  if (!Array.isArray(memoryCache[key].data)) return false;

  if (!Array.isArray(table)) table = [table];

  memoryCache[key].data.length = 0;
  memoryCache[key].data.push(...table);
  memoryCache[key].lastFetch = Date.now();
  return true;
}

// =====================================================
// 🌐 GetOrFetch (carrega do cache OU busca e atualiza)
// =====================================================
async function GetOrFetch(key, fetchFunction) {
  const item = memoryCache[key];

  if (item && !isExpired(key)) {
    return item.data;
  }

  const fresh = await fetchFunction();
  UpdKeyDt(key, fresh);

  return fresh;
}

// =====================================================
// 📤 Exportações
// =====================================================
export {
  memoryCache,
  CACHE_TTL,
  CACHE_CONFIG,
  clearAllCache,
  GetKeyDt,
  DelKeyDt,
  UpdKeyDt,
  GetOrFetch,
};


