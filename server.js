// ====================
// 🌐 Servidor Principal Unificado
// ====================
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

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
// 🎵 API: Gerenciar IDs de músicas
// ====================
const musicsFile = path.join(__dirname, "data/musics.json");

// Lê o arquivo JSON de IDs
function readMusics() {
  if (!fs.existsSync(musicsFile)) return [];
  try {
    const data = fs.readFileSync(musicsFile, "utf-8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("❌ Erro ao ler JSON:", err);
    return [];
  }
}

// Salva os IDs
function saveMusics(list) {
  fs.writeFileSync(musicsFile, JSON.stringify(list, null, 2), "utf-8");
}

// ➕ Adicionar um novo ID
app.post("/api/musics", (req, res) => {
  const id = req.body.id || req.body.texto;
  if (!id) return res.status(400).json({ error: "Campo 'id' é obrigatório" });

  const musics = readMusics();

  if (!musics.includes(id)) {
    musics.push(id);
    saveMusics(musics);
    console.log("📩 Novo ID adicionado:", id);
  } else {
    console.log("⚠️ ID duplicado ignorado:", id);
  }

  res.json({ success: true, total: musics.length, musics });
});

// 📜 Listar todos os IDs
app.get("/api/musics", (req, res) => {
  res.json(readMusics());
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
