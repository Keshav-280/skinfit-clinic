"use client";

import { motion } from "framer-motion";
import {
  Search,
  Bot,
  User,
  Phone,
  Video,
  Paperclip,
  Send,
} from "lucide-react";

const contacts = [
  {
    id: "ai",
    name: "SkinFit AI Assistant",
    snippet: "Hi! How can I help with your skincare today?",
    time: "10:42 AM",
    isActive: true,
    icon: Bot,
  },
  {
    id: "doctor",
    name: "Dr. Ruby Sachdev",
    snippet: "Your next follow-up is scheduled for...",
    time: "9:15 AM",
    isActive: false,
    icon: User,
  },
  {
    id: "support",
    name: "Clinic Support",
    snippet: "We're here to assist with your booking.",
    time: "Yesterday",
    isActive: false,
    icon: User,
  },
];

const messages = [
  {
    id: 1,
    sender: "ai",
    text: "Hi! I'm your SkinFit AI assistant. How can I help with your skincare routine today?",
  },
  {
    id: 2,
    sender: "patient",
    text: "I've been using the new retinol serum for a week. What should I expect?",
  },
  {
    id: 3,
    sender: "ai",
    text: "Great question! In the first 1–2 weeks, mild dryness or purging is common. Make sure you're using SPF daily and hydrating well. Let me know if you notice any irritation.",
  },
  {
    id: 4,
    sender: "patient",
    text: "Thanks, that helps!",
  },
];

const CARD_SHADOW = "rounded-[22px] border border-zinc-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]";

export default function ChatPage() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex min-h-[calc(100vh-120px)] flex-col gap-4 md:h-[calc(100vh-100px)] md:flex-row md:gap-6"
    >
      {/* Sidebar */}
      <div
        className={`flex w-full min-w-0 flex-col overflow-hidden md:w-[min(100%,320px)] md:shrink-0 ${CARD_SHADOW}`}
      >
        <div className="border-b border-zinc-100 p-4">
          <h1 className="mb-3 text-center text-xl font-bold text-zinc-900 md:hidden">
            Chat
          </h1>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              type="text"
              placeholder="Search messages or doctors..."
              className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-[240px] flex-1 overflow-y-auto md:max-h-none">
          {contacts.map((contact) => {
            const Icon = contact.icon;
            return (
              <div
                key={contact.id}
                className={`flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-4 transition-colors hover:bg-zinc-50 ${
                  contact.isActive ? "bg-[#E0F0ED]/60" : ""
                }`}
              >
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E0F0ED]">
                  <Icon className="h-5 w-5 text-[#6B8E8E]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {contact.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {contact.snippet}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-400">
                  {contact.time}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat */}
      <div
        className={`relative flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden ${CARD_SHADOW}`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E0F0ED]">
                <Bot className="h-5 w-5 text-[#6B8E8E]" />
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900">SkinFit AI Assistant</p>
              <p className="text-xs text-emerald-600">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-teal-700"
              title="Voice call"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-teal-700"
              title="Video call"
            >
              <Video className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#FDF9F0]/30 p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "patient" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 sm:max-w-[80%] ${
                    msg.sender === "patient"
                      ? "rounded-l-2xl rounded-tr-2xl bg-teal-600 text-white"
                      : "rounded-r-2xl rounded-tl-2xl border border-zinc-100 bg-white text-zinc-800 shadow-sm"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-100 bg-white p-4">
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white hover:text-teal-700"
              title="Attach file"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              className="max-h-24 flex-1 bg-transparent px-2 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white transition-colors hover:bg-teal-500"
              title="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
