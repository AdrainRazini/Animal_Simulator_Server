// ====================
// Servidor Principal Unificado
// ====================
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs"; 

// Coleção Fire Base
import { query, where } from "firebase/firestore";
import { fileURLToPath } from "url";
import { collection, getDocs, addDoc, updateDoc} from "firebase/firestore";
import { db } from "./firebase.js";

// Coleção de Memoria
import { memoryCache, CACHE_TTL, clearAllCache, GetKeyDt, DelKeyDt, UpdKeyDt } from "./fileCache/Cache.js"; // Memoria Iportada

// Corrigir __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ====================
//  Porta 3000 
// ====================
const app = express();
const PORT = process.env.PORT || 3000;

// ====================
// Middlewares
// ====================
app.use(cors({ origin: "*" }));
app.use(express.json());

// ====================
// 📁 Servir arquivos estáticos
// ====================
// Serve os arquivos .json (tipo GitHub Raw)
app.use("/data", express.static(path.join(__dirname, "data")));
// Serve os arquivos .lua (tipo GitHub Raw)
app.use("/lua", express.static(path.join(__dirname, "lua")));
// Serve HTML, CSS, JS da pasta "public"
app.use(express.static(path.join(__dirname, "public")));



// Caminhos para os caches locais
const dataDir = path.join(__dirname, "data");
const musicsFile = path.join(dataDir, "musics.json");
const musicsObjFile = path.join(dataDir, "musics_obj.json");
const playersFile = path.join(dataDir, "players.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log("📁 Pasta 'data' criada automaticamente");
}


// ====================
// 🔸 Cache em memória para reduzir leituras no Firestore
// ====================

// verificar 
const isReadOnly = process.env.VERCEL || process.env.AWS_REGION || process.env.NODE_ENV === "production";



// Ler cache local (somente local)
function readLocalCache(file) {
  if (isReadOnly) return []; // 🔒 não tenta ler em ambiente read-only
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
    return [];
  } catch (err) {
    console.warn(`⚠️ Erro ao ler cache local: ${file}`, err);
    return [];
  }
}

// Salvar cache local (somente local)
function writeLocalCache(file, data) {
  if (isReadOnly) return; // 🔒 ignora em produção
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`❌ Erro ao salvar cache local: ${file}`, err);
  }
}

async function getDataWithCache(key, file, firestoreCollection) {
  const now = Date.now();

  // 1. Memória
  if (memoryCache[key].data.length > 0 && (now - memoryCache[key].lastFetch < CACHE_TTL)) {
    return memoryCache[key].data;
  }

  // 2. Local (se permitido)
  if (!isReadOnly) {
    const local = readLocalCache(file);
    if (local.length > 0) {
      memoryCache[key] = { data: local, lastFetch: now };
      return local;
    }
  }

  // 3. Firestore
  const snapshot = await getDocs(collection(db, firestoreCollection));
  const docs = snapshot.docs.map(doc => doc.data());
  memoryCache[key] = { data: docs, lastFetch: now };
  if (!isReadOnly) writeLocalCache(file, docs);
  return docs;
}

// ====================
// 🔧 Função Genérica para Rotas de Busca
// ====================
function createDataRoute(endpoint, cacheKey, localFile, firestoreCollection) {
  app.get(endpoint, async (req, res) => {
    try {
      const now = Date.now();

      // ⚡ 1. Cache em memória
      if (memoryCache[cacheKey].data.length > 0 && (now - memoryCache[cacheKey].lastFetch < CACHE_TTL)) {
        console.log(`⚡ ${endpoint} → cache: memória`);
        return res.json(memoryCache[cacheKey].data);
      }

      // ⚡ 2. Cache local (disco)
      if (!isReadOnly) {
        const local = readLocalCache(localFile);
        if (local.length > 0) {
          memoryCache[cacheKey] = { data: local, lastFetch: now };
          console.log(`⚡ ${endpoint} → cache: disco`);
          return res.json(local);
        }
      }

      // ⚡ 3. Firestore (fallback)
      const data = await getDataWithCache(cacheKey, localFile, firestoreCollection);
      console.log(`⚡ ${endpoint} → fonte: Firestore`);
      res.json(data);
    } catch (err) {
      console.error(`❌ Erro em ${endpoint}:`, err);
      res.status(500).json({ error: err.message });
    }
  });
}


// ====================
// API: Gerenciar Jogadores
// ====================


// Função auxiliar para buscar jogador por ID
async function getPlayerById(id) {
  const numericId = Number(id);
  const q = query(collection(db, "players"), where("Id_player", "==", numericId));
  const snapshot = await getDocs(q);
  return snapshot.docs[0]; // retorna undefined se não existir
}

// Adicionar ou Atualizar Jogador
app.post("/api/players", async (req, res) => {
  const { Name, Id_player, Tag } = req.body;

  if (!Name) return res.status(400).json({ error: "Campo 'Name' é obrigatório" });
  if (!Id_player) return res.status(400).json({ error: "Campo 'Id_player' é obrigatório" });
  if (!/^\d+$/.test(Id_player)) return res.status(400).json({ error: "O campo 'Id_player' deve conter apenas números" });
  if (!Tag) return res.status(400).json({ error: "Campo 'Tag' é obrigatório" });

  try {
    const numericId = Number(Id_player);
    const existingDoc = await getPlayerById(numericId);

    if (existingDoc) {
      const data = existingDoc.data();

      if (data.Name !== Name || data.Tag !== Tag) {
        await updateDoc(existingDoc.ref, { Name, Tag, updatedAt: new Date().toISOString() });
        console.log(`♻️ Jogador atualizado: ${Name} (${numericId}) [${Tag}]`);

        // Atualiza cache
        memoryCache.players.data = memoryCache.players.data.map(p => p.Id_player === numericId ? { Name, Id_player: numericId, Tag } : p);
        return res.json({ success: true, message: "Jogador atualizado com sucesso" });
      }

      return res.json({ success: false, message: "Jogador já cadastrado e atualizado" });
    }

    // Adiciona novo jogador
    const newPlayer = { Name, Id_player: numericId, Tag, createdAt: new Date().toISOString() };
    await addDoc(collection(db, "players"), newPlayer);
    console.log(`👤 Novo jogador adicionado: ${Name} (${numericId}) [${Tag}]`);

    // Atualiza cache
    memoryCache.players.data.push(newPlayer);

    res.json({ success: true, message: "Jogador adicionado com sucesso" });
  } catch (err) {
    console.error("❌ Erro ao adicionar/atualizar jogador:", err);
    res.status(500).json({ error: err.message });
  }
});


// Atualizar tag de jogador (banir/desbanir)
app.put("/api/players/:id", async (req, res) => {
  const { id } = req.params;
  const { Tag } = req.body;

  if (!Tag) return res.status(400).json({ error: "Campo 'Tag' é obrigatório" });

  try {
    const playerDoc = await getPlayerById(id);
    if (!playerDoc) return res.status(404).json({ error: "Jogador não encontrado" });

    await updateDoc(playerDoc.ref, { Tag, updatedAt: new Date().toISOString() });
    console.log(`⚙️ Jogador ${id} atualizado para: ${Tag}`);

    // Atualiza cache
    memoryCache.players.data = memoryCache.players.data.map(p => p.Id_player == id ? { ...p, Tag } : p);

    res.json({ success: true, message: `Jogador ${id} atualizado para ${Tag}` });
  } catch (err) {
    console.error("❌ Erro ao atualizar jogador:", err);
    res.status(500).json({ error: err.message });
  }
});


// Obter jogador por ID 
app.set('trust proxy', true);  // se estiver atrás de proxy (ex: Vercel, Nginx)

app.get("/api/player/:id", async (req, res) => {
// casso erro delete
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress);
  console.log("🔍 IP do cliente:", ip);

  let { id } = req.params;

  try {
    // 0️⃣ Remove espaços e mantém só números
    id = id.replace(/\D+/g, "");

    const numericId = Number(id);
    if (!numericId || numericId <= 0) {
      return res.status(202).json({
        success: false,
        message: "ID inválido",
        Tag: "Livre",
        cached: false
      });
    }

    // 1️⃣ Tenta buscar normalmente no Firestore ou cache real
    const playerDoc = await getPlayerById(numericId);

    // 2️⃣ Se não existir → cria cache temporário e retorna 202 (sem erro)
    if (!playerDoc) {
    //202 mas o roblox acha que é erro 
      return res.status(200).json({
        success: false,
        message: "Jogador não encontrado (cache criado)",
        Id_player: numericId,
        Name: "Desconhecido",
        Tag: "Livre",
        cached: true
      });

    }

    // 3️⃣ Se existe → responde normalmente
    const data = playerDoc.data();
    return res.status(200).json({
      success: true,
      Id_player: data.Id_player,
      Name: data.Name,
      Tag: data.Tag || "Livre",
      cached: false
    });

  } catch (err) {
    console.error("❌ Erro ao buscar jogador:", err);

    // Mesmo em erro interno → 202 para não quebrar o Lua
    return res.status(202).json({
      success: false,
      message: "Erro interno, mas resposta segura enviada",
      Tag: "Livre",
      error: err.message,
      cached: false
    });
  }
});



// ====================
//  API: Gerenciar IDs de músicas (Firebase)
// ====================

//  API: Gerenciar IDs de músicas (Firebase) — VERSÃO ATUALIZADA
app.post("/api/musics_obj", async (req, res) => {
  const Name = req.body.Name || req.body.name;
  const Obj = Number(req.body.Obj || req.body.obj);

  if (!Name || isNaN(Obj)) return res.status(400).json({ error: "Campos inválidos" });

  // 1. Checa cache em memória
  if (memoryCache.musics_obj.data.some(item => item.Obj === Obj)) {
    return res.status(400).json({ error: "Obj já existe no cache" });
  }

  try {
    // 2. Checa Firestore via query
    const q = query(collection(db, "musics_obj"), where("Obj", "==", Obj));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) return res.status(400).json({ error: "Obj já existe no Firestore" });

    // 3. Adiciona
    const newDoc = { Name, Obj };
    await addDoc(collection(db, "musics_obj"), newDoc);

    // 4. Atualiza caches
    const localCache = readLocalCache(musicsObjFile);
    const updatedCache = [...localCache, newDoc];
    writeLocalCache(musicsObjFile, updatedCache);

    memoryCache.musics_obj.data.push(newDoc);
    memoryCache.musics_obj.lastFetch = Date.now();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// GET: Retornar todos os objetos no formato LUA (Module) usando cache local
app.get("/api/musics_obj_lua", async (req, res) => {
  try {
    const now = Date.now();

    // ⚡ 1. Cache em memória
    if (memoryCache.musics_obj.data.length > 0 && (now - memoryCache.musics_obj.lastFetch < CACHE_TTL)) {
      console.log("⚡ /api/musics_obj_lua → cache: memória");
      return res.type("text/plain").send(convertToLua(memoryCache.musics_obj.data));
    }

    //  2. Cache local (disco)
    const localCache = readLocalCache(musicsObjFile);
    if (localCache.length > 0) {
      memoryCache.musics_obj = { data: localCache, lastFetch: now };
      console.log("⚡ /api/musics_obj_lua → cache: disco");
      return res.type("text/plain").send(convertToLua(localCache));
    }

    //  3. Firestore (fallback)
    const snapshot = await getDocs(collection(db, "musics_obj"));
    const musics = snapshot.docs.map(doc => doc.data());

    memoryCache.musics_obj = { data: musics, lastFetch: now };
    writeLocalCache(musicsObjFile, musics);
    console.log("⚡ /api/musics_obj_lua → fonte: Firestore");

    res.type("text/plain").send(convertToLua(musics));

  } catch (err) {
    console.error("❌ Erro ao gerar musics_obj_lua:", err);
    res.status(500).send("-- Erro ao gerar tabela Lua");
  }
});

function convertToLua(musics) {
  return `return {\n${musics.map(m => `  {name="${m.Name}", Obj=${m.Obj}}`).join(",\n")}\n}`;
 // return `return {\n${musics.map(m => `  {name=${JSON.stringify(m.Name)}, Obj=${m.Obj}}`).join(",\n")}\n}`;
}



// Adicionar um novo ID
app.post("/api/musics", async (req, res) => {
  const id = req.body.id || req.body.texto;

  if (!id) return res.status(400).json({ error: "Campo 'id' é obrigatório" });
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "O campo 'id' deve conter apenas números" });

  const numericId = Number(id);

  try {
    // 🔹 Verifica se o ID já existe via query
    const q = query(collection(db, "musics"), where("id", "==", numericId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return res.status(400).json({ error: "ID já existe" });

    // 🔹 Adiciona no Firestore
    await addDoc(collection(db, "musics"), { id: numericId });
    console.log("📩 Novo ID adicionado:", numericId);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao salvar no Firestore:", err);
    res.status(500).json({ error: err.message });
  }
});




// Criar rotas automáticas de leitura
createDataRoute("/api/musics", "musics", musicsFile, "musics");
createDataRoute("/api/musics_obj", "musics_obj", musicsObjFile, "musics_obj");

// ====================
// Página inicial
// ====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Detecta se está rodando em ambiente Serverless (Vercel, AWS, etc)
const isServerless = process.env.VERCEL || process.env.AWS_REGION;
// Se for ambiente local → inicia com app.listen()
// Se for ambiente serverless → exporta app (sem escutar porta)
if (!isServerless) {
  app.listen(PORT, () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`📁 Lua: http://localhost:${PORT}/lua/mod_animal_simulator_v2.lua`);
    console.log(`🎵 API: http://localhost:${PORT}/api/musics`);
  });
} else {
  console.log("⚡ Executando em ambiente serverless (Vercel)");
}

// Exporta o app para ser usado pela Vercel
export default app;
