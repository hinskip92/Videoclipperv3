import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

// Recursive function to delete directory contents
async function deleteDirectoryContents(dir: string): Promise<void> {
  try {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    
    // First, delete all files in this directory
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // If it's a directory named "Viral_Clips", delete its contents
        if (entry.name === "Viral_Clips") {
          await deleteDirectoryContents(fullPath);
          // Keep the Viral_Clips directory itself
        } else {
          // For other directories, recursively delete their contents
          await deleteDirectoryContents(fullPath);
        }
      } else if (entry.name.startsWith('viral_clip_') || entry.name === 'viral_clips_metadata.json') {
        // Delete clip files and metadata
        await fsPromises.unlink(fullPath);
        console.log(`Deleted file: ${fullPath}`);
      }
    }
    
    console.log(`Cleared directory: ${dir}`);
  } catch (error) {
    console.error(`Error clearing directory ${dir}:`, error);
    throw error;
  }
}

export async function POST() {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    // Make sure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      return NextResponse.json({ success: true, message: "No clips to clear" });
    }
    
    // Find all Viral_Clips directories and clear them
    const entries = await fsPromises.readdir(uploadsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(uploadsDir, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name === "Viral_Clips") {
          // Clear the root Viral_Clips directory
          await deleteDirectoryContents(entryPath);
        } else {
          // Check if this directory contains a Viral_Clips subdirectory
          const subEntries = await fsPromises.readdir(entryPath, { withFileTypes: true });
          for (const subEntry of subEntries) {
            if (subEntry.isDirectory() && subEntry.name === "Viral_Clips") {
              await deleteDirectoryContents(path.join(entryPath, subEntry.name));
            }
          }
        }
      }
    }
    
    return NextResponse.json({ success: true, message: "Clips library cleared successfully" });
  } catch (error) {
    console.error("Error clearing clips library:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear clips library" },
      { status: 500 }
    );
  }
}