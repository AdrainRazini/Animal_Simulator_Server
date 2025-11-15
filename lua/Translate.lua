local Translator = {}
local Cache = {}

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")

local targetLang = string.sub(Players.LocalPlayer.LocaleId, 1, 2)

local requestFunction =
	(syn and syn.request)
	or (http and http.request)
	or http_request
	or request
	or (fluxus and fluxus.request)
	or (krnl and krnl.request)

local lastRequest = 0

function Translator.TranslateText(text)
	if Cache[text] then
		return Cache[text]
	end
	
	-- Cooldown anti-rate-limit
	if tick() - lastRequest < 0.15 then
		task.wait(0.15 - (tick() - lastRequest))
	end
	lastRequest = tick()

	local url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl="
		.. targetLang .. "&dt=t&q=" .. HttpService:UrlEncode(text)

	local response = requestFunction({
		Url = url,
		Method = "GET",
	})

	-- Falha total → mantém o texto original
	if not response or not response.Body then
		return text
	end

	-- Resposta inválida → sem tradução
	if not response.Body:find("%[%[%[") then
		warn("API retornou erro ou HTML:", response.Body)
		return text
	end

	local translated = response.Body:match('%[%[%["(.-)","')

	-- Se vier nil → mantém o original
	if not translated or translated == "" then
		return text
	end

	Cache[text] = translated
	return translated
end

function Translator.AutoTranslate(gui, searchMode)
	searchMode = searchMode or "Class"

	if not gui or typeof(gui.GetDescendants) ~= "function" then
		warn("[AutoTranslate] GUI inválido:", gui)
		return
	end

	for _, obj in ipairs(gui:GetDescendants()) do
		if obj:IsA("TextLabel") or obj:IsA("TextButton") or obj:IsA("TextBox") then
			
			-- Skip sistema de proteção
			if obj:FindFirstChild("Translate_Off") then
				continue
			end

			local text = (searchMode == "Name") and obj.Name
				or (searchMode == "All" and (obj.Text ~= "" and obj.Text or obj.Name))
				or obj.Text

			if text and text ~= "" then
				task.spawn(function()
					local newText = Translator.TranslateText(text)
					if newText then
						obj.Text = newText
					end
				end)
			end
		end
	end
end

return Translator
