/**
 * DairyChain Backend Server
 *
 * Express + Socket.io server that receives temperature readings from ESP32
 * sensors via HTTP POST and broadcasts them to connected React clients
 * via WebSocket in real time.
 *
 * Routes:
 *   POST /api/temperature      — Receive a new sensor reading
 *   GET  /api/temperature/history — Retrieve all stored readings
 *   GET  /api/health            — Health check endpoint
 *
 * WebSocket Events:
 *   "new-temperature" — Emitted to all clients when a reading arrives
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const { ethers } = require('ethers');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const accessRequestRoutes = require('./routes/accessRequests');
const userRoutes = require('./routes/users');

// ─── Sepolia blockchain writer ───────────────────────────────────
// Configure these in the LOCAL server/.env file. Never commit private keys.
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const TEMPERATURE_LOG_CONTRACT_ADDRESS = process.env.TEMPERATURE_LOG_CONTRACT_ADDRESS;
const BLOCKCHAIN_PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;
const BLOCKCHAIN_BATCH_ID = process.env.BLOCKCHAIN_BATCH_ID || 'BATCH-001';
const BLOCKCHAIN_MIN_INTERVAL_MS = 60_000; // At most one on-chain write per minute
const temperatureLogAbi = [
  'function recordTemperature(string deviceId, string batchId, int256 temperatureCentiC) external',
  'function getReadingCount() external view returns (uint256)',
];
let temperatureLogContract = null;
let lastBlockchainWriteAt = 0;
let blockchainWriteInProgress = false;

if (SEPOLIA_RPC_URL && TEMPERATURE_LOG_CONTRACT_ADDRESS && BLOCKCHAIN_PRIVATE_KEY) {
  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(BLOCKCHAIN_PRIVATE_KEY, provider);
    temperatureLogContract = new ethers.Contract(
      TEMPERATURE_LOG_CONTRACT_ADDRESS,
      temperatureLogAbi,
      wallet
    );
    console.log('⛓️ Sepolia temperature logging configured. Signer:', wallet.address);
    console.log('   Contract:', TEMPERATURE_LOG_CONTRACT_ADDRESS);
  } catch (err) {
    console.error('❌ Blockchain configuration error:', err.message);
  }
} else {
  console.warn('ℹ️ Sepolia logging is not configured. Add SEPOLIA_RPC_URL, TEMPERATURE_LOG_CONTRACT_ADDRESS, and BLOCKCHAIN_PRIVATE_KEY to server/.env.');
}

async function recordTemperatureOnChain(reading) {
  if (!temperatureLogContract) return;
  const now = Date.now();
  if (blockchainWriteInProgress || now - lastBlockchainWriteAt < BLOCKCHAIN_MIN_INTERVAL_MS) return;

  blockchainWriteInProgress = true;
  lastBlockchainWriteAt = now;
  try {
    const temperatureCentiC = Math.round(Number(reading.temperature) * 100);
    const tx = await temperatureLogContract.recordTemperature(
      String(reading.deviceId || 'MILK-ESP32-01'),
      BLOCKCHAIN_BATCH_ID,
      temperatureCentiC
    );
    console.log('⛓️ Sepolia transaction submitted:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Temperature recorded on Sepolia. Block:', receipt.blockNumber, '| Tx:', tx.hash);
    reading.blockchainTxHash = tx.hash;
    reading.blockchainStatus = 'confirmed';
  } catch (err) {
    // Keep live sensor monitoring working even if blockchain submission fails.
    lastBlockchainWriteAt = 0; // Allow retry on a later reading
    console.error('❌ Sepolia temperature write failed:', err.shortMessage || err.message);
    if (reading) reading.blockchainStatus = 'failed';
  } finally {
    blockchainWriteInProgress = false;
  }
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected:', process.env.MONGO_URI))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ─── Middleware ──────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/access-requests', accessRequestRoutes);
app.use('/api/users', userRoutes);

// ─── In-memory readings store (FIFO, max 200) ──────────────────
const MAX_READINGS = 200;
const readings = [];

// ─── Helper: get local network IP ──────────────────────────────
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// ─── Routes ─────────────────────────────────────────────────────

/**
 * POST /api/temperature
 *
 * Accepts a JSON body with sensor data from ESP32.
 *
 * @body {number}  temperature  — Temperature in °C (required)
 * @body {number}  [humidity]   — Relative humidity in % (optional)
 * @body {string}  deviceId     — Identifier for the sensor device (required)
 *
 * @returns {{ success: boolean, reading: object }}
 */
app.post('/api/temperature', (req, res) => {
  const rawTemp =
    req.body.milkTemperature !== undefined
      ? req.body.milkTemperature
      : req.body.temperature;
  const { humidity, deviceId, relay, mode, limit, status } = req.body;

  const temperature = parseFloat(rawTemp);

  // Validate temperature is a number
  if (isNaN(temperature)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing "temperature" or "milkTemperature" — must be a number.',
    });
  }

  // Validate deviceId is present
  const resolvedDeviceId = deviceId || 'MILK-ESP32-01';

  // Build reading with server-side timestamp
  const reading = {
    temperature,
    humidity: humidity !== undefined && humidity !== null ? parseFloat(humidity) : null,
    deviceId: resolvedDeviceId,
    timestamp: new Date().toISOString(),
    source: 'http',
    milkTemperature: temperature,
    relay: relay || null,
    mode: mode || null,
    limit: limit != null ? parseFloat(limit) : null,
    status: status || null,
  };

  // Store (FIFO — drop oldest when at capacity)
  readings.push(reading);
  if (readings.length > MAX_READINGS) {
    readings.shift();
  }

  // Save a throttled copy to Sepolia, then broadcast live to clients.
  void recordTemperatureOnChain(reading);
  io.emit('new-temperature', reading);

  // Console log
  const time = new Date().toLocaleTimeString();
  const humStr = reading.humidity !== null ? `${reading.humidity}%` : 'N/A';
  console.log(`📥 [${time}] ${reading.deviceId}: ${reading.temperature}°C | Humidity: ${humStr}`);

  return res.status(200).json({ success: true, reading });
});

/**
 * GET /api/temperature/history
 *
 * Returns the full in-memory readings array.
 *
 * @returns {Array<{ temperature, humidity, deviceId, timestamp }>}
 */
app.get('/api/temperature/history', (req, res) => {
  return res.status(200).json(readings);
});

/**
 * GET /api/health
 *
 * Simple health check.
 *
 * @returns {{ status: string, readings: number }}
 */
app.get('/api/health', (req, res) => {
  return res.status(200).json({ status: 'ok', readings: readings.length });
});

/**
 * GET /api/mqtt/status
 *
 * Checks MQTT broker connection status.
 */
app.get('/api/mqtt/status', (req, res) => {
  res.json({
    connected: mqttClient ? mqttClient.connected : false,
    broker: MQTT_BROKER_URL,
    topic: PRIMARY_MQTT_TOPIC,
    topics: MQTT_TOPICS,
    readings: readings.length,
  });
});

// ─── Socket.io ──────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Send the latest reading immediately if available
  if (readings.length > 0) {
    socket.emit('new-temperature', readings[readings.length - 1]);
  }

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ─── Start Server ───────────────────────────────────────────────
const PORT = 5000;
const localIP = getLocalIP();

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🧊  DairyChain Temperature Relay Server');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ✅ Backend running on http://0.0.0.0:${PORT}`);
  console.log(`  📡 POST endpoint: http://${localIP}:${PORT}/api/temperature`);
  console.log(`  🌐 WebSocket:     ws://${localIP}:${PORT}`);
  console.log(`  📜 History:       http://localhost:${PORT}/api/temperature/history`);
  console.log(`  💚 Health:        http://localhost:${PORT}/api/health`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('  Waiting for ESP32 sensor data...');
  console.log('');
});

// ============================================================
// MQTT SUBSCRIBER — Bridges ESP32 sensor data into the app
// ============================================================

const MQTT_BROKER_URL = 'mqtt://broker.emqx.io:1883';
const PRIMARY_MQTT_TOPIC = 'smartfarm/field1/sensors';
const MQTT_TOPICS = [
  'smartfarm/field1/sensors',
  'dairychain/sensors/temperature',
  'dairychain',
];

console.log('🔄 Connecting to MQTT broker:', MQTT_BROKER_URL);

const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
  clientId: 'dairychain_backend_' + Math.random().toString(16).slice(2, 10),
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 10000,
});

mqttClient.on('connect', () => {
  console.log('✅ MQTT connected to broker');
  MQTT_TOPICS.forEach((topic) => {
    mqttClient.subscribe(topic, { qos: 0 }, (err) => {
      if (err) {
        console.error(`❌ MQTT subscribe error for ${topic}:`, err.message);
      } else {
        console.log(`📡 MQTT subscribed to topic: ${topic}`);
      }
    });
  });
});

mqttClient.on('message', (topic, message) => {
  try {
    const raw = message.toString();
    console.log(`📥 MQTT [${topic}]:`, raw);

    const data = JSON.parse(raw);

    // Support both `milkTemperature` and standard `temperature` / `temp`
    const rawTemp =
      data.milkTemperature !== undefined
        ? data.milkTemperature
        : (data.temperature !== undefined ? data.temperature : data.temp);

    const temperature = parseFloat(rawTemp);

    // Validate
    if (isNaN(temperature)) {
      console.warn('⚠️ Invalid temperature in MQTT message:', raw);
      return;
    }

    const newReading = {
      temperature,
      humidity: data.humidity != null ? parseFloat(data.humidity) : null,
      deviceId: data.deviceId || 'MILK-ESP32-01',
      timestamp: new Date().toISOString(),
      source: 'mqtt',
      topic,
      milkTemperature: temperature,
      relay: data.relay || null,
      mode: data.mode || null,
      limit: data.limit != null ? parseFloat(data.limit) : null,
      status: data.status || null,
    };

    // Store in the existing in-memory array
    readings.push(newReading);
    if (readings.length > 200) readings.shift();

    // Save a throttled copy to Sepolia, then broadcast live to clients.
    void recordTemperatureOnChain(newReading);
    io.emit('new-temperature', newReading);

    const extraInfo = [
      newReading.relay ? `Relay: ${newReading.relay}` : null,
      newReading.mode ? `Mode: ${newReading.mode}` : null,
      newReading.limit != null ? `Limit: ${newReading.limit}°C` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    console.log(
      `✅ Broadcast to React: ${newReading.temperature}°C${
        newReading.humidity != null ? ` | ${newReading.humidity}%` : ''
      }${extraInfo ? ` | ${extraInfo}` : ''}`
    );
  } catch (err) {
    console.error('❌ MQTT parse error:', err.message);
  }
});

mqttClient.on('error', (err) => {
  console.error('❌ MQTT error:', err.message);
});

mqttClient.on('offline', () => {
  console.warn('⚠️ MQTT offline — will retry in 5s');
});

mqttClient.on('reconnect', () => {
  console.log('🔄 MQTT reconnecting...');
});

