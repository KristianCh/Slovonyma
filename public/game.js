function leave() {
    location.reload();
}

$(function () {
    var socket = io({transports:['websocket']});
    const callbackAlerts = ["Miestnosť je plná", "Nenašla sa voľná  miestnosť", "Miestnosť s týmto kódom už existuje", "Musíš byť prihlásený",
        "Nemôžeš hrať dva krát naraz"];
    var role = '';
    var word = '';
    var typingHint = false;
    var timeoutHint = undefined;
    var typingGuess = false;
    var timeoutGuess = undefined;

    var typingTimeoutHint = function () {
        socket.emit('show typing hint', {user:sessionStorage.getItem("name"), typing:false})
        typingHint = false;
    }
    var typingTimeoutGuess = function () {
        socket.emit('show typing guess', {user:sessionStorage.getItem("name"), typing:false})
        typingGuess = false;
    }
    document.getElementById("logout").onclick = function() {
        sessionStorage.setItem('name', null);
        document.getElementById("logout").style.display = 'block';
        location.reload();
    }

    var clearAlert = function(alertId) {
        document.getElementById(alertId).innerHTML = '';
    }

    document.getElementById("sound-btn").onclick = function () {
        if (sessionStorage.getItem("sound") !== 'off') {
            sessionStorage.setItem("sound", 'off');
            document.getElementById("sound-btn").className = 'sound-button-off';
        }
        else {
            sessionStorage.setItem("sound", 'on');
            document.getElementById("sound-btn").className = 'sound-button-on';
        }
    }

    var hintLength = 3 + Math.floor(Math.random() * Math.floor(3));
    document.getElementById("hint-length").innerHTML = 'Zadaj indíciu ' + ['s tromi', 'so štyrmi', 's piatimi'][hintLength-3] + ' slovami';

    socket.emit('request leaderboard', '');

    if (sessionStorage.getItem("name") !== null) document.getElementById("login").style.display = "none";
    if (sessionStorage.getItem("sound") === 'off') document.getElementById("sound-btn").className = 'sound-button-off';

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
            setTimeout(clearAlert, 3000, "alert-join");
            return false;
        }
        var roomId = $('#room').val();
        socket.emit('join room', {name: sessionStorage.getItem("name"), room:roomId, type:e.originalEvent.submitter.value}, (callback) => {
            if (callback.id === 0) {

                document.getElementById("room-set").style.display = "none";
                document.getElementById("login").style.display = "none";
                document.getElementById("leaderboard").style.display = "none";
                document.getElementById("menu-content").style.display = 'none';
                document.getElementById("left-content").style.display = 'none';
                document.getElementById("main-title").style.display = 'none';
                document.getElementById("active-users").style.display = "block";
            }
            else {
                document.getElementById("alert-join").innerHTML = callbackAlerts[callback.id-1];
                setTimeout(clearAlert, 3000, "alert-join");
            }
            document.getElementById("room_code").innerHTML = "Kód miestnosti: " + callback.room;
        });
        return false;
    });

    $('#login-form').submit(function (e) {
        e.preventDefault(); // prevents page reloading
        if($('#pass').val() === '') {
            document.getElementById("alert-login").innerHTML = "Musíš zadať heslo";
            setTimeout(clearAlert, 3000, "alert-login");
            return false;
        }
        if($('#pass').val().length < 8 || !$('#pass').val().match(/[0-9]+/) ||
            $('#pass').val().match(/[A-Z]+/)) {
            document.getElementById("alert-login").innerHTML = "Heslo musí mať aspoň 8 znakov, minimálne 1 čislo a 1 veľké písmeno";
            setTimeout(clearAlert, 3000, "alert-login");
            return false;
        }
        if ($('#nick').val() !== '') {
            if ($('#nick').val().split(" ").length !== 1) {
                document.getElementById("alert-login").innerHTML = "Prezývka musí byť jedno slovo";
                setTimeout(clearAlert, 3000, "alert-login");
                return false;
            }
            if (/[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test($('#nick').val())) {
                document.getElementById("alert-login").innerHTML = 'Prezývka nesmie obsahovať špeciálne znaky';
                setTimeout(clearAlert, 3000, "alert-login");
                $('#nick').val('');
                return false;
            }
            $.post('/verify-login', { 'name' :  $('#nick').val(), 'password': $('#pass').val()}, function(data) {
                console.log(data);
                if (data.response) {
                    sessionStorage.setItem("name", $('#nick').val());
                    document.getElementById("login").style.display = "none";
                    document.getElementById("logout").style.display = "block";
                }
                else {
                    document.getElementById("alert-login").innerHTML = "Nesprávne prihlásenie";
                    setTimeout(clearAlert, 3000, "alert-login");
                }
            });
        }
        else {
            document.getElementById("alert-login").innerHTML = "Musíš zadať prezývku";
            setTimeout(clearAlert, 3000, "alert-login");
        }
        return false;
    });

    $('#register-form').submit(function (e) {
        e.preventDefault(); // prevents page reloading
        if($('#reg-pass').val() === '' || $('#reg-pass-confirm').val() === '') {
            document.getElementById("alert-register").innerHTML = "Musíš zadať heslo";
            setTimeout(clearAlert, 3000, "alert-register");
            return false;
        }
        if($('#reg-pass').val() !== $('#reg-pass-confirm').val()) {
            document.getElementById("alert-register").innerHTML = "Heslá sa musia zhodovať";
            setTimeout(clearAlert, 3000, "alert-register");
            return false;
        }
        if($('#reg-pass').val().length < 8 || !$('#reg-pass').val().match(/[0-9]+/) ||
            $('#reg-pass').val().match(/[A-Z]+/)) {
            document.getElementById("alert-register").innerHTML = "Heslo musí mať aspoň 8 znakov, minimálne 1 čislo a 1 veľké písmeno";
            setTimeout(clearAlert, 3000, "alert-register");
            return false;
        }
        if ($('#reg-nick').val() !== '') {
            if ($('#reg-nick').val().split(" ").length !== 1) {
                document.getElementById("alert-register").innerHTML = "Prezývka musí byť jedno slovo";
                setTimeout(clearAlert, 3000, "alert-register");
                return false;
            }
            if (/[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test($('#reg-nick').val())) {
                document.getElementById("alert-register").innerHTML = 'Prezývka nesmie obsahovať špeciálne znaky';
                setTimeout(clearAlert, 3000, "alert-register");
                $('#nick').val('');
                return false;
            }
            $.post('/verify-register', { 'name' :  $('#reg-nick').val(), 'password': $('#reg-pass').val()}, function(data) {
                console.log(data);
                if (data.response) {
                    sessionStorage.setItem("name", $('#reg-nick').val());
                    document.getElementById("login").style.display = "none";
                    document.getElementById("logout").style.display = "block";
                }
                else {
                    document.getElementById("alert-register").innerHTML = "Prezývka už existuje";
                    setTimeout(clearAlert, 3000, "alert-register");
                }
            });
        }
        else {
            document.getElementById("alert-register").innerHTML = "Musíš zadať prezývku";
            setTimeout(clearAlert, 3000, "alert-register");
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
            } else {
                document.getElementById("alert-word").innerHTML = "Musíš zadať jedno slovo";
                setTimeout(clearAlert, 3000, "alert-word");
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
                        setTimeout(clearAlert, 3000, "alert-hint");
                        $('#hint').val('');
                        return false;
                    }
                    wordToFind = wordToFind.slice(0, wordToFind.length - 1);
                } while (wordToFind.length > 3);
                socket.emit('hint submit', $('#hint').val());
                document.getElementById("alert-hint").innerHTML = '';
                hintLength = 3 + Math.floor(Math.random() * Math.floor(3));
                document.getElementById("hint-length").innerHTML = 'Zadaj indíciu ' + ['s tromi', 'so štyrmi', 's piatimi'][hintLength - 3] +
                    ' slovami';
                setTimeout(clearAlert, 3000, "alert-hint");
            } else {
                document.getElementById("alert-hint").innerHTML = 'Indícia musí mať ' + ['tri slová!', 'štyri slová!', 'päť slov!'][hintLength - 3];
                setTimeout(clearAlert, 3000, "alert-hint");
            }
        }
        else {
            document.getElementById("alert-hint").innerHTML = 'Indícia musí byť kratšia ako 50 znakov!';
            setTimeout(clearAlert, 3000, "alert-hint");
        }
        $('#hint').val('');
        return false;
    });

    $('#guess-form').submit(function(e){
        e.preventDefault(); // prevents page reloading
        if (role === 'guesser') {
            if ($('#guess').val() !== '' && $('#guess').val().split(" ").length === 1) {
                socket.emit('guess submit', $('#guess').val());
            }
            else document.getElementById("alert-guess").innerHTML = "Musíš zadať jedno slovo";
            setTimeout(clearAlert, 3000, "alert-guess");
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
        if ($('#search-player-name').val().split(" ").length !== 1) {
            document.getElementById("alert-search-player").innerHTML = "Prezývka musí byť jedno slovo";
            setTimeout(clearAlert, 3000, "alert-search-player");
            return false;
        }
        if (/[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test($('#search-player-name').val())) {
            document.getElementById("alert-search-player").innerHTML = 'Prezývka nesmie obsahovať špeciálne znaky';
            setTimeout(clearAlert, 3000, "alert-search-player");
            $('#nick').val('');
            return false;
        }
        socket.emit('request leaderboard', $('#search-player-name').val());
    });

    $('#hint').keypress((e)=>{
        if(e.which!=13){
            if (!typingHint) {
                socket.emit('show typing hint', {user:sessionStorage.getItem("name"), typing:true})
            }
            typingHint = true
            clearTimeout(timeoutHint)
            timeoutHint = setTimeout(typingTimeoutHint, 3000);
        }
    });

    $('#guess').keypress((e)=>{
        if(e.which!=13){
            if (!typingGuess) {
                socket.emit('show typing guess', {user:sessionStorage.getItem("name"), typing:true})
            }
            typingGuess = true
            clearTimeout(timeoutGuess)
            timeoutGuess = setTimeout(typingTimeoutGuess, 3000);
        }
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
            if (sessionStorage.getItem("sound") !== 'off') document.getElementById('finish').play();
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
        if (role === 'guesser' && sessionStorage.getItem("sound") !== 'off') document.getElementById('notification').play();
        $('#hints').append('<li style="background: rgb(255, 255, 255)">' + hint);
        $('#hints').animate({scrollTop: $('#hints').prop("scrollHeight")}, 1);
    });

    socket.on('update active', function(active){
        document.getElementById("active-rooms").innerHTML = 'Aktívne miestnosti: ' + active;
    });

    socket.on('update guesses', function(guesses){
        if (role === 'describer' && sessionStorage.getItem("sound") !== 'off') document.getElementById('notification').play();
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
        if (sessionStorage.getItem("sound") !== 'off') document.getElementById('notification').play();
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
                '    <th>'+ score.prezyvka +'</th>' +
                '    <th>'+ score.odohrane_hry +'</th>' +
                '    <th>'+ score.celkove_body +'</th>' +
                '    <th>'+ score.ohodnotene_slova +'</th>' +
                '  </tr>'
            );
        });
    });

    socket.on('show typing hint', (data)=>{
        if(data.typing === true && role === 'guesser')
            document.getElementById("typing-display-hint").innerHTML = sessionStorage.getItem("name") + ' píše...';
        else
            document.getElementById("typing-display-hint").innerHTML = '';
    });

    socket.on('show typing guess', (data)=>{
        if(data.typing === true && role === 'describer')
            document.getElementById("typing-display-guess").innerHTML = sessionStorage.getItem("name") + ' píše...';
        else
            document.getElementById("typing-display-guess").innerHTML = '';
    });
});