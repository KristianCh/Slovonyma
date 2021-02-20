function leave() {
    location.reload();
}

$(function () {
    var socket = io({transports:['websocket']});
    const callbackAlerts = ["Miestnosť je plná", "Nenašla sa voľná  miestnosť", "Miestnosť s týmto kódom už existuje", "Musíš byť prihlásený",
        "Nemôžeš hrať dva krát naraz"];
    var role = '';
    var word = '';
    var hintLength = 3 + Math.floor(Math.random() * Math.floor(3));
    document.getElementById("hint-length").innerHTML = 'Zadaj indíciu ' + ['s tromi', 'so štyrmi', 's piatimi'][hintLength-3] + ' slovami';

    socket.emit('request leaderboard', '');

    if (sessionStorage.getItem("name") !== null) document.getElementById("login").style.display = "none";

    document.getElementById("login-btn").onclick = function() {
        document.getElementById("login-btn").className = 'active-button';
        document.getElementById("register-btn").className = 'inactive-button';

        document.getElementById("login-tab").style.display = 'block';
        document.getElementById("register-tab").style.display = 'none';
    };

    document.getElementById("register-btn").onclick = function() {
        document.getElementById("login-btn").className = 'inactive-button';
        document.getElementById("register-btn").className = 'active-button';

        document.getElementById("login-tab").style.display = 'none';
        document.getElementById("register-tab").style.display = 'block';
    };

    $('#join-form').submit(function (e) {
        e.preventDefault(); // prevents page reloading
        if (sessionStorage.getItem("name") === null ||
            sessionStorage.getItem("name") !== null && sessionStorage.getItem("name") === '') {
            document.getElementById("alert-join").innerHTML = callbackAlerts[3];
            return false;
        }
        var roomId = $('#room').val();
        socket.emit('join room', {name: sessionStorage.getItem("name"), room:roomId, type:e.originalEvent.submitter.value}, (callback) => {
            if (callback.id === 0) {

                document.getElementById("nick-set").style.display = "none";
                document.getElementById("login").style.display = "none";
                document.getElementById("leaderboard").style.display = "none";
                document.getElementById("menu-content").style.display = 'none';
                document.getElementById("left-content").style.display = 'none';
                document.getElementById("main-title").style.display = 'none';
                document.getElementById("active-users").style.display = "block";
            }
            else {
                document.getElementById("alert-join").innerHTML = callbackAlerts[callback.id-1];
            }
            document.getElementById("room_code").innerHTML = "Kód miestnosti: " + callback.room;
        });
        return false;
    });

    $('#login-form').submit(function (e) {
        e.preventDefault(); // prevents page reloading
        if($('#pass').val() === '') {
            document.getElementById("alert-login").innerHTML = "Musíš zadať heslo";
            return false;
        }
        if ($('#nick').val() !== '') {
            socket.emit('login', {name: $('#nick').val(), password: $('#pass').val()}, (callback) => {
                if (callback.allowed) {
                    sessionStorage.setItem("name", $('#nick').val());
                    document.getElementById("login").style.display = "none";
                }
                else {
                    document.getElementById("alert-login").innerHTML = "Nesprávne prihlásenie";
                }
            });
        }
        else {
            document.getElementById("alert-login").innerHTML = "Musíš zadať prezývku";
        }
        return false;
    });

    $('#register-form').submit(function (e) {
        e.preventDefault(); // prevents page reloading
        if($('#reg-pass').val() === '' || $('#reg-pass-confirm').val() === '') {
            document.getElementById("alert-register").innerHTML = "Musíš zadať heslo";
            return false;
        }
        if($('#reg-pass').val() !== $('#reg-pass-confirm').val()) {
            document.getElementById("alert-register").innerHTML = "Heslá sa musia zhodovať";
            return false;
        }
        if ($('#reg-nick').val() !== '') {
            socket.emit('register', {name: $('#reg-nick').val(), password: $('#reg-pass').val()}, (callback) => {
                if (callback.allowed) {
                    sessionStorage.setItem("name", $('#reg-nick').val());
                    document.getElementById("login").style.display = "none";
                }
                else {
                    document.getElementById("alert-register").innerHTML = "Nesprávne prihlásenie";
                }
            });
        }
        else {
            document.getElementById("alert-register").innerHTML = "Musíš zadať prezývku";
        }
        return false;
    });

    $('#word-select-form').submit(function (e) {
        e.preventDefault(); // prevents page reloading
        if (e.originalEvent.submitter.value === '') {
            if ($('#word').val() !== '' && $('#word').val().split(" ").length === 1) {
                document.getElementById("word-select-button").style.display = "none";
                document.getElementById("loader").style.display = "block";
                socket.emit('select word', $('#word').val());
                word = $('#word').val();
                $('#word').val('');
                document.getElementById("alert-word").innerHTML = '';
            } else {
                document.getElementById("alert-word").innerHTML = "Musíš zadať jedno slovo";
            }
        }
        else {
            document.getElementById("word-select-button").style.display = "none";
            document.getElementById("loader").style.display = "block";
            socket.emit('select word', e.originalEvent.submitter.value);
            word = e.originalEvent.submitter.value;
            $('#word').val('');
        }
        return false;
    });

    $('#hint-form').submit(function(e) {
        e.preventDefault(); // prevents page reloading
        if ($('#hint').val().length <= 50 && role === 'describer') {
            if (hintLength === $('#hint').val().split(" ").length) {
                var stringToCheck = $('#hint').val().replace(/[^a-zA-Z\u00C0-\uFFFF]/gu, '');
                var wordToFind = word;
                do {
                    if (new RegExp(wordToFind, 'iu').test(stringToCheck)) {
                        document.getElementById("alert-hint").innerHTML = 'Indícia nesmie obsahovať hádané slovo ani jeho časť!';
                        $('#hint').val('');
                        return false;
                    }
                    wordToFind = wordToFind.slice(0, wordToFind.length - 1);
                } while (wordToFind.length > 3);
                socket.emit('hint submit', $('#hint').val());
                hintLength = 3 + Math.floor(Math.random() * Math.floor(3));
                document.getElementById("hint-length").innerHTML = 'Zadaj indíciu ' + ['s tromi', 'so štyrmi', 's piatimi'][hintLength - 3] +
                    ' slovami';
            } else {
                document.getElementById("alert-hint").innerHTML = 'Indícia musí mať ' + ['tri slová!', 'štyri slová!', 'päť slov!'][hintLength - 3];
            }
        }
        else {
            document.getElementById("alert-hint").innerHTML = 'Indícia musí byť kratšia ako 50 znakov!';
        }
        $('#hint').val('');
        return false;
    });

    $('#guess-form').submit(function(e){
        e.preventDefault(); // prevents page reloading
        if (role === 'guesser') {
            if ($('#guess').val() !== '' && $('#guess').val().split(" ").length === 1) {
                socket.emit('guess submit', $('#guess').val());
                document.getElementById("alert-guess").innerHTML = '';
            }
            else document.getElementById("alert-guess").innerHTML = "Musíš zadať jedno slovo";
        }
        $('#guess').val('');
        return false;
    });

    $('#replay-form').submit(function(e){
        e.preventDefault(); // prevents page reloading
        socket.emit('replay');

        document.getElementById("end-buttons").style.display = "none";
        document.getElementById("end-stats").style.display = "none";
        document.getElementById("wait-for-other-message").style.display = "block";
        document.getElementById("loader").style.display = "none";
    });

    $('#search-player-form').submit(function(e){
        e.preventDefault(); // prevents page reloading
        socket.emit('request leaderboard', $('#search-player-name').val());
    });

    socket.on('update state', function(msg){
        $('#users').empty();
        document.getElementById("u").innerHTML = "Pripojení používatelia " + msg.users.length + "/" + 2;
        if (msg.state === 'waiting_for_second') {
            document.getElementById("wait-for-other-message").style.display = "block";
            document.getElementById("loader").style.display = "none";
        }
        else if (msg.state === 'waiting_for_word_select') {
            document.getElementById("wait-for-other-message").style.display = "none";
            if (msg.describer === sessionStorage.getItem("name")) {
                role = 'describer';
                document.getElementById("word-select").style.display = "block";
                document.getElementById("word-select-button").style.display = "block";
            }
            else {
                role = 'guesser';
                document.getElementById("wait-for-word-select-message").style.display = "block";
            }
        }
        else if (msg.state === 'in_game') {
            document.getElementById("hint-display").style.display = "block";
            document.getElementById("guess-display").style.display = "block";
            document.getElementById("top-bar").style.display = "block";
            if (msg.describer === sessionStorage.getItem("name")) {
                document.getElementById("word-select").style.display = "none";
                document.getElementById("guess-form").style.display = "none";
                document.getElementById("hint-form").style.display = "block";
                document.getElementById("top-bar").innerHTML = '<h1 id="word-display">  </h1> <br>' +
                    'Zostávajúce indície: ' + msg.hintsLeft + '<br> Zostávajúce hádania: ' + msg.guessesLeft +
                    '<br> Skóre: ' + msg.describerPoints;
                document.getElementById("word-display").innerHTML = msg.word;
            }
            else {
                document.getElementById("wait-for-word-select-message").style.display = "none";
                document.getElementById("hint-form").style.display = "none";
                document.getElementById("guess-form").style.display = "block";
                document.getElementById("top-bar").innerHTML = 'Zostávajúce indície: ' + msg.hintsLeft + '<br> Zostávajúce hádania: ' + msg.guessesLeft +
                    '<br> Skóre: ' + msg.guesserPoints;
            }
        }
        else if (msg.state === 'game_finished') {
            $('#guesses').empty();
            $('#hints').empty();
            document.getElementById("top-bar").style.display = "none";
            document.getElementById("hint-display").style.display = "none";
            document.getElementById("guess-display").style.display = "none";

            document.getElementById("end-buttons").style.display = "block";
            document.getElementById("end-stats").style.display = "block";
            document.getElementById("end-stats").innerHTML =
                "<h1> Slovo bolo: " + msg.word + "</h1> <br>" +
                "Skóre: " + ((role === 'describer') ? msg.describerPoints : msg.guesserPoints) +
                '<br>Slová ohodnotené: ' + msg.ratedWords;
        }

        msg.users.forEach(function (user) {
            $('#users').append($('<li>').text(user));
        });
    });

    socket.on('update hints', function(hint){
        $('#hints').append('<li style="background: rgb(255, 255, 255)">' + hint);
        $('#hints').animate({scrollTop: $('#hints').prop("scrollHeight")}, 1);
    });

    socket.on('update guesses', function(guesses){
        $('#guesses').empty();
        for (const [key, value] of Object.entries(guesses)) {
            var rating = ''
            if (value.rating === -1) {
                rating += 'Neohodnotené';
            }
            else if (value.rating === -2) {
                rating += 'Nie je slovo!';
            }
            else {
                rating += ['Úplne iné', 'Veľmi málo podobné', 'Trochu podobné', 'Veľmi podobné', 'Takmer identické'][value.rating];
            }
            if (role === 'guesser' || value.rating !== -1) {
                $('#guesses').append('<li class="rate-li-' + value.rating + '" style="background: rgb(255, 255, 255)">' + key + ': ' + rating);
            }
            else {
                $('#guesses').append('<li id="' + key + '-line">' + key + ': ');

                var buttons = [
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON")];

                for (var i = 4; i >= 0; i--) {
                    buttons[i].innerHTML = ['Úplne iné', 'Veľmi málo podobné', 'Trochu podobné', 'Veľmi podobné', 'Takmer identické'][i];
                    buttons[i].className = 'rate-button-' + i;
                    document.getElementById(key + "-line").appendChild(buttons[i]);
                }

                buttons[5].innerHTML = 'Nie je slovo!';
                buttons[5].className = 'rate-button--2';
                document.getElementById(key + "-line").appendChild(buttons[5]);

                buttons[0].onclick = function () {
                    socket.emit('rate guess', {word: key, rating: 0});
                }
                buttons[1].onclick = function () {
                    socket.emit('rate guess', {word: key, rating: 1});
                }
                buttons[2].onclick = function () {
                    socket.emit('rate guess', {word: key, rating: 2});
                }
                buttons[3].onclick = function () {
                    socket.emit('rate guess', {word: key, rating: 3});
                }
                buttons[4].onclick = function () {
                    socket.emit('rate guess', {word: key, rating: 4});
                }
                buttons[5].onclick = function () {
                    socket.emit('rate guess', {word: key, rating: -2});
                }
            }
            $('#guesses').animate({scrollTop: $('#guesses').prop("scrollHeight")}, 1);
        }
    });

    socket.on('other disconnected', function(){
        location.reload();
        alert("Druhý hráč sa odpojil");
    });

    socket.on('preset words', function(words){
        document.getElementById("preset_word_1").innerHTML = words[0];
        document.getElementById("preset_word_1").value = words[0];
        document.getElementById("preset_word_2").innerHTML = words[1];
        document.getElementById("preset_word_2").value = words[1];
        document.getElementById("preset_word_3").innerHTML = words[2];
        document.getElementById("preset_word_3").value = words[2];
    });

    socket.on('display leaderboard', function(scores) {
        $('#leadboard-table').empty();
        $('#leadboard-table').append(
            '<tr>' +
            '    <th>Prezývka</th>' +
            '    <th>Odohrané hry</th>' +
            '    <th>Skóre</th>' +
            '    <th>Ohodnotené slová</th>' +
            '  </tr>'
        );

        scores.forEach(function (score) {
            $('#leadboard-table').append(
                '<tr>' +
                '    <th>'+ score[0] +'</th>' +
                '    <th>'+ score[1] +'</th>' +
                '    <th>'+ score[2] +'</th>' +
                '    <th>'+ score[3] +'</th>' +
                '  </tr>'
            );
        });
    });
});