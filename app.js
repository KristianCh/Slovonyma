const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const bcrypt = require('bcrypt');
const util = require('util');
var sql = require("mssql");

var app = express();

app.use(express.static(path.join(__dirname, '/public')));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/game.html');
});

app.get('/ako-hrat', (req, res) => {
  res.sendFile(__dirname + '/public/how_to_play.html');
});

const credentials = {
  key: fs.readFileSync('certificate/key.pem'),
  cert: fs.readFileSync('certificate/cert.pem')
};

var server = https.createServer(credentials, app);

server.listen({ port: 5000, host: '192.168.0.16'}, () => {
  console.log('listening on https://192.168.0.16:5000');
});

var io = require('socket.io')(server);

game_server = require('./gameServer')

var dbConfig = JSON.parse(fs.readFileSync('dbConfig.json'));
console.log(dbConfig);

function uploadGameData(data) {
  //tu sa nahraju udaje z hry do databazy
}

async function loginPlayer(socket, data, callback) {
  var conn = new sql.ConnectionPool(dbConfig);

  conn.connect()
      // Successfull connection
      .then(async function () {
        var req = new sql.Request(conn);
        var queryResult = await req.query(util.format("SELECT heslo FROM [dbo].[Hraci] WHERE prezyvka='%s'", data.name));
        if (queryResult.recordset.length < 1) {
          game_server.confirmLogin(io, socket, false, callback);
          conn.close();
          return;
        }
        bcrypt.compare(data.password, queryResult.recordset[0].heslo)
            .then(result => {
              game_server.confirmLogin(io, socket, result, callback);
            });
        conn.close();
      })
      // Handle connection errors
      .catch(function (err) {
        console.log(err);
        conn.close();
      });
}

async function registerNewPlayer(socket, data, callback) {
  var conn = new sql.ConnectionPool(dbConfig);

  conn.connect()
      // Successfull connection
      .then(async function () {

        // Create request instance, passing in connection instance
        var req = new sql.Request(conn);
        var queryResult = await req.query(util.format("SELECT prezyvka FROM [dbo].[Hraci] WHERE prezyvka='%s'", data.name))

        if (queryResult.recordset.length === 0) {
          var hash = await bcrypt.hash(data.password, 5)
          await req.query(util.format("INSERT INTO [dbo].[Hraci] (prezyvka, heslo, odohrane_hry, celkove_body)" +
              "VALUES ('%s', '%s', 0, 0)", data.name, hash));
          game_server.confirmLogin(io, socket, true, callback);
        }
        else game_server.confirmLogin(io, socket, false, callback);
        conn.close();
      })
      // Handle connection errors
      .catch(function (err) {
        console.log(err);
        conn.close();
      });
}

function getPresetWords() {
  return ['obrovský', 'skala', 'kopec'];
}

game_server.successfulGuessUpdate = uploadGameData;
game_server.getPresetWords = getPresetWords;

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    game_server.disconnectUser(io, socket);
  });
  socket.on('join room', (data, callback) => {
    //tu sa z databazy nacitaju 3 slova na hadanie
    game_server.connectUserToRoom(io, socket, data, callback);
  });
  socket.on('login', (data, callback) => {
    loginPlayer(socket, data, callback);
  });
  socket.on('register', (data, callback) => {
    registerNewPlayer(socket, data, callback);
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
  socket.on('show typing hint', (data)=>{
    game_server.showTypingHint(io, socket, data);
  });
  socket.on('show typing guess', (data)=>{
    game_server.showTypingGuess(io, socket, data);
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

var host = process.env.HOST || '127.0.0.1';
// Listen on a specific port via the PORT environment variable
var port = process.env.PORT || 8080;

var cors_proxy = require('cors-anywhere');
cors_proxy.createServer({
  originWhitelist: [], // Allow all origins
  removeHeaders: ['cookie', 'cookie2']
}).listen(port, host, function() {
  console.log('Running CORS Anywhere on ' + host + ':' + port);
});