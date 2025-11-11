// ====================
// 🌐 Servidor Principal Unificado
// ====================
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase.js";

// Corrigir __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ====================
// 🔧 Middlewares
// ====================
app.use(cors({ origin: "*" }));
app.use(express.json());

// ====================
// 📁 Servir arquivos estáticos
// ====================
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

  try {
    const snapshot = await getDocs(collection(db, "musics_obj"));
    const exists = snapshot.docs.some(doc => doc.data().Obj === numericObj);

    if (exists) return res.status(400).json({ error: "Obj já existe" });

    await addDoc(collection(db, "musics_obj"), { Name, Obj: numericObj });
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
    const snapshot = await getDocs(collection(db, "musics_obj"));
    const musics = snapshot.docs.map(doc => doc.data());
    res.json(musics); // ✅ JSON real
  } catch (err) {
    console.error("❌ Erro ao buscar musics_obj:", err);
    res.status(500).json({ error: err.message });
  }
});

// 📜 GET: Retornar todos os objetos no formato LUA (Module)
app.get("/api/musics_obj_lua", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "musics_obj"));
    const musics = snapshot.docs.map(doc => doc.data());

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
    const snapshot = await getDocs(collection(db, "musics"));
    const list = snapshot.docs.map(doc => doc.data().id);
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
