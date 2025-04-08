"use client";

import React from "react";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-gray-100 py-12 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-6 text-gray-800">Document Q&A Assistant</h1>
          <p className="text-lg max-w-3xl mx-auto mb-8 text-gray-600">
            Your intelligent companion for document analysis, information extraction, and question answering.
            Upload your documents and get instant insights with our advanced AI.
          </p>
        </div>
      </div>

      {/* Auth Form */}
      <div className="flex-grow flex items-center justify-center py-12">
        <SignIn />
      </div>

      {/* Footer */}
      <div className="mt-12 bg-blue-50 border border-blue-100 text-blue-800 max-w-2xl mx-auto p-4 rounded-lg mb-12">
      
      </div>
    </div>
  );
}
