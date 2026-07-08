/* ============================================================
   config.js  —  THE ONLY FILE YOU NEED TO EDIT
   ------------------------------------------------------------
   Change the three sections below, save, done.
   (Follow SETUP.md if you're not sure where the Firebase bits
    come from — it's a click-by-click guide.)
   ============================================================ */


/* 1) YOUR ROOMS ─────────────────────────────────────────────
   List your rooms/counters in the order they should appear on
   the waiting-room screen. Add or remove lines to match your
   clinic. Keep the quotes and the commas.
   Tip: if you add a room later, add it at the END of the list. */
const ROOMS = [
  "Gabinete 1",
  "Gabinete 2",
  "Gabinete 3",
  "Gabinete 4",
  "Gabinete 5",
  "Gabinete 6",
  "Gabinete 7"
];


/* 2) THE BIG LABEL at the top of the waiting-room screen ───── */
const DISPLAY_HEADER = "A atender";


/* 3) SOUND & VOICE ──────────────────────────────────────────
   When a gabinete's number goes UP, the waiting-room screen can
   play a chime and read the call out loud in European Portuguese.
   (Browsers need ONE tap on the screen to allow sound — the
    "Iniciar ecrã" button handles that. See SETUP.md.)
   Set either to false to turn it off. */
const SOUND_ENABLED     = true;               // the chime
const SPEAK_ENABLED     = true;               // the spoken announcement
const VOICE_LANG        = "pt-PT";            // European Portuguese
const ANNOUNCE_TEMPLATE = "Senha {n}, {room}"; // {n}=number, {room}=gabinete name

/* English call (the "Call 🇬🇧" button on the control page).
   {room} in English automatically becomes "Room X" when the
   gabinete is named "Gabinete X". */
const VOICE_LANG_EN        = "en-GB";
const ANNOUNCE_TEMPLATE_EN = "Ticket {n}, {room}";


/* 4) YOUR FIREBASE SETTINGS ─────────────────────────────────
   Paste the values from your Firebase project here.
   SETUP.md shows exactly where to copy each one from.
   These are NOT secret — they're meant to live in the page. */
const firebaseConfig = {
  apiKey:            "AIzaSyAdGHIhBBHnL-pLcplOMjNbeUwvefo7CTc",
  authDomain:        "gat-checkpointlx---senhas.firebaseapp.com",
  databaseURL:       "https://gat-checkpointlx---senhas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "gat-checkpointlx---senhas",
  storageBucket:     "gat-checkpointlx---senhas.firebasestorage.app",
  messagingSenderId: "441339300205",
  appId:             "1:441339300205:web:963fb97845ad72c3c23264"
};
