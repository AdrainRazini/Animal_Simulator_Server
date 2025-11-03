
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local PlayerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
local Workspace = game:GetService("Workspace")
local TweenService = game:GetService("TweenService")
local Camera = Workspace.CurrentCamera

-- Check if a ScreenGui named "AimbotV2" already exists
local existingScreenGui = game.Players.LocalPlayer:WaitForChild("PlayerGui"):FindFirstChild("Remake Aimbot(ES)" .. Players.LocalPlayer.Name)

if existingScreenGui then
	return
end

game:GetService("StarterGui"):SetCore("SendNotification", { 
	Title = "Mastermod + ADN Mod";
	Text = "AimBot V2";
	Icon = "rbxthumb://type=Asset&id=72684486485553&w=150&h=150",
	Duration = 16;
})


-- Variáveis da mira
local detectionRadius = 50
local lerpSpeed = 0.1
local aimEnabled = true
local targetEnemiesOnly = false
local includeNPCs = true
local Hud_Stats = true

-- Carrega Regui
local Regui

-- 1️⃣ Tenta carregar localmente
local success, module = pcall(function()
	return require(script.Parent:FindFirstChild("ReguiModule"))
end)

if success and module then
	Regui = module
	print("[✅ Mod Loader] Carregado localmente com sucesso!")
else
	-- 2️⃣ Tenta baixar remoto
	local ok, code
	local urls = {
		"https://animal-simulator-server.vercel.app/lua/ReguiModule.lua"
	}

	for _, url in ipairs(urls) do
		local okHttp, result = pcall(function()
			return game:HttpGet(url)
		end)
		if okHttp and result and result ~= "" then
			code = result
			print("[🌐 Mod Loader] Código baixado de: " .. url)
			break
		else
			warn("[⚠️ Mod Loader] Falha ao baixar de:", url)
		end
	end

	-- 3️⃣ Executa o código remoto se baixado
	if code then
		local okLoad, result = pcall(function()
			return loadstring(code)() 
		end)
		if okLoad and result then
			Regui = result
			print("[✅ Mod Loader] Módulo remoto carregado com sucesso!")
		else
			warn("[❌ Mod Loader] Erro ao executar código remoto:", result)
		end
	else
		warn("[❌ Mod Loader] Nenhuma das fontes pôde ser carregada.")
	end
end

assert(Regui, "Regui não foi carregado!")





-- Cria HUD com Regui
local hudRefs

if Regui then
	hudRefs = Regui.CreateAimbotHUD({
		Parent = PlayerGui,
		FollowMouse = false,
		PulsePoint = false,
		Name = "Remake Aimbot(ES)" .. Players.LocalPlayer.Name
	})

	-- Cria Menu com Regui
	local menu = Regui.CreateMenuHud({
		Title = "🎯 Aimbot Menu",
		FrameColor = Color3.fromRGB(30,30,30),
		ButtonColor = Color3.fromRGB(50,50,50)
	}, {
		{
			Name = "Enable Aim",
			Callback = function() aimEnabled = not aimEnabled end,
			StateFunc = function() return aimEnabled end
		},
		{
			Name = "Target NPC",
			Callback = function() includeNPCs = not includeNPCs end,
			StateFunc = function() return includeNPCs end
		},
		{
			Name = "EnemiesOnly",
			Callback = function() targetEnemiesOnly = not targetEnemiesOnly end,
			StateFunc = function() return targetEnemiesOnly end
		},
		{
			Name = "Use Hud Stats",
			Callback = function() Hud_Stats = not Hud_Stats  end,
			StateFunc = function() return Hud_Stats end
		},
	})


	local input = menu.CreateInputText("Distance", "Distance: 50", function(text, enterPressed)
		print("Texto digitado:", text)
		if enterPressed then
			detectionRadius = tonumber(text) or detectionRadius
		end
	end)


end



-- ex 

local function getHudFrame()
	if not hudRefs then return nil end
	-- espera SubFrame primeiro, depois Frame
	local frame = hudRefs.SubFrame or hudRefs.Frame
	if not frame then return nil end

	-- garante que AbsolutePosition e Size estejam atualizados
	frame:GetPropertyChangedSignal("AbsolutePosition"):Wait()
	frame:GetPropertyChangedSignal("AbsoluteSize"):Wait()
	return frame
end


-- Atualiza HUD do status
local function updateHUDStatus(target)
	if hudRefs and hudRefs.Point then
		if not aimEnabled then
			hudRefs.Point.BackgroundColor3 = Color3.fromRGB(255, 255, 0)
		elseif target then
			hudRefs.Point.BackgroundColor3 = Color3.fromRGB(0, 255, 0)
		else
			hudRefs.Point.BackgroundColor3 = Color3.fromRGB(255, 0, 0)
		end
	end
end

-- Função para encontrar o alvo mais próximo
local function findClosestPlayer()
	if not aimEnabled then return nil end
	local character = Players.LocalPlayer.Character
	if not character then return nil end
	local hrp = character:FindFirstChild("HumanoidRootPart")
	if not hrp then return nil end

	local closestTarget = nil
	local closestDistance = detectionRadius

	for _, p in ipairs(Players:GetPlayers()) do
		if p ~= Players.LocalPlayer and p.Character then
			if targetEnemiesOnly and p.Team == Players.LocalPlayer.Team then continue end
			local head = p.Character:FindFirstChild("Head")
			local humanoid = p.Character:FindFirstChildOfClass("Humanoid")
			if head and humanoid and humanoid.Health > 0 then
				local distance = (hrp.Position - head.Position).Magnitude
				if distance < closestDistance then
					closestDistance = distance
					closestTarget = p
				end
			end
		end
	end

	if includeNPCs then
		for _, npc in ipairs(Workspace:GetDescendants()) do
			if npc:IsA("Model") and not Players:GetPlayerFromCharacter(npc) then
				local hum = npc:FindFirstChildOfClass("Humanoid")
				local head = npc:FindFirstChild("Head")
				if hum and head and hum.Health > 0 then
					local distance = (hrp.Position - head.Position).Magnitude
					if distance < closestDistance then
						closestDistance = distance
						closestTarget = { Character = npc }
					end
				end
			end
		end
	end

	return closestTarget
end

-- Função para mirar
local function aimAt(target)
	if not aimEnabled or not target or not target.Character then return end
	local head = target.Character:FindFirstChild("Head")
	if head then
		local targetPosition = head.Position
		local cameraLookAt = CFrame.new(Camera.CFrame.Position, targetPosition)
		Camera.CFrame = cameraLookAt:Lerp(Camera.CFrame, lerpSpeed)
	end
end

-- retorna frame do HUD (garante propriedades atualizadas)
local function safeGetHudFrame()
	if not hudRefs then return nil end
	local frame = hudRefs.SubFrame or hudRefs.Frame
	if not frame then return nil end

	-- se AbsoluteSize já for zero, espera um Heartbeat para garantir renderização
	if frame.AbsoluteSize.X == 0 or frame.AbsoluteSize.Y == 0 then
		RunService.Heartbeat:Wait()
	end
	-- opcional: aguarda sinal caso ainda precise
	if frame.AbsoluteSize.X == 0 or frame.AbsoluteSize.Y == 0 then
		frame:GetPropertyChangedSignal("AbsoluteSize"):Wait()
	end

	return frame
end

-- verifica se a posição do head (em pixels) está dentro do frame do HUD
local function targetIsInsideHud(target)
	if not hudRefs then return false end
	if not target or not target.Character then return false end
	local head = target.Character:FindFirstChild("Head")
	if not head then return false end

	local screenPoint3 = Camera:WorldToViewportPoint(head.Position)
	local sx, sy, sz = screenPoint3.X, screenPoint3.Y, screenPoint3.Z
	if sz <= 0 then return false end -- atrás da camera
	local viewport = Camera.ViewportSize
	if sx < 0 or sx > viewport.X or sy < 0 or sy > viewport.Y then return false end

	local frame = safeGetHudFrame()
	if not frame then return false end
	-- usa AbsolutePosition/Size
	local pos = frame.AbsolutePosition
	local size = frame.AbsoluteSize
	-- confere dentro do retângulo
	return sx >= pos.X and sx <= (pos.X + size.X) and sy >= pos.Y and sy <= (pos.Y + size.Y)
end

-- mira suave (igual sua função aimAt mas usada condicionalmente)
local function aimAtWhenInHud(target)
	if not aimEnabled or not target then return end
	if not targetIsInsideHud(target) then return end

	if not target.Character then return end
	local head = target.Character:FindFirstChild("Head")
	if head then
		local camLook = CFrame.new(Camera.CFrame.Position, head.Position)
		Camera.CFrame = camLook:Lerp(Camera.CFrame, lerpSpeed)
	end
end

-- atualiza posição do ponto do HUD (tweened). se não houver target dentro do HUD, centraliza.
local function updateHudPointPosition(target)
	if not hudRefs or not hudRefs.Point then return end
	local frame = safeGetHudFrame()
	if not frame then return end

	local centerX = frame.AbsolutePosition.X + frame.AbsoluteSize.X * 0.5
	local centerY = frame.AbsolutePosition.Y + frame.AbsoluteSize.Y * 0.5

	-- se target válido e dentro do HUD, mover para a posição do head (limitado ao frame)
	if target and target.Character and targetIsInsideHud(target) then
		local head = target.Character:FindFirstChild("Head")
		if head then
			local screenPoint3 = Camera:WorldToViewportPoint(head.Position)
			local sx, sy = screenPoint3.X, screenPoint3.Y

			-- limita para não ultrapassar o frame
			local pos = frame.AbsolutePosition
			local size = frame.AbsoluteSize
			local clampedX = math.clamp(sx, pos.X, pos.X + size.X)
			local clampedY = math.clamp(sy, pos.Y, pos.Y + size.Y)

			-- converte para posição relativa dentro do frame (pixels)
			local relX = clampedX - pos.X
			local relY = clampedY - pos.Y

			local goal = { Position = UDim2.new(0, relX, 0, relY) }
			local tween = TweenService:Create(hudRefs.Point, TweenInfo.new(0.08, Enum.EasingStyle.Sine, Enum.EasingDirection.Out), goal)
			tween:Play()
			return
		end
	end

	-- fallback: centraliza o point no frame (tween suave)
	local relCenterX = centerX - frame.AbsolutePosition.X
	local relCenterY = centerY - frame.AbsolutePosition.Y
	local goal = { Position = UDim2.new(0, relCenterX, 0, relCenterY) }
	TweenService:Create(hudRefs.Point, TweenInfo.new(0.12, Enum.EasingStyle.Sine, Enum.EasingDirection.Out), goal):Play()
end

-- atualiza cor/estado do ponto (mantive sua função)
local function updateHUDStatusAndPosition(target)
	updateHUDStatus(target)
	--updateHudPointPosition(target)
end


-- Reconstrói HUD quando o personagem renasce (mantendo referências)
local function rebuildHud()
	if not Regui then return end
	hudRefs = Regui.CreateAimbotHUD({
		Parent = PlayerGui,
		FollowMouse = false,
		PulsePoint = false,
		Name = "Remake Aimbot(ES)" .. Players.LocalPlayer.Name
	})
end
--[[
Players.LocalPlayer.CharacterAdded:Connect(function()
	-- espera o personagem carregar completamente
	repeat RunService.Heartbeat:Wait() until Players.LocalPlayer.Character and Players.LocalPlayer.Character:FindFirstChild("HumanoidRootPart")
	rebuildHud()
end)

-- caso o personagem já exista no início do script
if Players.LocalPlayer.Character then
	rebuildHud()
end
]]
-- loop principal: busca alvo, mira e atualiza HUD
RunService.RenderStepped:Connect(function()
	local target = findClosestPlayer()
	if Hud_Stats then
		aimAtWhenInHud(target)            -- mira somente se o target estiver dentro do HUD
		updateHUDStatusAndPosition(target) -- atualiza cor + posição do point
	else
		aimAt(target)                      -- mira normalmente
		updateHUDStatus(target)            -- atualiza cor
	end
end)
