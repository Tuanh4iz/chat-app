const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, clientTracking: true });

app.use(express.static(path.join(__dirname, 'public')));

// Lưu clients với timestamp
const clients = new Map();

wss.on('connection', (ws, req) => {
  const id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  const ip = req.socket.remoteAddress;
  clients.set(id, { ws, alive: true, ip });
  console.log(`🟢 Client ${id} (${ip}) kết nối, tổng: ${clients.size}`);

  // Gửi tin nhắn chào mừng
  ws.send(JSON.stringify({
    type: 'system',
    message: '👋 Chào mừng bạn đến phòng chat!'
  }));

  // Xử lý ping/pong
  ws.on('pong', () => {
    const client = clients.get(id);
    if (client) client.alive = true;
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      // Broadcast đến tất cả client khác
      clients.forEach((client, clientId) => {
        if (clientId !== id && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'message',
            username: message.username || 'Ẩn danh',
            text: message.text || '',
            image: message.image || null,
            timestamp: new Date().toLocaleTimeString()
          }));
        }
      });
    } catch (e) {
      console.error('Lỗi xử lý tin nhắn:', e);
    }
  });

  ws.on('close', (code, reason) => {
    clients.delete(id);
    console.log(`🔴 Client ${id} mất kết nối (code: ${code}), tổng: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error(`⚠️ Lỗi WebSocket client ${id}:`, err.message);
  });
});

// Ping clients mỗi 25 giây
setInterval(() => {
  const now = Date.now();
  clients.forEach((client, id) => {
    if (!client.alive) {
      client.ws.terminate();
      clients.delete(id);
      console.log(`💀 Client ${id} bị terminate do timeout`);
    } else {
      client.alive = false;
      client.ws.ping();
    }
  });
}, 25000);

const PORT = process.env.PORT || 3801;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Chat server đang chạy tại http://localhost:${PORT}`);
});