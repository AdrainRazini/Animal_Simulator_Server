
const form = document.getElementById("musicForm");
const musicsList = document.getElementById("musicsList");
const counter = document.getElementById("counter");
const alerta = document.getElementById("Alerta_h");

const modal = document.getElementById("musicModal");
const modalName = document.getElementById("modalName");
const modalObj = document.getElementById("modalObj");
const closeBtn = document.querySelector(".close-btn");

// Esconde alerta por padrão
alerta.style.display = "none";

// === 🔹 Função para abrir modal ===
function openModal(name, obj) {
  modalName.textContent = `🎵 ${name}`;
  modalObj.textContent = `🆔 ID: ${obj}`;
  modal.classList.add("show");

  // Adiciona botão de copiar ID (uma vez)
  let existingBtn = modal.querySelector(".copy-id-btn");
  if (!existingBtn) {
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 Copiar ID";
    copyBtn.className = "copy-id-btn";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(obj);
      copyBtn.textContent = "✅ Copiado!";
      copyBtn.style.background = "linear-gradient(135deg, #2ecc71, #00ffb3)";
      setTimeout(() => {
        copyBtn.textContent = "📋 Copiar ID";
        copyBtn.style.background = "linear-gradient(135deg, #00ffb3, #00b3ff)";
      }, 2000);
    });
    modal.querySelector(".modal").appendChild(copyBtn);
  }

  modal.style.display = "flex";
  modal.style.opacity = "1";
}

// === 🔹 Fechar modal com fade ===
function closeModal() {
  modal.style.opacity = "0";
  setTimeout(() => {
    modal.style.display = "none";
    modal.classList.remove("show");
  }, 250);
}

closeBtn.addEventListener("click", closeModal);
modal.addEventListener("click", e => {
  if (e.target === modal) closeModal();
});


// === 🔹 Fechar modal ===
closeBtn.addEventListener("click", () => modal.style.display = "none");
modal.addEventListener("click", e => {
  if (e.target === modal) modal.style.display = "none"; // fecha clicando fora
});

// === 🔹 Carregar músicas_obj ===
async function loadMusicsObj() {
  try {
    const res = await fetch("/api/musics_obj");
    if (!res.ok) throw new Error("Falha ao carregar músicas_obj");
    const musics = await res.json();

    musicsList.innerHTML = "";
    counter.textContent = `Total: ${musics.length}`;

    musics.forEach(music => {
      const li = document.createElement("li");
      const btn = document.createElement("button");

      btn.textContent = music.Obj;
      btn.style.background = "#fff";
      btn.style.color = "#2575fc";
      btn.style.border = "none";
      btn.style.borderRadius = "8px";
      btn.style.padding = "8px 12px";
      btn.style.cursor = "pointer";
      btn.style.fontWeight = "600";
      btn.style.transition = "0.3s";

      btn.addEventListener("mouseenter", () => {
        btn.style.background = "#2575fc";
        btn.style.color = "#fff";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "#fff";
        btn.style.color = "#2575fc";
      });

      btn.addEventListener("click", () => openModal(music.Name, music.Obj));

      li.appendChild(btn);
      musicsList.appendChild(li);
    });

    alerta.style.display = "none";
  } catch (err) {
    console.error(err);
    alerta.textContent = "Erro ao conectar com o servidor.";
    alerta.style.display = "block";
  }
}

// === 🔹 Adicionar novo ID (endpoint antigo) ===
form.addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("musicId").value.trim();
  if (!id) {
    alerta.textContent = "Digite um ID.";
    alerta.style.display = "block";
    return;
  }

  if (!/^\d+$/.test(id)) {
    alerta.textContent = "Digite apenas números!";
    alerta.style.display = "block";
    return;
  }

  try {
    const res = await fetch("/api/musics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });

    const data = await res.json();
    if (!res.ok) {
      alerta.textContent = data.error || "Erro ao adicionar música.";
      alerta.style.display = "block";
      return;
    }

    document.getElementById("musicId").value = "";
    alerta.style.display = "none";
    loadMusicsObj();
  } catch (err) {
    console.error(err);
    alerta.textContent = "Erro ao adicionar música.";
    alerta.style.display = "block";
  }
});

// 🔹 Carregar ao abrir
loadMusicsObj();

// === 🔹 MENU HAMBÚRGUER ===
const hamburger = document.getElementById("hamburgerMenu");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("menuOverlay");

hamburger.addEventListener("click", () => {
  const active = hamburger.classList.toggle("active");
  sideMenu.classList.toggle("active", active);
  overlay.classList.toggle("active", active);
});

overlay.addEventListener("click", () => {
  hamburger.classList.remove("active");
  sideMenu.classList.remove("active");
  overlay.classList.remove("active");
});


const logo = document.getElementById("logoPreview");
const tooltip = document.getElementById("tooltipPreview");

// Mostrar tooltip ao passar o mouse
logo.addEventListener("mouseenter", () => {
  tooltip.style.display = "flex";
});

// Esconder tooltip ao tirar o mouse
logo.addEventListener("mouseleave", () => {
  tooltip.style.display = "none";
});

// Alternativa: clique para manter aberto
let open = false;
logo.addEventListener("click", () => {
  open = !open;
  tooltip.style.display = open ? "flex" : "none";
});


 // Função para copiar o código do script
  document.getElementById("copyBtn").addEventListener("click", () => {
    const luaCode = document.getElementById("luaCode").innerText;
    navigator.clipboard.writeText(luaCode);
    const btn = document.getElementById("copyBtn");
    btn.textContent = "✅ Copiado!";
    btn.style.background = "#2ecc71";
    setTimeout(() => {
      btn.textContent = "📋 Copiar";
      btn.style.background = "#2575fc";
    }, 2000);
  });