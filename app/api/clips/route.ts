import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Walk through directory and find clips and metadata
function walkDir(dir: string, uploadsDir: string): any[] {
    const clips: any[] = [];
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && file === 'Viral_Clips') {
            // Found a Viral_Clips directory, look for clips and metadata
            const clipFiles = fs.readdirSync(fullPath);
            let metadata = null;
            const videoClips: string[] = [];

            clipFiles.forEach(clipFile => {
                if (clipFile === 'viral_clips_metadata.json') {
                    const metadataContent = fs.readFileSync(path.join(fullPath, clipFile), 'utf-8');
                    metadata = JSON.parse(metadataContent);
                } else if (clipFile.startsWith('viral_clip_') && (clipFile.endsWith('.mp4') || clipFile.endsWith('.mov'))) {
                    videoClips.push(clipFile);
                }
            });

            if (metadata && videoClips.length > 0) {
                clips.push({
                    directory: path.relative(uploadsDir, dir),
                    clips: videoClips.map(clip => ({
                        filename: clip,
                        path: path.join('uploads', path.relative(uploadsDir, dir), 'Viral_Clips', clip),
                    })),
                    metadata
                });
            }
        } else if (stat.isDirectory()) {
            // Recursively walk through subdirectories
            clips.push(...walkDir(fullPath, uploadsDir));
        }
    });

    return clips;
}

export async function GET() {
    try {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        const clips = walkDir(uploadsDir, uploadsDir);
        return NextResponse.json({ clips });
    } catch (error) {
        console.error('Error fetching clips:', error);
        return NextResponse.json({ error: 'Failed to fetch clips' }, { status: 500 });
    }
} 