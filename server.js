const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL-Datenbank-Verbindung (ersetze 'dein_connection_string' durch deinen tatsächlichen Connection-String)
const pool = new Pool({
  connectionString: 'postgresql://gaestelistedb_o0ev_user:SsPaukVReZVdYnkCc7Ih1VQ2LtyUFHJb@dpg-crn9tft6l47c73ac0tvg-a/gaestelistedb_o0ev',  // Deinen Connection-String hier einfügen
  ssl: {
    rejectUnauthorized: false  // Falls du SSL verwenden musst (z. B. bei Render), ansonsten auf true setzen.
  }
});

// Middleware zum Parsen von JSON-Daten
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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
  res.sendFile(path.join(__dirname, 'index.html'));
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
