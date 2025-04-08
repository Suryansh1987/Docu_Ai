"use client";

import { useState } from "react";
import { Inbox, SendHorizontal } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { askQuestion } from "@/lib/api"; // Update this file if needed
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChatList } from "@/components/chat-list";

export default function DocumentQA() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);

  const onDrop = async (acceptedFiles) => {
    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("https://docu-ai-1.onrender.com/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Files uploaded successfully!");
        setFiles([]);
      } else {
        toast.error(result.error || "File upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload error");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
  });

  const handleAsk = async () => {
    if (!question.trim()) return;

    const newMessage = {
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, newMessage]);
    setLoading(true);
    setQuestion("");

    try {
      const response = await fetch("https://docu-ai-1.onrender.com/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      const botMessage = {
        role: "assistant",
        content: data.answer || "No response from server.",
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to get answer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div
        {...getRootProps()}
        className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center cursor-pointer bg-white hover:bg-gray-50"
      >
        <input {...getInputProps()} />
        <Inbox className="mx-auto text-gray-400" size={48} />
        <p className="text-gray-600 mt-2">
          {isDragActive ? "Drop files here..." : "Drag & drop files or click to upload"}
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          rows={3}
          placeholder="Ask your question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button onClick={handleAsk} disabled={loading || !question}>
          <SendHorizontal className="mr-2 h-4 w-4" /> Ask
        </Button>
      </div>

      {loading && <p className="text-sm italic text-gray-500">AI is thinking...</p>}

      <div className="mt-6">
        <ChatList messages={messages} />
      </div>
    </div>
  );
}
