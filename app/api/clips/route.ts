import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Walk through directory and find clips and metadata
function walkDir(dir: string, baseDir: string): any[] {
    const clips: any[] = [];
    
    try {
        // Check if directory exists before trying to read from it
        if (!fs.existsSync(dir)) {
            console.log(`Directory does not exist: ${dir}`);
            return clips;
        }
        
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            
            try {
                // Check if path exists before trying to get stats
                if (!fs.existsSync(fullPath)) {
                    console.log(`Path does not exist: ${fullPath}`);
                    return;
                }
                
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // Check if the directory is a clips directory (Viral_Clips or generated clip directory)
                    // Look for a metadata file to determine if this is a clips directory
                    const metadataPath = path.join(fullPath, 'viral_clips_metadata.json');
                    
                    if (fs.existsSync(metadataPath)) {
                        // This is a clips directory, process it
                        try {
                            // Read the metadata file
                            const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
                            const metadata = JSON.parse(metadataContent);
                            
                            // Find all video clips in this directory
                            const dirFiles = fs.readdirSync(fullPath);
                            const videoClips: string[] = [];
                            
                            dirFiles.forEach(clipFile => {
                                if (clipFile.startsWith('viral_clip_') && (clipFile.endsWith('.mp4') || clipFile.endsWith('.mov'))) {
                                    // Verify that the file actually exists before adding it
                                    const clipFilePath = path.join(fullPath, clipFile);
                                    if (fs.existsSync(clipFilePath)) {
                                        videoClips.push(clipFile);
                                    } else {
                                        console.log(`Clip file listed but doesn't exist: ${clipFilePath}`);
                                    }
                                }
                            });
                            
                            if (videoClips.length > 0) {
                                // Create a timestamp based on directory creation time for sorting
                                const dirStat = fs.statSync(fullPath);
                                const timestamp = dirStat.birthtime || dirStat.mtime;
                                
                                // baseDir is passed into the function to identify which root directory we're in
                                const baseFullPath = path.join(process.cwd(), baseDir);
                                
                                clips.push({
                                    directory: path.relative(baseFullPath, fullPath),
                                    timestamp: timestamp.toISOString(),
                                    clips: videoClips.map(clip => ({
                                        filename: clip,
                                        path: path.join(baseDir, path.relative(baseFullPath, fullPath), clip),
                                    })),
                                    metadata
                                });
                            }
                        } catch (error) {
                            console.error(`Error processing clips directory ${fullPath}:`, error);
                        }
                    } else if (file !== 'Viral_Clips') {
                        // If not a Viral_Clips directory, recurse into it 
                        // Pass the same baseDir to the recursive call
                        clips.push(...walkDir(fullPath, baseDir));
                    }
                }
            } catch (error) {
                console.error(`Error accessing ${fullPath}:`, error);
            }
        });
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
    }

    return clips;
}

export async function GET() {
    try {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        const clipsDir = path.join(process.cwd(), 'clips');
        
        // Make sure directories exist
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        if (!fs.existsSync(clipsDir)) {
            fs.mkdirSync(clipsDir, { recursive: true });
        }
        
        // Look for clips in both uploads and clips directories
        // Use "uploads" and "clips" as the base directory identifiers
        let allClips = [...walkDir(uploadsDir, "uploads"), ...walkDir(clipsDir, "clips")];
        
        // Sort clips by timestamp, newest first
        allClips.sort((a, b) => {
            if (!a.timestamp) return 1;
            if (!b.timestamp) return -1;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        
        // If no clips found, return mock data for demo purposes
        if (allClips.length === 0) {
            console.log('No clips found, returning mock data');
            
            // Create a demo directory where we'll store mock clips
            const demoDir = path.join(clipsDir, 'demo');
            if (!fs.existsSync(demoDir)) {
                fs.mkdirSync(demoDir, { recursive: true });
            }
            
            // Create mock metadata file if it doesn't exist
            const metadataPath = path.join(demoDir, 'viral_clips_metadata.json');
            if (!fs.existsSync(metadataPath)) {
                const mockMetadata = [
                    {
                        "timecodes": [16.0, 25.0],
                        "description": "This segment features the fascinating poison dart frog, showcasing its surprising toxicity. The Kratt brothers' enthusiastic explanation and animated visuals make this fact engaging for viewers of all ages.",
                        "entertainment_score": 9,
                        "educational_score": 10,
                        "clarity_score": 9,
                        "shareability_score": 10,
                        "length_score": 10,
                        "analysis": {
                            "animal_facts": [
                                "Poison dart frogs contain enough toxin to take down ten adult humans",
                                "These frogs are among the most toxic animals on Earth",
                                "Their bright colors warn predators of their toxicity"
                            ],
                            "context_and_setup": "The clip begins with a provocative question that hooks the viewer's interest.",
                            "emotional_engagement": "The brothers' reactions create an emotional response that helps viewers understand the significance.",
                            "follow_up": "After revealing the main fact, they explain how these frogs use this defense mechanism in the wild.",
                            "educational_entertainment_balance": "This clip balances the shocking fact with entertaining reactions."
                        },
                        "text_hook": "This tiny frog could take down 10 grown men! 🐸☠️"
                    }
                ];
                
                fs.writeFileSync(metadataPath, JSON.stringify(mockMetadata, null, 2));
            }
            
            // Return mock clip data
            return NextResponse.json({
                clips: [
                    {
                        directory: 'demo',
                        timestamp: new Date().toISOString(),
                        clips: [
                            {
                                filename: 'viral_clip_1.mp4',
                                path: 'public/sample-video.mp4', // Use a known existing file
                                description: "Poison dart frog's surprising toxicity",
                                score: 9.6
                            }
                        ],
                        metadata: [
                            {
                                "timecodes": [16.0, 25.0],
                                "description": "This segment features the fascinating poison dart frog, showcasing its surprising toxicity. The Kratt brothers' enthusiastic explanation and animated visuals make this fact engaging for viewers of all ages.",
                                "entertainment_score": 9,
                                "educational_score": 10,
                                "clarity_score": 9,
                                "shareability_score": 10,
                                "length_score": 10,
                                "analysis": {
                                    "animal_facts": [
                                        "Poison dart frogs contain enough toxin to take down ten adult humans",
                                        "These frogs are among the most toxic animals on Earth",
                                        "Their bright colors warn predators of their toxicity"
                                    ],
                                    "context_and_setup": "The clip begins with a provocative question that hooks the viewer's interest.",
                                    "emotional_engagement": "The brothers' reactions create an emotional response that helps viewers understand the significance.",
                                    "follow_up": "After revealing the main fact, they explain how these frogs use this defense mechanism in the wild.",
                                    "educational_entertainment_balance": "This clip balances the shocking fact with entertaining reactions."
                                },
                                "text_hook": "This tiny frog could take down 10 grown men! 🐸☠️"
                            }
                        ]
                    }
                ]
            });
        }
        
        return NextResponse.json({ clips: allClips });
    } catch (error) {
        console.error('Error fetching clips:', error);
        return NextResponse.json({ error: 'Failed to fetch clips' }, { status: 500 });
    }
} 