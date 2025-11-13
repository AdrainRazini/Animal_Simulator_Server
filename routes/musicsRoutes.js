import express from "express";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { memoryCache, CACHE_TTL } from "../utils/cache.js";
import { readLocalCache, writeLocalCache } from "../utils/fileCache.js";
import path from "path";

const router = express.Router();

// Caminho do cache local
const musicsFile = path.join("data", "musics.json");

// POST
router.post("/", async (req, res) => {
  const id = Number(req.body.id || req.body.texto);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const q = query(collection(db, "musics"), where("id", "==", id));
  const snap = await getDocs(q);

  if (!snap.empty) return res.status(400).json({ error: "Já existe" });

  await addDoc(collection(db, "musics"), { id });

  memoryCache.musics.data.push(id);
  res.json({ success: true });
});

// GET
router.get("/", async (req, res) => {
  const now = Date.now();

  if (memoryCache.musics.data.length && now - memoryCache.musics.lastFetch < CACHE_TTL)
    return res.json(memoryCache.musics.data);

  const local = readLocalCache(musicsFile);
  if (local.length) {
    memoryCache.musics = { data: local, lastFetch: now };
    return res.json(local);
  }

  const snap = await getDocs(collection(db, "musics"));
  const list = snap.docs.map(d => d.data().id);

  memoryCache.musics = { data: list, lastFetch: now };
  writeLocalCache(musicsFile, list);

  res.json(list);
});

export default router;
