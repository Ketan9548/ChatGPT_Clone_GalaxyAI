"use client";

import { useState, useRef, useEffect } from "react";
import ChatWindow from "@/Components/ChatWindow";
import ChatInput from "@/Components/ChatInput";
import Sidebar from "@/Components/Sidebar";
import { Menu } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false); // 👈 new state
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSend = async (
    msg: string,
    fileUrl?: string,
    aiSummary?: string
  ) => {
    if (!msg.trim() && !fileUrl && !aiSummary) return;

    const userMessage: Message = { role: "user", content: msg };
    let newMessages: Message[] = [userMessage, ...[]];

    if (fileUrl && aiSummary) {
      newMessages.push({ role: "user", content: `File uploaded: ${fileUrl}` });
      newMessages.push({ role: "assistant", content: aiSummary });
    }

    newMessages = [...messages, ...newMessages];
    setMessages(newMessages);

    setIsLoading(true); // 👈 show typing dots while waiting

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "test-user",
          messages: newMessages,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.reply,
        };
        setMessages([...newMessages, assistantMessage]);
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsLoading(false); // 👈 hide typing dots after response
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    setMessages([]);
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen flex bg-[#343541] text-white">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col md:ml-0">
        <header className="flex items-center justify-between p-3 border-b border-gray-700 bg-[#343541]">
          <button
            className="p-2 rounded hover:bg-gray-700 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <p className="text-sm text-gray-400 flex-1 text-center md:text-left">
            ChatGPT Clone
          </p>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          <ChatWindow messages={messages} isLoading={isLoading} /> {/* 👈 pass isLoading */}
          <div ref={chatEndRef} />
        </main>

        <footer className="border-t border-gray-700 bg-[#40414f] p-3">
          <ChatInput onSend={handleSend} />
          <p className="text-xs text-gray-400 mt-2 text-center">
            ChatGPT Clone – powered by API
          </p>
        </footer>
      </div>
    </div>
  );
}
