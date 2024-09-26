const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

let spieler = []; // Liste der Spieler
let verlauf = [];  // Verlaufsdaten
let wortEingaben = {}; // Wörter der Spieler

// PostgreSQL-Datenbank-Verbindung
const pool = new Pool({
  connectionString: 'postgresql://gaestelistedb_o0ev_user:SsPaukVReZVdYnkCc7Ih1VQ2LtyUFHJb@dpg-crn9tft6l47c73ac0tvg-a/gaestelistedb_o0ev',
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(express.json());

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route für den Verlauf
app.get('/verlauf', async (req, res) => {
  try {
    const result = await pool.query('SELECT spielername, wort FROM worte');
    res.json(result.rows);
  } catch (err) {
    console.error("Fehler beim Abrufen des Verlaufs:", err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Route zum Zurücksetzen des Spiels
app.post('/zuruecksetzen', async (req, res) => {
  try {
    await pool.query('DELETE FROM worte');
    spieler = [];
    verlauf = [];
    wortEingaben = {};
    io.emit('reset');
    res.json({ status: 'reset' });
  } catch (err) {
    console.error("Fehler beim Zurücksetzen:", err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('Ein Spieler ist verbunden');

  // Spieler hinzufügen
  socket.on('spielerHinzufügen', async (name) => {
    if (!spieler.includes(name)) {
      spieler.push(name);

      // Spieler sofort anzeigen, auch wenn keine weiteren Spieler da sind
      io.emit('update', { spieler, verlauf });

      // Spieler in die Datenbank einfügen
      await pool.query('INSERT INTO worte (spielername, wort) VALUES ($1, $2)', [name, '']);
    }
  });

  // Wort einloggen
  socket.on('wortEinloggen', async ({ name, wort }) => {
    wortEingaben[name] = wort; // Das Wort des Spielers speichern

    // Wort in die Datenbank eintragen
    await pool.query('UPDATE worte SET wort = $1 WHERE spielername = $2', [wort, name]);

    // Wenn alle Spieler ihre Wörter eingeloggt haben
    if (Object.keys(wortEingaben).length === spieler.length) {
      verlauf.push({ ...wortEingaben }); // Wörter zum Verlauf hinzufügen
      const wörter = Object.values(wortEingaben);
      
      // Wörter vergleichen
      const ergebnis = new Set(wörter).size === 1 
        ? "Gewonnen! Alle haben dasselbe Wort: " + wörter[0]
        : `Weiter! Runde ${verlauf.length}: Wörter stimmen nicht überein.`;

      if (new Set(wörter).size === 1) {
        io.emit('gewonnen');
      }

      io.emit('vergleichErgebnis', { ergebnis, verlauf }); // Ergebnis an alle senden
      wortEingaben = {}; // Zurücksetzen für die nächste Runde
    } else {
      // Wenn noch nicht alle Spieler eingeloggt haben
      io.emit('warteAufSpieler', { message: "Warte auf andere Spieler, bis sie eingeloggt haben." });
    }
  });

  socket.on('disconnect', () => {
    console.log('Ein Spieler hat die Verbindung getrennt');
  });
});

server.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
