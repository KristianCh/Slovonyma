const PLAYERS_NUM = 2;
const fetch = require("node-fetch");

var game_server = module.exports = {gameRooms: {}}

game_server.getPresetWords = async function(){};
game_server.successfulGuessUpdate = function(placeholder){};


game_server.lema = async function(io, socket, text, type) {

    let response = await fetch('http://text.fiit.stuba.sk:8080/lematizer/services/lemmatizer/lemmatize/fast?tools=database', {
        method: 'POST',
        mode: 'cors',
        headers: {'Content-Type': 'text/plain;charset=UTF-8'},
        body: text
    });
    let text_response = await response.text();

    if (type === 'word') {
        game_server.gameRooms[socket.room].word = text_response;
        game_server.gameRooms[socket.room].state = 'in_game';
        io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
    }
    else if (type === 'guess') {
        if (text_response === game_server.gameRooms[socket.room].word) {
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
            game_server.gameRooms[socket.room].state = 'game_finished';

            game_server.successfulGuessUpdate(game_server.gameRooms[socket.room]);

            io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
            return;
        }

        if (!game_server.gameRooms[socket.room].guessedWords[text_response]) {
            game_server.gameRooms[socket.room].guessesLeft--;
            game_server.gameRooms[socket.room].guessedWords[text_response] = {rating: -1, timestamp: Date.now()};
            game_server.gameRooms[socket.room].guesserPoints += 1;
            io.in(socket.room).emit('update guesses', game_server.gameRooms[socket.room].guessedWords);
            io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
        }

        if (game_server.gameRooms[socket.room].guessesLeft === 0) {
            game_server.gameRooms[socket.room].state = 'game_finished';
            game_server.gameRooms[socket.room].playerWantingReplay = 0;
            io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
        }
    }
}

game_server.decideRoles = async function(io, socket) {
    var guesserIndex = Math.round(Math.random());
    if (game_server.gameRooms[socket.room].prevGuesserIndex !== -1) {
        guesserIndex = 1 - game_server.gameRooms[socket.room].prevGuesserIndex;
    }
    game_server.gameRooms[socket.room].prevGuesserIndex = guesserIndex;
    game_server.gameRooms[socket.room].guesser = game_server.gameRooms[socket.room].users[guesserIndex];
    game_server.gameRooms[socket.room].describer = game_server.gameRooms[socket.room].users[Math.abs(guesserIndex-1)];
    game_server.gameRooms[socket.room].state = 'waiting_for_word_select';

    var words = await game_server.getPresetWords();
    io.in(socket.room).emit('preset words', words);
    io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
}

game_server.disconnectUser = function (io, socket) {
    //zistuje sa, ci bol pouzivatel v nejakej miestnosti
    if (socket.room !== undefined) {
        //najde sa index pouzivatela vramci miestnosti
        const uIndex = game_server.gameRooms[socket.room].users.indexOf(socket.username);
        if (uIndex > -1) {
            //meno pouzivatela sa odstrani z miestnosti
            game_server.gameRooms[socket.room].users.splice(uIndex, 1);
        }
        //upovedomi pouzivatelov miestnosti o odpojeni pouzivatela
        io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);

        if (game_server.gameRooms[socket.room].state !== 'waiting_for_second'
            && game_server.gameRooms[socket.room].state !== 'game_finished'
            && game_server.gameRooms[socket.room].state !== 'game_reseting') {
            io.in(socket.room).emit('other disconnected');
        }
        if (game_server.gameRooms[socket.room].state === 'game_reseting') {
            game_server.gameRooms[socket.room].state = 'waiting_for_second';
            io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
        }

        //ak je miestnost po odpojeni pouzivatela prazdna, tak ju vymaze
        if (game_server.gameRooms[socket.room].users.length === 0) {
            delete game_server.gameRooms[socket.room];
            socket.broadcast.emit("update active", Object.keys(game_server.gameRooms).length);
        }
    }
}

game_server.connectUserToRoom = function (io, socket, data, callback) {
    data.name = data.name.replace(';', '');
    if (data.name === '') {
        callback({id:4, room:data.room});
        return;
    }

    for (gameRoom in game_server.gameRooms) {
        console.log(game_server.gameRooms[gameRoom]);
        if (game_server.gameRooms[gameRoom].users.includes(data.name)) {
            callback({id: 5, room: data.room});
            return;
        }
    }

    //ak nebolo zadane id miestnosti, vygeneruje nahodne
    if (data.room === '') {
        do {
            data.room = Math.random().toString(36).substring(7);
        }
        while (Object.keys(game_server.gameRooms).includes(data.room));
    }
    var priv = false;
    //hlada sa volna miestnost
    if (data.type === "find_room") {
        var found = Object.keys(game_server.gameRooms).some(function (room) {
            if (game_server.gameRooms[room].users.length < PLAYERS_NUM && !game_server.gameRooms[room].private) {
                data.room = room;
                return true;
            }
        })
        if (!found) {
            callback({id:2, room:data.room});
            return;
        }
    }
    else if (data.type === "create_private_room") {
        if (game_server.gameRooms[data.room] !== undefined) {
            callback({id: 3, room: data.room});
            return;
        }
        priv = true;
    }
    //zistuje sa, ci zadana miestnost neexistuje alebo je v nej miesto
    if((game_server.gameRooms[data.room] === undefined || game_server.gameRooms[data.room].users.length < PLAYERS_NUM)) {
        //povoluje pripojenie
        callback({id:0, room:data.room});
    }
    else {
        //zadana miestnost je plna
        callback({id:1, room:data.room});
        return;
    }
    //nastavi pouzivatelovi udaje
    socket.username = data.name;
    socket.room = data.room;
    socket.join(data.room);
    //ak miestnost nebola vytvorena, vytvori miestnost a prida do nej pouzivatela
    if (game_server.gameRooms[data.room] === undefined) {
        game_server.gameRooms[data.room] = {private: priv, users: [data.name], state: 'waiting_for_second', guessedWords: {},
            hints: [], guesserPoints: 0, describerPoints: 0, hintsLeft: 10, guessesLeft: 10, ratedWords: 0, prevGuesserIndex: -1};
        socket.broadcast.emit("update active", Object.keys(game_server.gameRooms).length);
    }
    //ak miestnost bola vytvorena, tak do nej prida pouzivatela
    else {
        game_server.gameRooms[data.room].users.push(data.name);
    }

    if (game_server.gameRooms[data.room].users.length === PLAYERS_NUM) {
        game_server.decideRoles(io, socket);
    }

    //upovedomi pouzivatelov miestnosti o pripojeni noveho pouzivatela
    io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
}

game_server.confirmLogin = function (io, socket, response, callback) {
    callback({response: response});
}

game_server.selectWord = function (io, socket, word) {
    word = word.replace(';', '');
    game_server.lema(io, socket, word, 'word');
}

game_server.hintSubmit = function (io, socket, hint) {
    hint = hint.replace(';', '');
    if (game_server.gameRooms[socket.room].hintsLeft > 0) {
        game_server.gameRooms[socket.room].hintsLeft--;
        game_server.gameRooms[socket.room].hints.push({text: hint, timestamp: Date.now()});
        io.in(socket.room).emit('update hints', hint);
        io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
    }
}

game_server.guessSubmit = function (io, socket, guess) {
    guess = guess.replace(';', '');
    game_server.lema(io, socket, guess, 'guess');
}

game_server.rateGuess = function (io, socket, data) {
    game_server.gameRooms[socket.room].guessedWords[data.word].rating = data.rating;
    if (data.rating > 4) return;
    if (data.rating >= 0) {
        game_server.gameRooms[socket.room].guesserPoints += 1 + Math.ceil(data.rating / 2);
        game_server.gameRooms[socket.room].describerPoints += 2;
        game_server.gameRooms[socket.room].ratedWords++;
    }
    else {
        game_server.gameRooms[socket.room].guesserPoints--;
        game_server.gameRooms[socket.room].describerPoints++;
    }
    io.in(socket.room).emit('update guesses', game_server.gameRooms[socket.room].guessedWords);
    io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
}

game_server.replay = function (io, socket) {
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
    else {
        game_server.decideRoles(io, socket);
    }
    io.in(socket.room).emit('update guesses', game_server.gameRooms[socket.room].guessedWords);
    game_server.gameRooms[socket.room].playerWantingReplay++;
    io.in(socket.room).emit('update state', game_server.gameRooms[socket.room]);
}

game_server.displayLeaderboard = function (io, socket, scores) {
    socket.emit('display leaderboard', scores);
    socket.emit("update active", Object.keys(game_server.gameRooms).length);
}

game_server.showTypingHint = function (io, socket, data) {
    io.in(socket.room).emit('show typing hint', data);
}

game_server.showTypingGuess = function (io, socket, data) {
    io.in(socket.room).emit('show typing guess', data);
}