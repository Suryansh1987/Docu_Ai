"use client";

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Send, Loader2, PlusCircle, Menu, Upload,
  MessageSquare, X, Search,
  FileText, HelpCircle, Settings
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserButton } from "@clerk/nextjs";
import { Separator } from "@/components/ui/separator";
import axios from 'axios';
import { uploadDocument, askQuestion } from "@/lib/api";

export default function DocumentQA() {
  const [files, setFiles] = useState([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentChat, setCurrentChat] = useState({ id: "1", title: "New Chat" });
  const [recentChats, setRecentChats] = useState([
    { id: "1", title: "New Chat", lastMessage: "Start a new conversation" },
    { id: "2", title: "Access Modifiers in Classes", lastMessage: "What are access modifiers in Java?" },
  ]);
  // Add a new state to store messages for each chat
  const [chatMessages, setChatMessages] = useState({
    "1": [],
    "2": []
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef(null);
  const messageEndRef = useRef(null);

  // Check for pending uploads from dashboard
  useEffect(() => {
    const pendingFiles = sessionStorage.getItem('pendingUploadFiles');
    if (pendingFiles) {
      try {
        const fileNames = JSON.parse(pendingFiles);
        if (fileNames.length > 0) {
          toast.info("Files ready for upload", {
            description: `${fileNames.length} file(s) were selected. Please click Upload to process them.`,
            action: {
              label: "Upload",
              onClick: () => fileInputRef.current?.click(),
            },
          });
        }
        // Clear the pending uploads
        sessionStorage.removeItem('pendingUploadFiles');
      } catch (error) {
        console.error("Error parsing pending files:", error);
      }
    }
  }, []);

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length > 0) {
      setFiles((prev) => [...prev, ...selectedFiles]);
      toast.success("Files added", {
        description: `${selectedFiles.length} file(s) ready for upload`,
      });
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("No files selected", {
        description: "Please select files to upload",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Upload files one by one instead of using Promise.allSettled
      let successCount = 0;
      
      for (const file of files) {
        try {
          console.log(`Uploading file: ${file.name}`);
          const formData = new FormData();
          formData.append('file', file);
          
          // Use axios directly to have more control over the request
          const response = await axios.post('http://localhost:5000/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          
          console.log(`Upload response for ${file.name}:`, response.data);
          successCount++;
        } catch (fileError) {
          console.error(`Error uploading ${file.name}:`, fileError);
          toast.error(`Failed to upload ${file.name}`, {
            description: fileError.message || "Upload failed",
          });
        }
      }
      
      if (successCount > 0) {
        toast.success(`${successCount} file(s) uploaded successfully`, {
          description: "You can now ask questions about your documents",
        });
      }
      
      setFiles([]); // Clear files after upload attempt
    } catch (error) {
      toast.error("Upload failed", {
        description: error.message || "There was an error uploading your files",
      });
      console.error("Upload error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Add this useEffect to scroll to bottom when messages change
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Update the handleAsk function to store messages by chat ID
  const handleAsk = async () => {
    if (!question.trim()) {
      toast.error("Empty question", {
        description: "Please enter a question",
      });
      return;
    }

    setLoading(true);

    const userMessage = { role: "user", content: question };
    // Update both current messages and stored messages
    setMessages((prev) => [...prev, userMessage]);
    
    try {
      console.log("Sending question to backend:", question);
      
      // Use the askQuestion function from src/lib/api.js
      const response = await askQuestion(question);
      console.log("Response received from backend:", response);
      
      const aiResponse = {
        role: "assistant",
        content: response.answer || "I couldn't find an answer based on the document."
      };
      
      // Update both current messages and stored messages for this chat
      const updatedMessages = [...messages, userMessage, aiResponse];
      setMessages((prev) => [...prev, aiResponse]);
      setChatMessages(prev => ({
        ...prev,
        [currentChat.id]: [...messages, userMessage, aiResponse]
      }));
      
      if (messages.length === 0) {
        const newTitle = question.length > 20 ? `${question.substring(0, 20)}...` : question;
        setCurrentChat((prev) => ({ ...prev, title: newTitle }));

        setRecentChats((prev) =>
          prev.map((chat) =>
            chat.id === currentChat.id
              ? { ...chat, title: newTitle, lastMessage: question }
              : chat
          )
        );
      }
    } catch (error) {
      console.error("Error asking question:", error);
      
      let errorMessage = "Failed to get an answer";
      if (error.response) {
        errorMessage = error.response.data?.error || "Server error occurred";
        console.log("Error response data:", error.response.data);
      } else if (error.request) {
        errorMessage = "No response from server. Please check if the backend is running.";
      } else {
        errorMessage = error.message;
      }
      
      const aiResponse = {
        role: "assistant",
        content: `Error: ${errorMessage}`
      };
      
      setMessages((prev) => [...prev, aiResponse]);
      
      toast.error("Question failed", {
        description: errorMessage,
      });
    } finally {
      setQuestion("");
      setLoading(false);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Update the startNewChat function to properly store the current chat's messages
  const startNewChat = () => {
    // Save current chat messages first
    setChatMessages(prev => ({
      ...prev,
      [currentChat.id]: messages
    }));
    
    const newChatId = String(Date.now());
    const newChat = { id: newChatId, title: "New Chat", lastMessage: "Start a new conversation" };
    
    setRecentChats((prev) => [newChat, ...prev]);
    setCurrentChat(newChat);
    
    // Initialize empty messages for the new chat
    setChatMessages(prev => ({
      ...prev,
      [newChatId]: []
    }));
    
    // Clear current messages display
    setMessages([]);
    setFiles([]);
  };

  // Add a function to handle chat selection
  const selectChat = (chat) => {
    // Save current chat messages first
    setChatMessages(prev => ({
      ...prev,
      [currentChat.id]: messages
    }));
    
    // Set the selected chat as current
    setCurrentChat(chat);
    
    // Load the messages for the selected chat
    const chatMsgs = chatMessages[chat.id] || [];
    setMessages(chatMsgs);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className={`h-full flex flex-col border-r bg-white ${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300`}>
          {sidebarOpen && (
            <>
              <div className="p-4 flex items-center">
                <FileText className="h-6 w-6 text-blue-600 mr-2" />
                <h1 className="text-xl font-semibold text-gray-800">DocuAI</h1>
              </div>
              <div className="px-4 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 py-2 text-sm bg-gray-100 border-0"
                  />
                </div>
              </div>
              <div className="p-4 pt-2">
                <Button onClick={startNewChat} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <PlusCircle className="mr-2 h-4 w-4" /> New chat
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                <div className="px-4 py-2">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent</h2>
                </div>
                <div className="space-y-1 px-2">
                  {recentChats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => selectChat(chat)}
                      className={`flex items-center px-2 py-2 text-sm rounded-md cursor-pointer ${
                        currentChat.id === chat.id ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 mr-3" />
                      <span className="truncate">{chat.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserButton />
                    <div>
                      <p className="text-sm font-medium">User</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full">
          {/* Header */}
          <header className="border-b bg-white p-4 flex items-center justify-between">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-2"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-medium">{currentChat.title}</h2>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.docx,.txt"
                multiple
              />
              <Button 
                variant="ghost" 
                size="icon"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>
          </header>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-gray-50 p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Files to upload</h3>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleUpload}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>Upload All</>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <div 
                    key={index} 
                    className="bg-white border rounded-md px-3 py-1 text-sm flex items-center"
                  >
                    <FileText className="h-3 w-3 mr-2 text-blue-500" />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeFile(index)}
                      className="h-5 w-5 ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 overflow-auto">
            <div className="space-y-4 pb-4"> {/* Added pb-4 for padding at bottom */}
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-8">
                  <div>
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Document Q&A Assistant</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Upload your documents and ask questions about them. I'll help you find the information you need.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))
              )}
              <div ref={messageEndRef} /> {/* This is the element we'll scroll to */}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-4 bg-white">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Ask a question about your documents..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={handleAsk}
                disabled={!question.trim() || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
