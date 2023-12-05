const axios = require("axios");
const fetch = require("node-fetch");
const { clone_speaker } = require("./const");
const { Readable } = require("stream");
const { Writable } = require("stream");
const Wav = require("wav");
const path = require("path");
const fs = require("fs");

// Combine the drive letter, folder name, and file name to create the full file path
const driveLetter = "C:"; // Replace with the drive letter you want to write to
// Combine the drive letter, folder name, and file name to create the full file path
const folderPath = path.join(driveLetter, "xampp", "htdocs", "ari");

// Define your API endpoint and API key
const apiUrl =
  "https://api.elevenlabs.io/v1/text-to-speech/onwK4e9ZLuTAKqWW03F9/stream";
const xiApiKey = "26d1a0dec62339e9124ad5d08e3f618c";
const CHUNK_SIZE = 1024;

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}

let isTTSPending = false;

const handleTTS = async (text, lang, fileStream) => {
  isTTSPending = true;

  function linearInterpolate(sample1, sample2, fraction) {
    return sample1 * (1 - fraction) + sample2 * fraction;
  }

  await fetch("http://183.82.10.250:6631/tts_stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text,
      language: lang,
      gpt_cond_latent: clone_speaker.gpt_cond_latent,
      speaker_embedding: clone_speaker.speaker_embedding,
      add_wav_header: false,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body.pipe(fileStream);
      let audioQueue = [];
      let isStreamingFinished = false;
      let nextSample = 0;
      let amplitudeSum = 0; // Accumulator for amplitude values
      let sampleCount = 0; // Counter for number of samples processed

      function processAudioChunk(value) {
        // Convert the incoming data to Int16Array and add it to the queue
        const rawData = new Int16Array(
          value.buffer,
          value.byteOffset,
          value.byteLength / 2
        );
        audioQueue = audioQueue.concat(Array.from(rawData));

        // reader.then(processAudioChunk);
      }
      response.body.on("end", () => {
        isStreamingFinished = true;
        return;
      });

    //   reader.then(processAudioChunk);
    })
    .catch((error) => {
      console.error("Error calling TTS service:", error);
    });
};

const generateBotResponse = async (text, lang) => {
  let generated_text = "";
  let current_sentence = "";
  try {
    const fileName = generateRandomString(10);

    const outputPath = path.join(folderPath, fileName + ".wav");
    const fileStream = fs.createWriteStream(outputPath);

    const response = await axios.post(
      "http://183.82.10.250:6691/generate_stream",
      {
        inputs: text,
        parameters: {
          max_new_tokens: 250,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        responseType: "stream", // Handle the response as a stream
      }
    );

    if (!response.status === 200 || !response.data) {
      throw new Error(response.statusText);
    }

    const decoder = new TextDecoder();
    let partialData = "";

    response.data.on("data", async (chunk) => {
      partialData += decoder.decode(chunk, { stream: true });

      // Process each line separately
      let lines = partialData.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith("data:")) {
          const jsonString = line.substring(5); // Remove 'data:' prefix

          try {
            const jsonObject = JSON.parse(jsonString);
            if (jsonObject && jsonObject.token && jsonObject.token.text) {
              console.log("Received:", jsonObject.token.text);
              generated_text += jsonObject.token.text;
              if (jsonObject.token.text === "") {
                // You might want to handle the completion logic here
              } else {
                current_sentence += jsonObject.token.text;
              }
              if (
                jsonObject.token.text === "." ||
                jsonObject.token.text === "?" ||
                jsonObject.token.text === "!"
              ) {
                await handleTTS(current_sentence, lang, fileStream);

                while (isTTSPending) {
                  await new Promise((resolve) => setTimeout(resolve, 100));
                }
                current_sentence = "";
              }
            }
          } catch (error) {
            console.error("Error parsing JSON:", error);
          }
        }
      }

      partialData = lines[lines.length - 1];
    });

    response.data.on("end", () => {
      // Handle the end of the stream
      fileStream.end();
    });
  } catch (error) {
    console.error("Error calling generate_stream service:", error.message);
  }
  return generated_text;
};

module.exports = { generateBotResponse, handleTTS };
