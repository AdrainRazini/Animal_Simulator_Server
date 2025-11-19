
/* :) */
console.log("Sistema Ativo");

// Verifica se a página atual existe; se não, redireciona para 404.html
window.addEventListener('DOMContentLoaded', () => {
    const urlAtual = window.location.pathname;

    fetch(urlAtual, { method: 'HEAD' })
        .then(response => {
            if (!response.ok) {
                window.location.href = "404.html";
            }
            // Se a página existe, não faz nada
        })
        .catch(error => {
            console.error("Erro ao verificar a URL:", error);
            window.location.href = "404.html";
        });
});



const form = document.getElementById("musicForm");
const musicsList = document.getElementById("musicsList");
const counter = document.getElementById("counter");
const alerta = document.getElementById("Alerta_h");

const modal = document.getElementById("musicModal");
const modalName = document.getElementById("modalName");
const modalObj = document.getElementById("modalObj");
const closeBtn = document.querySelector(".close-btn");

const searchForm = document.getElementById("pesquise");
const searchInput = document.getElementById("name");

let allMusics = []; // 🔹 Guarda todas as músicas carregadas

alerta.style.display = "none";

// === 🔹 Abrir modal ===
function openModal(name, obj) {
  modalName.textContent = `🎵 ${name}`;
  modalObj.textContent = `🆔 ID: ${obj}`;
  modal.classList.add("show");

  // procura o botão (cria se não existir)
  let copyBtn = modal.querySelector(".copy-id-btn");
  if (!copyBtn) {
    copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 Copiar ID";
    copyBtn.className = "copy-id-btn";
    modal.querySelector(".modal").appendChild(copyBtn);
  }

  // 🔹 remove qualquer evento anterior
  const newBtn = copyBtn.cloneNode(true);
  copyBtn.replaceWith(newBtn);
  copyBtn = newBtn;

  // 🔹 adiciona evento atualizado com o novo obj
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(obj);
    copyBtn.textContent = "✅ Copiado!";
    copyBtn.style.background = "linear-gradient(135deg, #2ecc71, #00ffb3)";
    setTimeout(() => {
      copyBtn.textContent = "📋 Copiar ID";
      copyBtn.style.background = "linear-gradient(135deg, #00ffb3, #00b3ff)";
    }, 2000);
  });

  modal.style.display = "flex";
  modal.style.opacity = "1";
}

// === 🔹 Botão de copiar código -- Copia o Script para o Adn_Mod
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


closeBtn.addEventListener("click", () => (modal.style.display = "none"));
modal.addEventListener("click", e => {
  if (e.target === modal) modal.style.display = "none";
});

// === 🔹 Carregar músicas ===
async function loadMusicsObj() {
  try {
    const res = await fetch("/api/musics_obj");
    if (!res.ok) throw new Error("Falha ao carregar músicas_obj");
    const musics = await res.json();

    allMusics = musics; // salva todas
    renderMusics(allMusics);
  } catch (err) {
    console.error(err);
    alerta.textContent = "Erro ao conectar com o servidor.";
    alerta.style.display = "block";
  }
}

// === 🔹 Renderizar ===
function renderMusics(musics) {
  musicsList.innerHTML = "";
  counter.textContent = `Total: ${musics.length}`;

  if (musics.length === 0) {
    alerta.textContent = "Nenhuma música encontrada.";
    alerta.style.display = "block";
    return;
  }

  alerta.style.display = "none";

  musics.forEach(music => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.marginBottom = "8px";
    li.style.gap = "10px";

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

    const nameSpan = document.createElement("span");
    nameSpan.textContent = music.Name || "Sem nome";
    nameSpan.style.flex = "1";
    nameSpan.style.fontWeight = "500";
    nameSpan.style.color = "#333";
    nameSpan.style.fontSize = "14px";

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#2575fc";
      btn.style.color = "#fff";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "#fff";
      btn.style.color = "#2575fc";
    });

    btn.addEventListener("click", () => openModal(music.Name, music.Obj));

    li.appendChild(nameSpan);
    li.appendChild(btn);
    musicsList.appendChild(li);
  });
}

// === 🔹 Adicionar novo ID ===
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

// === 🔹 Pesquisa automática ===
function searchMusics() {
  const term = searchInput.value.trim().toLowerCase();

  if (term === "") {
    renderMusics(allMusics); // mostra todas
  } else {
    const filtered = allMusics.filter(music =>
      music.Name && music.Name.toLowerCase().includes(term)
    );
    renderMusics(filtered);
  }
}

// Atualiza enquanto digita
searchInput.addEventListener("input", searchMusics);

// Evita reload ao enviar formulário
searchForm.addEventListener("submit", e => e.preventDefault());

// === 🔹 Carrega tudo ao iniciar ===
loadMusicsObj();

// === 🔹 MENU HAMBÚRGUER e TOOLTIP (inalterado) ===
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

logo.addEventListener("mouseenter", () => {
  tooltip.style.display = "flex";
});
logo.addEventListener("mouseleave", () => {
  tooltip.style.display = "none";
});

let open = false;
logo.addEventListener("click", () => {
  open = !open;
  tooltip.style.display = open ? "flex" : "none";
});


