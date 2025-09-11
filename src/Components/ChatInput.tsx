"use client";

import {
  useState,
  FormEvent,
  ChangeEvent,
  KeyboardEvent,
  useRef,
  useEffect,
} from "react";

interface ChatInputProps {
  onSend: (msg: string, fileUrl?: string, chatSummary?: string) => void;
}

interface UploadResponse {
  file_url?: string;
  fileUrl?: string;
  ai_summary?: string;
  error?: string;
  rawText?: string;
}

export default function ChatInput({ onSend }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileSummary, setFileSummary] = useState<string>("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  // --- Handle sending ---
  const handleSend = async () => {
    if (!input.trim() && !file) return;

    let fileUrl: string | undefined;
    let chatSummary: string | undefined;

    // --- Upload file if present ---
    if (file) {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data: UploadResponse = await res.json();

        if (!res.ok || data.error) {
          alert("Upload failed: " + (data.error || res.status));
        } else {
          fileUrl = data.file_url ?? data.fileUrl;
          chatSummary = data.ai_summary;
          setFileSummary(chatSummary || "");
        }
      } catch (err) {
        console.error("Upload failed", err);
        alert("Upload failed — see console.");
      } finally {
        setUploading(false);
        setFile(null);
      }
    }

    // --- Send text message (or file summary) to Home ---
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-700 bg-[#343541] p-4">
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 max-w-4xl mx-auto w-full"
      >
        {/* File upload */}
        <label className="cursor-pointer text-gray-400 hover:text-white">
          <input
            type="file"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (e.target.files?.[0]) setFile(e.target.files[0]);
            }}
          />
          📎
        </label>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message or upload a file..."
          className="flex-1 resize-none rounded-lg bg-[#40414f] text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] max-h-40 overflow-y-auto"
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={uploading}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
            uploading
              ? "bg-gray-500 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {uploading ? "Uploading..." : "Send"}
        </button>
      </form>

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
