const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const app = express();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public')); // carpeta donde estará tu HTML y JS

let players = {}; // objeto para almacenar la info de todos los jugadores

wss.on('connection', ws => {
  const id = Date.now() + Math.random(); // ID único
  players[id] = { x:0, y:10, z:0, rotationY:0 };

  // Enviar estado inicial a todos
  ws.send(JSON.stringify({ type:'init', id, players }));

  ws.on('message', message => {
    const data = JSON.parse(message);
    if(data.type === 'update'){
      players[id] = data.player;
      // reenviar a todos los demás
      wss.clients.forEach(client => {
        if(client !== ws && client.readyState === WebSocket.OPEN){
          client.send(JSON.stringify({ type:'update', id, player: data.player }));
        }
      });
    }
  });

  ws.on('close', () => {
    delete players[id];
    // notificar a los demás jugadores
    wss.clients.forEach(client => {
      if(client.readyState === WebSocket.OPEN){
        client.send(JSON.stringify({ type:'remove', id }));
      }
    });
  });
});

//server.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));