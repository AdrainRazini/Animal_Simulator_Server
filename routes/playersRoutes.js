import express from "express";
import { collection, getDocs, addDoc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { memoryCache, CACHE_TTL } from "../utils/cache.js";

const router = express.Router();

// Função interna
async function getPlayerById(id) {
  const q = query(collection(db, "players"), where("Id_player", "==", Number(id)));
  const snap = await getDocs(q);
  return snap.docs[0];
}

// POST add/update
router.post("/", async (req, res) => {
  const { Name, Id_player, Tag } = req.body;

  if (!Name || !Id_player || !Tag)
    return res.status(400).json({ error: "Campos inválidos" });

  const docP = await getPlayerById(Id_player);

  if (docP) {
    await updateDoc(docP.ref, { Name, Tag });
    return res.json({ success: true, message: "Atualizado" });
  }

  await addDoc(collection(db, "players"), {
    Name,
    Id_player: Number(Id_player),
    Tag
  });

  res.json({ success: true, message: "Criado" });
});

// GET all
router.get("/", async (req, res) => {
  const now = Date.now();

  if (memoryCache.players.data.length && now - memoryCache.players.lastFetch < CACHE_TTL)
    return res.json(memoryCache.players.data);

  const snap = await getDocs(collection(db, "players"));
  const list = snap.docs.map(d => d.data());

  memoryCache.players = { data: list, lastFetch: now };
  res.json(list);
});

// GET by ID
router.get("/:id", async (req, res) => {
  const docP = await getPlayerById(req.params.id);
  if (!docP) return res.status(404).json({ error: "Não encontrado" });
  res.json(docP.data());
});

export default router;
