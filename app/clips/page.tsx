'use client';

import { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface Clip {
    path: string;
    description: string;
    score: number;
}

interface ClipGroup {
    clips: Clip[];
}

function normalizePath(path: string): string {
    // Remove 'uploads' prefix if present and normalize slashes
    return path.replace(/^uploads[\/\\]/, '').replace(/\\/g, '/');
}

export default function ClipsPage() {
    const videoRefs = useRef<{ [key: string]: Plyr | null }>({});
    const [clips, setClips] = useState<Clip[]>([]);

    useEffect(() => {
        const fetchClips = async () => {
            try {
                const response = await fetch('/api/clips');
                if (!response.ok) {
                    throw new Error('Failed to fetch clips');
                }
                const data: ClipGroup = await response.json();
                console.log('Fetched clips:', data);
                setClips(data.clips);
                
                // Initialize Plyr for each video after a short delay to ensure DOM is ready
                setTimeout(() => {
                    data.clips.forEach((clip) => {
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
                console.error('Error fetching clips:', error);
            }
        };

        fetchClips();

        return () => {
            // Cleanup Plyr instances
            Object.values(videoRefs.current).forEach((player) => {
                if (player) {
                    player.destroy();
                }
            });
        };
    }, []);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Viral Clips</h1>
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
                                >
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