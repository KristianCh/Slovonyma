//import knižníc
const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const bcrypt = require('bcrypt');
const util = require('util');
const bodyParser = require('body-parser');
var sql = require("mssql/msnodesqlv8");

var app = express();

//nastavenie vlastností aplikácie
app.use(express.static(path.join(__dirname, '/public')));
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

//nastavenie súboru na zobrazenie pri načítaní defaultnej stránky
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/game.html');
});

//nastavenie súboru na zobrazenie pri načítaní stránky s návodom
app.get('/ako-hrat', (req, res) => {
  res.sendFile(__dirname + '/public/how_to_play.html');
});

//spracovanie POST requestu pre prihlásenie
app.post('/verify-login' , function(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    loginPlayerPOST(req.body, res, next);
});

//spracovanie POST requestu pre registráciu
app.post('/verify-register' , function(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    registerNewPlayerPOST(req.body, res, next);
});

//načítanie HTTPS certifikátov
const credentials = {
  key: fs.readFileSync('certificate/key.pem'),
  cert: fs.readFileSync('certificate/cert.pem')
};

//vytvorenie HTTPS serveru
var server = https.createServer(credentials, app);

//pripojenie serveru na port a adresu
server.listen({ port: 5000, host: '192.168.0.16'}, () => {
  console.log('listening on https://192.168.0.16:5000');
});

//vytvorenie socket.IO rozhrania nad serverom
var io = require('socket.io')(server);

//vytvorenie herného serveru
game_server = require('./gameServer')

//načítanie nastavení pre pripojenie do databázy
var dbConfig = JSON.parse(fs.readFileSync('dbConfigLocal.json'));

/*
 *  Funkcia na nahranie údajov z hry do databázy. Získa ID hráčov podľa ich prezývok. Pre ohodnotené slová taktiež
 *  nájde ID, ak ešte nie sú v databáze, vytvorí nové záznamy pre tieto slová. Vytvorí ohodnotenia slov a nahrá do
 *  databázy nové záznamy s týmito vzťahmi. Do databázy nahrá indície. Pre hráčov updatene počet odohraných hier a
 *  bodov.
 */
function uploadGameData(data) {
    console.log(data);
    var conn = new sql.ConnectionPool(dbConfig);

    conn.connect()
        //úspešné pripojenie
        .then(async function () {
            //vytvorenie requestu
            var req = new sql.Request(conn);
            //načítanie ID hádača
            var queryResult = await req.query(util.format(
                "SELECT ID FROM [dbo].[Hraci] WHERE prezyvka='%s'", data.guesser));
            //načítanie ID opisovača
            var guesserID = queryResult.recordset[0].ID;
            queryResult = await req.query(util.format(
                "SELECT ID FROM [dbo].[Hraci] WHERE prezyvka='%s'", data.describer));
            //načítanie ID hlavného slova
            var describerID = queryResult.recordset[0].ID;
            queryResult = await req.query(util.format(
                "SELECT ID FROM [dbo].[Slova] WHERE lema='%s'", data.word));
            var wordID = 0;
            //ak hlavné slovo nie je v databáze, vytvorí nový záznam a získa jeho ID
            if (queryResult.recordset.length > 0) wordID = queryResult.recordset[0].ID;
            else {
                queryResult = await req.query(util.format(
                    "INSERT INTO [dbo].[Slova] (lema, vytvorene_hracom) OUTPUT Inserted.ID VALUES('%s', 1)", data.word));
                wordID = queryResult.recordset[0].ID;
            }
            //nahrá indície do databázy
            for (var i = 0; i < data.hints.length; i++) {
                await req.query(util.format(
                    "INSERT INTO [dbo].[Indicie] (text, cas_vytvorenia, slovo, hrac) VALUES('%s', %d, %d, %d)",
                    data.hints[i].text, data.hints[i].timestamp, wordID, describerID));
            }
            /*
             *  Pre každé slovo načíta ID, ak slovo nie je v databáze, vytvorí nový záznam a získa jeho ID
             *  Následne pre slová nahrá do databázy ohodnotenia s hlavným slovom.
             */
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
            //updatne počet odohraných hier a bodov pre opisovača
            await req.query(util.format(
                "UPDATE [dbo].[Hraci] SET odohrane_hry = odohrane_hry + 1, celkove_body = celkove_body + %d WHERE ID = %d",
                data.describerPoints, describerID));
            //updatne počet odohraných hier a bodov pre hádača
            await req.query(util.format(
                "UPDATE [dbo].[Hraci] SET odohrane_hry = odohrane_hry + 1, celkove_body = celkove_body + %d WHERE ID = %d",
                data.guesserPoints, guesserID));

            conn.close();
        })
        //neúspešné pripojenie
        .catch(function (err) {
            console.log(err);
            conn.close();
        });
}

/*
 *  Funkcia na overenie prihlásenia hráča. Načíta hash hesla s databázy a overí proti nemu zadané heslo.
 *  Výsledok vráti ako response k POST requestu a zavolá callback funkciu next.
 */
async function loginPlayerPOST(data, res, next) {
    //vytvorenie spojenia
    var conn = new sql.ConnectionPool(dbConfig);
    //vymazanie prípadných bodkočiarok
    data.password = data.password.replace(";", "");
    data.name = data.name.replace(";", "");

    conn.connect()
        //úspešné pripojenie
        .then(async function () {
            //vytvorenie requestu
            var req = new sql.Request(conn);
            //načítanie hashu hesla hráča
            var queryResult = await req.query(util.format("SELECT heslo FROM [dbo].[Hraci] WHERE prezyvka='%s'", data.name));
            //ak hráč so zadanou prezývkou neexistuje, vráti neúspech
            if (queryResult.recordset.length < 1) {
                res.json({response: false});
                next();
                conn.close();
                return;
            }
            //ak sa hash úspešne načítal, overí zadané heslo proti nemu. Vráti výsledok overenia
            bcrypt.compare(data.password, queryResult.recordset[0].heslo)
                .then(result => {
                    res.json({response: result});
                    next();
                });
            //ukončí spojenie
            conn.close();
        })
        //neúspešné pripojenie
        .catch(function (err) {
            console.log(err);
            conn.close();
        });
}

/*
 *  Funkcia na overenie registráciu nového hráča. Overí, či zadaná prezývka neexistuje, ak nie, vytvorí záznam
 *  pre nového hráča. Ako výsledok vráti úspech alebo neúspech registrácie. Výsledok vráti ako response k POST
 *  requestu a zavolá callback funkciu next.
 */
async function registerNewPlayerPOST(data, res, next) {
    //vytvorenie spojenia
    var conn = new sql.ConnectionPool(dbConfig);
    //vymazanie prípadných bodkočiarok
    data.password = data.password.replace(";", "");
    data.name = data.name.replace(";", "");

    conn.connect()
        //úspešné pripojenie
        .then(async function () {
            //vytvorenie requestu
            var req = new sql.Request(conn);
            //zistí, či existuje záznam so zadanou prezývkou
            var queryResult = await req.query(util.format("SELECT prezyvka FROM [dbo].[Hraci] WHERE prezyvka='%s'", data.name))
            //ak neexisuje záznam so zadanou prezývkou, vytvorí nový záznam pre hráča. Vráti úspech.
            if (queryResult.recordset.length === 0) {
                var hash = await bcrypt.hash(data.password, 5)
                await req.query(util.format("INSERT INTO [dbo].[Hraci] (prezyvka, heslo, odohrane_hry, celkove_body)" +
                    "VALUES ('%s', '%s', 0, 0)", data.name, hash));
                res.json({response: true});
                next();
            }
            //ak existuje záznam so zadanou prezývkou, vráti neúspech
            else {
                res.json({response: false});
                next();
            }
            //ukončí spojenie
            conn.close();
        })
        //neúspešné pripojenie
        .catch(function (err) {
            console.log(err);
            conn.close();
        });
}


/*
 *  Funkcia na načítanie údajov pre rebríček hráčov.
 */
async function displayLeaderboard(socket, filterName) {
    //vytvorenie spojenia
    var conn = new sql.ConnectionPool(dbConfig);
    conn.connect()
        //úspešné pripojenie
        .then(async function () {
            //vytvorenie requestu
            var req = new sql.Request(conn);
            //načítanie prvých 10 záznamov hráčov, s prezývkou, odohranými hrami, celkovými bodmi a počtom ohodnotených
            // slov, ktorých začiatok sa zhoduje so zadaným filtrom
            var queryResult = await req.query(util.format(
                "SELECT TOP 10 prezyvka, odohrane_hry, celkove_body, (ISNULL(c1, 0)+ISNULL(c2, 0))ohodnotene_slova FROM (("+
                "SELECT ID, prezyvka, odohrane_hry, celkove_body, c1 FROM [dbo].[Hraci] LEFT JOIN"+
                "(SELECT COUNT(hrac1) AS c1, hrac1 FROM [dbo].[Ohodnotenia] GROUP BY hrac1) AS oh1 ON [dbo].[Hraci].ID=hrac1"+
                ")"+
                "AS v1 LEFT JOIN"+
                "(SELECT COUNT(hrac2) AS c2, hrac2 FROM [dbo].[Ohodnotenia] GROUP BY hrac2) AS oh2 ON v1.ID=hrac2)"+
                "WHERE prezyvka LIKE '%s%' ORDER BY celkove_body DESC;", filterName));
            //zavolanie funkcie herného servera pre posunutie údajov v rebríčku klientovi
            game_server.displayLeaderboard(io, socket, queryResult.recordset);
            //ukončí spojenie
            conn.close();
        })
        //neúspešné pripojenie
        .catch(function (err) {
            console.log(err);
            conn.close();
        });
}

/*
 *  Funkcia na načítanie troch náhodných slov, z ktorých si bude môcť opisovač vybrať.
 */
async function getPresetWords() {
    //vytvorenie spojenia
    var conn = new sql.ConnectionPool(dbConfig);
    //vytvorenie pola pre slová
    var out = ['obrovský', 'skala', 'kopec'];
    //čakanie na pripojenie
    await conn.connect();
    //vytvorenie requestu
    var req = new sql.Request(conn);
    //načítanie troch náhodných slov z databázy
    var queryResult = await req.query("SELECT TOP 3 lema FROM [dbo].[Slova] ORDER BY newid()");
    out[0] = queryResult.recordset[0].lema;
    out[1] = queryResult.recordset[1].lema;
    out[2] = queryResult.recordset[2].lema;
    //ukončí spojenie
    conn.close();
    return out;
}

//hernému serveru nastaví funkcie pre nahranie údajov z hry do databázy a načítanie slov pre opisovača
game_server.successfulGuessUpdate = uploadGameData;
game_server.getPresetWords = getPresetWords;

/*
 *  Spracovanie socket requestov a posunutie údajov zo socket requestov hernému serveru na spracovanie
 */
io.on('connection', (socket) => {
    //zavolá funkciu herného servera na spracovanie odpojenia hráča
    socket.on('disconnect', () => {
        game_server.disconnectUser(io, socket);
    });
    //zavolá funkciu herného servera na spracovanie žiadosti o pripojenie hráča do miestnosti
    socket.on('join room', (data, callback) => {
        game_server.connectUserToRoom(io, socket, data, callback);
    });
    //zavolá funkciu herného servera na spracovanie výberu slova
    socket.on('select word', (word) => {
        game_server.selectWord(io, socket, word);
    });
    //zavolá funkciu herného servera na spracovanie zadania indície
    socket.on('hint submit', (hint) => {
        game_server.hintSubmit(io, socket, hint);
    });
    //zavolá funkciu herného servera na spracovanie hádania slova
    socket.on('guess submit', (guess) => {
        game_server.guessSubmit(io, socket, guess);
    });
    //zavolá funkciu herného servera na spracovanie ohodnotenie slova
    socket.on('rate guess', (data) => {
        game_server.rateGuess(io, socket, data);
    });
    //zavolá funkciu herného servera na spracovanie žiadosti o pokračovanie hry
    socket.on('replay', ()=> {
        game_server.replay(io, socket);
    });
    //zavolá funkciu herného servera na spracovanie zobrazenia písania indície
    socket.on('show typing hint', (data)=>{
        game_server.showTypingHint(io, socket, data);
    });
    //zavolá funkciu herného servera na spracovanie zobrazenia písania slova
    socket.on('show typing guess', (data)=>{
        game_server.showTypingGuess(io, socket, data);
    });
    //zavolá funkciu na zobrazenie rebríčka hráčov
    socket.on('request leaderboard', (filterName)=> {
        displayLeaderboard(socket, filterName);
    });
});

//nastaví host adresu a port pre CorsAnywhere server
var host = process.env.HOST || '127.0.0.1';
var port = process.env.PORT || 8080;

//vytvorí CorsAnywhere server
var cors_proxy = require('cors-anywhere');
cors_proxy.createServer({
  originWhitelist: [], // povolíme všetky zdrojové domény
  removeHeaders: ['cookie', 'cookie2']
}).listen(port, host, function() {
  console.log('Running CORS Anywhere on ' + host + ':' + port);
});