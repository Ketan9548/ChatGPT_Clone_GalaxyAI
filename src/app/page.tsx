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
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSend = (text: string, fileUrl?: string, chatSummary?: string) => {
    let newMessage: Message = {
      role: "user",
      content: text,
    };

    // attach fileUrl if present
    if (fileUrl) {
      newMessage = {
        ...newMessage,
        content: `${text}\n\n📎 File attached: ${fileUrl}`,
      };
    }

    // attach summary if present
    if (chatSummary) {
      newMessage = {
        ...newMessage,
        content: `${newMessage.content}\n\n📝 AI Summary: ${chatSummary}`,
      };
    }

    setMessages((prev) => [...prev, newMessage]);

    // continue your existing send logic…
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
          <ChatWindow messages={messages} isLoading={isLoading} />{" "}
          {/* 👈 pass isLoading */}
          <div ref={chatEndRef} />
        </main>

        <footer className="border-t border-gray-700 bg-[#40414f] p-3">
          <ChatInput
            onSend={(text, fileUrl, chatSummary) =>
              handleSend(text, fileUrl, chatSummary)
            }
          />

          <p className="text-xs text-gray-400 mt-2 text-center">
            ChatGPT Clone – powered by API
          </p>
        </footer>
      </div>
    </div>
  );
}
