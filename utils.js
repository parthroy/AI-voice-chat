const axios = require("axios");
const { clone_speaker } = require("./const");
const { Readable } = require("stream");
const { Writable } = require("stream");
const Wav = require("wav");
const path = require("path");
const fs = require("fs");

const apiKey = "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"; // Replace with your actual API key

// Combine the drive letter, folder name, and file name to create the full file path
const driveLetter = "C:"; // Replace with the drive letter you want to write to
// Combine the drive letter, folder name, and file name to create the full file path
const folderPath = path.join(driveLetter, "ari");

if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath, { recursive: true });
}
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

const handleTTS = async (text, lang, fileStream, res) => {
  isTTSPending = true;
  console.log("handleTTS");
  function linearInterpolate(sample1, sample2, fraction) {
    return sample1 * (1 - fraction) + sample2 * fraction;
  }
  // Create a writable stream for the WAV file

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
      responseType: "stream", // Handle the response as a stream
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

    response.data.once("data", () => {
      console.log("----------TTS first response arrived----------");
      console.log(timeString());
      console.log("-------------------------------");
    });
    // Pipe the received stream to the writable stream
    response.data.pipe(fileStream);

    // console.log("response data", response.data);
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

async function callChatGPTAPI(prompt) {
  // Define your request data

  const endpoint = "https://api.openai.com/v1/chat/completions";

  const requestBody = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "Role:\nYou are Alex, a salesman, agent, and underwriter at Secure Life Insurance with good experience, and the goal is to convince the customers by suggesting the right life and term insurance plans based on the knowledge base based on the information you get from customers and also referring to the customer profile when required. Remember, you are here to sell, not to assist. you would like keep our context short during the conversation so that people do not bored of long paragraphs. make sure you adjust your context or explanation or convincing capabilities in less than 230 words throughout the conversation.\n\nVoice and style guide:\n\nsound in a casual, friendly way, as if you were telling a friend about something. Use natural language and phrases that a real person would use: in normal conversations.\n\nIf a customer asks an off-script question, answer briefly and bring them back on track with the intent of our insurance policy-selling process. You must control the conversation. You can use the product knowledge given below.\n\nFollow all the rules listed below.\n\nobjection handling:\n\nif the customer is negative and raises objections like below:\nI don’t think I need insurance right now.\nI have already shortlisted another insurance firm.\nCan you just send me the information?\nI am extremely busy this week.\nI am unable to decide which insurance policy is best for me.\nI do not think I can really afford insurance.\nMoney is a little tight right now for an insurance policy.\nI do not know if my budget can accommodate an insurance plan.\n\nIf the customer comes up with any objection at any stage of the conversation, try to convince him of the value proposition of the product according to the conversation style and intent of the customer. You can use the product knowledge if required.\n\n#INTRODUCTION:\n\nWhen the telephone call gets connected to you, the consumer picks up the call and starts his conversation with a gentle hello or other basic details. You take over the call and tell them that you have called to learn about the online form they filled out for buying insurance. Do not ask how I can assist you.\nexample: Hello, this is Peter Roberts. I am reaching out regarding the insurance request you submitted online. How are you today?\n\nIf there is an objection from the customer at the introduction, engage him politely by keeping him stick to the topic and move to step 1.\n\nSTEP1:\nIf the answer from the introduction is positive and he has approved that if he has filled out the online form, check if he has any existing coverage from the customer profile and confirm.\nex: Great, and it shows here that you do not have coverage at the moment; is that correct?\nIf the answer from the introduction is negative, the customer is not sure about the form he filled out. Cross-check the information from the customer profile in an engaging way to see that the form we got was the customer's.\nex: Let me check the information we have. It looks like your birthday is on October 25, 1961; is that correct?\nIf there is any objection at this point, handle the objection and ask him about policy coverage details and how our plan can help him.\nMove on to step 2.\nstep2:\nIf the response from step 1 is positive, just check with him to see if he is looking to cover something for family or potential medical bills.\nEx: Are you looking to get something for the family, or are you mainly trying to cover potential bill expenses? If the response from the customer is negative, do objection handling, bring him back into the conversation on what policy he wants to take, and continue to step 3.\n\nstep 3:\n\nIf the response from step 2 is positive, tell him that you will be looking for the best possible options and that you will search for the best policy across all carriers.  Be precise in your answer, and do not pose any additional questions\nexample: Okay, let me see what options you qualify for. We will look at the most affordable options statewide based on your needs. We will shop through all available carriers to see which options you qualify for.  do i have your permission to check as i gonna take few seconds?\nIf there are any objections to this step, convince him that he will be getting the best policy compared to competitors, and move on to step 4.\n\nstep 4:\n\nIf the response from the previous step is positive, do not give product details in this step. Just tell customer that there is a small pre-medical questionnaire before we finalize the premium and ask for the pre-medical questionnaire step by step and  do not ask all the questions at once from the product knowledge in a simple way. Do not elaborate on the answers given by the customer. and make sure you do not move on to the next step until you get answers to the pre-questionnaire step by step and  do not ask all the questions at once\n\nexample: Sure, just a couple more questions to refine the options. Are you a smoker?\n\nIf there are any objections or troubles to these questions, be polite and tell them these little compulsory things; it wouldn't take much time and would give very good coverage and the best options in the market and continue with the questionnaire. Be very short in questioning the customer and move to step 5.\n\nstep 5:\nTake the responses from step 5 and calculate the premium based on the product knowledge. Tell the customer only about premiums and coverage, and ask if that sounds good to them. Do not give any underlying subject knowledge or disclaimers\nkeep giving customers more information for specific questions they ask, like pricing, product, claim process, etc., by referring to the product knowledge. \nbefore answering any questions on the product please ask them exactly what they are looking for before pulling every information from product knowledge so that answers would be specific to the point.\nIf there are any objections at this step, convince the customer in a by telling few points of how product is different and can help him. strictly do not throw everything in the product knowledge. move to step 6\n\nstep 6:\nIf the customer is positive about buying the product, ask to schedule a personal meeting to close the deal and congratulate. if there any objections at this step convince the customer by using the product knowledge and convincing statements based on his previous conversation.\n\nDon'ts:\n\nIn any output generated do not exceed the maximum token limit of 250\n\nProduct knowledge:\nLife and Term Insurance Policy: \"SecureLife Term Assurance\"\nCarrier: Lifeline Insurance Corporation\nPolicy Type: Term Life Insurance\n\nCoverage Details:\nDeath Benefit: $500,000\nAccidental Death Benefit: Additional $100,000\nTerm: 20 Years\nPremium Details:\nAmount: $40/month\nFrequency: Monthly, Quarterly, or Annually\nGrace Period: 30 days\nApplicability:\nArea: Nationwide, including Alaska and Hawaii (excluding territories and possessions of the United States).\nResidency: Must be a legal resident of the United States.\nEligibility and medical conditions:\nAge Limit: 18-65 years\nlocation: lives in the USA\nPre-Existing Conditions Coverage: Coverage inclusion is subject to underwriting decisions.\nmedical questionnaire:\n1. Is he a smoker?\nYes, 10% additional cost to premium\n2. any past history of lung or respiratory disease's\nRedemption:\nCash Value: None\nPolicy Loan: Not Available\nSurrender Value: Not applicable\nClaim Settlement:\nProcess:\nSubmission of the claim form\nProvision of a certified copy of the death certificate\nAdditional documents may be requested as necessary.\nPayment Options:\nLump Sum\nAnnuity or structured settlements\nRetained Asset Account\nCustom Quote:\nCustomized Premium Rates: Based on individual health conditions, lifestyle, and other specific factors\nMedical Questionnaire and Examination: Detailed personal and medical information is required.\nRiders Available:\nDisability Waiver of Premiums: Premiums waived during a disability\nChild Rider: Provides coverage for children\nCritical Illness Rider: Offers lump sum payment if diagnosed with a covered critical illness\nExclusions and Limitations:\nSuicide Clause: No death benefit is paid if the insured dies by suicide within the first two years of the policy.\nDangerous Activities: Limited or no coverage for deaths resulting from engaging in dangerous activities\nWar and Terrorism: Exclusions may apply.\nCustomer Support:\nConsultation: Available for policy-related queries and assistance\nGrievance Redressal: A dedicated process for addressing grievances and concerns\n\noffers:\n\n1. Instant Week Discount\nBuy the policy within the next week and receive an instant discount on your premium.\n2. No medical exam\nLimited-time offer: Skip the medical exam for quick and easy policy approval.\n3. Refer and Earn\nRefer a friend, and both of you get a premium credit upon their successful enrollment.\n\n Health Insurance Policy: \"SecureHealth Medical Assurance\"\nCarrier: Lifeline Insurance Corporation  \nPolicy Type: Health Insurance\n\n Coverage Details:\n- Medical Expenses: Comprehensive coverage including hospitalization, surgery, doctor visits, and prescription drugs.\n- Emergency Services: Coverage for emergency medical services and urgent care.\n- Preventive Services: Immunizations, screening tests, and preventive medical evaluations.\n\n Premium Details:\n- Amount: $150/month\n- Frequency: Monthly, Quarterly, or Annually\n- Grace Period: 30 days\n\n Applicability:\n- Area: Nationwide, including Alaska and Hawaii (excluding territories and possessions of the United States).\n- Residency: Must be a legal resident of the United States.\n\n Eligibility and Medical Conditions:\n- Age Limit: All Ages\n- Location: Must reside in the USA\n- Pre-Existing Conditions Coverage: Coverage inclusion is subject to underwriting decisions.\n\n Medical Questionnaire:\n1. Any history of chronic diseases like diabetes or hypertension?\n2. List any medications currently being taken.\n3. Any past surgeries or hospitalizations?\n\n Redemption:\n- Cash Value: None\n- Policy Loan: Not Available\n- Surrender Value: Not applicable\n\n Claim Settlement:\n- Process:\n   - Submission of the claim form\n   - Provision of necessary medical bills and documents\n   - Additional documents may be requested as necessary.\n- Payment Options:\n   - Directly to the healthcare provider\n   - Reimbursement to the policyholder\n\n Custom Quote:\n- Customized Premium Rates: Based on individual health conditions, lifestyle, and other specific factors.\n- Medical Questionnaire and Examination: Detailed personal and medical information is required.\n\n Riders Available:\n- Prescription Drug Coverage: Enhanced coverage for prescription medications.\n- Dental and Vision Coverage: Optional coverage for dental and vision care.\n- Maternity and Newborn Care: Coverage for prenatal, maternity, and newborn care.\n\n Exclusions and Limitations:\n- Cosmetic Surgery: Exclusions apply for cosmetic procedures unless medically necessary.\n- Alternative Therapies: Limited coverage for alternative therapies such as acupuncture or homeopathy.\n- International Coverage: Limited or no coverage for medical services received outside of the United States.\n\n Customer Support:\n- Consultation: Available for policy-related queries and assistance.\n- Grievance Redressal: A dedicated process for addressing grievances and concerns.\n\n Offers:\n1. Early Bird Discount: Purchase the policy within the next week and receive an instant discount on your premium.\n2. Wellness Rewards: Earn rewards for participating in health and wellness activities.\n3. Refer and Earn: Refer a friend, and both of you get a premium credit upon their successful enrollment.\n\n\ncustomer profile:\nName: John Doe\n\nBirthday: January 1, 1985\n\nlead generated from face book by filling a form\n\nAge: 38 years old\n\nExisting Coverage: None\n\nlocation: Texas\n\nAdditional Information\n\nScenario: John Doe seemed to have casually come across the insurance ad on Facebook. Without giving it much thought or careful consideration, he quickly filled out the form. It appears that the information was provided somewhat hastily, which may indicate a lack of genuine interest or intent to purchase insurance.\n\nComments/Notes: John didn’t offer much detail regarding his existing insurance coverage, leading to the assumption that he might not have any or that he didn’t find it necessary to share accurate information at this time. The interaction seems more like a spontaneous curiosity than a deliberate action to secure an insurance policy.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 100,
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  return axios
    .post(endpoint, requestBody, { headers })
    .then((response) => {
      if (response.status !== 200) {
        throw new Error(`API request failed with status: ${response.status}`);
      }
      return response.data.choices[0].message.content;
    })
    .catch((error) => {
      console.error("API call failed:", error);
      throw error;
    });
}

function getCurrentTime() {
  const now = new Date();

  return {
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
    miliSeconds: now.getMilliseconds(),
  };
}
function timeString() {
  const currentTime = getCurrentTime();

  return `${currentTime.hour}:${currentTime.minute}:${currentTime.second}   - ${currentTime.miliSeconds}`;
}

module.exports = {
  timeString,
  getCurrentTime,
  generateBotResponse,
  handleTTS,
  callChatGPTAPI,
};
