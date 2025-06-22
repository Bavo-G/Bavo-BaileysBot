const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require('baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

const { state, saveCreds } = useSingleFileAuthState('./auth_info.json');

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot connected to WhatsApp!');
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid !== "status@broadcast") return;

    const from = msg.key.participant || msg.pushName;

    try {
      // 👀 AUTO-VIEW
      await sock.readMessages([msg.key]);
      console.log(`👀 Viewed status from ${from}`);

      // 🔥 AUTO-REACT
      await sock.sendMessage(msg.key.remoteJid, {
        react: {
          text: "🔥",
          key: msg.key,
        },
      });

      console.log(`🔥 Reacted to ${from}'s status`);
    } catch (err) {
      console.log("⚠️ Error handling status:", err.message);
    }
  });
}

startBot();
