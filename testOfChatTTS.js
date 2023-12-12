require("dotenv").config({ path: ".env.local" });
const WebSocket = require("ws");
const axios = require("axios");
const { spawn } = require("child_process");
const { spawnSync } = require("child_process");
const fs = require("fs");

// Define API keys and voice ID
const OPENAI_API_KEY = process.env.apiKey;
const ELEVENLABS_API_KEY = process.env.ElevenLab_API_KEY;
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// Set OpenAI API key
const axiosOpenAI = axios.create({
  baseURL: "https://api.openai.com/v1",
  headers: {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  },
});

const isInstalled = (command) => {
  const result = spawnSync("which", [command]);
  return result.status === 0;
};

const textChunker = async function* (chunks) {
  const splitters = [
    ".",
    ",",
    "?",
    "!",
    ";",
    ":",
    "—",
    "-",
    "(",
    ")",
    "[",
    "]",
    "}",
    " ",
  ];
  let buffer = "";

  for await (const text of chunks) {
    if (
      buffer.endsWith(splitters.join("")) ||
      splitters.includes(buffer.slice(-1))
    ) {
      yield buffer + " ";
      buffer = text;
    } else if (splitters.includes(text[0])) {
      yield buffer + text[0] + " ";
      buffer = text.slice(1);
    } else {
      buffer += text;
    }
  }

  if (buffer) {
    yield buffer + " ";
  }
};
const outputAudioFile = "output.wav"; // Change the file extension as needed

const stream = async (audioStream) => {
  const writeStream = fs.createWriteStream(outputAudioFile);

  console.log("Started streaming audio");

  for await (const chunk of audioStream) {
    if (chunk) {
      writeStream.write(chunk);
    }
  }

  writeStream.end();
  console.log(`Audio saved to ${outputAudioFile}`);
};

const textToSpeechInputStreaming = async (voiceId, textIterator) => {
  const uri = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_monolingual_v1`;

  const websocket = new WebSocket(uri);

  await new Promise((resolve, reject) => {
    websocket.on("open", () => resolve());
    websocket.on("error", (error) => reject(error));
  });

  websocket.send(
    JSON.stringify({
      text: " ",
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      xi_api_key: ELEVENLABS_API_KEY,
    })
  );

  const listen = async function* () {
    while (true) {
      try {
        const message = await new Promise((resolve) =>
          websocket.once("message", resolve)
        );
        const data = JSON.parse(message);

        if (data.audio) {
          yield Buffer.from(data.audio, "base64");
        } else if (data.isFinal) {
          break;
        }
      } catch (error) {
        console.log("Connection closed");
        break;
      }
    }
  };

  const listenTask = stream(listen());

  for await (const text of textChunker(textIterator)) {
    websocket.send(
      JSON.stringify({ text: text, try_trigger_generation: true })
    );
  }

  websocket.send(JSON.stringify({ text: "" }));

  await listenTask;
  websocket.close();
};

const chatCompletion = async (query) => {
  console.log("query", query);
  const response = await axiosOpenAI.post(
    "/chat/completions",
    {
      model: "gpt-4",
      messages: [{ role: "user", content: query }],
      temperature: 1,
    },
    { responseType: "stream" }
  );

  const textIterator = async function* () {
    for await (const chunk of response.data) {
      console.log(chunk);
      const delta = chunk.choices[0].delta;
      yield delta.content;
    }
  };

  await textToSpeechInputStreaming(VOICE_ID, textIterator());
};

// Main execution
const userQuery = "Hello, tell me a story.";
try {
  chatCompletion(userQuery);
} catch (error) {
  console.error("Error =>", error);
}
