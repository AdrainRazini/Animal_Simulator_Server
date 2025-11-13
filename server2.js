import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import musicsRoutes from "./routes/musicsRoutes.js";
import musicsObjRoutes from "./routes/musicsObjRoutes.js";
import musicsObjLuaRoutes from "./routes/musicsObjLuaRoutes.js";
import playersRoutes from "./routes/playersRoutes.js";

import { isServerless } from "./utils/env.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Public + arquivos estáticos
app.use("/lua", express.static(path.join(__dirname, "lua")));
app.use("/data", express.static(path.join(__dirname, "data")));
app.use(express.static(path.join(__dirname, "public")));

// Rotas separadas
app.use("/api/musics", musicsRoutes);
app.use("/api/musics_obj", musicsObjRoutes);
app.use("/api/musics_obj_lua", musicsObjLuaRoutes);
app.use("/api/players", playersRoutes);

// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Inicialização híbrida
if (!isServerless) {
  app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
}

export default app;
