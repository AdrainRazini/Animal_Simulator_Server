-- ModuleScript (ex: ReguiModule)
local Regui = {}

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

function Regui.applyDraggable(frame, dragButton)
	local dragging = false
	local dragStart = Vector2.new()
	local startPos = UDim2.new()

	local function startDrag(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = true
			dragStart = input.Position
			startPos = frame.Position
			input.Changed:Connect(function()
				if input.UserInputState == Enum.UserInputState.End then
					dragging = false
				end
			end)
		end
	end

	local function updateDrag(input)
		if dragging then
			local delta = input.Position - dragStart
			frame.Position = UDim2.new(
				startPos.X.Scale, startPos.X.Offset + delta.X,
				startPos.Y.Scale, startPos.Y.Offset + delta.Y
			)
		end
	end

	dragButton.InputBegan:Connect(startDrag)
	dragButton.InputChanged:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch then
			updateDrag(input)
		end
	end)
end


-- Util: cria e aplica UICorner
local function applyCorner(instance, radius)
	radius = radius or UDim.new(1, 0)
	local corner = instance:FindFirstChildOfClass("UICorner") or Instance.new("UICorner")
	corner.CornerRadius = radius
	corner.Parent = instance
	return corner
end

-- Util: cria UIStroke se quiser
local function applyStroke(parent, thickness, color, transparency)
	local stroke = parent:FindFirstChildOfClass("UIStroke") or Instance.new("UIStroke")
	stroke.Thickness = thickness or 1
	stroke.Color = color or Color3.fromRGB(255,255,255)
	stroke.Transparency = transparency or 0.7
	stroke.Parent = parent
	return stroke
end

-- Remove GUI existente com mesmo nome (evita duplicatas)
local function removeExistingGui(playerGui, name)
	local existing = playerGui:FindFirstChild(name)
	if existing then
		existing:Destroy()
	end
end



function Regui.CreateAimbotHUD(opts)
	opts = opts or {}

	local player = Players.LocalPlayer
	if not player then
		warn("[Regui] CreateAimbotHUD: LocalPlayer não encontrado (esse módulo deve rodar em LocalScript).")
		return
	end

	local playerGui = opts.Parent or player:WaitForChild("PlayerGui")
	local guiName = opts.Name or ("Remake Aimbot(ES)" .. player.Name)

	-- Remove qualquer GUI anterior com mesmo nome
	removeExistingGui(playerGui, guiName)

	-- ScreenGui
	local Hud_Screen = Instance.new("ScreenGui")
	Hud_Screen.Name = guiName
	Hud_Screen.Parent = playerGui
	Hud_Screen.IgnoreGuiInset = true
	Hud_Screen.ResetOnSpawn = false

	-- Frame principal (ponto central / alvo)
	local Hud_Frame = Instance.new("Frame")
	Hud_Frame.Name = "Aimbot"
	Hud_Frame.Size = opts.FrameSize or UDim2.new(0, 75, 0, 75)
	Hud_Frame.AnchorPoint = Vector2.new(0.5, 0.5)
	Hud_Frame.Position = opts.FramePosition or UDim2.new(0.5, 0, 0.5, 0)
	Hud_Frame.BackgroundColor3 = opts.FrameColor or Color3.fromRGB(0, 0, 0)
	Hud_Frame.BackgroundTransparency = opts.FrameTransparency or 0.5
	Hud_Frame.BorderSizePixel = 0
	Hud_Frame.Parent = Hud_Screen
	Hud_Frame.ZIndex = opts.ZIndex or 2
	applyCorner(Hud_Frame, opts.FrameCorner or UDim.new(1,0))
	--applyStroke(Hud_Frame, 1, Color3.new(1,1,1), 0.8) -- descomente para stroke

	-- Sub frame (borda maior)
	local Hud_Sub_Frame = Instance.new("Frame")
	Hud_Sub_Frame.Name = "AimbotSub"
	Hud_Sub_Frame.Size = opts.SubFrameSize or UDim2.new(0, 100, 0, 100)
	Hud_Sub_Frame.AnchorPoint = Vector2.new(0.5, 0.5)
	Hud_Sub_Frame.Position = opts.SubFramePosition or UDim2.new(0.5, 0, 0.5, 0)
	Hud_Sub_Frame.BackgroundColor3 = opts.SubFrameColor or Color3.fromRGB(0,0,0)
	Hud_Sub_Frame.BackgroundTransparency = opts.SubFrameTransparency or 0.8
	Hud_Sub_Frame.BorderColor3 = opts.SubFrameBorderColor or Color3.fromRGB(255,255,255)
	Hud_Sub_Frame.BorderSizePixel = opts.SubFrameBorderSize or 2
	Hud_Sub_Frame.Parent = Hud_Screen
	Hud_Sub_Frame.ZIndex = opts.SubZIndex or 1
	applyCorner(Hud_Sub_Frame, opts.SubFrameCorner or UDim.new(1,0))

	-- Ponto central
	local point = Instance.new("Frame")
	point.Name = "Point"
	point.Size = opts.PointSize or UDim2.new(0, 5, 0, 5)
	point.Visible = true
	point.AnchorPoint = Vector2.new(0.5, 0.5)
	point.Position = opts.PointPosition or UDim2.new(0.5, 0, 0.5, 0)
	point.BackgroundColor3 = opts.PointColor or Color3.fromRGB(255,0,0)
	point.BackgroundTransparency = opts.PointTransparency or 0.5
	point.BorderSizePixel = 0
	point.Parent = Hud_Screen
	point.ZIndex = opts.PointZIndex or 3
	applyCorner(point, opts.PointCorner or UDim.new(1,0))

	-- Opcional: animação de pulsar no ponto
	if opts.PulsePoint then
		local tweenInfo = TweenInfo.new(0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true)
		local tween = TweenService:Create(point, tweenInfo, {Size = (opts.PointPulseSize or UDim2.new(0,8,0,8))})
		tween:Play()
	end

	-- Opcional: seguir o mouse (apenas o point)
	if opts.FollowMouse then
		local UserInputService = game:GetService("UserInputService")
		UserInputService.InputChanged:Connect(function(input)
			
			if input.UserInputType == Enum.UserInputType.MouseMovement then
				-- converte posição do mouse para UDim2 na tela
				local x = math.clamp(input.Position.X, 0, workspace.CurrentCamera.ViewportSize.X)
				local y = math.clamp(input.Position.Y, 0, workspace.CurrentCamera.ViewportSize.Y)
				point.Position = UDim2.fromOffset(x, y)
			end
			
		end)
	end

	-- Retorna referências para manipulação
	local ret = {
		ScreenGui = Hud_Screen,
		Frame = Hud_Frame,
		SubFrame = Hud_Sub_Frame,
		Point = point,
		Destroy = function()
			if Hud_Screen and Hud_Screen.Parent then
				Hud_Screen:Destroy()
			end
		end
	}

	return ret
end


function Regui.CreateMenuHud(opts, list)
	opts = opts or {}
	local player = Players.LocalPlayer
	local playerGui = opts.Parent or player:WaitForChild("PlayerGui")

	-- Remove GUI antiga
	local oldGui = playerGui:FindFirstChild("MenuHud")
	if oldGui then oldGui:Destroy() end

	local Hud_Screen = Instance.new("ScreenGui")
	Hud_Screen.Name = "MenuHud"
	Hud_Screen.DisplayOrder = opts.DisplayOrder or 10
	Hud_Screen.IgnoreGuiInset = true
	Hud_Screen.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	Hud_Screen.ResetOnSpawn = false
	Hud_Screen.Parent = playerGui

	-- Frame principal
	local frame = Instance.new("Frame", Hud_Screen)
	frame.Size = UDim2.new(0, 200, 0, 250)
	frame.Position = UDim2.new(0, 50, 0, 50)
	frame.BackgroundColor3 = opts.FrameColor or Color3.fromRGB(25,25,25)
	frame.BorderSizePixel = 0
	applyCorner(frame, UDim.new(0,10))

	-- Title bar
	local titleBar = Instance.new("TextLabel", frame)
	titleBar.Size = UDim2.new(1, 0, 0, 30)
	titleBar.Position = UDim2.new(0,0,0,0)
	titleBar.BackgroundColor3 = opts.TitleColor or Color3.fromRGB(40,40,40)
	titleBar.Text = opts.Title or "Menu"
	titleBar.TextColor3 = Color3.new(1,1,1)
	titleBar.Font = Enum.Font.SourceSansBold
	titleBar.TextSize = 18
	applyCorner(titleBar, UDim.new(0,10))

	-- Botão minimizar
	local minimizeBtn = Instance.new("TextButton", titleBar)
	minimizeBtn.Size = UDim2.new(0, 20, 0, 20)
	minimizeBtn.Position = UDim2.new(1, -25, 0, 5)
	minimizeBtn.Text = "-"
	minimizeBtn.TextColor3 = Color3.new(1,1,1)
	minimizeBtn.BackgroundColor3 = Color3.fromRGB(50,50,50)
	minimizeBtn.Font = Enum.Font.SourceSansBold
	minimizeBtn.TextSize = 18

	local contentVisible = true
	local function toggleContent()
		contentVisible = not contentVisible
		for _, obj in pairs(frame:GetChildren()) do
			if obj:IsA("GuiObject") and obj ~= titleBar and obj ~= minimizeBtn then
				obj.Visible = contentVisible
			end
		end
		minimizeBtn.Text = contentVisible and "-" or "+"
		frame.Size = contentVisible and UDim2.new(0, 200, 0, 250) or UDim2.new(0, 200, 0, 35)
	end
	minimizeBtn.MouseButton1Click:Connect(toggleContent)

	-- Tornar arrastável
	Regui.applyDraggable(frame, titleBar)

	-- tabela de botões
	local Buttons = {}

	-- função para criar botão
	local function CreateBtn(name, callback, stateFunc)
		local btn = Instance.new("TextButton", frame)
		btn.Size = UDim2.new(1, -20, 0, 30)
		btn.Position = UDim2.new(0, 10, 0, 35 + (#Buttons * 35))
		btn.BackgroundColor3 = opts.ButtonColor or Color3.fromRGB(35,35,35)
		btn.TextColor3 = Color3.new(1,1,1)
		btn.Font = Enum.Font.SourceSans
		btn.TextSize = 16

		-- se tiver função de estado, mostra "Yes" ou "No"
		if stateFunc then
			btn:GetPropertyChangedSignal("Text"):Connect(function()
				-- força atualização inicial
				btn.Text = name .. ": " .. (stateFunc() and "Yes" or "No")
			end)
		else
			btn.Text = name
		end

		if callback then
			btn.MouseButton1Click:Connect(function()
				callback(btn)
				-- atualiza texto imediatamente se tiver stateFunc
				if stateFunc then
					btn.Text = name .. ": " .. (stateFunc() and "Yes" or "No")
				end
			end)
		end

		table.insert(Buttons, btn)
		return btn
	end

   
	-- cria botões iniciais da lista
	if list then
		for _, item in ipairs(list) do
			CreateBtn(item.Name, item.Callback, item.StateFunc)
		end
	end

	-- atualiza textos dos botões de estado a cada frame
	RunService.RenderStepped:Connect(function()
		for i, btn in ipairs(Buttons) do
			if list[i] and list[i].StateFunc then
				btn.Text = list[i].Name .. ": " .. (list[i].StateFunc() and "Yes" or "No")
			end
		end
	end)
	
	-- função para criar um TextBox
	local function CreateInputText(labelName, placeholder, callback)
		local y = 35 + (#Buttons * 35) -- usa a tabela Buttons definida no menu

		-- Frame para Label + TextBox
		local inputFrame = Instance.new("Frame", frame)
		inputFrame.Size = UDim2.new(1, -20, 0, 30)
		inputFrame.Position = UDim2.new(0, 10, 0, y)
		inputFrame.BackgroundTransparency = 1

		local label = Instance.new("TextLabel", inputFrame)
		label.Size = UDim2.new(0.4, 0, 1, 0)
		label.Position = UDim2.new(0,0,0,0)
		label.BackgroundTransparency = 1
		label.TextColor3 = Color3.new(1,1,1)
		label.Text = labelName or "Input"
		label.Font = Enum.Font.SourceSans
		label.TextSize = 16
		label.TextXAlignment = Enum.TextXAlignment.Left

		local inputBox = Instance.new("TextBox", inputFrame)
		inputBox.Size = UDim2.new(0.6, 0, 1, 0)
		inputBox.Position = UDim2.new(0.4, 5, 0, 0)
		inputBox.BackgroundColor3 = Color3.fromRGB(40,40,40)
		inputBox.TextColor3 = Color3.new(1,1,1)
		inputBox.PlaceholderText = placeholder or ""
		inputBox.Font = Enum.Font.SourceSans
		inputBox.TextSize = 16
		inputBox.Text = ""
		inputBox.ClearTextOnFocus = false

		inputBox.FocusLost:Connect(function(enterPressed)
			if callback then
				callback(inputBox.Text, enterPressed)
			end
		end)

		table.insert(Buttons, inputBox)
		return inputBox
	end




	return {
		ScreenGui = Hud_Screen,
		Frame = frame,
		MinimizeBtn = minimizeBtn,
		Buttons = Buttons,
		CreateBtn = CreateBtn,
		CreateInputText = CreateInputText
	}
end





return Regui
