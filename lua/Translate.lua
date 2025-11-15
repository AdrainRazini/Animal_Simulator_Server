-- 📘 Tradutor automático de textos Roblox (executores)
-- Suporte: syn.request, http_request, krnl.request, fluxus.request etc.

local Translator = {}
local Cache = {}

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")

-- idioma alvo (LocaleId do jogador → "pt-br" → "pt")
local targetLang = string.sub(Players.LocalPlayer.LocaleId, 1, 2)

-- Detecta função compatível com o executor
local requestFunction =
    (syn and syn.request)
    or (http and http.request)
    or http_request
    or request
    or (fluxus and fluxus.request)
    or (krnl and krnl.request)

if not requestFunction then
    error("❌ Executor não suporta requisições HTTP (syn.request / http_request).")
end

-- 🔹 Função interna de tradução (com cache)
function Translator.TranslateText(text)
    if Cache[text] then
        return Cache[text]
    end

    local url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl="
        .. targetLang
        .. "&dt=t&q="
        .. HttpService:UrlEncode(text)

    local response = requestFunction({
        Url = url,
        Method = "GET",
    })

    if not response or not response.Body then
        warn("⚠️ Erro ao obter resposta da API.")
        return text
    end

    local translated = response.Body:match('%[%[%["(.-)","')
    if translated then
        Cache[text] = translated
        return translated
    else
        warn("Falha ao extrair tradução:", response.Body)
        return text
    end
end

-- 🔹 Traduz automaticamente todos TextLabels/TextButtons dentro de um GUI
-- 🔸 Antes de traduzir: ignora se o nome contém "Translate_Off"
function Translator.AutoTranslate(gui, searchMode)
    searchMode = searchMode or "Class" -- "Class" | "Name" | "All"

    if not gui or typeof(gui.GetDescendants) ~= "function" then
        warn("[AutoTranslate] GUI inválido ou não encontrado:", gui)
        return
    end

    for _, obj in ipairs(gui:GetDescendants()) do
        if obj:IsA("TextLabel") or obj:IsA("TextButton") or obj:IsA("TextBox") then

            -- 🔥 SE O NOME CONTÉM "Translate_Off", NÃO TRADUZ
            if string.find(obj.Name, "Translate_Off") then
                continue
            end

            local textToTranslate

            if searchMode == "Name" then
                textToTranslate = obj.Name
            elseif searchMode == "All" then
                textToTranslate = obj.Text ~= "" and obj.Text or obj.Name
            else
                textToTranslate = obj.Text
            end

            if textToTranslate and textToTranslate ~= "" then
                task.spawn(function()
                    local newText = Translator.TranslateText(textToTranslate)
                    if newText then
                        obj.Text = newText
                    end
                end)
            end
        end
    end
end

return Translator
