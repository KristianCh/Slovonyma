//funckia na odchod z hry
function leave() {
    location.reload();
}

$(function () {
    //nastaví transports exkluzívne na websocket
    var socket = io({transports:['websocket']});
    //definujeme správy callbacku pripojenia do miestnosti
    const callbackAlerts = ["Miestnosť je plná", "Nenašla sa voľná  miestnosť", "Miestnosť s týmto kódom už existuje", "Musíš byť prihlásený",
        "Nemôžeš hrať dva krát naraz"];
    //definujeme premenné hry
    var role = '';
    var word = '';
    var typingHint = false;
    var timeoutHint = undefined;
    var typingGuess = false;
    var timeoutGuess = undefined;

    //timeout zobrazenia písania indície
    var typingTimeoutHint = function () {
        socket.emit('show typing hint', {user:sessionStorage.getItem("name"), typing:false})
        typingHint = false;
    }
    //timeout zobrazenia písania hádania
    var typingTimeoutGuess = function () {
        socket.emit('show typing guess', {user:sessionStorage.getItem("name"), typing:false})
        typingGuess = false;
    }
    //nastavíme onclick logout tlačidla
    document.getElementById("logout").onclick = function() {
        console.log()
        sessionStorage.setItem("name", '');
        location.reload();
    }
    //funkcia na premazanie zobrazenej chybovej správy
    var clearAlert = function(alertId) {
        document.getElementById(alertId).innerHTML = '';
    }
    //nastavíme funkciu zvukového tlačidla
    document.getElementById("sound-btn").onclick = function () {
        //toggle zvuku
        if (sessionStorage.getItem("sound") !== 'off') {
            sessionStorage.setItem("sound", 'off');
            document.getElementById("sound-btn").className = 'sound-button-off';
        }
        else {
            sessionStorage.setItem("sound", 'on');
            document.getElementById("sound-btn").className = 'sound-button-on';
        }
    }

    //náhodne vygenerujeme dĺžku prvej indície, od 3 po 5
    var hintLength = 3 + Math.floor(Math.random() * Math.floor(3));
    document.getElementById("hint-length").innerHTML = 'Zadaj indíciu ' + ['s tromi', 'so štyrmi', 's piatimi'][hintLength-3] + ' slovami';

    //vyžiada sa leaderboard
    socket.emit('request leaderboard', '');

    //skontroluje sa, či je hráč prihlásený, ak áno, schová sa prihlasovací formulár a zobrazí sa tlačidlo odhlásiť
    if (sessionStorage.getItem("name") !== null && sessionStorage.getItem("name") !== '') {
        document.getElementById("login").style.display = "none";
        document.getElementById("logout").style.display = "block";
    }
    //skontroluje sa, či je zvuk zapnutý, ak nie, zmeníme triedu zvukového tlačidla
    if (sessionStorage.getItem("sound") === 'off') document.getElementById("sound-btn").className = 'sound-button-off';

    //nastavíme funkciu tlačidla login
    document.getElementById("login-btn").onclick = function() {
        //nastaví tlačidlám adekvátne triedy
        document.getElementById("login-btn").className = 'active-button';
        document.getElementById("register-btn").className = 'inactive-button';
        //zobrazí prihlásenie a schováme registráciu
        document.getElementById("login-tab").style.display = 'block';
        document.getElementById("register-tab").style.display = 'none';
    };
    //nastavíme funkciu tlačidla register
    document.getElementById("register-btn").onclick = function() {
        //nastaví tlačidlám adekvátne triedy
        document.getElementById("login-btn").className = 'inactive-button';
        document.getElementById("register-btn").className = 'active-button';
        //zobrazí registráciu a schováme prihlásenie
        document.getElementById("login-tab").style.display = 'none';
        document.getElementById("register-tab").style.display = 'block';
    };

    //spracovanie formuláru na pripojenie do hry
    $('#join-form').submit(function (e) {
        e.preventDefault(); //zakáže reload stránky
        //overí, či je hráč prihlásený
        if (sessionStorage.getItem("name") === null ||
            sessionStorage.getItem("name") !== null && sessionStorage.getItem("name") === '') {
            document.getElementById("alert-join").innerHTML = callbackAlerts[3];
            setTimeout(clearAlert, 3000, "alert-join");
            return false;
        }
        //skontroluje správnosť kódu miestnosti
        var roomId = $('#room').val();
        if (/[ ]/.test(roomId)) {
            document.getElementById("alert-join").innerHTML = 'Kód miestnosti nemôže obsahovať medzeru';
            setTimeout(clearAlert, 3000, "alert-join");
            return false;
        }
        //socket pošle žiadosť o pripojenie do miestnosti
        socket.emit('join room', {name: sessionStorage.getItem("name"), room:roomId, type:e.originalEvent.submitter.value}, (callback) => {
            //pripojenie bolo schválené
            if (callback.id === 0) {
                //schová GUI elementy hlavného menu a zobrazí aktívnych hráčov
                document.getElementById("room-set").style.display = "none";
                document.getElementById("login").style.display = "none";
                document.getElementById("leaderboard").style.display = "none";
                document.getElementById("menu-content").style.display = 'none';
                document.getElementById("left-content").style.display = 'none';
                document.getElementById("main-title").style.display = 'none';
                document.getElementById("active-users").style.display = "block";
            }
            //pripojenie nebolo schválené
            else {
                //zobrazí chybovú hlášku na 3 sekundy
                document.getElementById("alert-join").innerHTML = callbackAlerts[callback.id-1];
                setTimeout(clearAlert, 3000, "alert-join");
            }
            //updatneme zobrazený kód miestnosti
            document.getElementById("room_code").innerHTML = "Kód miestnosti: " + callback.room;
        });
        return false;
    });

    //formulár na spracovanie prihlásenia
    $('#login-form').submit(function (e) {
        e.preventDefault(); //zakáže reload stránky
        //skontroluje, či bolo zadané heslo
        if($('#pass').val() === '') {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-login").innerHTML = "Musíš zadať heslo";
            setTimeout(clearAlert, 3000, "alert-login");
            return false;
        }
        //skontroluje, či heslo spĺňa kritériá
        if($('#pass').val().length < 8 || !$('#pass').val().match(/[0-9]+/) ||
            !$('#pass').val().match(/[A-Z]+/)) {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-login").innerHTML = "Heslo musí mať aspoň 8 znakov, minimálne 1 čislo a 1 veľké písmeno";
            setTimeout(clearAlert, 3000, "alert-login");
            return false;
        }
        //skontroluje, či bola zadaná prezývka
        if ($('#nick').val() !== '') {
            //skontroluje, či je prezývka iba jedno slovo
            if ($('#nick').val().split(" ").length !== 1) {
                //zobrazí chybovú hlášku na 3 sekundy
                document.getElementById("alert-login").innerHTML = "Prezývka musí byť jedno slovo";
                setTimeout(clearAlert, 3000, "alert-login");
                return false;
            }
            //skontroluje, či prezývka neobsahuje žiadne špeciálne znaky
            if (/[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test($('#nick').val())) {
                //zobrazí chybovú hlášku na 3 sekundy
                document.getElementById("alert-login").innerHTML = 'Prezývka nesmie obsahovať špeciálne znaky';
                setTimeout(clearAlert, 3000, "alert-login");
                //premaže textové pole prezývky
                $('#nick').val('');
                return false;
            }
            //vytvorí POST request na server a spracuje odpoveď
            $.post('/verify-login', { 'name' :  $('#nick').val(), 'password': $('#pass').val()}, function(data) {
                //ak bolo prihlásenie úspešné, uloží prezývku do session premennej a
                //schová sa prihlasovací formulár a zobrazí sa tlačidlo odhlásiť
                if (data.response) {
                    sessionStorage.setItem("name", $('#nick').val());
                    document.getElementById("login").style.display = "none";
                    document.getElementById("logout").style.display = "block";
                }
                //prihlásenie nebolo úspešné
                else {
                    //zobrazí chybovú hlášku na 3 sekundy
                    document.getElementById("alert-login").innerHTML = "Nesprávne prihlásenie";
                    setTimeout(clearAlert, 3000, "alert-login");
                }
            });
        }
        else {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-login").innerHTML = "Musíš zadať prezývku";
            setTimeout(clearAlert, 3000, "alert-login");
        }
        return false;
    });

    //formulár na spracovanie registrácie
    $('#register-form').submit(function (e) {
        e.preventDefault(); //zakáže reload stránky
        //skontroluje, či bolo zadané heslo
        if($('#reg-pass').val() === '' || $('#reg-pass-confirm').val() === '') {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-register").innerHTML = "Musíš zadať heslo";
            setTimeout(clearAlert, 3000, "alert-register");
            return false;
        }
        //skontroluje, či sú obe zadané heslá rovnaké
        if($('#reg-pass').val() !== $('#reg-pass-confirm').val()) {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-register").innerHTML = "Heslá sa musia zhodovať";
            setTimeout(clearAlert, 3000, "alert-register");
            return false;
        }
        //skontroluje, či heslo spĺňa kritériá
        if($('#reg-pass').val().length < 8 || !$('#reg-pass').val().match(/[0-9]+/) ||
            !$('#reg-pass').val().match(/[A-Z]+/)) {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-register").innerHTML = "Heslo musí mať aspoň 8 znakov, minimálne 1 čislo a 1 veľké písmeno";
            setTimeout(clearAlert, 3000, "alert-register");
            return false;
        }
        //skontroluje, či bola zadaná prezývka
        if ($('#reg-nick').val() !== '') {
            //skontroluje, či je prezývka iba jedno slovo
            if ($('#reg-nick').val().split(" ").length !== 1) {
                //zobrazí chybovú hlášku na 3 sekundy
                document.getElementById("alert-register").innerHTML = "Prezývka musí byť jedno slovo";
                setTimeout(clearAlert, 3000, "alert-register");
                return false;
            }
            //skontroluje, či prezývka neobsahuje žiadne špeciálne znaky
            if (/[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test($('#reg-nick').val())) {
                //zobrazí chybovú hlášku na 3 sekundy
                document.getElementById("alert-register").innerHTML = 'Prezývka nesmie obsahovať špeciálne znaky';
                setTimeout(clearAlert, 3000, "alert-register");
                //premaže textové pole prezývky
                $('#nick').val('');
                return false;
            }
            //vytvorí POST request na server a spracuje odpoveď
            $.post('/verify-register', { 'name' :  $('#reg-nick').val(), 'password': $('#reg-pass').val()}, function(data) {
                //ak bola registrácia úspešná, uloží prezývku do session premennej a
                //schová sa prihlasovací formulár a zobrazí sa tlačidlo odhlásiť
                if (data.response) {
                    sessionStorage.setItem("name", $('#reg-nick').val());
                    document.getElementById("login").style.display = "none";
                    document.getElementById("logout").style.display = "block";
                    //animuje farbu linku na stránku s návodom k hre aby bol výraznejší
                    document.getElementById("help").className = "help help-animate";
                }
                //registrácia nebola úspešná
                else {
                    //zobrazí chybovú hlášku na 3 sekundy
                    document.getElementById("alert-register").innerHTML = "Prezývka už existuje";
                    setTimeout(clearAlert, 3000, "alert-register");
                }
            });
        }
        else {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-register").innerHTML = "Musíš zadať prezývku";
            setTimeout(clearAlert, 3000, "alert-register");
        }
        return false;
    });

    //formulár na výber slova
    $('#word-select-form').submit(function (e) {
        e.preventDefault(); //zakáže reload stránky
        //skontroluje, či hráč zadával slovo, alebo vybral jedno z ponúkaných
        if (e.originalEvent.submitter.value === '') {
            //skontroluje, či bolo zadané iba jedno slovo
            if ($('#word').val() !== '' && $('#word').val().split(" ").length === 1) {
                //schová tlačidlo na výber slova a zobrazí načítavací symbol
                document.getElementById("word-select-button").style.display = "none";
                document.getElementById("loader").style.display = "block";
                //pošle zadané slovo hernému serveru
                socket.emit('select word', $('#word').val());
                word = $('#word').val();
                //premaže textové pole slova
                $('#word').val('');
            } else {
                //zobrazí chybovú hlášku na 3 sekundy
                document.getElementById("alert-word").innerHTML = "Musíš zadať jedno slovo";
                setTimeout(clearAlert, 3000, "alert-word");
            }
        }
        else {
            //schová tlačidlo na výber slova a zobrazí načítavací symbol
            document.getElementById("word-select-button").style.display = "none";
            document.getElementById("loader").style.display = "block";
            //pošle vybraté slovo hernému serveru
            socket.emit('select word', e.originalEvent.submitter.value);
            word = e.originalEvent.submitter.value;
            //premaže textové pole slova
            $('#word').val('');
        }
        return false;
    });

    //formulár na spracovanie indície
    $('#hint-form').submit(function(e) {
        e.preventDefault(); //zakáže reload stránky
        //skontroluje dĺžku indície a či ju zadal opisovač
        if ($('#hint').val().length <= 50 && role === 'describer') {
            //skontroluje, či má indícia správny počet slov
            if (hintLength === $('#hint').val().split(" ").length) {
                //vytvorí string na porovnanie so slovom vymazaním znakov ktoré nie sú písmená
                var stringToCheck = $('#hint').val().replace(/[^a-zA-Z\u00C0-\uFFFF]/gu, '');
                var wordToFind = word;
                //porovnáva čassti slova so stringom z indície aby sa zistilo, či indícia neobsahuje hádané slovo, alebo jeho časť
                do {
                    if (new RegExp(wordToFind, 'iu').test(stringToCheck)) {
                        //zobrazí chybovú hlášku na 3 sekundy
                        document.getElementById("alert-hint").innerHTML = 'Indícia nesmie obsahovať hádané slovo ani jeho časť!';
                        setTimeout(clearAlert, 3000, "alert-hint");
                        $('#hint').val('');
                        return false;
                    }
                    wordToFind = wordToFind.slice(0, wordToFind.length - 1);
                } while (wordToFind.length > 3);
                //pošle serveru indíciu
                socket.emit('hint submit', $('#hint').val());
                document.getElementById("alert-hint").innerHTML = '';
                //vygeneruje a zobrazí novú dľžku indície
                hintLength = 3 + Math.floor(Math.random() * Math.floor(3));
                document.getElementById("hint-length").innerHTML = 'Zadaj indíciu ' + ['s tromi', 'so štyrmi', 's piatimi'][hintLength - 3] +
                    ' slovami';
                setTimeout(clearAlert, 3000, "alert-hint");
            }
            //indícia nemá správny počet slov
            else {
                //zobrazí chybovú hlášku na 3 sekundy
                document.getElementById("alert-hint").innerHTML = 'Indícia musí mať ' + ['tri slová!', 'štyri slová!', 'päť slov!'][hintLength - 3];
                setTimeout(clearAlert, 3000, "alert-hint");
            }
        }
        else {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-hint").innerHTML = 'Indícia musí byť kratšia ako 50 znakov!';
            setTimeout(clearAlert, 3000, "alert-hint");
        }
        //premaže textové pole indície
        $('#hint').val('');
        return false;
    });

    //formulár na spracovanie hádania
    $('#guess-form').submit(function(e){
        e.preventDefault(); //zakáže reload stránky
        //skontroluje, či hádal hádač
        if (role === 'guesser') {
            //skontroluje, či slovo nie je prázdne a či je iba jedno
            if ($('#guess').val() !== '' && $('#guess').val().split(" ").length === 1) {
                //pošle slovo hernému serveru
                socket.emit('guess submit', $('#guess').val());
            }
            //zobrazí chybovú hlášku na 3 sekundy
            else document.getElementById("alert-guess").innerHTML = "Musíš zadať jedno slovo";
            setTimeout(clearAlert, 3000, "alert-guess");
        }
        //premaže textové pole hádania
        $('#guess').val('');
        return false;
    });

    //formulár na opakovanie hry
    $('#replay-form').submit(function(e){
        e.preventDefault(); //zakáže reload stránky
        //pošle hernému serveru správu, že chce opakovať hru
        socket.emit('replay');
        //schová GUI elementy koncu hry a zobrazí elementy o čakaní na druhého hráča
        document.getElementById("end-buttons").style.display = "none";
        document.getElementById("end-stats").style.display = "none";
        document.getElementById("wait-for-other-message").style.display = "block";
        document.getElementById("loader").style.display = "none";
    });

    //formulár na spracovanie hľadanie hráča v rebríčku hráčov
    $('#search-player-form').submit(function(e){
        e.preventDefault(); //zakáže reload stránky
        //skontroluje, či je zadaná prezývka jedno slovo
        if ($('#search-player-name').val().split(" ").length !== 1) {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-search-player").innerHTML = "Prezývka musí byť jedno slovo";
            setTimeout(clearAlert, 3000, "alert-search-player");
            return false;
        }
        //skontroluje, či zadaná prezývka neobsahuje špeciálne znaky
        if (/[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test($('#search-player-name').val())) {
            //zobrazí chybovú hlášku na 3 sekundy
            document.getElementById("alert-search-player").innerHTML = 'Prezývka nesmie obsahovať špeciálne znaky';
            setTimeout(clearAlert, 3000, "alert-search-player");
            $('#nick').val('');
            return false;
        }
        //pošle serveru žiadosť o načítanie rebríčku hráčov so zadaným filtrom
        socket.emit('request leaderboard', $('#search-player-name').val());
    });

    //spracovanie stlačenia klávesy pri písaní indície
    $('#hint').keypress((e)=>{
        //skontroluje, či je to iná klávesa ako Enter
        if(e.which!=13){
            //skontroluje, či zobrazenie písanie indície už nie je aktívne
            if (!typingHint) {
                //pošle hernému serveru správu, že sa píše indícia
                socket.emit('show typing hint', {user:sessionStorage.getItem("name"), typing:true})
            }
            //nastaví stav písanie indíciu
            typingHint = true
            //premaže timeout písanie indície
            clearTimeout(timeoutHint)
            //nastaví timeout písania indície na 3 sekundy
            timeoutHint = setTimeout(typingTimeoutHint, 3000);
        }
    });

    //spracovanie stlačenia klávesy pri písaní hádania
    $('#guess').keypress((e)=>{
        //skontroluje, či je to iná klávesa ako Enter
        if(e.which!=13){
            //skontroluje, či zobrazenie písanie hádania už nie je aktívne
            if (!typingGuess) {
                //pošle hernému serveru správu, že sa píše hádanie
                socket.emit('show typing guess', {user:sessionStorage.getItem("name"), typing:true})
            }
            //nastaví stav písania hádania
            typingGuess = true
            //premaže timeout písania hádania
            clearTimeout(timeoutGuess)
            //nastaví timeout písania hádania na 3 sekundy
            timeoutGuess = setTimeout(typingTimeoutGuess, 3000);
        }
    });

    //spracovanie správy od hernéhu serveru o stave
    socket.on('update state', function(msg){
        //premaže list pripojených požívateľov
        $('#users').empty();
        //zobrazí počet pripojených používateľov
        document.getElementById("u").innerHTML = "Pripojení používatelia " + msg.users.length + "/" + 2;
        //stav hry je čakanie na druhého hráča
        if (msg.state === 'waiting_for_second') {
            //zobrazí správu o čakaní na druhého hráča a schová animovaný loader
            document.getElementById("wait-for-other-message").style.display = "block";
            document.getElementById("loader").style.display = "none";
        }
        //stav hry je čakanie na výber slova
        else if (msg.state === 'waiting_for_word_select') {
            //schová správu o čakaní na druhého hráča
            document.getElementById("wait-for-other-message").style.display = "none";
            //ak je hráč opisovač, priradí mu rolu, zobrazí výber slov
            if (msg.describer === sessionStorage.getItem("name")) {
                role = 'describer';
                document.getElementById("word-select").style.display = "block";
                document.getElementById("word-select-button").style.display = "block";
            }
            //ak je hráč hádač, priradí mu rolu, zobrazí správu o čakaní na výber slova opisovačom
            else {
                role = 'guesser';
                document.getElementById("wait-for-word-select-message").style.display = "block";
            }
        }
        //stav hry je hra prebieha
        else if (msg.state === 'in_game') {
            //zobrazí herné GUI elementy
            document.getElementById("hint-display").style.display = "block";
            document.getElementById("guess-display").style.display = "block";
            document.getElementById("top-bar").style.display = "block";
            //ak je hráč opisovač, schová výber slova a formulár hádania, zobrazí formulár indície
            //v hornom paneli zobrazí slovo, skóre a údaje o zostávajúcich indíciach a hádaniach
            if (msg.describer === sessionStorage.getItem("name")) {
                document.getElementById("word-select").style.display = "none";
                document.getElementById("guess-form").style.display = "none";
                document.getElementById("hint-form").style.display = "block";
                document.getElementById("top-bar").innerHTML = '<h1 id="word-display">  </h1> <br>' +
                    'Zostávajúce indície: ' + msg.hintsLeft + '<br> Zostávajúce hádania: ' + msg.guessesLeft +
                    '<br> Skóre: ' + msg.describerPoints;
                document.getElementById("word-display").innerHTML = msg.word;
            }
            //ak je hráč hádač, schová správu o čakaní na výber slova opisovačom a formulár indície, zobrazí formulár hádania
            //v hornom paneli zobrazí skóre a údaje o zostávajúcich indíciach a hádaniach
            else {
                document.getElementById("wait-for-word-select-message").style.display = "none";
                document.getElementById("hint-form").style.display = "none";
                document.getElementById("guess-form").style.display = "block";
                document.getElementById("top-bar").innerHTML = 'Zostávajúce indície: ' + msg.hintsLeft + '<br> Zostávajúce hádania: ' + msg.guessesLeft +
                    '<br> Skóre: ' + msg.guesserPoints;
            }
        }
        //stav hry je skončná hra
        else if (msg.state === 'game_finished') {
            //ak je zvuk zapnutý zahrá koncový zvuk
            if (sessionStorage.getItem("sound") !== 'off') document.getElementById('finish').play();
            //premaže listy hádaní a indícií
            $('#guesses').empty();
            $('#hints').empty();
            //schová herné GUI elementy a zobrazí koncové
            document.getElementById("top-bar").style.display = "none";
            document.getElementById("hint-display").style.display = "none";
            document.getElementById("guess-display").style.display = "none";

            document.getElementById("end-buttons").style.display = "block";
            document.getElementById("end-stats").style.display = "block";
            //zobrazí výsledky hry
            document.getElementById("end-stats").innerHTML =
                "<h1> Slovo bolo: " + msg.word + "</h1> <br>" +
                "Skóre: " + ((role === 'describer') ? msg.describerPoints : msg.guesserPoints) +
                '<br>Slová ohodnotené: ' + msg.ratedWords;
        }
        //zobrazí zoznam pripojených hráčov
        msg.users.forEach(function (user) {
            $('#users').append($('<li>').text(user));
        });
    });
    //spracovanie správy od hernéhu serveru o updatnutí indící
    socket.on('update hints', function(hint){
        //ak je hráč hádač a má zapnutý zvuk, zahrá zvuk notifikácie
        if (role === 'guesser' && sessionStorage.getItem("sound") !== 'off') document.getElementById('notification').play();
        //pridá novú indíciu do zoznamu
        $('#hints').append('<li style="background: rgb(255, 255, 255)">' + hint);
        $('#hints').animate({scrollTop: $('#hints').prop("scrollHeight")}, 1);
    });
    //spracovanie správy od hernéhu serveru o updatnutí počtu aktívnych miestností
    socket.on('update active', function(active){
        //zobrazí aktuálny počet otvorených herných miestností
        document.getElementById("active-rooms").innerHTML = 'Aktívne miestnosti: ' + active;
    });
    //spracovanie správy od hernéhu serveru o updatnutí hádaní
    socket.on('update guesses', function(guesses){
        //ak je hráč opisovač a má zapnutý zvuk, zahrá zvuk notifikácie
        if (role === 'describer' && sessionStorage.getItem("sound") !== 'off') document.getElementById('notification').play();
        //premaže list hádaní
        $('#guesses').empty();
        //pre každé hádanie pridá do zoznamu
        for (const [key, value] of Object.entries(guesses)) {
            //postupne vygeneruje text pre hádanie podľa hodnoty ohodnotenia
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
            //ak je hráč opisovač a slovo má hodnotu ohodnotenia -1,
            // pridá do listu riadok zobrazujúci slovo a text ohodnotenia, s triedou podľa hodnoty ohodnotenia
            if (role === 'guesser' || value.rating !== -1) {
                $('#guesses').append('<li class="rate-li-' + value.rating + '" style="background: rgb(255, 255, 255)">' + key + ': ' + rating);
            }
            //ak je hráč opisovač, pridá do listu riadok so slovom a vygenerovanými tlačidlami pre ohodnotenie slova
            else {
                //pridá do listu slovo
                $('#guesses').append('<li id="' + key + '-line">' + key + ': ');
                //vytvorí pole 6 tlačidieľ
                var buttons = [
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON"),
                    document.createElement("BUTTON")];
                //priradí tlačidlám text a triedu a pridá ich do listu
                for (var i = 4; i >= 0; i--) {
                    buttons[i].innerHTML = ['Úplne iné', 'Veľmi málo podobné', 'Trochu podobné', 'Veľmi podobné', 'Takmer identické'][i];
                    buttons[i].className = 'rate-button-' + i;
                    document.getElementById(key + "-line").appendChild(buttons[i]);
                }
                buttons[5].innerHTML = 'Nie je slovo!';
                buttons[5].className = 'rate-button--2';
                document.getElementById(key + "-line").appendChild(buttons[5]);
                //priradí tlačidlám funkcie - poslanie slova a hodnoty ohodnotenia hernému severu
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
            //posunie sa na spodok listu hádaní
            $('#guesses').animate({scrollTop: $('#guesses').prop("scrollHeight")}, 1);
        }
    });
    //spracovanie správy od hernéhu serveru o odpojení druhého hráča
    socket.on('other disconnected', function(){
        //ak má hráč zapnutý zvuk, zahrá zvuk notifikácie
        if (sessionStorage.getItem("sound") !== 'off') document.getElementById('notification').play();
        //reloadne stranku
        location.reload();
        //zobrazí popup alert o odpojení druhého hráča
        alert("Druhý hráč sa odpojil");
    });
    //spracovanie správy od hernéhu serveru o zobrazení slov na výber pre opisovača
    socket.on('preset words', function(words){
        //zobrazí slová a priradí tlačidľám ich value
        document.getElementById("preset_word_1").innerHTML = words[0];
        document.getElementById("preset_word_1").value = words[0];
        document.getElementById("preset_word_2").innerHTML = words[1];
        document.getElementById("preset_word_2").value = words[1];
        document.getElementById("preset_word_3").innerHTML = words[2];
        document.getElementById("preset_word_3").value = words[2];
    });
    //spracovanie správy od hernéhu serveru o zobrazení rebríčku hráčov
    socket.on('display leaderboard', function(scores) {
        //premaže list rebríčku hráčov
        $('#leadboard-table').empty();
        //zobrazí riadok listu s opismy
        $('#leadboard-table').append(
            '<tr>' +
            '    <th>Prezývka</th>' +
            '    <th>Odohrané hry</th>' +
            '    <th>Skóre</th>' +
            '    <th>Ohodnotené slová</th>' +
            '  </tr>'
        );
        //zobrazí údaje o každom hráčovi v rebríčku
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
    //spracovanie správy od hernéhu serveru o zobrazení písania indície
    socket.on('show typing hint', (data)=>{
        //ak sa píše a hráč je hádač, zobrazí správu že druhý hráč píše, inak text schová
        if(data.typing === true && role === 'guesser')
            document.getElementById("typing-display-hint").innerHTML = data.user + ' píše...';
        else
            document.getElementById("typing-display-hint").innerHTML = '';
    });
    //spracovanie správy od hernéhu serveru o zobrazení písania hádania
    socket.on('show typing guess', (data)=>{
        //ak sa píše a hráč je opisovač, zobrazí správu že druhý hráč píše, inak text schová
        if(data.typing === true && role === 'describer')
            document.getElementById("typing-display-guess").innerHTML = data.user + ' píše...';
        else
            document.getElementById("typing-display-guess").innerHTML = '';
    });
});