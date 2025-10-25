// ===============================
// 🚀 Publicador de musics_obj
// ===============================

import fetch from "node-fetch";
import fs from "fs";

// Lê o arquivo local (ex: ./data/musics_obj.json)
const objects = JSON.parse(fs.readFileSync("./data/musics_obj.json", "utf-8"));

async function publishAllObjects() {
  for (const { name, Obj } of objects) {
    try {
      const res = await fetch("https://animal-simulator-server.vercel.app/api/musics_obj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, Obj })
      });

      const data = await res.json();

      if (data.success) {
        console.log(`✅ Publicado: ${name} (${Obj})`);
      } else {
        console.log(`⚠️ Falha ao publicar ${name} (${Obj}): ${data.error || "já existe"}`);
      }
    } catch (err) {
      console.error(`❌ Erro ao enviar ${name} (${Obj}):`, err.message);
    }
  }
}

publishAllObjects();
