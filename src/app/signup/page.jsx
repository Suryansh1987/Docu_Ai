"use client";

import { SignUp } from "@clerk/nextjs";
import React from "react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="bg-white shadow px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">Document Q&A</h1>
        </div>
      </header>

      {/* INTRO SECTION */}
      <section className="bg-gray-100 py-12 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4 text-gray-800">Welcome to Document Q&A Assistant</h2>
          <p className="text-lg max-w-2xl mx-auto text-gray-600">
            Your intelligent companion for document analysis, information extraction, and question answering.
            Upload your documents and get instant insights with our advanced AI.
          </p>
        </div>
      </section>

      {/* SIGN UP SECTION */}
      <main className="flex flex-1 justify-center items-center bg-gray-50">
        <SignUp routing="hash" />
      </main>

      {/* FOOTER */}
      <footer className="bg-white text-center text-sm text-gray-500 py-4">
        &copy; {new Date().getFullYear()} Document Q&A. All rights reserved.
      </footer>
    </div>
  );
}
