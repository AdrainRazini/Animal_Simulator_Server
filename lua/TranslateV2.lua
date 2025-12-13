local Translator = {}
local Cache = {}

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")

local player = Players.LocalPlayer
local targetLang = string.sub(player.LocaleId, 1, 2)

local requestFunction =
    (syn and syn.request)
    or (http and http.request)
    or http_request
    or request
    or (fluxus and fluxus.request)
    or (krnl and krnl.request)

if not requestFunction then
    error("Executor não suporta HTTP request")
end

-- 🔹 Tradução segura
function Translator.TranslateText(text)
    if Cache[text] then
        return Cache[text]
    end

    local url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl="
        .. targetLang
        .. "&dt=t&q="
        .. HttpService:UrlEncode(text)

    local ok, response = pcall(function()
        return requestFunction({
            Url = url,
            Method = "GET"
        })
    end)

    if not ok or not response or not response.Body then
        return text
    end

    local success, data = pcall(function()
        return HttpService:JSONDecode(response.Body)
    end)

    if not success or not data[1] or not data[1][1] then
        return text
    end

    local translated = data[1][1][1]
    Cache[text] = translated
    return translated
end

-- 🔹 AutoTranslate estável (NÃO quebra HUD)
function Translator.AutoTranslate(gui, searchMode)
    searchMode = searchMode or "Class"

    if not gui or typeof(gui.GetDescendants) ~= "function" then
        warn("[AutoTranslate] GUI inválido")
        return
    end

    for _, obj in ipairs(gui:GetDescendants()) do
        if obj:IsA("TextLabel") or obj:IsA("TextButton") then

            if obj:GetAttribute("Translated") then
                continue
            end

            if string.find(obj.Name, "Translate_Off") then
                continue
            end

            local textToTranslate =
                (searchMode == "Name" and obj.Name)
                or (searchMode == "All" and (obj.Text ~= "" and obj.Text or obj.Name))
                or obj.Text

            if textToTranslate and #textToTranslate > 1 then
                local translated = Translator.TranslateText(textToTranslate)
                obj.Text = translated
                obj:SetAttribute("Translated", true)

                task.wait(0.15) -- 🔥 ESSENCIAL (anti-crash HUD)
            end
        end
    end
end

return Translator
