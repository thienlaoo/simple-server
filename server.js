const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept'],
        credentials: true
    }
});

app.use(express.json());
app.use(express.static('public'));
app.use(cors());

const apikey = process.env.API_KEY;
let messages = [];
let rooms = {};

app.post('/process-txid', async (req, res) => {
    const { txid, message } = req.body;
    try {
        const response = await axios.get(`https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txid}&apikey=${apikey}`);
        const txInfo = response.data.result;

        const formattedTxInfo = {
            Txid: txInfo.hash,
            Date: new Date(parseInt(txInfo.timeStamp) * 1000).toLocaleString(),
            Amount: `${parseInt(txInfo.value, 16)} wei`,
            WalletFrom: txInfo.from,
            WalletTo: txInfo.to
        };

        console.log('tx', formattedTxInfo)
        res.json({ txInfo: formattedTxInfo, message });
    } catch (error) {
        console.error('Error processing txid:', error);
        res.status(500).json({ error: 'Error processing txid' });
    }
});

io.on('connection', (socket) => {
    socket.emit('initial-messages', messages);

    socket.on('join-room', (roomId, name) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        if (!rooms[roomId].includes(name)) {
            rooms[roomId].push(name);
            io.to(roomId).emit('user-connected', { message: name });
            console.log(`Пользователь ${name} присоединился к комнате ${roomId}, массив ${rooms}`);
        }
    });

    socket.on('send-message', (data) => {
        const { roomId, message } = data;
        console.log('msg', message)
        console.log(`Пользователь ${socket.id} отправил сообщение: "${message}" в комнату ${roomId}`);
        io.to(roomId).emit('receive-message', message);
    });

    socket.on('disconnect', () => {
        console.log(`Пользователь ${socket.id} отключен`);
        for (const roomId in rooms) {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
        }
    });
});

server.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});
