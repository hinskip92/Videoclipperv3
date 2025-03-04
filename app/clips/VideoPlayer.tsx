'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
    src: string;
    type: string;
}

export default function VideoPlayer({ src, type }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [debugInfo, setDebugInfo] = useState<string>('');

    // Convert /uploads/path/to/video.mp4 to /api/video?path=path/to/video.mp4
    const apiSrc = src.replace(/^\/uploads\//, '');
    const videoUrl = `/api/video?path=${encodeURIComponent(apiSrc)}`;

    // First, verify the video URL is accessible
    useEffect(() => {
        const checkVideo = async () => {
            try {
                const response = await fetch(videoUrl, { method: 'HEAD' });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');
                console.log('Video metadata:', {
                    url: videoUrl,
                    status: response.status,
                    contentType,
                    contentLength,
                    headers: Object.fromEntries(response.headers.entries())
                });
            } catch (error) {
                console.error('Error checking video:', error);
                setError(error instanceof Error ? error.message : 'Failed to check video');
            }
        };

        checkVideo();
    }, [videoUrl]);

    useEffect(() => {
        let isMounted = true;

        const initializePlyr = async () => {
            try {
                console.log('Initializing Plyr for:', videoUrl);
                const Plyr = (await import('plyr')).default;
                await import('plyr/dist/plyr.css');

                if (!isMounted || !videoRef.current) return;

                // Add video element event listeners before Plyr initialization
                const handleLoadStart = () => {
                    console.log('Video loadstart:', videoUrl);
                    setIsLoading(true);
                    setDebugInfo('Loading started...');
                };

                const handleCanPlay = () => {
                    console.log('Video canplay:', videoUrl);
                    setIsLoading(false);
                    setDebugInfo('Ready to play');
                };

                const handleWaiting = () => {
                    console.log('Video waiting:', videoUrl);
                    if (videoRef.current) {
                        const state = {
                            readyState: videoRef.current.readyState,
                            networkState: videoRef.current.networkState,
                            paused: videoRef.current.paused,
                            currentTime: videoRef.current.currentTime,
                            duration: videoRef.current.duration,
                            buffered: videoRef.current.buffered.length > 0 
                                ? `${videoRef.current.buffered.start(0)}-${videoRef.current.buffered.end(0)}`
                                : 'none'
                        };
                        console.log('Video state:', state);
                        setDebugInfo(`Waiting... State: ${JSON.stringify(state)}`);
                    }
                };

                const handleError = (e: Event) => {
                    const video = e.target as HTMLVideoElement;
                    const errorInfo = {
                        src: videoUrl,
                        error: video.error?.code,
                        message: video.error?.message,
                        networkState: video.networkState,
                        readyState: video.readyState,
                        currentSrc: video.currentSrc
                    };
                    console.error('Video error:', errorInfo);
                    setError(video.error?.message || 'Error loading video');
                    setIsLoading(false);
                    setDebugInfo(`Error: ${JSON.stringify(errorInfo)}`);

                    // Try to recover by reloading the video
                    if (video.error?.code === MediaError.MEDIA_ERR_NETWORK) {
                        console.log('Network error detected, attempting to reload...');
                        setTimeout(() => {
                            if (videoRef.current) {
                                videoRef.current.load();
                            }
                        }, 1000);
                    }
                };

                videoRef.current.addEventListener('loadstart', handleLoadStart);
                videoRef.current.addEventListener('canplay', handleCanPlay);
                videoRef.current.addEventListener('waiting', handleWaiting);
                videoRef.current.addEventListener('error', handleError);

                if (!playerRef.current) {
                    console.log('Creating Plyr instance for:', videoUrl);
                    playerRef.current = new Plyr(videoRef.current, {
                        controls: [
                            'play-large',
                            'play',
                            'progress',
                            'current-time',
                            'mute',
                            'volume',
                            'fullscreen'
                        ],
                        debug: true,
                        loadSprite: false,
                        resetOnEnd: false
                    });

                    playerRef.current.on('ready', () => {
                        console.log('Plyr ready:', videoUrl);
                        setDebugInfo('Player ready');
                        if (videoRef.current) {
                            videoRef.current.load(); // Force load the video
                        }
                    });

                    playerRef.current.on('error', (error: any) => {
                        console.error('Plyr error:', error);
                        setError('Player error occurred');
                        setDebugInfo(`Player error: ${JSON.stringify(error)}`);
                    });
                }

                return () => {
                    if (videoRef.current) {
                        videoRef.current.removeEventListener('loadstart', handleLoadStart);
                        videoRef.current.removeEventListener('canplay', handleCanPlay);
                        videoRef.current.removeEventListener('waiting', handleWaiting);
                        videoRef.current.removeEventListener('error', handleError);
                    }
                };
            } catch (error) {
                console.error('Error initializing Plyr:', error);
                setError('Failed to initialize video player');
                setDebugInfo(`Init error: ${error}`);
            }
        };

        initializePlyr();

        return () => {
            isMounted = false;
            if (playerRef.current) {
                console.log('Destroying Plyr instance for:', videoUrl);
                playerRef.current.destroy();
            }
        };
    }, [videoUrl]);

    return (
        <div className="w-full h-full relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50">
                    <div className="text-sm text-gray-500">Loading video...</div>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-50">
                    <div className="text-sm text-red-500">{error}</div>
                </div>
            )}
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
                playsInline
                preload="auto"
            >
                <source src={videoUrl} type={type} />
                Your browser does not support the video tag.
            </video>
            <div className="mt-2 text-xs text-gray-500">
                <div>Original: {src}</div>
                <div>API URL: {videoUrl}</div>
                <div>Type: {type}</div>
                <div>Status: {debugInfo}</div>
            </div>
        </div>
    );
} 