'use strict';

const mqtt = require('mqtt');

let client = null;
const plugCache = {}; // { 'plug1001': { voltage, current, power, ... } }

function getClient() {
  if (client) return client;

  const url = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
  client = mqtt.connect(url, {
    username: process.env.MQTT_USER || 'kybe',
    password: process.env.MQTT_PASS || '88888888',
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log('[mqtt] connected to', url);
    client.subscribe('#', { qos: 0 });
  });

  client.on('message', (topic, message) => {
    const msg = message.toString();
    const parts = topic.split('/');

    // Telemetry: plug{id}/{type}/get  e.g. plug1001/voltage/get
    if (parts.length === 3 && parts[0].startsWith('plug') && parts[2] === 'get') {
      const plugId = parts[0];
      if (!plugCache[plugId]) plugCache[plugId] = {};
      plugCache[plugId][parts[1]] = msg;
      plugCache[plugId].lastSeen = Date.now();
    }

    // plug{id}/connected  e.g. plug1001/connected online
    if (parts.length === 2 && parts[0].startsWith('plug') && parts[1] === 'connected') {
      const plugId = parts[0];
      if (!plugCache[plugId]) plugCache[plugId] = {};
      plugCache[plugId].connected = msg;
      plugCache[plugId].lastSeen = Date.now();
    }

    // stat/plug{id}/POWER  or  stat/plug{id}/STATUS
    if (parts.length === 3 && parts[0] === 'stat' && parts[1].startsWith('plug')) {
      const plugId = parts[1];
      if (!plugCache[plugId]) plugCache[plugId] = {};
      if (parts[2] === 'POWER') {
        plugCache[plugId].powerState = msg;
      } else if (parts[2] === 'STATUS') {
        try { plugCache[plugId].statusRaw = JSON.parse(msg); }
        catch { plugCache[plugId].statusRaw = msg; }
      }
      plugCache[plugId].lastSeen = Date.now();
    }
  });

  client.on('error', (err) => console.error('[mqtt] error:', err.message));
  client.on('reconnect', () => console.log('[mqtt] reconnecting…'));

  return client;
}

function publish(topic, payload) {
  return new Promise((resolve, reject) => {
    getClient().publish(topic, String(payload), { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getPlugData(plugId) {
  return plugCache[plugId] || null;
}

module.exports = { getClient, publish, getPlugData };
