'use client';

import { useEffect, useRef, useState } from 'react';
// Import Plyr dynamically instead of statically
import dynamic from 'next/dynamic';
// We'll import the CSS in useEffect

interface Clip {
    path: string;
    description: string;
    score: number;
}

interface ClipGroup {
    clips: Clip[];
}

function normalizePath(path: string | undefined | null): string {
    // Handle undefined or null paths
    if (!path) return '';
    
    // Pass through paths that already start with uploads/ or clips/
    if (path.startsWith('uploads/') || path.startsWith('clips/')) {
        return path.replace(/\\/g, '/');
    }
    
    // For other paths, assume they're relative to uploads and normalize slashes
    return path.replace(/\\/g, '/');
}

export default function ClipsPage() {
    // Use any type for now since Plyr is dynamically imported
    const videoRefs = useRef<{ [key: string]: any }>({});
    const [clips, setClips] = useState<Clip[]>([]);

    useEffect(() => {
        // Dynamically import Plyr only on the client side
        const loadPlyr = async () => {
            try {
                // Import the CSS
                await import('plyr/dist/plyr.css');
                // Import the Plyr library
                const PlyrModule = await import('plyr');
                const Plyr = PlyrModule.default;
                
                // Now fetch clips and initialize Plyr
                const response = await fetch('/api/clips');
                if (!response.ok) {
                    throw new Error('Failed to fetch clips');
                }
                const data = await response.json();
                console.log('Fetched clips data:', data);
                
                // Extract clips from the response
                let processedClips: Clip[] = [];
                
                if (data.clips && Array.isArray(data.clips)) {
                    // Process the nested structure of clip groups - sort by timestamp, newest first
                    const sortedClipGroups = [...data.clips];
                    sortedClipGroups.sort((a: any, b: any) => {
                        if (!a.timestamp) return 1;
                        if (!b.timestamp) return -1;
                        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                    });
                    
                    // Process the nested structure of clip groups
                    sortedClipGroups.forEach((clipGroup: any) => {
                        if (clipGroup.clips && Array.isArray(clipGroup.clips)) {
                            // Add a header with the upload date if available
                            const groupHeader = clipGroup.timestamp 
                                ? `Upload from ${new Date(clipGroup.timestamp).toLocaleString()}` 
                                : 'Clips';
                                
                            // For each clip in this group
                            clipGroup.clips.forEach((clip: any, index: number) => {
                                // Get metadata for this clip if available
                                const metadata = clipGroup.metadata && clipGroup.metadata[index] 
                                    ? clipGroup.metadata[index] 
                                    : null;
                                
                                // Add the header to the first clip in each group
                                const clipDescription = index === 0
                                    ? `${groupHeader}: ${metadata?.description || clip.description || 'No description available'}`
                                    : metadata?.description || clip.description || 'No description available';
                                    
                                processedClips.push({
                                    path: clip.path || '',
                                    description: clipDescription,
                                    score: metadata?.entertainment_score || clip.score || 0
                                });
                            });
                        }
                    });
                }
                
                console.log('Processed clips:', processedClips);
                setClips(processedClips);
                
                // Initialize Plyr for each video after a short delay to ensure DOM is ready
                setTimeout(() => {
                    processedClips.forEach((clip) => {
                        const videoId = `video-${normalizePath(clip.path)}`;
                        const element = document.getElementById(videoId);
                        if (element && !videoRefs.current[videoId]) {
                            console.log('Initializing Plyr for:', videoId);
                            videoRefs.current[videoId] = new Plyr(element, {
                                controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                                debug: true
                            });
                        }
                    });
                }, 100);
            } catch (error) {
                console.error('Error loading Plyr or fetching clips:', error);
            }
        };

        loadPlyr();

        return () => {
            // Cleanup Plyr instances
            Object.values(videoRefs.current).forEach((player) => {
                if (player) {
                    player.destroy();
                }
            });
        };
    }, []);

    const clearClipsLibrary = async () => {
        try {
            const response = await fetch('/api/clips/clear', {
                method: 'POST'
            });
            
            if (response.ok) {
                // Reload the page to reflect changes
                window.location.reload();
            } else {
                console.error('Failed to clear clips library');
                alert('Failed to clear clips library. Please try again.');
            }
        } catch (error) {
            console.error('Error clearing clips library:', error);
            alert('An error occurred while clearing clips library.');
        }
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Viral Clips</h1>
                <button 
                    onClick={clearClipsLibrary}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm"
                >
                    Clear Clips Library
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clips.map((clip: Clip) => {
                    const videoPath = normalizePath(clip.path);
                    const videoId = `video-${videoPath}`;
                    const videoUrl = `/api/video?path=${encodeURIComponent(videoPath)}`;
                    
                    console.log('Rendering video:', {
                        id: videoId,
                        url: videoUrl,
                        path: videoPath
                    });

                    return (
                        <div key={videoPath} className="bg-white rounded-lg shadow-md p-4">
                            <div className="aspect-w-16 aspect-h-9 mb-4">
                                <video
                                    id={videoId}
                                    className="plyr-video"
                                    controls
                                    preload="metadata"
                                    crossOrigin="anonymous"
                                    onError={(e) => {
                                        console.error('Video playback error:', e);
                                        // Replace the video element with an error message
                                        const videoElement = document.getElementById(videoId);
                                        if (videoElement && videoElement.parentNode) {
                                            const errorDiv = document.createElement('div');
                                            errorDiv.className = 'flex items-center justify-center bg-gray-100 h-full text-red-500';
                                            errorDiv.textContent = 'Video not available';
                                            videoElement.parentNode.replaceChild(errorDiv, videoElement);
                                        }
                                    }}
                                >
                                    <source src={videoUrl} type="video/mp4" />
                                    <source src={videoUrl} type="video/quicktime" />
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                            <div className="mt-2">
                                <p className="text-gray-700">{clip.description}</p>
                                <p className="text-sm text-gray-500">Score: {clip.score}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
} 