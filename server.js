// ====================
// Servidor Principal Unificado
// ====================
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs"; 

import { fileURLToPath } from "url";
import { collection, getDocs, addDoc, updateDoc} from "firebase/firestore";
import { db } from "./firebase.js";

// Corrigir __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminhos para os caches locais
const dataDir = path.join(__dirname, "data");
const musicsFile = path.join(dataDir, "musics.json");
const musicsObjFile = path.join(dataDir, "musics_obj.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log("📁 Pasta 'data' criada automaticamente");
}

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


// ====================
// 👥 API: Gerenciar Jogadores
// ====================

// ➕ Adicionar ou Atualizar Jogador
app.post("/api/players", async (req, res) => {
  const { Name, Id_player, Tag } = req.body;

  // 🧩 Validação básica
  if (!Name) return res.status(400).json({ error: "Campo 'Name' é obrigatório" });
  if (!Id_player) return res.status(400).json({ error: "Campo 'Id_player' é obrigatório" });
  if (!/^\d+$/.test(Id_player)) return res.status(400).json({ error: "O campo 'Id_player' deve conter apenas números" });
  if (!Tag) return res.status(400).json({ error: "Campo 'Tag' é obrigatório" });

  const numericId = Number(Id_player);

  try {
    const playersRef = collection(db, "players");
    const snapshot = await getDocs(playersRef);

    // 🔍 Verifica se o jogador já existe pelo Id_player
    const existingDoc = snapshot.docs.find(doc => doc.data().Id_player === numericId);

    if (existingDoc) {
      const data = existingDoc.data();

      // 🛠️ Atualiza caso o nome ou tag sejam diferentes
      if (data.Name !== Name || data.Tag !== Tag) {
        await updateDoc(existingDoc.ref, {
          Name,
          Tag,
          updatedAt: new Date().toISOString(),
        });
        console.log(`♻️ Jogador atualizado: ${Name} (${numericId}) [${Tag}]`);
        return res.json({ success: true, message: "Jogador atualizado com sucesso" });
      }

      // ✅ Caso o jogador já exista igual
      return res.json({ success: false, message: "Jogador já cadastrado e atualizado" });
    }

    // ➕ Adiciona novo jogador
    await addDoc(playersRef, {
      Name,
      Id_player: numericId,
      Tag,
      createdAt: new Date().toISOString(),
    });

    console.log(`👤 Novo jogador adicionado: ${Name} (${numericId}) [${Tag}]`);
    res.json({ success: true, message: "Jogador adicionado com sucesso" });
  } catch (err) {
    console.error("❌ Erro ao adicionar/atualizar jogador:", err);
    res.status(500).json({ error: err.message });
  }
});

// 📜 Listar todos os jogadores
app.get("/api/players", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "players"));
    const players = snapshot.docs.map(doc => doc.data());
    res.json(players);
  } catch (err) {
    console.error("❌ Erro ao listar jogadores:", err);
    res.status(500).json({ error: err.message });
  }
});


// 🛠 Atualizar tag de jogador (banir/desbanir)
app.put("/api/players/:id", async (req, res) => {
  const { id } = req.params;
  const { Tag } = req.body;

  if (!Tag) return res.status(400).json({ error: "Campo 'Tag' é obrigatório" });

  try {
    const snapshot = await getDocs(collection(db, "players"));
    const playerDoc = snapshot.docs.find(d => d.data().Id_player == id);

    if (!playerDoc) {
      return res.status(404).json({ error: "Jogador não encontrado" });
    }

    // ✅ Atualiza corretamente usando o ref do documento
    await updateDoc(playerDoc.ref, { Tag, updatedAt: new Date().toISOString() });

    console.log(`⚙️ Jogador ${id} atualizado para: ${Tag}`);
    res.json({ success: true, message: `Jogador ${id} atualizado para ${Tag}` });
  } catch (err) {
    console.error("❌ Erro ao atualizar jogador:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔍 Obter Tag de jogador por ID
app.get("/api/player/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Busca na coleção "players"
    const snapshot = await getDocs(collection(db, "players"));
    const playerDoc = snapshot.docs.find(doc => doc.data().Id_player == id);

    if (!playerDoc) {
      return res.status(404).json({ success: false, message: "Jogador não encontrado" });
    }

    const data = playerDoc.data();
    res.json({
      success: true,
      Id_player: data.Id_player,
      Name: data.Name,
      Tag: data.Tag,
    });
  } catch (err) {
    console.error("❌ Erro ao buscar jogador:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});




// ====================
// 🎵 API: Gerenciar IDs de músicas (Firebase)
// ====================

// 🎵 API: Gerenciar IDs de músicas (Firebase) — VERSÃO ATUALIZADA
app.post("/api/musics_obj", async (req, res) => {
  const Name = req.body.Name || req.body.name;
  const Obj = req.body.Obj || req.body.obj;
  if (!Name) return res.status(400).json({ error: "Campo 'Name' é obrigatório" });
  if (!Obj) return res.status(400).json({ error: "Campo 'Obj' é obrigatório" });
  if (!/^\d+$/.test(Obj)) return res.status(400).json({ error: "O campo 'Obj' deve conter apenas números" });

  const numericObj = Number(Obj);

  // 🔹 Lê cache local primeiro
  let cache = readLocalCache(musicsObjFile);
  const existsCache = cache.some(item => item.Obj === numericObj);
  if (existsCache) {
    return res.status(400).json({ error: "Obj já existe no cache local" });
  }

  try {
    // 🔹 Verifica também no Firestore (caso cache esteja desatualizado)
    const snapshot = await getDocs(collection(db, "musics_obj"));
    const exists = snapshot.docs.some(doc => doc.data().Obj === numericObj);
    if (exists) return res.status(400).json({ error: "Obj já existe no Firestore" });

    // 🔹 Adiciona no Firestore e no cache local
    await addDoc(collection(db, "musics_obj"), { Name, Obj: numericObj });
    cache.push({ Name, Obj: numericObj });
    writeLocalCache(musicsObjFile, cache);

    console.log("📩 Novo objeto adicionado:", { Name, Obj: numericObj });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao salvar no Firestore:", err);
    res.status(500).json({ error: err.message });
  }
});


// 📜 GET: Retornar todos os objetos no formato Lua/table
app.get("/api/musics_obj", async (req, res) => {
  try {
    // 🔹 Prioriza o cache local
    const cache = readLocalCache(musicsObjFile);
    if (cache.length > 0) {
      return res.json(cache);
    }

    // 🔹 Se vazio, busca do Firestore e atualiza o cache
    const snapshot = await getDocs(collection(db, "musics_obj"));
    const musics = snapshot.docs.map(doc => doc.data());
    writeLocalCache(musicsObjFile, musics);

    res.json(musics);
  } catch (err) {
    console.error("❌ Erro ao buscar musics_obj:", err);
    res.status(500).json({ error: err.message });
  }
});



// 📜 GET: Retornar todos os objetos no formato LUA (Module) usando cache local
app.get("/api/musics_obj_lua", async (req, res) => {
  try {
    let musics;

    // 🔹 Tenta ler do Firestore
    try {
      const snapshot = await getDocs(collection(db, "musics_obj"));
      musics = snapshot.docs.map(doc => doc.data());

      // Atualiza o cache local
      writeLocalCache(musicsObjFile, musics);
    } catch (firestoreErr) {
      console.warn("⚠️ Firestore não disponível, usando cache local", firestoreErr);
      musics = readLocalCache(musicsObjFile);
    }

    // Se nem Firestore nem cache funcionarem
    if (!musics || musics.length === 0) {
      return res.status(404).send("-- Nenhum dado disponível");
    }

    // Gera a string Lua — exemplo: return { {Name="A",Obj=123}, {Name="B",Obj=456} }
    const luaTable = `return {\n${
      musics
        .map(m => `  {name="${m.Name}", Obj=${m.Obj}}`)
        .join(",\n")
    }\n}`;

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(luaTable);
  } catch (err) {
    console.error("❌ Erro ao gerar musics_obj_lua:", err);
    res.status(500).send("-- Erro ao gerar tabela Lua: " + err.message);
  }
});





// ➕ Adicionar um novo ID
app.post("/api/musics", async (req, res) => {
  const id = req.body.id || req.body.texto;

  if (!id) return res.status(400).json({ error: "Campo 'id' é obrigatório" });

  // Verifica se id contém apenas números
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: "O campo 'id' deve conter apenas números" });
  }

  const numericId = Number(id); // converte para número

  try {
    // Busca todos os IDs existentes
    const snapshot = await getDocs(collection(db, "musics"));
    const exists = snapshot.docs.some(doc => doc.data().id === numericId);

    if (exists) {
      return res.status(400).json({ error: "ID já existe" });
    }

    // Adiciona no Firestore
    await addDoc(collection(db, "musics"), { id: numericId });
    console.log("📩 Novo ID adicionado:", numericId);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao salvar no Firestore:", err);
    res.status(500).json({ error: err.message });
  }
});


// 📜 Listar todos os IDs
app.get("/api/musics", async (req, res) => {
  try {
    let cache = readLocalCache(musicsFile);
    if (cache.length > 0) {
      return res.json(cache);
    }

    const snapshot = await getDocs(collection(db, "musics"));
    const list = snapshot.docs.map(doc => doc.data().id);

    writeLocalCache(musicsFile, list);
    res.json(list);
  } catch (err) {
    console.error("❌ Erro ao ler do Firestore:", err);
    res.status(500).json({ error: err.message });
  }
});

// ====================
// 🏠 Página inicial
// ====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ====================
// 🚀 Iniciar servidor
// ====================
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`📁 Lua: http://localhost:${PORT}/lua/mod_animal_simulator_v2.lua`);
  console.log(`🎵 API: http://localhost:${PORT}/api/musics`);
});
