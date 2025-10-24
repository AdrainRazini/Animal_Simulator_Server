// ====================
// 🌐 Servidor Principal Unificado
// ====================
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { collection, getDocs, addDoc } from "firebase/firestore";
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
// 🎵 API: Gerenciar IDs de músicas (Firebase)
// ====================

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
