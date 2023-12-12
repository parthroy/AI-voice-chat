require("dotenv").config({ path: ".env.local" });
const WebSocket = require("ws");
const voiceId = "21m00Tcm4TlvDq8ikWAM"; // replace with your voice_id
const model = "eleven_monolingual_v1";
const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}`;
const socket = new WebSocket(wsUrl);
global.ttsSocket = socket;
const xi_api_key = process.env.ElevenLab_API_KEY;
// 2. Initialize the connection by sending the BOS message
socket.onopen = function (event) {};

// 5. Handle server responses
socket.onmessage = function (event) {
  const response = JSON.parse(event.data);

  console.log("Server response:", response);

  if (response.audio) {
    // decode and handle the audio data (e.g., play it)
    const audioChunk = atob(response.audio); // decode base64
    console.log("Received audio chunk");
    console.log(audioChunk);
  } else {
    console.log("No audio data in the response");
  }

  if (response.isFinal) {
    // the generation is complete
  }

  if (response.normalizedAlignment) {
    // use the alignment info if needed
  }
};

// Handle errors
socket.onerror = function (error) {
  console.error(`WebSocket Error: ${error}`);
};

// Handle socket closing
socket.onclose = function (event) {
  if (event.wasClean) {
    console.info(
      `Connection closed cleanly, code=${event.code}, reason=${event.reason}`
    );
  } else {
    console.warn("Connection died");
  }
};

function init({ text }) {
  const bosMessage = {
    text: text,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
    },
    xi_api_key: xi_api_key, // replace with your API key
  };

  socket.send(JSON.stringify(bosMessage));
}

function sendText({ text }) {
  const bosMessage = {
    text: text,
    try_trigger_generation: true,
  };

  socket.send(JSON.stringify(bosMessage));
}

function eosMessage({}) {
  // 4. Send the EOS message with an empty string
  const eosMessage = {
    text: "",
  };

  socket.send(JSON.stringify(eosMessage));
}
module.exports = { init, sendText, eosMessage };
