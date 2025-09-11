"use client";

import { useState, FormEvent, ChangeEvent, KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (msg: string, fileUrl?: string, chatSummary?: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileSummary, setFileSummary] = useState<string>("");

  const handleSend = async () => {
    if (!input.trim() && !file) return;

    let fileUrl: string | undefined;
    let chatSummary: string | undefined;

    if (file) {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();

        if (data.error) {
          alert(data.error);
        } else {
          fileUrl = data.url;
          chatSummary = data.ai_summary || data.chatgpt_summary;
          setFileSummary(chatSummary || "");
        }
      } catch (err) {
        console.error(err);
        alert("File upload failed.");
      } finally {
        setUploading(false);
        setFile(null);
      }
    }

    if (input.trim() || chatSummary) {
      onSend(input, fileUrl, chatSummary);
      setInput("");
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift → send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // prevent new line
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-700 bg-[#343541] p-4">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 max-w-4xl mx-auto w-full"
      >
        {/* File upload */}
        <label className="cursor-pointer text-gray-400 hover:text-white">
          <input
            type="file"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setFile(e.target.files?.[0] || null)
            }
          />
          📎
        </label>

        {/* Text input */}
        <textarea
          rows={1}
          value={input}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setInput(e.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="Send a message or upload a file..."
          className="flex-1 resize-none rounded-lg bg-[#40414f] text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={uploading}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
            uploading ? "bg-gray-500 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {uploading ? "Uploading..." : "Send"}
        </button>
      </form>

      {/* Selected file info */}
      {file && (
        <p className="text-xs text-gray-300 mt-2 text-center">
          Selected file: {file.name}
        </p>
      )}

      {/* File summary */}
      {fileSummary && (
        <div className="mt-2 p-2 bg-gray-800 text-gray-100 rounded-md text-sm">
          <strong>AI Summary:</strong>
          <p>{fileSummary}</p>
        </div>
      )}
    </div>
  );
}
