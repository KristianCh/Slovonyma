//nastavenie počtu hráčov
const PLAYERS_NUM = 2;
//import knižnice
const fetch = require("node-fetch");

//vytvorenie objektu herného serveru
var game_server = module.exports = {gameRooms: {}}

//deklarácia funkcií pre nahranie údajov z hry do databázy a načítanie slov pre opisovača
game_server.getPresetWords = async function(){};
game_server.successfulGuessUpdate = function(placeholder){};

/*
 *  Funkcia na lematizáciu slova a spracovanie slova alebo hádaného slova
 */
game_server.lema = async function(io, socket, text, type) {
    //získame lemu slova
    let response = await fetch('http://text.fiit.stuba.sk:8080/lematizer/services/lemmatizer/lemmatize/fast?tools=all', {
        method: 'POST',
        mode: 'cors',
        headers: {'Content-Type': 'text/plain;charset=UTF-8'},
        body: text
    });
    let text_response = await response.text();
    //ak lematizujeme hlavné slovo, nastavíme miestnosti socketu ktorý vytvoril request slovo a zmeníme mu stav na 'in_game'
    //upovedomíme o tom klientov pripjených do tejto miestnosti
    if (type === 'word') {
        game_server.gameRooms[socket.room].word = text_response;
        game_server.gameRooms[socket.room].state = 'in_game';
        io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
    }
    //lematizujeme hádané slovo
    else if (type === 'guess') {
        //hádané slovo bolo hlavné slovo
        if (text_response === game_server.gameRooms[socket.room].word) {
             //prirátame hráčom body za uhádnutie slova. Ak bolo ohodnotených 0 alebo 1 slovo, opisovačovi adekvátne
             //znížime počet získaných bodov.
            game_server.gameRooms[socket.room].playerWantingReplay = 0;
            if (Object.getOwnPropertyNames(game_server.gameRooms[socket.room].guessedWords).length > 1) {
                game_server.gameRooms[socket.room].describerPoints += 100;
            }
            else if (Object.getOwnPropertyNames(game_server.gameRooms[socket.room].guessedWords).length > 0){
                game_server.gameRooms[socket.room].describerPoints += 75;
            }
            else {
                game_server.gameRooms[socket.room].describerPoints += 50;
            }
            game_server.gameRooms[socket.room].guesserPoints += 100;
            //updatneme stav hernej miestnosti na 'game_finished'
            game_server.gameRooms[socket.room].state = 'game_finished';
            //zavoláme funkciu na nahranie údajov z hry do databázy
            game_server.successfulGuessUpdate(game_server.gameRooms[socket.room]);
            //upovedomíme klientov pripojených do miestnosti o zmene stavu
            io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
            return;
        }
        //hádané slovo nebolo hlavné slovo
        if (!game_server.gameRooms[socket.room].guessedWords[text_response]) {
            //znížíme počítadlo možných hádaní
            game_server.gameRooms[socket.room].guessesLeft--;
            //pridáme slovo s ohodnotením a timestampom do poľa slov a pripočítame hádačovi 1 bod
            game_server.gameRooms[socket.room].guessedWords[text_response] = {rating: -1, timestamp: Date.now()};
            game_server.gameRooms[socket.room].guesserPoints += 1;
            //upovedomíme klientov pripojených do miestnosti o zmene stavu a hádaní
            io.in(socket.room).emit('update guesses', game_server.gameRooms[socket.room].guessedWords);
            io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
        }
        //hádačovi došli možné hádania
        if (game_server.gameRooms[socket.room].guessesLeft === 0) {
            //updatneme stav hernej miestnosti na 'game_finished'
            game_server.gameRooms[socket.room].state = 'game_finished';
            //zavoláme funkciu na nahranie údajov z hry do databázy
            game_server.successfulGuessUpdate(game_server.gameRooms[socket.room]);
			//nastavíme počet hráčov, ktorý chcú hrať znova na 0
            game_server.gameRooms[socket.room].playerWantingReplay = 0;
            //upovedomíme klientov pripojených do miestnosti o zmene stavu
            io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
        }
    }
}

/*
 *  Funkcia na rozhodnutie rolí hráčov. Ak hrajú prvú hru, je rozhodnutie náhodné, inak sa im role vymenia
 */
game_server.decideRoles = async function(io, socket) {
    //náhodné vygenerovanie indexu hádača (môže byť 0 alebo 1)
    var guesserIndex = Math.round(Math.random());
    //ak predtým hrali, index hádača sa vymení
    if (game_server.gameRooms[socket.room].prevGuesserIndex !== -1) {
        guesserIndex = 1 - game_server.gameRooms[socket.room].prevGuesserIndex;
    }
    //nastaví index predchádzajúceho hádača na aktuálny
    game_server.gameRooms[socket.room].prevGuesserIndex = guesserIndex;
    //nastaví hádača na hráča, ktorý je v zozname hráčov miestnosti na indexe hádača
    game_server.gameRooms[socket.room].guesser = game_server.gameRooms[socket.room].users[guesserIndex];
    //nastaví opisovača na druhého hráča
    game_server.gameRooms[socket.room].describer = game_server.gameRooms[socket.room].users[Math.abs(guesserIndex-1)];
    //updatneme stav hernej miestnosti na 'waiting_for_word_select'
    game_server.gameRooms[socket.room].state = 'waiting_for_word_select';

    //čaká na načítanie slov z ktorých si opisvač bude môcť vybrať
    var words = await game_server.getPresetWords();
    //upovedomíme klientov pripojených do miestnosti o slovách pre opisovača a o zmene stavu
    io.in(socket.room).emit('preset words', words);
    io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
}

/*
 *  Funkcia na spracovanie odpojenia hráča
 */
game_server.disconnectUser = function (io, socket) {
    //zistuje sa, či bol hráč v nejakej miestnosti
    if (socket.room !== undefined) {
        //nájde sa index hráča vrámci miestnosti
        const uIndex = game_server.gameRooms[socket.room].users.indexOf(socket.username);
        if (uIndex > -1) {
            //meno hráča sa odstráni z miestnosti
            game_server.gameRooms[socket.room].users.splice(uIndex, 1);
        }
        //upovedomí klientov v miestnosti o zmene stavu
        io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);

        //ak hra prebiehala pošle klientom v miestnosti správu o odpojení hráča
        if (game_server.gameRooms[socket.room].state !== 'waiting_for_second'
            && game_server.gameRooms[socket.room].state !== 'game_finished'
            && game_server.gameRooms[socket.room].state !== 'game_reseting') {
            io.in(socket.room).emit('other disconnected');
        }
        //ak bola hra skončená a hráč čakal, či odpojený hráč chce hrať ďalej, zmení stav miestnosi na 'waiting_for_second'
        //a upovedomí klientov v miestnosti o zmene stavu
        if (game_server.gameRooms[socket.room].state === 'game_reseting') {
            game_server.gameRooms[socket.room].state = 'waiting_for_second';
            io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
        }
        //ak je miestnosť po odpojení hráča prázdna, tak ju vymaže a upovedomí klientov o zmene počtu aktívnych miestností
        if (game_server.gameRooms[socket.room].users.length === 0) {
            delete game_server.gameRooms[socket.room];
            socket.broadcast.emit("update active", Object.keys(game_server.gameRooms).length);
        }
    }
}

/*
 *  Funkcia na spracovanie požiadavky hráča o pripojenie do miestnosti
 */
game_server.connectUserToRoom = function (io, socket, data, callback) {
    //vymazanie prípadných bodkočiarok
    data.name = data.name.replace(';', '');
    //ak hráč nie je prihlásený zavolá sa callback s ID 4 - hráč nie je prihlásený
    if (data.name === '') {
        callback({id:4, room:data.room});
        return;
    }
    //skontroluje, či hráč už nie je v nejakej hre, aby nemohol hrať viac hier naraz
    for (gameRoom in game_server.gameRooms) {
        if (game_server.gameRooms[gameRoom].users.includes(data.name)) {
            callback({id: 5, room: data.room});
            return;
        }
    }
    //ak nebolo zadané ID miestnosti, vygeneruje náhodne
    if (data.room === '') {
        do {
            data.room = Math.random().toString(36).substring(7);
        }
        while (Object.keys(game_server.gameRooms).includes(data.room));
    }
    var priv = false;
    //ak hráč vybral pripojenie do náhodnej otvorenej miestnosti, hladá sa volná miestnosť. Ak sa nájde, pripojí do nej hráča
    if (data.type === "find_room") {
        var found = Object.keys(game_server.gameRooms).some(function (room) {
            if (game_server.gameRooms[room].users.length < PLAYERS_NUM && !game_server.gameRooms[room].private) {
                data.room = room;
                return true;
            }
        })
        //ak sa nenašla volná miestnosť, zavolá sa callback s ID 2 - Nenašla sa volná miestnosť
        if (!found) {
            callback({id:2, room:data.room});
            return;
        }
    }
    //ak hráč vybral vytvorenie súkromnej miestnosti, vytvorí súkromnú miestnosť a pripojí do nej hráča
    else if (data.type === "create_private_room") {
        if (game_server.gameRooms[data.room] !== undefined) {
            callback({id: 3, room: data.room});
            return;
        }
        priv = true;
    }
    //zisťuje sa, či zadaná miestnosť neexistuje alebo je v nej miesto
    if((game_server.gameRooms[data.room] === undefined || game_server.gameRooms[data.room].users.length < PLAYERS_NUM)) {
        //povoluje pripojenie
        callback({id:0, room:data.room});
    }
    else {
        //zadaná miestnost je plná
        callback({id:1, room:data.room});
        return;
    }
    //nastavi hráčovi údaje
    socket.username = data.name;
    socket.room = data.room;
    socket.join(data.room);
    //ak miestnosť nebola vytvorená, vytvorí miestnosť a pridá do nej hráča
    if (game_server.gameRooms[data.room] === undefined) {
        game_server.gameRooms[data.room] = {private: priv, users: [data.name], state: 'waiting_for_second', guessedWords: {},
            hints: [], guesserPoints: 0, describerPoints: 0, hintsLeft: 10, guessesLeft: 10, ratedWords: 0, prevGuesserIndex: -1};
        //upovedomí klientov o zmene počtu aktívnych miestností
        socket.broadcast.emit("update active", Object.keys(game_server.gameRooms).length);
    }
    //ak miestnosť bola vytvorená, tak do nej pridá hráča
    else {
        game_server.gameRooms[data.room].users.push(data.name);
    }
    //ak sú v miestnosti dvaja hráči, vyberie im role
    if (game_server.gameRooms[data.room].users.length === PLAYERS_NUM) {
        game_server.decideRoles(io, socket);
    }
    //upovedomí klientov v miestnosti o zmene stavu
    io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
}

/*
 * Funkcia na spracovanie výberu slova
 */
game_server.selectWord = function (io, socket, word) {
    //vymazanie prípadných bodkočiarok
    word = word.replace(';', '');
    //zavolá funkciu lema na ďaľšie spracovanie zadaného slova
    game_server.lema(io, socket, word, 'word');
}

/*
 * Funkcia na spracovanie indície
 */
game_server.hintSubmit = function (io, socket, hint) {
    //vymazanie prípadných bodkočiarok
    hint = hint.replace(';', '');
    //skontroluje, či má hádač dosť možných indícií
    if (game_server.gameRooms[socket.room].hintsLeft > 0) {
        //zníži počet možných indícií
        game_server.gameRooms[socket.room].hintsLeft--;
        //pridá indíciu s timestampom do poľa indícií
        game_server.gameRooms[socket.room].hints.push({text: hint, timestamp: Date.now()});
        //upovedomíme klientov pripojených do miestnosti o zmene stavu a indícií
        io.in(socket.room).emit('update hints', hint);
        io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
    }
}

/*
 * Funkcia na spracovanie hádaného slova
 */
game_server.guessSubmit = function (io, socket, guess) {
    //vymazanie prípadných bodkočiarok
    guess = guess.replace(';', '');
    //zavolá funkciu lema na ďaľšie spracovanie hádaného slova
    game_server.lema(io, socket, guess, 'guess');
}

/*
 * Funkcia na spracovanie hodnotenia hádaného slova
 */
game_server.rateGuess = function (io, socket, data) {
    //update ohodnotenia pre slovo
    game_server.gameRooms[socket.room].guessedWords[data.word].rating = data.rating;
    if (data.rating > 4) return;
    if (data.rating >= 0) {
        //pripočítanie bodov hráčom a zvýšenie počítadla ohodnotených slov
        game_server.gameRooms[socket.room].guesserPoints += 3 + data.rating;
        game_server.gameRooms[socket.room].describerPoints += 5;
        game_server.gameRooms[socket.room].ratedWords++;
    }
    else {
        //priradenie bodov hráčom
        game_server.gameRooms[socket.room].guesserPoints--;
        game_server.gameRooms[socket.room].describerPoints += 3;
    }
    //upovedomíme klientov pripojených do miestnosti o zmene stavu a hádaní
    io.in(socket.room).emit('update guesses', game_server.gameRooms[socket.room].guessedWords);
    io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
}

/*
 *  Funckia na spracovanie requestu hráča na ďalšiu hru
 */
game_server.replay = function (io, socket) {
    //pripravenie hernej miestnosti na ďalšiu hru
    if (game_server.gameRooms[socket.room].playerWantingReplay === 0) {
        game_server.gameRooms[socket.room].state = 'game_reseting';
        game_server.gameRooms[socket.room].guesserPoints = 0;
        game_server.gameRooms[socket.room].describerPoints = 0;
        game_server.gameRooms[socket.room].guessedWords = {};
        game_server.gameRooms[socket.room].hints = [];
        game_server.gameRooms[socket.room].hintsLeft = 10;
        game_server.gameRooms[socket.room].guessesLeft = 10;
        game_server.gameRooms[socket.room].ratedWords = 0;
        game_server.gameRooms[socket.room].describer = null;
        game_server.gameRooms[socket.room].guesser = null;
        game_server.gameRooms[socket.room].word = null;
    }
    //ak obaja hráči chcú hrať znova, vyberie im role
    else {
        game_server.decideRoles(io, socket);
    }
    //upovedomíme klientov pripojených do miestnosti o zmene stavu a hádaní
    io.in(socket.room).emit('update guesses', game_server.gameRooms[socket.room].guessedWords);
    game_server.gameRooms[socket.room].playerWantingReplay++;
    io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
}

/*
 *  Funkcia na poslanie údajov rebríčku hráčov klientovi
 */
game_server.displayLeaderboard = function (io, socket, scores) {
    //klientovi pošleme dáta rebríčku hráčov a počet aktívnych herných miestností
    socket.emit('display leaderboard', scores);
    socket.emit("update active", Object.keys(game_server.gameRooms).length);
}

/*
 *  Funckia na spracovanie zobrazenia písanie indície
 */
game_server.showTypingHint = function (io, socket, data) {
    //upovedomíme klientov pripojených do miestnosti o tom, že opisovač píše
    io.in(socket.room).emit('show typing hint', data);
}

/*
 *  Funckia na spracovanie zobrazenia písanie hádania
 */
game_server.showTypingGuess = function (io, socket, data) {
    //upovedomíme klientov pripojených do miestnosti o tom, že hádač píše
    io.in(socket.room).emit('show typing guess', data);
}