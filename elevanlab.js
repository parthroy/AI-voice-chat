require("dotenv").config({ path: ".env.local" });
const WebSocket = require("ws");
const { timeString } = require("./utils");
const logger = require("./logger");
const voiceId = "21m00Tcm4TlvDq8ikWAM"; // replace with your voice_id
const model = "eleven_turbo_v2";
const output_format = "pcm_16000";
const xiApiKey = process.env.ElevenLab_API_KEY;

// const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model}&output_format=${output_format}`;
// const socket = new WebSocket(wsUrl);
// socket.onopen = function (event) {
//   logger.info("connection open");
//   // const bosMessage = {
//   //   text: text,
//   //   voice_settings: {
//   //     stability: 0.5,
//   //     similarity_boost: 0.8,
//   //   },
//   //   xi_api_key: xiApiKey,
//   // };
//   // socket.send(JSON.stringify(bosMessage));
//   // setTimeout(() => {
//   //   eosMessage();
//   // }, 100);
// };
async function handleStream(llmResponse, { socket, fileStream }) {
  const time1 = new Date().getTime();
  llmResponse.data.on("data", (chunk) => {
    // console.log(chunk.toString());
    try {
      const payloads = chunk.toString().split("\n\n");
      for (const payload of payloads) {
        if (payload.includes("[DONE]")) {
          eosMessage();
          return;
        }
        if (payload.startsWith("data:")) {
          const data = JSON.parse(payload.replace("data: ", ""));
          try {
            const chunk = data.choices[0].delta?.content;
            if (chunk) {
              // if (i === -1) {
              //   logger.info("----------LLM first response arrived----------");
              //   logger.info(timeString());
              //   logger.info("-------------------------------");
              //   init({ text: chunk });
              // } else {
              sendText({ text: chunk });
              // }
              logger.info(chunk, new Date().getTime());
            }
          } catch (error) {
            logger.info(
              `Error with JSON.parse and ${chunk.toString()}.\n${error}`
            );
          }
        }
      }
    } catch (error) {
      // logger.info("handleStream err", error, chunk.toString());
    }
  });

  llmResponse.data.on("end", () => {
    console.log("Stream finished");
    // eosMessage();
    // fileStream.end();
  });

  socket.onmessage = function (event) {
    const response = JSON.parse(event.data);
    // logger.info("----------TTS response arrived----------");
    // logger.info(timeString(true, time1));
    // logger.info("-------------------------------");
    // logger.info("Server response:", response);

    if (response.audio) {
      logger.info("Received audio chunk", new Date().getTime());
      const audioChunk = Buffer.from(response.audio, "base64");
      fileStream.write(audioChunk);
    } else {
      logger.info("No audio data in the response");
    }

    if (response.isFinal) {
      // The generation is complete
      logger.info("Streaming response ended.");
      fileStream.end();
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
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
      },
      xi_api_key: xiApiKey,
      try_trigger_generation: true,
    };

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(bosMessage));
      logger.info("TTS Send");
    }
  }

  function eosMessage() {
    const eosMessage = {
      text: "",
    };
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(eosMessage));
      logger.info("TTS EOD");
    }
  }
  function init({ text }) {
    const bosMessage = {
      text: text,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
      },
      xi_api_key: xiApiKey,
      try_trigger_generation: true,
    };
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(bosMessage));
      logger.info("TTS init");
    }
  }
}

module.exports = { handleStream };
