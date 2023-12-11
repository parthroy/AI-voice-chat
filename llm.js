const axios = require("axios");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { callChatGPTAPI, handleTTS, timeString } = require("./utils");
const Wav = require("wav");

// Define your API endpoint and API key
const apiUrl =
  "https://api.elevenlabs.io/v1/text-to-speech/onwK4e9ZLuTAKqWW03F9/stream?output_format=mp3_44100_128";
const xiApiKey = "70e7a08a3122cae6e7416ca09937e7ba";
const CHUNK_SIZE = 1024;
const driveLetter = "C:"; // Replace with the drive letter you want to write to
// Combine the drive letter, folder name, and file name to create the full file path
const folderPath = path.join(driveLetter, "xampp", "htdocs", "ari");

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

// Utility function to make the POST request
let x = 0;
async function generateTextToSpeech(text, writeStream, fileName) {
  const requestData = {
    text: text,
    model_id: "eleven_monolingual_v1",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
    },
  };

  const headers = {
    accept: "audio/mpeg",
    "xi-api-key": xiApiKey,
    output_format: "mp3_44100_128",
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.post(apiUrl, requestData, {
      headers: headers,
      responseType: "stream", // Set the response type to 'stream'
    });

    response.data.on("data", (chunk) => {
      writeStream.write(chunk);
      if (x == 0)
        console.log(`https://0059-49-36-80-187.ngrok.io/ari/${fileName}.mp3`);
      x++;
      //   res.send({
      //     url: `https://0059-49-36-80-187.ngrok.io/ari/${fileName}.wav`,
      //   });
    });

    response.data.on("end", () => {});

    response.data.on("error", (error) => {
      console.error("Error while receiving audio stream:", error);
    });
  } catch (error) {
    console.error(error);
    // Handle errors
    // throw error;
  }
}

// Example usage
function ElevenLabExec(text, params) {
  try {
    const { webScoket, agent, connectionId, ...others } = params;

    x = 0;
    callChatGPTAPI(text);
    //   .then((response) => {
    //     console.log("connectionId:", text);
    //     console.log("API response:", response);
    //     generateTextToSpeech(response, params);
    //   })
    //   .catch((error) => {
    //     // console.error("Error:", error);
    //   });
  } catch (error) {
    // console.error("Error:", error);
  }
}

const apiKey = "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"; // Replace with your actual API key

// Make the request and handle the streamed response

// async function callChatGPTAPI(prompt) {
//   // Define your request data

//   const endpoint = "https://api.openai.com/v1/chat/completions";

//   const requestBody = {
//     model: "gpt-3.5-turbo",
//     messages: [
//       {
//         role: "system",
//         content: "You are a helpful assistant.",
//       },
//       {
//         role: "user",
//         content: prompt,
//       },
//     ],
//     max_tokens: 30,
//   };

//   const headers = {
//     "Content-Type": "application/json",
//     Authorization: `Bearer ${apiKey}`,
//   };

//   return axios
//     .post(endpoint, requestBody, { headers })
//     .then((response) => {
//       if (response.status !== 200) {
//         throw new Error(`API request failed with status: ${response.status}`);
//       }
//       return response.data.choices[0].message.content;
//     })
//     .catch((error) => {
//       console.error("API call failed:", error);
//       throw error;
//     });
// }

const openai = new OpenAI({
  apiKey: apiKey,
});

// async function callChatGPTAPI(prompt) {
//   const stream = await openai.chat.completions.create({
//     model: "gpt-4",
//     messages: [
//       {
//         role: "system",
//         content: "You are a helpful assistant.",
//       },
//       {
//         role: "user",
//         content: prompt,
//       },
//     ],
//     max_tokens: 30,
//     stream: true,
//   });
//   const fileName = generateRandomString(10);
//   const outputFile = fileName + ".mp3";

//   const filePath = path.join(folderPath, outputFile);
//   // const outputPath = path.join(folderPath, fileName + ".wav");

//   const writeStream = fs.createWriteStream(filePath);
//   for await (const chunk of stream) {
//     generateTextToSpeech(
//       chunk.choices[0]?.delta?.content,
//       writeStream,
//       fileName
//     );
//     console.log(chunk.choices[0]?.delta?.content || "");
//   }
//   //   writeStream.end();
// }

function ElevenLabExec1(text, lang, res) {
  try {
    const fileName = new Date().getTime();
    // const fileName = generateRandomString(10);

    const outputPath = path.join(folderPath, fileName + ".wav");
    // const fileStream = fs.createWriteStream(outputPath);
    const fileStream = new Wav.FileWriter(outputPath, {
      channels: 1, // Number of audio channels (1 for mono, 2 for stereo)
      sampleRate: 24000, // Sample rate in Hz
      // bitDepth: 16, // Bit depth per sample
    });
    callChatGPTAPI(text)
      .then((response) => {
        console.log("----------ChaGPT response arrived----------");
        console.log(timeString());
        console.log("-------------------------------");
        console.log("text:", text);
        console.log("API response:", response);
        handleTTS(response, "en", fileStream, res);
      })
      .catch((error) => {
        // console.error("Error:", error);
      });
    fileStream.on("close", () => {
      console.log(`Audio saved to ${outputPath}`);
    });
    fileStream.on("finish", () => {
      console.log("Piping finished.");
      console.log("----------TTS response ended----------");
      console.log(timeString());
      console.log("-------------------------------");
      res.send({
        path: outputPath,
      });
    });

    fileStream.on("error", (err) => {
      console.error("Error:", err);
    });
  } catch (error) {
    // console.error("Error:", error);
  }
}
module.exports = {
  ElevenLabExec1,
  ElevenLabExec,
  callChatGPTAPI,
  generateTextToSpeech,
};
