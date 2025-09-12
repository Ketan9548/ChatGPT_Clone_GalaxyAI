"use client";

import { X, Plus, Bookmark, Settings } from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void; 
}

export default function Sidebar({ open, onClose, onNewChat }: SidebarProps) {
  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-[#202123] border-r border-gray-700 transform transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Chats</h2>
        <button
          className="md:hidden p-2 rounded hover:bg-gray-700"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>


      <nav className="flex-1 p-2 space-y-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 text-left px-3 py-2 rounded hover:bg-gray-700"
        >
          <Plus size={16} /> New Chat
        </button>
        <button className="w-full flex items-center gap-2 text-left px-3 py-2 rounded hover:bg-gray-700">
          <Bookmark size={16} /> Saved
        </button>
        <button className="w-full flex items-center gap-2 text-left px-3 py-2 rounded hover:bg-gray-700">
          <Settings size={16} /> Settings
        </button>
      </nav>
    </aside>
  );
}
