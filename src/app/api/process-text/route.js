// app/api/process-text/route.js

import { NextResponse } from "next/server";
import {
  LexRuntimeV2Client,
  RecognizeTextCommand,
} from "@aws-sdk/client-lex-runtime-v2";

// --- Initialize Client ---
const lexClient = new LexRuntimeV2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

console.log(JSON.stringify(lexClient));

// --- Helper function to call Lex ---
async function sendToLex(text, sessionId) {
  // This function can be shared from a utils file if you prefer
  const params = {
    botId: process.env.LEX_BOT_ID,
    botAliasId: process.env.LEX_BOT_ALIAS_ID,
    localeId: "en_US",
    sessionId: sessionId,
    text: text,
  };
  const command = new RecognizeTextCommand(params);

  const data = await lexClient.send(command);
  const botMessage =
    data.messages?.map((msg) => msg.content).join(" ") ||
    "Sorry, I didn't understand.";
  return botMessage;
}

export async function POST(request) {
  try {
    const { text, sessionId } = await request.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided." }, { status: 400 });
    }

    const lexResponse = await sendToLex(text, sessionId);
    return NextResponse.json({ botResponse: lexResponse }); // userText is already known by the client
  } catch (error) {
    console.error("Error in process-text route:", error);
    return NextResponse.json(
      { error: "Server error during text processing." },
      { status: 500 }
    );
  }
}
