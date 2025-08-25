// app/page.js

"use client"; // This is the crucial directive!

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

// Web Speech API setup - Must be inside a useEffect or a check to ensure 'window' is available
let recognition;
if (typeof window !== "undefined") {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;
  }
}

export default function HomePage() {
  // Renamed to HomePage and exported as default
  const [sttProvider, setSttProvider] = useState("web-speech");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([
    { speaker: "bot", text: "Hello! How can I help you today?" },
  ]);
  const [sessionId] = useState(Date.now().toString()); // Simplified sessionId for POC

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        mediaRecorder.current = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });

        mediaRecorder.current.ondataavailable = (event) =>
          audioChunks.current.push(event.data);
        mediaRecorder.current.onstop = async () => {
          setIsLoading(true);
          const audioBlob = new Blob(audioChunks.current, {
            type: "audio/webm",
          });
          audioChunks.current = [];
          await sendAudioToBackend(audioBlob);
          setIsLoading(false);
        };

        mediaRecorder.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Could not access your microphone. Please check permissions.");
      }
    }
  };

  const handleWebServiceRecognition = () => {
    if (!recognition) {
      alert("Web Speech API is not supported in this browser.");
      return;
    }
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      return;
    }
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      addToConversation("user", transcript);
      setIsLoading(true);
      await sendTextToBackend(transcript);
      setIsLoading(false);
    };
    recognition.start();
  };

  const handleRecordButton = () => {
    if (sttProvider === "web-speech") {
      handleWebServiceRecognition();
    } else {
      toggleRecording();
    }
  };

  const sendAudioToBackend = async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("provider", sttProvider);
    formData.append("sessionId", sessionId);

    try {
      // IMPORTANT: Use relative path for the API call
      const { data } = await axios.post("/api/process-audio", formData);
      addToConversation("user", data.userText);
      addToConversation("bot", data.botResponse);
    } catch (error) {
      console.error("Error sending audio to backend:", error);
      addToConversation(
        "bot",
        "Sorry, there was an error processing your request."
      );
    }
  };

  const sendTextToBackend = async (text) => {
    try {
      // IMPORTANT: Use relative path for the API call
      const { data } = await axios.post("/api/process-text", {
        text,
        sessionId,
      });
      addToConversation("bot", data.botResponse);
    } catch (error) {
      console.error("Error sending text to backend:", error);
      addToConversation(
        "bot",
        "Sorry, there was an error processing your request."
      );
    }
  };

  const addToConversation = (speaker, text) => {
    setConversation((prev) => [...prev, { speaker, text }]);
  };

  const chatEndRef = useRef(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  return (
    <div className="container">
      <header className="header">
        <h1>Pluggable Voice Agent</h1>
        <div className="stt-selector">
          <label htmlFor="stt-provider">STT Provider:</label>
          <select
            id="stt-provider"
            value={sttProvider}
            onChange={(e) => setSttProvider(e.target.value)}
            disabled={isRecording || isLoading}
          >
            <option value="web-speech">Web Speech API (Browser)</option>
            <option value="google">Google Cloud STT</option>
            <option value="assemblyai">AssemblyAI</option>
          </select>
        </div>
      </header>
      <div className="chat-window">
        {conversation.map((entry, index) => (
          <div key={index} className={`message ${entry.speaker}`}>
            <p>{entry.text}</p>
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <p>
              <i>Thinking...</i>
            </p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <footer className="footer">
        <button
          onClick={handleRecordButton}
          className={`record-btn ${isRecording ? "recording" : ""}`}
          disabled={isLoading}
        >
          {isRecording ? "■" : "🎙️"}
        </button>
      </footer>
    </div>
  );
}
