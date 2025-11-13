import fs from "fs";
import path from "path";

const logsFile = path.join(process.cwd(), "data", "logs.json");
const MAX_LOGS = 200;

// Cache em memória
let logCache = [];

// Salva logs localmente
function saveLogs() {
  try {
    fs.writeFileSync(logsFile, JSON.stringify(logCache, null, 2));
  } catch (err) {
    console.warn("⚠️ Não foi possível salvar logs:", err.message);
  }
}

// Função para adicionar log
function addLog(type, message) {
  const log = {
    type,
    message,
    time: new Date().toLocaleString("pt-BR"),
  };

  logCache.push(log);
  if (logCache.length > MAX_LOGS) logCache.shift();
  saveLogs();
}

// Sobrescreve consoles
const original = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

console.log = (...args) => {
  addLog("log", args.join(" "));
  original.log(...args);
};

console.warn = (...args) => {
  addLog("warn", args.join(" "));
  original.warn(...args);
};

console.error = (...args) => {
  addLog("error", args.join(" "));
  original.error(...args);
};

export function getLogs() {
  return logCache;
}

export function clearLogs() {
  logCache = [];
  saveLogs();
}

export default { getLogs, clearLogs };
