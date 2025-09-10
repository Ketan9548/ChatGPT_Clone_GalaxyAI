"use client";

import { useState, useRef, useEffect } from "react";
import ChatWindow from "@/Components/ChatWindow";
import ChatInput from "@/Components/ChatInput";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const handleSend = async (msg: string) => {
    if (!msg.trim()) return;

    const newMessages = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "test-user", // ✅ must exist
          messages: newMessages,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (err) {
      console.error("Chat error:", err);
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-screen flex flex-col bg-[#343541] text-white">
      {/* Header (optional, like ChatGPT) */}
      <header className="p-3 text-center text-sm text-gray-400 border-b border-gray-700">
        ChatGPT Clone
      </header>

      {/* Chat messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <ChatWindow messages={messages} />
        <div ref={chatEndRef} />
      </main>

      {/* Input box */}
      <footer className="border-t border-gray-700 bg-[#40414f] p-3">
        <ChatInput onSend={handleSend} />
        <p className="text-xs text-gray-400 mt-2 text-center">
          ChatGPT Clone – powered by API
        </p>
      </footer>
    </div>
  );
}
