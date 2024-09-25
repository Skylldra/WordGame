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

io.on('connection', (socket) => {
  console.log('Ein Spieler ist verbunden');

  // Spieler hinzufügen
  socket.on('spielerHinzufügen', (name) => {
    if (!spieler.includes(name)) {
      spieler.push(name);
      io.emit('update', { spieler, verlauf });
    }
  });

  // Wort einloggen
  socket.on('wortEinloggen', ({ name, wort }) => {
    wortEingaben[name] = wort; // Das Wort des Spielers speichern

    // Wenn alle Spieler ihre Wörter eingeloggt haben
    if (Object.keys(wortEingaben).length === spieler.length) {
      verlauf.push(wortEingaben); // Wörter zum Verlauf hinzufügen
      const wörter = Object.values(wortEingaben);
      
      // Wörter vergleichen
      const ergebnis = new Set(wörter).size === 1 
        ? "Gewonnen! Alle haben dasselbe Wort: " + wörter[0]
        : "Weiter! Wörter stimmen nicht überein.";

      io.emit('vergleichErgebnis', ergebnis); // Ergebnis an alle senden
      wortEingaben = {}; // Zurücksetzen für die nächste Runde
    }
  });

  socket.on('disconnect', () => {
    console.log('Ein Spieler hat die Verbindung getrennt');
  });
});

server.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
