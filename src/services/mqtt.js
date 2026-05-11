'use strict';

const mqtt = require('mqtt');

let client = null;

function getClient() {
  if (client) return client;

  const url = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
  client = mqtt.connect(url, {
    username: process.env.MQTT_USER || 'kybe',
    password: process.env.MQTT_PASS || '88888888',
    reconnectPeriod: 3000,
  });

  client.on('connect', () => console.log('[mqtt] connected to', url));
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

module.exports = { publish };
