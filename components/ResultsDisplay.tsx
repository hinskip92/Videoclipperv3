import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast-context";

interface ResultsDisplayProps {
  outputFolder: string;
  onReset: () => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ outputFolder, onReset }) => {
  const { toast } = useToast();

  const openFolder = () => {
    // Use the Electron shell.openPath API if running in Electron
    // For web, we'll just provide the path for the user to open manually
    toast(
      "Folder Location",
      `Your clips are ready in folder: ${outputFolder}`,
      "default"
    );
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Processing Complete!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center">
          Your video has been processed and the clips are available in:
        </p>
        <pre className="bg-muted p-3 rounded-md overflow-auto text-sm">
          {outputFolder}
        </pre>
        <div className="flex gap-4 justify-center mt-6">
          <Button onClick={openFolder} variant="outline">
            Show Folder
          </Button>
          <Button onClick={onReset}>
            Process Another Video
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultsDisplay; 