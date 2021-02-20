const express = require('express');
const path = require('path');

var app = express();
var server = require('http').createServer(app);

var io = require('socket.io')(server);


app.use(express.static(path.join(__dirname, '/public')));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/game.html');
});

app.get('/ako-hrat', (req, res) => {
  res.sendFile(__dirname + '/public/how_to_play.html');
});

server.listen(process.env.port)

game_server = require('./gameServer')

function uploadGameData(data) {
  //tu sa nahraju udaje z hry do databazy
}

function getPresetWords() {
  return ['obrovský', 'skala', 'kopec'];
}

game_server.successfulGuessUpdate = uploadGameData;
game_server.getPresetWords = getPresetWords;

io.on('connection', (socket) => {
  io.set('transports', ['websocket']);
  socket.on('disconnect', () => {
    game_server.disconnectUser(io, socket);
  });
  socket.on('join room', (data, callback) => {
    //tu sa z databazy nacitaju 3 slova na hadanie
    game_server.connectUserToRoom(io, socket, data, callback);
  });
  socket.on('login', (data, callback) => {
    //tu bude overenie prihlasenia
    game_server.confirmLogin(io, socket, !(data.name === ''), callback);
  });
  socket.on('register', (data, callback) => {
    //tu bude overenie registracie
    game_server.confirmLogin(io, socket, !(data.name === ''), callback);
  });
  socket.on('select word', (word) => {
    game_server.selectWord(io, socket, word);
  });
  socket.on('hint submit', (hint) => {
    game_server.hintSubmit(io, socket, hint);
  });
  socket.on('guess submit', (guess) => {
    game_server.guessSubmit(io, socket, guess);
  });
  socket.on('rate guess', (data) => {
    game_server.rateGuess(io, socket, data);
  });
  socket.on('replay', ()=> {
    game_server.replay(io, socket);
  });
  socket.on('request leaderboard', (filterName)=> {
    //tu sa z databazy nacitaju udaje o hracoch
    scores = [
      ['Ivan', 10, 1400, 90],
      ['Maroš', 11, 1300, 85],
      ['Zuzka', 4, 1200, 80],
      ['Boris', 2, 1100, 75],
      ['Ignác', 43, 1000, 70],
      ['Júlia', 50, 900, 75],
      ['Tereza', 51, 800, 70],
      ['Fero', 61, 700, 65],
      ['Ivan2', 2, 600, 60],
      ['Ivan3', 3, 50, 55],
    ];
    if (filterName !== '') {
      scores = [
        ['Ivan', 10, 1400, 90],
        ['Maroš', 11, 1300, 85],
        ['Zuzka', 4, 1200, 80],
        ['Boris', 2, 1100, 75]
      ];
    }
    game_server.displayLeaderboard(io, socket, scores);
  });
});