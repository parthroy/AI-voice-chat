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
const folderPath = path.join(driveLetter, "ari");

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
  console.log("handleTTS");
  function linearInterpolate(sample1, sample2, fraction) {
    return sample1 * (1 - fraction) + sample2 * fraction;
  }
  try {
    let config = {
      method: "post",
      // maxBodyLength: Infinity,
      url: "http://183.82.10.250:6631/tts_stream",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        text: text,
        language: lang,
        gpt_cond_latent: clone_speaker.gpt_cond_latent,
        speaker_embedding: clone_speaker.speaker_embedding,
        add_wav_header: false,
        stream_chunk_size: "20",
      },
    };
    const response = await axios(config);
    if (!response.status === 200 || !response.data) {
      console.log("error in tts");
      return;
      // throw new Error(response.statusText);
    }
    // const fileName = generateRandomString(10);

    // const outputPath = path.join(folderPath, fileName + ".wav");
    // const fileStream1 = fs.createWriteStream(outputPath);

    //   if (!response.ok) {
    //     throw new Error("Network response was not ok", response);
    //   }
    // response.data.pipe(fileStream);
    // const buffer = Buffer.from(response.data);
    // const reader = new Wav.Reader();
    // reader.end(buffer);
    // reader.pipe(fileStream);

    // fileStream.write(buffer);

    console.log("streaming........");
    // response.data.on("data", async (chunk) => {
    //   fileStream.write(chunk);
    // });
    // fs.writeFileSync(filePath, audioData, { flag: 'a' });
    // response.data.pipe(fileStream1);
    // fs.writeFileSync(outputPath, response.data, { flag: 'a' });

    // Pipe the received stream to the writable stream
    // response.data.pipe(fileStream);

    // Event handlers for stream events
    // response.data.on("end", () => {
    //   console.log("Audio download completed.");
    // });

    // response.data.on("error", (err) => {
    //   console.error("Error downloading audio:", err);
    // });
    // response.data.on("data", async (chunk) => {
    fileStream.write(response.data);
    // });
    // response.data.on("end", () => {
    //   // Handle the end of the stream
    //   fileStream.end();
    // });
    // Wait for the stream to finish writing to the file
    // await new Promise((resolve, reject) => {
    //   fileStream.on("finish", resolve);
    //   fileStream.on("error", reject);
    // });

    console.log("response data", response.data);
  } catch (error) {
    console.error("Error calling TTS service", error);
    return;
  }
};

const generateBotResponse = async (text, lang) => {
  let generated_text = "";
  let current_sentence = "";
  try {
    const fileName = generateRandomString(10);

    const outputPath = path.join(folderPath, fileName + ".mp3");
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
      console.log("end of llm respose");
      // Handle the end of the stream
      // fileStream.end();
    });
    fileStream.on("close", () => {
      console.log(`Audio saved to ${outputPath}`);
    });
  } catch (error) {
    console.error("Error calling generate_stream service:", error.message);
  }
  return generated_text;
};

module.exports = { generateBotResponse, handleTTS };
