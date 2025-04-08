// src/app/components/ConditionalLayout.jsx
"use client";

import { usePathname } from 'next/navigation';

export default function ConditionalLayout({ children, header, footer }) {
  const pathname = usePathname();
  
  // Check if current path is /Analyst
  const isAnalystPage = pathname === '/Analyst';
  
// In your ConditionalLayout.jsx
if (isAnalystPage) {
  return <main className="analyst-page">{children}</main>;
}
  
  // For all other pages, render the header, children, and footer
  return (
    <>
      {header}
      <main className="flex-grow">{children}</main>
      {footer}
    </>
  );
}