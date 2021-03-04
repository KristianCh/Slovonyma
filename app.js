const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const util = require('util');
var sql = require("mssql");

var app = express();
var server = require('http').createServer(app);

var io = require('socket.io')(server);


app.use(express.static(path.join(__dirname, '/public')));
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/game.html');
});

app.get('/ako-hrat', (req, res) => {
  res.sendFile(__dirname + '/public/how_to_play.html');
});

app.post('/verify-login' , function(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    loginPlayerPOST(req.body, res, next);
});

app.post('/verify-register' , function(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    registerNewPlayerPOST(req.body, res, next);
});

server.listen(process.env.port);

game_server = require('./gameServer');

var dbConfig = require(__dirname + '//dbConfig.json');
console.log(dbConfig);

function uploadGameData(data) {
  console.log(data);
  var conn = new sql.ConnectionPool(dbConfig);

  conn.connect()
      // Successfull connection
      .then(async function () {
        var req = new sql.Request(conn);
        var queryResult = await req.query(util.format(
            "SELECT ID FROM [dbo].[Hraci] WHERE prezyvka='%s'", data.guesser));
        var guesserID = queryResult.recordset[0].ID;
        queryResult = await req.query(util.format(
            "SELECT ID FROM [dbo].[Hraci] WHERE prezyvka='%s'", data.describer));
        var describerID = queryResult.recordset[0].ID;
        queryResult = await req.query(util.format(
            "SELECT ID FROM [dbo].[Slova] WHERE lema='%s'", data.word));
        var wordID = 0;
        if (queryResult.recordset.length > 0) wordID = queryResult.recordset[0].ID;
        else {
          queryResult = await req.query(util.format(
              "INSERT INTO [dbo].[Slova] (lema, vytvorene_hracom) OUTPUT Inserted.ID VALUES('%s', 1)", data.word));
          wordID = queryResult.recordset[0].ID;
        }
        for (var i = 0; i < data.hints.length; i++) {
          await req.query(util.format(
              "INSERT INTO [dbo].[Indicie] (text, cas_vytvorenia, slovo, hrac) VALUES('%s', %d, %d, %d)",
              data.hints[i].text, data.hints[i].timestamp, wordID, describerID));
        }
        var guessKeys = Object.keys(data.guessedWords);
        for (var i = 0; i < guessKeys.length; i++) {
          if (data.guessedWords[guessKeys[i]].rating >= 0) {
            queryResult = await req.query(util.format(
                "SELECT ID FROM [dbo].[Slova] WHERE lema='%s'", guessKeys[i]));
            var guessID = 0;
            if (queryResult.recordset.length > 0) guessID = queryResult.recordset[0].ID;
            else {
              queryResult = await req.query(util.format(
                  "INSERT INTO [dbo].[Slova] (lema, vytvorene_hracom) OUTPUT Inserted.ID VALUES('%s', 1)", guessKeys[i]));
              guessID = queryResult.recordset[0].ID;
            }
            await req.query(util.format(
                "INSERT INTO [dbo].[Ohodnotenia] (sila_ohodnotenia, cas_vytvorenia, slovo1, slovo2, hrac1, hrac2) " +
                "VALUES(%d, %d, %d, %d, %d, %d)",
                data.guessedWords[guessKeys[i]].rating, data.guessedWords[guessKeys[i]].timestamp,
                wordID, guessID, describerID, guesserID));
          }
        }
        await req.query(util.format(
            "UPDATE [dbo].[Hraci] SET odohrane_hry = odohrane_hry + 1, celkove_body = celkove_body + %d WHERE ID = %d",
            data.describerPoints, describerID));
        await req.query(util.format(
            "UPDATE [dbo].[Hraci] SET odohrane_hry = odohrane_hry + 1, celkove_body = celkove_body + %d WHERE ID = %d",
            data.guesserPoints, guesserID));

        conn.close();
      })
      // Handle connection errors
      .catch(function (err) {
        console.log(err);
        conn.close();
      });
}

async function loginPlayerPOST(data, res, next) {
    data.password = data.password.replace(";", "");
    data.name = data.name.replace(";", "");
    var conn = new sql.ConnectionPool(dbConfig);
    conn.connect()
        // Successfull connection
        .then(async function () {
            var req = new sql.Request(conn);
            var queryResult = await req.query(util.format("SELECT heslo FROM [dbo].[Hraci] WHERE prezyvka='%s'", data.name));
            if (queryResult.recordset.length < 1) {
                res.json({response: false});
                next();
                conn.close();
                return;
            }
            bcrypt.compare(data.password, queryResult.recordset[0].heslo)
                .then(result => {
                    res.json({response: result});
                    next();
                });
            conn.close();
        })
        // Handle connection errors
        .catch(function (err) {
            console.log(err);
            conn.close();
        });
}

async function registerNewPlayerPOST(data, res, next) {
    var conn = new sql.ConnectionPool(dbConfig);
    data.password = data.password.replace(";", "");
    data.name = data.name.replace(";", "");
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
                res.json({response: true});
                next();
            }
            else {
                res.json({response: false});
                next();
            }
            conn.close();
        })
        // Handle connection errors
        .catch(function (err) {
            console.log(err);
            conn.close();
        });
}

async function displayLeaderboard(socket, filterName) {
  var conn = new sql.ConnectionPool(dbConfig);

  conn.connect()
      // Successfull connection
      .then(async function () {
        var req = new sql.Request(conn);
        var queryResult = await req.query(util.format(
            "SELECT TOP 10 prezyvka, odohrane_hry, celkove_body, (ISNULL(c1, 0)+ISNULL(c2, 0))ohodnotene_slova FROM (("+
            "SELECT ID, prezyvka, odohrane_hry, celkove_body, c1 FROM [dbo].[Hraci] LEFT JOIN"+
            "(SELECT COUNT(hrac1) AS c1, hrac1 FROM [dbo].[Ohodnotenia] GROUP BY hrac1) AS oh1 ON [dbo].[Hraci].ID=hrac1"+
            ")"+
            "AS v1 LEFT JOIN"+
            "(SELECT COUNT(hrac2) AS c2, hrac2 FROM [dbo].[Ohodnotenia] GROUP BY hrac2) AS oh2 ON v1.ID=hrac2)"+
            "WHERE prezyvka LIKE '%s%' ORDER BY celkove_body DESC;", filterName));
        game_server.displayLeaderboard(io, socket, queryResult.recordset);

        conn.close();
      })
      // Handle connection errors
      .catch(function (err) {
        console.log(err);
        conn.close();
      });
}

async function getPresetWords() {
  var conn = new sql.ConnectionPool(dbConfig);
  var out = ['obrovský', 'skala', 'kopec'];
  await conn.connect();
  var req = new sql.Request(conn);
  var queryResult = await req.query("SELECT TOP 3 lema FROM [dbo].[Slova] WHERE vytvorene_hracom = 0 ORDER BY newid()");
  out[0] = queryResult.recordset[0].lema;
  out[1] = queryResult.recordset[1].lema;
  out[2] = queryResult.recordset[2].lema;
  conn.close();
  return out;
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
    displayLeaderboard(socket, filterName);
  });
});