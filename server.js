<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wortvergleich-Spiel</title>
    <style>
        body {
            background-color: #4A90E2;
            font-family: Arial, sans-serif;
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        h1, h2 {
            text-align: center;
            font-size: 2rem;
            margin-bottom: 20px;
        }
        #spielbereich {
            background-color: #ffffff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.1);
            color: #333;
            width: 100%;
            max-width: 400px;
            text-align: center;
        }
        input[type="text"] {
            width: calc(100% - 20px);
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            border: 1px solid #ccc;
            font-size: 1rem;
        }
        button {
            width: 100%;
            padding: 10px;
            background-color: #4A90E2;
            border: none;
            border-radius: 5px;
            color: white;
            font-size: 1rem;
            cursor: pointer;
        }
        button:hover {
            background-color: #357ABD;
        }
        ul {
            list-style-type: none;
            padding: 0;
        }
        li {
            font-size: 1.2rem;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div id="spielbereich">
        <h1>Wortvergleich-Spiel</h1>
        
        <h2>Spieler hinzufügen</h2>
        <input type="text" id="spielerName" placeholder="Spielername eingeben">
        <button onclick="spielerHinzufügen()">Spieler hinzufügen</button>

        <h2>Aktive Spieler</h2>
        <ul id="spielerListe"></ul>

        <h2>Worteingabe</h2>
        <div id="wortEingabeBereich"></div>
        <button id="wortEinloggenBtn" onclick="worteEinloggen()">Worte einloggen</button>

        <h2>Ergebnis</h2>
        <p id="ergebnis"></p>

        <button onclick="spielZuruecksetzen()">Spiel zurücksetzen</button>

        <h2>Verlauf</h2>
        <ul id="verlaufListe"></ul>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let meinName = null;

        function spielerHinzufügen() {
            const name = document.getElementById("spielerName").value;
            if (name) {
                meinName = name;
                socket.emit('spielerHinzufügen', name);
                updateWortEingabeBereich(name);
            }
        }

        function updateWortEingabeBereich(name) {
            const wortEingabeBereich = document.getElementById("wortEingabeBereich");
            wortEingabeBereich.innerHTML = `
                <input type="text" id="wortEingabe" placeholder="Wort eingeben">
            `;
        }

        function worteEinloggen() {
            const wort = document.getElementById("wortEingabe").value;
            if (wort && meinName) {
                socket.emit('wortEinloggen', { name: meinName, wort });
            }
        }

        function spielZuruecksetzen() {
            fetch('/zuruecksetzen', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'reset') {
                        document.getElementById("ergebnis").textContent = '';
                        updateSpielerListe([]);
                        updateVerlaufListe([]);
                    }
                });
        }

        socket.on('vergleichErgebnis', (ergebnis) => {
            document.getElementById("ergebnis").textContent = ergebnis;
        });

        socket.on('update', (data) => {
            const { spieler } =
