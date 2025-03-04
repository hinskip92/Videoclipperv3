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
    
    // Create a unique output folder for each video upload to prevent overwriting existing clips
    let targetOutputFolder = outputFolder;
    if (!targetOutputFolder) {
      // If no custom output folder provided, create one with a timestamp and unique ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      targetOutputFolder = path.join(process.cwd(), "clips", `${timestamp}-${uniqueId}`);
    } else {
      // If custom output folder provided, add a timestamp subfolder to avoid overwrites
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      targetOutputFolder = path.join(outputFolder, `upload-${timestamp}-${uniqueId}`);
    }
    
    // Create the output folder
    try {
      await promisify(require("fs").mkdir)(targetOutputFolder, { recursive: true });
      console.log(`Created output directory: ${targetOutputFolder}`);
    } catch (error) {
      console.error(`Error creating output directory: ${error}`);
    }
    
    const outputFolderArg = ` "${targetOutputFolder}"`;
    const venvPython = path.join(process.cwd(), "venv/bin/python");
    const command = `"${venvPython}" "${scriptPath}" "${filePath}"${outputFolderArg}`;

    console.log(`Executing command: ${command}`);

    // Execute the command with environment variables
    try {
      // Print current environment paths
      console.log('Running Python path check...');
      await execPromise('which python; which python3; echo $PATH');
      
      // Get API key from the form if provided
      const apiKey = formData.get("api_key") as string;
      
      // Add API key to environment variables if provided
      const env = { 
        ...process.env, 
        PATH: process.env.PATH 
      };
      
      if (apiKey) {
        console.log('Using API key from form submission');
        env.OPENAI_API_KEY = apiKey;
      }
      
      // Execute with environment variables
      const { stdout, stderr } = await execPromise(command, { env });
      console.log('Python script output:', stdout);
      
      if (stderr) {
        console.error('Python script errors:', stderr);
      }

      // Return success response
      return NextResponse.json({
        success: true,
        message: "Video processed successfully",
        outputFolder: targetOutputFolder,
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