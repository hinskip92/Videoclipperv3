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
  const [apiKey, setApiKey] = useState("");
  const [processedResult, setProcessedResult] = useState<string | null>(null);
  const [processingPhase, setProcessingPhase] = useState<string>("idle");
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

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setOutputFolder("");
    setProcessedResult(null);
    setUploadProgress(0);
    setProcessingPhase("idle");
    // Don't reset API key to maintain it across uploads
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setProcessingPhase("uploading");
    
    toast("Upload started", "Uploading your video file...", "default");

    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(uploadInterval);
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

      if (apiKey) {
        formData.append("api_key", apiKey);
      }

      // Update phase to show upload is complete
      setTimeout(() => {
        clearInterval(uploadInterval);
        setUploadProgress(100);
        setProcessingPhase("analyzing");
        toast("Analysis started", "AI is analyzing your video content...", "default");
        
        // After a short delay, simulate next phase
        setTimeout(() => {
          setProcessingPhase("generating");
          toast("Generating clips", "Creating vertical clips from your video...", "default");
        }, 3000);
      }, 3000);

      // Send the actual request to the backend
      const response = await fetch("/api/process-video", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Process response as needed
        const result = await response.json();
        console.log("Upload successful:", result);
        setProcessedResult(result.outputFolder);
        setProcessingPhase("complete");
        toast(
          "Processing complete",
          "Your video has been successfully processed!",
          "default"
        );
      } else {
        console.error("Upload failed");
        setProcessingPhase("error");
        toast(
          "Upload failed",
          "There was an error processing your video. Please try again.",
          "destructive"
        );
      }
    } catch (error) {
      console.error("Error during upload:", error);
      setProcessingPhase("error");
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

  // Get phase display information
  const getPhaseInfo = () => {
    switch (processingPhase) {
      case "uploading":
        return {
          title: "Uploading Video",
          description: "Uploading your video file to the server...",
          progress: uploadProgress
        };
      case "analyzing":
        return {
          title: "Analyzing Content",
          description: "AI is analyzing your video to identify interesting moments...",
          progress: 100
        };
      case "generating":
        return {
          title: "Creating Clips",
          description: "Converting selected moments into vertical clips...",
          progress: 100
        };
      case "error":
        return {
          title: "Processing Error",
          description: "An error occurred while processing your video.",
          progress: 100
        };
      default:
        return {
          title: "Upload Progress",
          description: "",
          progress: uploadProgress
        };
    }
  };

  const phaseInfo = getPhaseInfo();

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
            OpenAI API Key (optional):
          </label>
          <Input
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={handleApiKeyChange}
          />
          <p className="text-xs text-gray-500 mt-1">
            Provide your OpenAI API key for full functionality. Leave empty to use demo mode.
          </p>
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
              {phaseInfo.title}:
            </label>
            <Progress value={phaseInfo.progress} className="h-2" />
            <div className="flex flex-col items-center mt-2">
              <p className="text-xs text-center">{phaseInfo.description}</p>
              {processingPhase === "uploading" && (
                <p className="text-xs font-semibold mt-1">{uploadProgress}%</p>
              )}
              {processingPhase !== "idle" && processingPhase !== "error" && (
                <div className="flex items-center space-x-1 mt-2">
                  <div className={`h-2 w-2 rounded-full ${processingPhase === "uploading" ? "bg-blue-500" : "bg-gray-300"}`}></div>
                  <div className={`h-2 w-2 rounded-full ${processingPhase === "analyzing" ? "bg-blue-500" : "bg-gray-300"}`}></div>
                  <div className={`h-2 w-2 rounded-full ${processingPhase === "generating" ? "bg-blue-500" : "bg-gray-300"}`}></div>
                  <div className={`h-2 w-2 rounded-full ${processingPhase === "complete" ? "bg-blue-500" : "bg-gray-300"}`}></div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleUpload} 
          disabled={!selectedFile || isUploading}
          className="w-full"
        >
          {isUploading ? `${processingPhase.charAt(0).toUpperCase() + processingPhase.slice(1)}...` : "Process Video"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default VideoUploadForm; 