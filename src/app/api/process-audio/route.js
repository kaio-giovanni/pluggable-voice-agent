// app/api/process-audio/route.js

import { NextResponse } from "next/server";
import {
  LexRuntimeV2Client,
  RecognizeTextCommand,
} from "@aws-sdk/client-lex-runtime-v2";
import { SpeechClient } from "@google-cloud/speech";
import { AssemblyAI } from "assemblyai";

// --- Initialize Clients --- (This code runs once per server start)
const lexClient = new LexRuntimeV2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const googleSpeechClient = new SpeechClient();
const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

// --- Helper function to call Lex ---
async function sendToLex(text, sessionId) {
  const params = {
    botId: process.env.LEX_BOT_ID,
    botAliasId: process.env.LEX_BOT_ALIAS_ID,
    localeId: "en_US",
    sessionId: sessionId,
    text: text,
  };
  console.log(JSON.stringify(params));
  const command = new RecognizeTextCommand(params);
  const data = await lexClient.send(command);
  const botMessage =
    data.messages?.map((msg) => msg.content).join(" ") ||
    "Sorry, I didn't understand.";
  return botMessage;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");
    const provider = formData.get("provider");
    const sessionId = formData.get("sessionId");

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file uploaded." },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    let transcription = "";

    // --- Transcribe Audio ---
    if (provider === "google") {
      const [response] = await googleSpeechClient.recognize({
        audio: { content: audioBuffer.toString("base64") },
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: "en-US",
        },
      });
      transcription = response.results
        .map((result) => result.alternatives[0].transcript)
        .join("\n");
    } else if (provider === "assemblyai") {
      const transcript = await assemblyai.transcripts.transcribe({
        audio: audioBuffer,
      });
      transcription = transcript.text;
    } else {
      return NextResponse.json(
        { error: "Invalid STT provider." },
        { status: 400 }
      );
    }

    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription failed." },
        { status: 500 }
      );
    }

    // --- Send transcription to Amazon Lex ---
    const lexResponse = await sendToLex(transcription, sessionId);
    return NextResponse.json({
      userText: transcription,
      botResponse: lexResponse,
    });
  } catch (error) {
    console.error("Error in process-audio route:", error);
    return NextResponse.json(
      { error: "Server error during audio processing." },
      { status: 500 }
    );
  }
}
