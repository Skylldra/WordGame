const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

let verlauf = [];  // Definiere die verlauf-Variable hier oben

// PostgreSQL-Datenbank-Verbindung
const pool = new Pool({
  connectionString: 'postgresql://gaestelistedb_o0ev_user:SsPaukVReZVdYnkCc7Ih1VQ2LtyUFHJb@dpg-crn9tft6l47c73ac0tvg-a/gaestelistedb_o0ev',
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware zum Parsen von JSON-Daten
app.use(express.json());

// Funktion zum Erstellen der Tabelle, falls sie nicht existiert
const createTableIfNotExists = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS worte (
      id SERIAL PRIMARY KEY,
      spielername VARCHAR(80),
      wort VARCHAR(80)
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log("Tabelle 'worte' wurde überprüft und ggf. erstellt.");
  } catch (err) {
    console.error("Fehler beim Erstellen der Tabelle:", err);
  }
};

// Tabelle beim Start des Servers erstellen
createTableIfNotExists();

// Route für das Servieren von index.html
app.get('/', (req, res) => {
  res.send(`
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
            
            <h2>Spieler:</h2>
            <ul id="spielerListe"></ul>

            <h2>Worteingabe</h2>
            <div id="wortEingabeBereich"></div>
            <button id="wortEinloggenBtn" onclick="worteEinloggen()">Worte einloggen</button>

            <h2>Ergebnis</h2>
            <p id="ergebnis"></p>

            <button onclick="zurücksetzen()">Zurücksetzen</button>

            <h2>Verlauf:</h2>
            <ul id="verlaufListe"></ul>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            let spieler = [];
            let verlauf = [];

            const socket = io();

            socket.on('update', (data) => {
                spieler = data.spieler;
                verlauf = data.verlauf;
                updateSpielerListe();
                updateVerlaufListe();
                vergleichWorte();
            });

            function spielerHinzufügen() {
                const name = document.getElementById("spielerName").value;
                if (name) {
                    spieler.push({ name, wort: '' });
                    updateSpielerListe();
                    updateWortEingabeBereich();
                    document.getElementById("spielerName").value = '';
                    socket.emit('spielerUpdate', spieler);
                }
            }

            function updateSpielerListe() {
                const spielerListe = document.getElementById("spielerListe");
                spielerListe.innerHTML = '';
                spieler.forEach(s => {
                    const li = document.createElement("li");
                    li.textContent = s.name;
                    spielerListe.appendChild(li);
                });
            }

            function updateWortEingabeBereich() {
                const wortEingabeBereich = document.getElementById("wortEingabeBereich");
                wortEingabeBereich.innerHTML = '';
                spieler.forEach((s, index) => {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.id = \`wortEingabe\${index}\`;
                    input.placeholder = \`\${s.name}'s Wort\`;
                    wortEingabeBereich.appendChild(input);
                });
            }

            async function worteEinloggen() {
                spieler = spieler.map((s, index) => ({
                    ...s,
                    wort: document.getElementById(\`wortEingabe\${index}\`).value.toLowerCase()
                }));

                if (spieler.every(s => s.wort)) {
                    const response = await fetch('/wort_einloggen', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ spieler })
                    });

                    const data = await response.json();
                    if (data.status === 'success') {
                        verlauf.push([...spieler.map(s => s.wort)]);
                        updateVerlaufListe();
                        vergleichWorte();
                        socket.emit('spielerUpdate', spieler);
                    }
                }
            }

            function vergleichWorte() {
                const ergebnis = document.getElementById("ergebnis");
                const wörter = spieler.map(s => s.wort);
                if (new Set(wörter).size === 1) {
                    ergebnis.textContent = "Gewonnen! Beide Spieler haben dasselbe Wort: " + wörter[0];
                } else {
                    ergebnis.textContent = "Weiter! Gebt neue Wörter ein.";
                    updateWortEingabeBereich();
                }
            }

            function updateVerlaufListe() {
                const verlaufListe = document.getElementById("verlaufListe");
                verlaufListe.innerHTML = '';
                verlauf.forEach((runde, index) => {
                    const li = document.createElement("li");
                    li.textContent = \`Runde \${index + 1}: \${runde.join(', ')}\`;
                    verlaufListe.appendChild(li);
                });
            }

            async function zurücksetzen() {
                const response = await fetch('/zuruecksetzen', {
                    method: 'POST'
                });

                const data = await response.json();
                if (data.status === 'reset') {
                    spieler = [];
                    verlauf = [];
                    document.getElementById("ergebnis").textContent = '';
                    updateSpielerListe();
                    updateWortEingabeBereich();
                    updateVerlaufListe();
                    socket.emit('spielerUpdate', spieler);
                }
            }
        </script>
    </body>
    </html>
  `);
});

// API-Endpunkt: Wort einloggen
app.post('/wort_einloggen', async (req, res) => {
  const { spieler } = req.body;

  try {
    for (const entry of spieler) {
      await pool.query('INSERT INTO worte (spielername, wort) VALUES ($1, $2)', [entry.name, entry.wort]);
    }
    verlauf = spieler.map(s => s.wort);  // aktualisiere verlauf
    io.emit('update', { spieler, verlauf });
    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// API-Endpunkt: Zurücksetzen
app.post('/zuruecksetzen', async (req, res) => {
  try {
    await pool.query('DELETE FROM worte');
    spieler = [];
    verlauf = [];
    io.emit('update', { spieler, verlauf });
    res.json({ status: 'reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// WebSocket-Kommunikation
io.on('connection', (socket) => {
  console.log('Ein Spieler ist verbunden');
  
  socket.on('spielerUpdate', (spieler) => {
    verlauf = spieler.map(s => s.wort);
    io.emit('update', { spieler, verlauf });
  });

  socket.on('disconnect', () => {
    console.log('Ein Spieler hat die Verbindung getrennt');
  });
});

// Server starten
server.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
