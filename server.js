const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve arquivos estáticos da pasta "lua"
app.use('/lua', express.static(path.join(__dirname, 'lua')));

app.get('/', (req, res) => {
    res.send('Servidor Lua local rodando! Acesse /lua/mod_animal_simulator_v2.lua');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
