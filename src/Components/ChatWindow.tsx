"use client";

import { useEffect, useRef } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  fileUrl?: string;      
  fileName?: string;
  fileType?: string;
};

export default function ChatWindow({
  messages,
  isLoading,
}: {
  messages: Message[];
  isLoading?: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-20 py-6 space-y-6">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 ${
            m.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          {m.role === "assistant" && (
            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-green-600 text-white font-bold">
              AI
            </div>
          )}

          <div
            className={`max-w-[80%] md:max-w-[65%] rounded-lg px-4 py-3 text-sm leading-relaxed shadow-md space-y-2 ${
              m.role === "user"
                ? "bg-[#0b93f6] text-white self-end"
                : "bg-[#444654] text-gray-100"
            }`}
          >
           
            {m.content.split("\n").map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}

          
            {m.fileUrl && (
              <a
                href={m.fileUrl}
                target="_blank"
                className="block underline text-blue-200 break-all"
              >
                📎 {m.fileName || "View Uploaded File"}
              </a>
            )}
          </div>

          {m.role === "user" && (
            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold">
              U
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div className="flex items-start gap-3 justify-start">
          <div className="h-8 w-8 flex items-center justify-center rounded-full bg-green-600 text-white font-bold">
            AI
          </div>
          <div className="bg-[#444654] text-gray-100 rounded-lg px-4 py-3 text-sm shadow-md flex space-x-2">
            <span className="animate-bounce">●</span>
            <span className="animate-bounce delay-200">●</span>
            <span className="animate-bounce delay-400">●</span>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
