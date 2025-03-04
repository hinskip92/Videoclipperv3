"use client";

import React from "react";
import VideoUploadForm from "../components/VideoUploadForm";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 md:p-24">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-center mb-8">Video Clipper</h1>
        <p className="text-center mb-12 text-muted-foreground">
          Upload your video, and let AI create optimized vertical clips for social media
        </p>
        
        <VideoUploadForm />
      </div>
    </main>
  );
} 