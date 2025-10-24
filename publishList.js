import fetch from "node-fetch";
import fs from "fs";

const ids = JSON.parse(fs.readFileSync("./data/musics.json", "utf-8"));

async function publishAll() {
  for (const id of ids) {
    try {
      const res = await fetch("https://animal-simulator-server.vercel.app/api/musics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) console.log(`✅ ID ${id} publicado!`);
      else console.log(`⚠️ ID ${id} já existe ou erro`);
    } catch (err) {
      console.error(`❌ Erro ID ${id}:`, err.message);
    }
  }
}

publishAll();
