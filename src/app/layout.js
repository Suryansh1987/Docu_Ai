// src/app/layout.jsx
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { FileText, HelpCircle, Settings } from 'lucide-react';
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import ConditionalLayout from "@/components/conditionallayout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Document Q&A Assistant",
  description: "Your intelligent document analysis companion",
};

export default function RootLayout({ children }) {
  // Define your header component
  const header = (
    <header className="bg-white py-6 border-b border-gray-200 sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-xl text-gray-800">DocuAI</span>
          </Link>
          
          <div className="flex items-center space-x-4">
            <Link href="/help" className="flex items-center px-3 py-2 text-sm rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100">
              <HelpCircle className="h-4 w-4 mr-2" />
              Help
            </Link>
            
            <Link href="/settings" className="flex items-center px-3 py-2 text-sm rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
            
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>
    </header>
  );
  
  // Define your footer component
  const footer = (
    <footer className="bg-gray-800 text-white py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-gray-300 mb-4 md:mb-0">© 2025 Document Q&A Assistant</div>
          <div className="flex space-x-4">
            <Link href="/terms" className="text-sm text-gray-300 hover:text-white">Terms</Link>
            <Link href="/privacy" className="text-sm text-gray-300 hover:text-white">Privacy</Link>
            <Link href="/contact" className="text-sm text-gray-300 hover:text-white">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );

  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
        <body className="min-h-screen flex flex-col bg-white">
          <ConditionalLayout header={header} footer={footer}>
            {children}
          </ConditionalLayout>
        </body>
      </html>
    </ClerkProvider>
  );
}