require("dotenv").config({ path: ".env.local" });
const WebSocket = require("ws");
const { timeString } = require("./utils");
const logger = require("./logger");
const voiceId = "21m00Tcm4TlvDq8ikWAM"; // replace with your voice_id
const model = "eleven_turbo_v2";
const output_format = "pcm_16000";
const xiApiKey = process.env.ElevenLab_API_KEY;
function textToSpeech({ text, fileStream, time1 }) {
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}&output_format=${output_format}`;
  const socket = new WebSocket(wsUrl);

  socket.onopen = function (event) {
    const bosMessage = {
      text: text,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
      },
      xi_api_key: xiApiKey,
    };

    socket.send(JSON.stringify(bosMessage));
    setTimeout(() => {
      eosMessage();
    }, 100);
  };

  socket.onmessage = function (event) {
    const response = JSON.parse(event.data);
    logger.info("----------TTS first response arrived----------");
    logger.info(timeString(true, time1));
    logger.info("-------------------------------");
    // logger.info("Server response:", response);

    if (response.audio) {
      //   const audioChunk = atob(response.audio);
      logger.info("Received audio chunk");
      const audioChunk = Buffer.from(response.audio, "base64");

      fileStream.write(audioChunk);
      // Decode and handle the audio data (e.g., play it)
    } else {
      logger.info("No audio data in the response");
    }

    if (response.isFinal) {
      fileStream.end();
      // The generation is complete
      logger.info("Streaming response ended.");
    }

    if (response.normalizedAlignment) {
      // Use the alignment info if needed
    }
  };

  socket.onerror = function (error) {
    console.error(`WebSocket Error: ${error}`);
  };

  socket.onclose = function (event) {
    if (event.wasClean) {
      console.info(
        `Connection closed cleanly, code=${event.code}, reason=${event.reason}`
      );
    } else {
      console.warn("Connection died");
    }
  };

  function sendText({ text }) {
    const bosMessage = {
      text: text,
      try_trigger_generation: true,
    };

    socket.send(JSON.stringify(bosMessage));
  }

  function eosMessage() {
    const eosMessage = {
      text: "",
    };

    socket.send(JSON.stringify(eosMessage));
  }

  // Initial sendText call
  sendText({ text });

  // Example usage:
  // textToSpeech({ text: "Hello, world!", voiceId: "your_voice_id", model: "your_model", xiApiKey: "your_api_key" });
}

module.exports = textToSpeech;
