const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL-Datenbank-Verbindung (ersetze 'dein_connection_string' durch deinen tatsächlichen Connection-String)
const pool = new Pool({
  connectionString: 'postgresql://gaestelistedb_o0ev_user:SsPaukVReZVdYnkCc7Ih1VQ2LtyUFHJb@dpg-crn9tft6l47c73ac0tvg-a/gaestelistedb_o0ev',
  ssl: {
    rejectUnauthorized: false  // Falls du SSL verwenden musst (z. B. bei Render), ansonsten auf true setzen.
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

// Tabelle beim Start des Servers erstellen, falls sie nicht existiert
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
    </head>
    <body>
        <h1>Wortvergleich-Spiel</h1>
        
        <div id="spielbereich">
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
        </div>

        <h2>Verlauf:</h2>
        <ul id="verlaufListe"></ul>

        <script>
            let spieler = [];
            let verlauf = [];

            function spielerHinzufügen() {
                const name = document.getElementById("spielerName").value;
                if (name) {
                    spieler.push({ name, wort: '' });
                    updateSpielerListe();
                    updateWortEingabeBereich();
                    document.getElementById("spielerName").value = '';
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
    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// API-Endpunkt: Verlauf abrufen
app.get('/verlauf', async (req, res) => {
  try {
    const result = await pool.query('SELECT spielername, wort FROM worte');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// API-Endpunkt: Zurücksetzen
app.post('/zuruecksetzen', async (req, res) => {
  try {
    await pool.query('DELETE FROM worte');
    res.json({ status: 'reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Server starten
app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
