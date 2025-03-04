import React, { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import ResultsDisplay from "./ResultsDisplay";
import { useToast } from "./ui/toast-context";

const VideoUploadForm = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [outputFolder, setOutputFolder] = useState("");
  const [processedResult, setProcessedResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      toast("File selected", `Selected ${file.name}`, "default");
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOutputFolder(e.target.value);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setOutputFolder("");
    setProcessedResult(null);
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 5;
      });
    }, 500);

    try {
      // Prepare FormData
      const formData = new FormData();
      formData.append("video", selectedFile);
      
      if (outputFolder) {
        formData.append("output_folder", outputFolder);
      }

      // Send the actual request to the backend
      const response = await fetch("/api/process-video", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);

      if (response.ok) {
        setUploadProgress(100);
        // Process response as needed
        const result = await response.json();
        console.log("Upload successful:", result);
        setProcessedResult(result.outputFolder);
        toast(
          "Processing complete",
          "Your video has been successfully processed!",
          "default"
        );
      } else {
        console.error("Upload failed");
        toast(
          "Upload failed",
          "There was an error processing your video. Please try again.",
          "destructive"
        );
      }
    } catch (error) {
      console.error("Error during upload:", error);
      toast(
        "Error",
        "An unexpected error occurred. Please try again.",
        "destructive"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Show results if processing is complete
  if (processedResult) {
    return <ResultsDisplay outputFolder={processedResult} onReset={handleReset} />;
  }

  // Otherwise show the upload form
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Upload Video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <input
            type="file"
            accept="video/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            onClick={triggerFileInput}
            className="border-2 border-dashed rounded-md h-32 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
          >
            {selectedFile ? selectedFile.name : "Click to select video file"}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Output Folder (optional):
          </label>
          <Input
            type="text"
            placeholder="Path to output folder"
            value={outputFolder}
            onChange={handleFolderChange}
          />
        </div>

        {isUploading && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">
              Upload Progress:
            </label>
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-center mt-1">{uploadProgress}%</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleUpload} 
          disabled={!selectedFile || isUploading}
          className="w-full"
        >
          {isUploading ? "Processing..." : "Process Video"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default VideoUploadForm; 