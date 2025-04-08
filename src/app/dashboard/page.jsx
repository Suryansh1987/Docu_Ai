// src/app/dashboard/page.js
"use client";

import React, { useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { FileText, ChevronRight, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from "sonner";
import { uploadDocument } from "@/lib/api";
import axios from 'axios';

export default function DashboardPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const handleAuthRequiredAction = (path) => {
    if (isSignedIn) {
      router.push(path);
    } else {
      router.push('/signup');
    }
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length > 0) {
      setIsUploading(true);
      
      try {
        // Check file types and warn about potential issues
        const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');
        if (pdfFiles.length > 0) {
          toast.info("PDF Processing Note", {
            description: "Some PDFs with only images or password protection may not process correctly.",
            duration: 5000,
          });
        }
        
        let successCount = 0;
        
        for (const file of selectedFiles) {
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
            
            // Check for specific PDF error in the response
            let errorMessage = "Upload failed";
            if (fileError.response && fileError.response.data) {
              console.log("Error response data:", fileError.response.data);
              if (fileError.response.data.error && 
                  fileError.response.data.error.includes("PDF") && 
                  (fileError.response.data.error.includes("images") || 
                   fileError.response.data.error.includes("password"))) {
                errorMessage = "This PDF contains only images or is password-protected. Please use a text-based PDF.";
              } else {
                errorMessage = fileError.response.data.error || errorMessage;
              }
            } else {
              errorMessage = fileError.message || errorMessage;
            }
            
            toast.error(`Failed to upload ${file.name}`, {
              description: errorMessage,
            });
          }
        }
        
        if (successCount > 0) {
          toast.success(`${successCount} file(s) uploaded successfully`, {
            description: "You can now ask questions about your documents",
          });
          
          // Navigate to the Analyst page after successful upload
          console.log("Redirecting to Analyst page...");
          setTimeout(() => {
            if (isSignedIn) {
              router.push('/Analyst');
            } else {
              router.push('/signup');
            }
          }, 1000); // Short delay to allow toast to be seen
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Upload failed", {
          description: error.message || "There was an error uploading your files",
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleUploadClick = () => {
    if (isSignedIn) {
      fileInputRef.current?.click();
    } else {
      router.push('/signup');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.docx,.txt"
        multiple
      />
      
      {/* Add a note about supported file types */}
      <div className="p-4">
        <p className="text-gray-600">Easily upload and manage your documents in a secure environment.</p>
        <p className="text-xs text-gray-500 mt-1">Note: PDFs should contain searchable text, not just images.</p>
      </div>
      
      {/* Middle section - light gray */}
      <div className="bg-gray-100 py-12 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-6 text-gray-800">Document Q&A Assistant</h1>
          <p className="text-lg max-w-3xl mx-auto mb-8 text-gray-600">
            Your intelligent companion for document analysis, information extraction, and question answering.
            Upload your documents and get instant insights with our advanced AI.
          </p>
          <div className="flex justify-center space-x-4">
            <button 
              onClick={() => isSignedIn ? router.push('/Analyst') : router.push('/signup')} 
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white"
            >
              Get Started
              <ChevronRight className="h-4 w-4 ml-2" />
            </button>
            <button
              onClick={() => router.push('/learn-more')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* Bottom section - white */}
      <div className="bg-white py-16 flex-grow">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="border border-gray-200 shadow-sm hover:shadow rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-blue-600">Upload Documents</h3>
                <p className="text-sm text-gray-500">Support for PDF, DOCX, TXT and more</p>
              </div>
              <div className="p-4">
                <p className="text-gray-600">Easily upload and manage your documents in a secure environment.</p>
              </div>
              <div className="p-4 bg-gray-50">
                {/* Replace the nested buttons with a single button */}
                <button
                  onClick={handleUploadClick}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Now
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="border border-gray-200 shadow-sm hover:shadow rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-blue-600">Ask Questions</h3>
                <p className="text-sm text-gray-500">Natural language processing</p>
              </div>
              <div className="p-4">
                <p className="text-gray-600">Get precise answers from your documents using advanced AI technology.</p>
              </div>
              <div className="p-4 bg-gray-50">
                <button 
                  onClick={() => handleAuthRequiredAction('/Analyst')}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200"
                >
                  Try It
                </button>
              </div>
            </div>
            
            <div className="border border-gray-200 shadow-sm hover:shadow rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-blue-600">Extract Insights</h3>
                <p className="text-sm text-gray-500">Automated data analysis</p>
              </div>
              <div className="p-4">
                <p className="text-gray-600">Discover key information and patterns within your documents.</p>
              </div>
              <div className="p-4 bg-gray-50">
                <button 
                  onClick={() => handleAuthRequiredAction('/insights')}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200"
                >
                  View Demo
                </button>
              </div>
            </div>
          </div>
          
          {/* Image placeholder */}
          <div className="flex justify-center">
            <div className="w-64 h-48 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
              <p className="text-gray-400 text-sm">Image will be placed here</p>
            </div>
          </div>
          
          <div className="mt-12 bg-blue-50 border border-blue-100 text-blue-800 max-w-2xl mx-auto p-4 rounded-lg">
            <h4 className="font-semibold mb-1">Stay Updated!</h4>
            <p>Sign up for our newsletter to receive the latest features and updates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}