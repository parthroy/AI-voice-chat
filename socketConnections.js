require("dotenv").config({ path: ".env.local" });
const WebSocket = require("ws");
const logger = require("./logger");
const voiceId = "21m00Tcm4TlvDq8ikWAM"; // replace with your voice_id
const model = "eleven_turbo_v2";
const output_format = "pcm_16000";

function createConncetion() {
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}&output_format=${output_format}`;
  const socket = new WebSocket(wsUrl);
  socket.onopen = function (event) {
    logger.info("connection open");
  };
  return socket;
}
module.exports = createConncetion;
