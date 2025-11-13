import express from "express";
const router = express.Router();
import { convertToLua } from "../utils/convertLua.js";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";

router.get("/", async (req, res) => {
  try {
    const snap = await getDocs(collection(db, "musics_obj"));
    const musics = snap.docs.map(doc => doc.data());

    const luaString = convertToLua(musics);

    res.setHeader("Content-Type", "text/plain");
    res.send(luaString);

  } catch (err) {
    console.error("Erro ao gerar Lua:", err);
    res.status(500).json({ error: "Erro ao gerar arquivo Lua" });
  }
});

export default router;
