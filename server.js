// server.js (versão atualizada)
// ====================
// Servidor Principal Unificado - Versão com Cache, RateLimit e proteção contra thundering-herd
// ====================
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { query, where } from "firebase/firestore";
import { fileURLToPath } from "url";
import { collection, getDocs, addDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { memoryCache as importedMemoryCache, CACHE_TTL as importedTTL } from "./fileCache/Cache.js";

// Corrigir __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====================
//  Porta
// ====================
const app = express();
const PORT = process.env.PORT || 3000;

// ====================
// Middlewares
// ====================
app.use(cors({ origin: "*" }));
app.use(express.json());

// ====================
// Static files
// ====================
app.use("/data", express.static(path.join(__dirname, "data")));
app.use("/lua", express.static(path.join(__dirname, "lua")));
app.use(express.static(path.join(__dirname, "public")));

// ====================
// Configs
// ====================
const dataDir = path.join(__dirname, "data");
const musicsFile = path.join(dataDir, "musics.json");
const musicsObjFile = path.join(dataDir, "musics_obj.json");
const playersFile = path.join(dataDir, "players.json");

if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); console.log("📁 Pasta 'data' criada automaticamente"); } catch (e) { console.warn("Falha ao criar pasta data:", e); }
}

// Detecta ambiente serverless (Vercel/AWS)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_REGION);
const isReadOnly = isServerless || process.env.NODE_ENV === "production";
const CACHE_TTL = importedTTL || (1000 * 60 * 2); // 2 minutos padrão se não definido

// ====================
// Memory cache safe init
// ====================
const memoryCache = {
  musics: { data: [], lastFetch: 0 },
  musics_obj: { data: [], lastFetch: 0 },
  players: { data: [], lastFetch: 0 },
  // merge with imported cache if exists (non-destructive)
  ...importedMemoryCache
};

// In-flight fetches to dedupe concurrent Firestore calls
const inFlightFetches = {};

// ====================
// Utils: read/write local cache (somente quando não read-only)
// ====================
function readLocalCache(file) {
  if (isReadOnly) return [];
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`⚠️ Erro ao ler cache local ${file}:`, err.message);
  }
  return [];
}

function writeLocalCache(file, data) {
  if (isReadOnly) return;
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn(`⚠️ Erro ao escrever cache local ${file}:`, err.message);
  }
}

// Promise.race with timeout helper
function withTimeout(promise, ms, fallback) {
  let id;
  const timeout = new Promise((resolve, reject) => {
    id = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).then((res) => {
    clearTimeout(id);
    return res;
  });
}

// ====================
// Rate limiter middleware (sliding window simples)
// ====================
const RATE_LIMIT = {
  maxRequests: Number(process.env.RATE_MAX) || 8, // requests
  windowMs: Number(process.env.RATE_WINDOW_MS) || 1000, // per x ms
};

const ipBuckets = new Map();

function rateLimiter(req, res, next) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  const key = ip;

  let bucket = ipBuckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    ipBuckets.set(key, bucket);
  }

  // remove timestamps older than window
  bucket.timestamps = bucket.timestamps.filter(ts => now - ts < RATE_LIMIT.windowMs);

  if (bucket.timestamps.length >= RATE_LIMIT.maxRequests) {
    // bloqueia temporariamente
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT.windowMs / 1000)));
    return res.status(429).json({ error: "Too Many Requests - rate limit" });
  }

  bucket.timestamps.push(now);
  next();
}

// Aplicar rate limiter só nas rotas que causam mais pressão
app.use(['/api/player', '/api/musics', '/api/musics_obj', '/lua'], rateLimiter);

// ====================
// getDataWithCache - com dedupe (inFlightFetches)
// ====================
async function fetchFromFirestore(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(d => d.data());
}

async function getDataWithCache(key, file, firestoreCollection) {
  const now = Date.now();

  // 1) Memória
  if (Array.isArray(memoryCache[key].data) && memoryCache[key].data.length > 0 && (now - memoryCache[key].lastFetch < CACHE_TTL)) {
    // console.log(`⚡ getDataWithCache(${key}) → memória`);
    return memoryCache[key].data;
  }

  // 2) Disco (quando permitido)
  if (!isReadOnly) {
    const local = readLocalCache(file);
    if (Array.isArray(local) && local.length > 0) {
      memoryCache[key] = { data: local, lastFetch: now };
      console.log(`⚡ getDataWithCache(${key}) → disco`);
      return local;
    }
  }

  // 3) Firestore (dedupe concurrent calls)
  if (inFlightFetches[key]) {
    // espera a fetch em andamento
    const result = await inFlightFetches[key];
    return result || [];
  }

  // cria fetch e coloca em inFlight
  const fetchPromise = (async () => {
    try {
      // Limitar tempo de leitura do Firestore (2s)
      const docs = await withTimeout(fetchFromFirestore(firestoreCollection), 2000, []);
      memoryCache[key] = { data: docs, lastFetch: Date.now() };
      if (!isReadOnly) writeLocalCache(file, docs);
      console.log(`⚡ getDataWithCache(${key}) → Firestore (fetched ${docs.length})`);
      return docs;
    } catch (err) {
      console.error(`❌ Erro ao buscar ${firestoreCollection} do Firestore:`, err.message);
      return [];
    } finally {
      // limpa a promise inFlight
      delete inFlightFetches[key];
    }
  })();

  inFlightFetches[key] = fetchPromise;
  return fetchPromise;
}

// ====================
// Helper para criar rotas de dados (mantido estilo original)
// ====================
function createDataRoute(endpoint, cacheKey, localFile, firestoreCollection, options = {}) {
  app.get(endpoint, async (req, res) => {
    try {
      const now = Date.now();

      // 1: memoria
      if (Array.isArray(memoryCache[cacheKey].data) && memoryCache[cacheKey].data.length > 0 && (now - memoryCache[cacheKey].lastFetch < CACHE_TTL)) {
        res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL/1000)}`);
        console.log(`⚡ ${endpoint} → cache: memória`);
        return res.json(memoryCache[cacheKey].data);
      }

      // 2: disco
      if (!isReadOnly) {
        const local = readLocalCache(localFile);
        if (Array.isArray(local) && local.length > 0) {
          memoryCache[cacheKey] = { data: local, lastFetch: now };
          res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL/1000)}`);
          console.log(`⚡ ${endpoint} → cache: disco`);
          return res.json(local);
        }
      }

      // 3: Firestore (via getDataWithCache)
      const data = await getDataWithCache(cacheKey, localFile, firestoreCollection);
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL/1000)}`);
      res.json(data);
    } catch (err) {
      console.error(`❌ Erro em ${endpoint}:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

// Criar rotas
createDataRoute("/api/musics", "musics", musicsFile, "musics");
createDataRoute("/api/musics_obj", "musics_obj", musicsObjFile, "musics_obj");
createDataRoute("/api/players", "players", playersFile, "players");

// ====================
// Players APIs (mantive lógica, com pequenas proteções)
// ====================
async function getPlayerById(id) {
  const numericId = Number(id);
  const q = query(collection(db, "players"), where("Id_player", "==", numericId));
  const snapshot = await getDocs(q);
  return snapshot.docs[0];
}

// Adicionar / atualizar jogador
app.post("/api/players", async (req, res) => {
  const { Name, Id_player, Tag } = req.body;
  if (!Name) return res.status(400).json({ error: "Campo 'Name' é obrigatório" });
  if (!Id_player) return res.status(400).json({ error: "Campo 'Id_player' é obrigatório" });
  if (!/^\d+$/.test(String(Id_player))) return res.status(400).json({ error: "O campo 'Id_player' deve conter apenas números" });
  if (!Tag) return res.status(400).json({ error: "Campo 'Tag' é obrigatório" });

  try {
    const numericId = Number(Id_player);
    const existingDoc = await getPlayerById(numericId);
    if (existingDoc) {
      const data = existingDoc.data();
      if (data.Name !== Name || data.Tag !== Tag) {
        await updateDoc(existingDoc.ref, { Name, Tag, updatedAt: new Date().toISOString() });
        console.log(`♻️ Jogador atualizado: ${Name} (${numericId}) [${Tag}]`);
        memoryCache.players.data = memoryCache.players.data.map(p => p.Id_player === numericId ? { Name, Id_player: numericId, Tag } : p);
        return res.json({ success: true, message: "Jogador atualizado com sucesso" });
      }
      return res.json({ success: false, message: "Jogador já cadastrado e atualizado" });
    }

    const newPlayer = { Name, Id_player: numericId, Tag, createdAt: new Date().toISOString() };
    await addDoc(collection(db, "players"), newPlayer);
    console.log(`👤 Novo jogador adicionado: ${Name} (${numericId}) [${Tag}]`);
    memoryCache.players.data.push(newPlayer);
    res.json({ success: true, message: "Jogador adicionado com sucesso" });
  } catch (err) {
    console.error("❌ Erro ao adicionar/atualizar jogador:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Listar todos
app.get("/api/players", async (req, res) => {
  try {
    const now = Date.now();
    if (memoryCache.players.data.length > 0 && (now - memoryCache.players.lastFetch < CACHE_TTL)) {
      return res.json(memoryCache.players.data);
    }
    const snapshot = await getDocs(collection(db, "players"));
    const players = snapshot.docs.map(doc => doc.data());
    memoryCache.players = { data: players, lastFetch: now };
    res.json(players);
  } catch (err) {
    console.error("❌ Erro ao listar jogadores:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/players/:id", async (req, res) => {
  const { id } = req.params;
  const { Tag } = req.body;
  if (!Tag) return res.status(400).json({ error: "Campo 'Tag' é obrigatório" });

  try {
    const playerDoc = await getPlayerById(id);
    if (!playerDoc) return res.status(404).json({ error: "Jogador não encontrado" });
    await updateDoc(playerDoc.ref, { Tag, updatedAt: new Date().toISOString() });
    console.log(`⚙️ Jogador ${id} atualizado para: ${Tag}`);
    memoryCache.players.data = memoryCache.players.data.map(p => p.Id_player == id ? { ...p, Tag } : p);
    res.json({ success: true, message: `Jogador ${id} atualizado para ${Tag}` });
  } catch (err) {
    console.error("❌ Erro ao atualizar jogador:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ====================
// API single player (com logs de IP / proteção)
// ====================
app.set('trust proxy', true);

app.get("/api/player/:id", async (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress) || 'unknown';
  console.log("🔍 IP do cliente:", ip);

  let { id } = req.params;
  try {
    id = String(id).replace(/\D+/g, "");
    const numericId = Number(id);
    if (!numericId || numericId <= 0) {
      return res.status(202).json({ success: false, message: "ID inválido", Tag: "Livre", cached: false });
    }

    // Tenta cache local antes de ir ao Firestore
    // Primeiro verifica memória (rápido)
    const now = Date.now();
    const foundInMem = memoryCache.players.data.find(p => p.Id_player === numericId);
    if (foundInMem) {
      return res.status(200).json({ success: true, Id_player: foundInMem.Id_player, Name: foundInMem.Name, Tag: foundInMem.Tag || "Livre", cached: true });
    }

    // Se não tem, checa Firestore via getPlayerById (com timeout)
    const playerDoc = await withTimeout(getPlayerById(numericId), 1500, null);
    if (!playerDoc) {
      // cria cache temporário local (evita spawners repetidos)
      memoryCache.players.data.push({ Id_player: numericId, Name: "Desconhecido", Tag: "Livre", cached_fake: true });
      memoryCache.players.lastFetch = Date.now();
      return res.status(202).json({ success: false, message: "Jogador não encontrado (cache criado)", Id_player: numericId, Name: "Desconhecido", Tag: "Livre", cached: true });
    }

    const data = playerDoc.data();
    return res.status(200).json({ success: true, Id_player: data.Id_player, Name: data.Name, Tag: data.Tag || "Livre", cached: false });
  } catch (err) {
    console.error("❌ Erro ao buscar jogador:", err.message);
    return res.status(202).json({ success: false, message: "Erro interno, mas resposta segura enviada", Tag: "Livre", error: err.message, cached: false });
  }
});

// ====================
// Music objects endpoints (post/get) - mantive sua lógica, com writeLocalCache protegido
// ====================
app.post("/api/musics_obj", async (req, res) => {
  const Name = req.body.Name || req.body.name;
  const Obj = Number(req.body.Obj || req.body.obj);
  if (!Name || isNaN(Obj)) return res.status(400).json({ error: "Campos inválidos" });

  if (memoryCache.musics_obj.data.some(item => item.Obj === Obj)) {
    return res.status(400).json({ error: "Obj já existe no cache" });
  }

  try {
    const q = query(collection(db, "musics_obj"), where("Obj", "==", Obj));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return res.status(400).json({ error: "Obj já existe no Firestore" });

    const newDoc = { Name, Obj };
    await addDoc(collection(db, "musics_obj"), newDoc);

    const localCache = readLocalCache(musicsObjFile);
    const updatedCache = Array.isArray(localCache) ? [...localCache, newDoc] : [newDoc];
    writeLocalCache(musicsObjFile, updatedCache);

    memoryCache.musics_obj.data.push(newDoc);
    memoryCache.musics_obj.lastFetch = Date.now();

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro em POST /api/musics_obj:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/musics_obj", async (req, res) => {
  try {
    const now = Date.now();
    if (memoryCache.musics_obj.data.length > 0 && (now - memoryCache.musics_obj.lastFetch < CACHE_TTL)) {
      console.log("⚡ /api/musics_obj → cache: memória");
      return res.json(memoryCache.musics_obj.data);
    }
    const localCache = readLocalCache(musicsObjFile);
    if (localCache.length > 0) {
      memoryCache.musics_obj = { data: localCache, lastFetch: now };
      console.log("⚡ /api/musics_obj → cache: disco");
      return res.json(localCache);
    }
    const snapshot = await getDocs(collection(db, "musics_obj"));
    const musics = snapshot.docs.map(doc => doc.data());
    memoryCache.musics_obj = { data: musics, lastFetch: now };
    writeLocalCache(musicsObjFile, musics);
    console.log("⚡ /api/musics_obj → fonte: Firestore");
    res.json(musics);
  } catch (err) {
    console.error("❌ Erro ao buscar musics_obj:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/musics_obj_lua", async (req, res) => {
  try {
    const now = Date.now();
    if (memoryCache.musics_obj.data.length > 0 && (now - memoryCache.musics_obj.lastFetch < CACHE_TTL)) {
      console.log("⚡ /api/musics_obj_lua → cache: memória");
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL/1000)}`);
      return res.type("text/plain").send(convertToLua(memoryCache.musics_obj.data));
    }
    const localCache = readLocalCache(musicsObjFile);
    if (localCache.length > 0) {
      memoryCache.musics_obj = { data: localCache, lastFetch: now };
      console.log("⚡ /api/musics_obj_lua → cache: disco");
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL/1000)}`);
      return res.type("text/plain").send(convertToLua(localCache));
    }
    const snapshot = await getDocs(collection(db, "musics_obj"));
    const musics = snapshot.docs.map(doc => doc.data());
    memoryCache.musics_obj = { data: musics, lastFetch: Date.now() };
    writeLocalCache(musicsObjFile, musics);
    console.log("⚡ /api/musics_obj_lua → fonte: Firestore");
    res.type("text/plain").send(convertToLua(musics));
  } catch (err) {
    console.error("❌ Erro ao gerar musics_obj_lua:", err.message);
    res.status(500).send("-- Erro ao gerar tabela Lua");
  }
});

function convertToLua(musics) {
  return `return {\n${musics.map(m => `  {name=${JSON.stringify(m.Name)}, Obj=${m.Obj}}`).join(",\n")}\n}`;
}

// Adicionar novo ID às músicas (post)
app.post("/api/musics", async (req, res) => {
  const id = req.body.id || req.body.texto;
  if (!id) return res.status(400).json({ error: "Campo 'id' é obrigatório" });
  if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: "O campo 'id' deve conter apenas números" });

  try {
    const numericId = Number(id);
    const q = query(collection(db, "musics"), where("id", "==", numericId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return res.status(400).json({ error: "ID já existe" });
    await addDoc(collection(db, "musics"), { id: numericId });
    console.log("📩 Novo ID adicionado:", numericId);
    // opcional: atualizar cache local/in-memory só se quiser
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao salvar no Firestore:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/musics", async (req, res) => {
  try {
    const now = Date.now();
    if (memoryCache.musics.data.length > 0 && (now - memoryCache.musics.lastFetch < CACHE_TTL)) {
      console.log("⚡ /api/musics → cache: memória");
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL/1000)}`);
      return res.json(memoryCache.musics.data);
    }
    const localCache = readLocalCache(musicsFile);
    if (localCache.length > 0) {
      memoryCache.musics = { data: localCache, lastFetch: now };
      console.log("⚡ /api/musics → cache: disco");
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL/1000)}`);
      return res.json(localCache);
    }
    const snapshot = await getDocs(collection(db, "musics"));
    const list = snapshot.docs.map(doc => doc.data().id);
    memoryCache.musics = { data: list, lastFetch: Date.now() };
    writeLocalCache(musicsFile, list);
    console.log("⚡ /api/musics → fonte: Firestore");
    res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL/1000)}`);
    res.json(list);
  } catch (err) {
    console.error("❌ Erro ao ler do Firestore:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Inicialização
if (!isServerless) {
  app.listen(PORT, () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`📁 Lua: http://localhost:${PORT}/lua/mod_animal_simulator_v2.lua`);
    console.log(`🎵 API: http://localhost:${PORT}/api/musics`);
  });
} else {
  console.log("⚡ Executando em ambiente serverless (Vercel)");
}

// Segurança: erros globais (não deixa o processo morrer silenciosamente)
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});

export default app;
