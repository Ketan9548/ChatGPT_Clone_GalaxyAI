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

  const handleSend = async (msg: string, file?: File) => {
    if (!msg.trim() && !file) return;

    let updatedMessages: Message[] = [...messages];

    // Add user message if text exists
    if (msg.trim()) {
      const userMessage: Message = { role: "user", content: msg };
      updatedMessages = [...updatedMessages, userMessage];
      setMessages(updatedMessages);
    }

    // File upload handling
    if (file) {
      const uploadingMessage: Message = {
        role: "assistant",
        content: `Uploading file: ${file.name}...`,
      };
      updatedMessages = [...updatedMessages, uploadingMessage];
      setMessages(updatedMessages);
      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        const fileMessages: Message[] = [];

        if (data.success) {
          if (data.ai_summary) {
            fileMessages.push({ role: "assistant", content: data.ai_summary });
          } else {
            fileMessages.push({
              role: "assistant",
              content: `File uploaded: ${data.fileUrl}`,
            });
          }
        } else {
          fileMessages.push({
            role: "assistant",
            content: `Failed to upload file: ${file.name}`,
          });
        }

        setMessages((prev) => [
          ...prev.filter((m) => m !== uploadingMessage),
          ...fileMessages,
        ]);
      } catch (err) {
        console.error("Upload error:", err);
        setMessages((prev) => [
          ...prev.filter((m) => m !== uploadingMessage),
          {
            role: "assistant",
            content: `Upload failed for ${file.name}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    // Send text message to /api/chat if text exists
    if (msg.trim()) {
      setIsLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "test-user",
            messages: updatedMessages, // ✅ use latest array
          }),
        });
        const data = await res.json();
        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply },
          ]);
        }
      } catch (err) {
        console.error("Chat error:", err);
      } finally {
        setIsLoading(false);
      }
    }
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
          <ChatInput onSend={(text, file) => handleSend(text, file)} />

          <p className="text-xs text-gray-400 mt-2 text-center">
            ChatGPT Clone – powered by API
          </p>
        </footer>
      </div>
    </div>
  );
}
