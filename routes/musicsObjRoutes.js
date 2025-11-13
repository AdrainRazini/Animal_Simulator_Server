import express from "express";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { memoryCache, CACHE_TTL } from "../utils/cache.js";
import { readLocalCache, writeLocalCache } from "../utils/fileCache.js";
import { convertToLua } from "../utils/convertLua.js";
import path from "path";

const router = express.Router();

const musicsObjFile = path.join("data", "musics_obj.json");

// POST
router.post("/", async (req, res) => {
  const Name = req.body.Name;
  const Obj = Number(req.body.Obj);

  if (!Name || isNaN(Obj))
    return res.status(400).json({ error: "Campos inválidos" });

  if (memoryCache.musics_obj.data.some(m => m.Obj === Obj))
    return res.status(400).json({ error: "Já existe" });

  const q = query(collection(db, "musics_obj"), where("Obj", "==", Obj));
  const snap = await getDocs(q);

  if (!snap.empty)
    return res.status(400).json({ error: "Já existe" });

  const newDoc = { Name, Obj };
  await addDoc(collection(db, "musics_obj"), newDoc);

  memoryCache.musics_obj.data.push(newDoc);
  writeLocalCache(musicsObjFile, memoryCache.musics_obj.data);

  res.json({ success: true });
});

// GET JSON
router.get("/", async (req, res) => {
  const now = Date.now();

  if (memoryCache.musics_obj.data.length && now - memoryCache.musics_obj.lastFetch < CACHE_TTL)
    return res.json(memoryCache.musics_obj.data);

  const local = readLocalCache(musicsObjFile);
  if (local.length) {
    memoryCache.musics_obj = { data: local, lastFetch: now };
    return res.json(local);
  }

  const snap = await getDocs(collection(db, "musics_obj"));
  const list = snap.docs.map(d => d.data());

  memoryCache.musics_obj = { data: list, lastFetch: now };
  writeLocalCache(musicsObjFile, list);

  res.json(list);
});

// GET LUA
router.get("/lua", async (req, res) => {
  const data = memoryCache.musics_obj.data;
  res.type("text/plain").send(convertToLua(data));
});

export default router;
