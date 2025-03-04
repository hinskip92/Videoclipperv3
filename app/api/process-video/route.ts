import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

// Promisify exec
const execPromise = promisify(exec);

// Function to generate a random string for temporary files
const generateId = () => Math.random().toString(36).substring(2, 10);

export async function POST(request: NextRequest) {
  try {
    // Create a FormData object from the request
    const formData = await request.formData();
    
    // Get the video file
    const file = formData.get("video") as File;
    if (!file) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // Get the output folder if provided
    const outputFolder = formData.get("output_folder") as string || "";

    // Create a Buffer from the file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a temporary directory for uploads if it doesn't exist
    const uploadDir = path.join(process.cwd(), "uploads");
    
    try {
      await promisify(require("fs").mkdir)(uploadDir, { recursive: true });
    } catch (error) {
      console.log("Upload directory already exists or couldn't be created");
    }

    // Generate a unique filename
    const uniqueId = generateId();
    const fileName = `${uniqueId}-${file.name}`;
    const filePath = path.join(uploadDir, fileName);

    // Write the file to disk
    await writeFile(filePath, buffer);
    console.log(`File saved at ${filePath}`);

    // Update the script path to point to the correct location
    const scriptPath = path.join(process.cwd(), "app.py");
    const outputFolderArg = outputFolder ? ` "${outputFolder}"` : "";
    const command = `python "${scriptPath}" "${filePath}"${outputFolderArg}`;

    console.log(`Executing command: ${command}`);

    // Execute the command
    try {
      const { stdout, stderr } = await execPromise(command);
      console.log('Python script output:', stdout);
      
      if (stderr) {
        console.error('Python script errors:', stderr);
      }

      // Return success response
      return NextResponse.json({
        success: true,
        message: "Video processed successfully",
        outputFolder: outputFolder || path.join(path.dirname(filePath), "Viral_Clips"),
      });
    } catch (error) {
      console.error("Error executing Python script:", error);
      return NextResponse.json(
        { error: "Error processing video", details: error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error handling request:", error);
    return NextResponse.json(
      { error: "Error handling request", details: error },
      { status: 500 }
    );
  }
} 