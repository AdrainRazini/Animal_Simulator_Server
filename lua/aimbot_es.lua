
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local PlayerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
local Workspace = game:GetService("Workspace")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Camera = Workspace.CurrentCamera

-- Check if a ScreenGui named "AimbotV2" already exists
local existingScreenGui = game.Players.LocalPlayer:WaitForChild("PlayerGui"):FindFirstChild("Remake Aimbot(ES)" .. Players.LocalPlayer.Name)

if existingScreenGui then
	return
end

game:GetService("StarterGui"):SetCore("SendNotification", { 
	Title = "Master + ADN Mod";
	Text = "AimBot V2";
	Icon = "rbxthumb://type=Asset&id=72684486485553&w=150&h=150",
	Duration = 16;
})


-- Variáveis da mira
local detectionRadius = 150
local lerpSpeed = 0.1
local aimEnabled = true
local targetEnemiesOnly = false
local includeNPCs = true
local Hud_Stats = true
-- Configuração da suavização (pode mudar dinamicamente)
local AIM_SMOOTH = true -- true = suave (Lerp) | false = mira direta

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
		{
			Name = "Lerp Camera",
			Callback = function() AIM_SMOOTH = not AIM_SMOOTH  end,
			StateFunc = function() return AIM_SMOOTH end
		}
	})


	local input = menu.CreateInputText("Distance", "Distance: " ..detectionRadius, function(text, enterPressed)
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

	-- procura jogadores
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

	-- procura NPCs
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

	return closestTarget -- sempre retorna o mais próximo vivo dentro do raio
end

-- Retorna posição da cabeça do alvo
local function getHeadPosition(target)
	if not target or not target.Character then return nil end
	local head = target.Character:FindFirstChild("Head")
	return head and head.Position or nil
end

-- Verifica se a cabeça do alvo está dentro do HUD
local function targetIsInsideHud(target)
	if not hudRefs or not hudRefs.Frame then return false end
	local headPos = getHeadPosition(target)
	if not headPos then return false end

	local screenPoint3 = Camera:WorldToViewportPoint(headPos)
	local sx, sy, sz = screenPoint3.X, screenPoint3.Y, screenPoint3.Z
	if sz <= 0 then return false end -- atrás da câmera

	local frame = safeGetHudFrame()
	if not frame then return false end
	local pos, size = frame.AbsolutePosition, frame.AbsoluteSize

	return sx >= pos.X and sx <= (pos.X + size.X)
		and sy >= pos.Y and sy <= (pos.Y + size.Y)
end

-- Mira genérica (com checagem de HUD opcional)
local function aimAt(target, options)
	options = options or {}
	if not aimEnabled or not target then return end

	local headPos = getHeadPosition(target)
	if not headPos then return end

	-- Ignora se alvo não estiver dentro do HUD, quando requisitado
	if options.RequireHud and not targetIsInsideHud(target) then return end

	local cam = Camera
	local newCFrame = CFrame.new(cam.CFrame.Position, headPos)

	-- Se Smooth = false → mira direta instantânea
	if options.Smooth == false then
		cam.CFrame = newCFrame
	else
		local speed = options.LerpSpeed or lerpSpeed
		cam.CFrame = cam.CFrame:Lerp(newCFrame, speed)
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




-- Loop principal: busca alvo, mira e atualiza HUD
RunService.RenderStepped:Connect(function(dt)
	local hasHud = Hud_Stats and hudRefs
	local target = findClosestPlayer()

	if not target then
		-- Nenhum alvo → limpa HUD
		if hasHud then
			updateHUDStatusAndPosition(nil)
		else
			updateHUDStatus(nil)
		end
		return
	end

	-- Opções padrão para a função aimAt
	local aimOptions = {
		RequireHud = hasHud,
		Smooth = AIM_SMOOTH,
		LerpSpeed = lerpSpeed
	}

	-- Mira e atualiza status
	aimAt(target, aimOptions)

	if hasHud then
		updateHUDStatusAndPosition(target)
	else
		updateHUDStatus(target)
	end
end)

UserInputService.InputBegan:Connect(function(input, gp)
	if gp then return end
	if input.KeyCode == Enum.KeyCode.F then
		AIM_SMOOTH = not AIM_SMOOTH
		print("Modo de mira:", AIM_SMOOTH and "Suave" or "Instantâneo")
	end
end)
