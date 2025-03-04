import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { constants } from 'fs';
import { statSync } from 'fs';

const accessAsync = promisify(fs.access);
const join = path.join;

function getContentType(filename: string): string {
    // Default to MP4 if we can't determine the file type
    // Most browsers handle MP4 well, and most of our videos are MP4
    if (!filename) {
        return 'video/mp4';
    }

    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
        case 'mp4':
            return 'video/mp4';
        case 'mov':
            return 'video/mp4'; // Change from video/quicktime to video/mp4 for better compatibility
        case 'webm':
            return 'video/webm';
        case 'avi':
            return 'video/x-msvideo';
        case 'mkv':
            return 'video/x-matroska';
        default:
            console.warn(`Unknown video extension: ${ext}, defaulting to video/mp4`);
            return 'video/mp4';
    }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Origin, Authorization',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
            'Access-Control-Max-Age': '86400',
        },
    });
}

// Handle HEAD requests
export async function HEAD(request: NextRequest) {
    console.log('HEAD request received:', {
        url: request.url,
        headers: Object.fromEntries(request.headers.entries())
    });

    try {
        const searchParams = request.nextUrl.searchParams;
        const videoPath = searchParams.get('path');

        if (!videoPath) {
            return new Response(null, { status: 400 });
        }

        let fullPath;
        
        // Check if the path is in the uploads or clips directory
        if (videoPath.startsWith('uploads/')) {
            fullPath = join(process.cwd(), videoPath);
        } else if (videoPath.startsWith('clips/')) {
            fullPath = join(process.cwd(), videoPath);
        } else {
            fullPath = join(process.cwd(), 'uploads', videoPath);
        }
        
        // Prevent directory traversal attempts
        if (!fullPath.startsWith(join(process.cwd(), 'uploads')) && 
            !fullPath.startsWith(join(process.cwd(), 'clips'))) {
            return new Response(null, { status: 403 });
        }

        try {
            await accessAsync(fullPath, constants.R_OK);
        } catch (error) {
            return new Response(null, { status: 404 });
        }

        const stat = statSync(fullPath);
        const contentType = getContentType(videoPath);

        console.log('HEAD response:', {
            path: videoPath,
            size: stat.size,
            type: contentType
        });

        return new Response(null, {
            status: 200,
            headers: {
                'Accept-Ranges': 'bytes',
                'Content-Length': stat.size.toString(),
                'Content-Type': contentType,
                'Last-Modified': stat.mtime.toUTCString(),
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('HEAD error:', error);
        return new Response(null, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    console.log('GET request received:', {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries())
    });

    try {
        const searchParams = request.nextUrl.searchParams;
        const videoPath = searchParams.get('path');

        if (!videoPath) {
            console.error('No video path provided');
            return new Response('Video path is required', { status: 400 });
        }

        // Define the variable as let instead of const so we can reassign it
        let videoFilePath;
        
        // Check if the path is in the uploads directory
        if (videoPath.startsWith('uploads/')) {
            videoFilePath = path.join(process.cwd(), videoPath);
        } else if (videoPath.startsWith('clips/')) {
            videoFilePath = path.join(process.cwd(), videoPath);
        } else {
            videoFilePath = path.join(process.cwd(), 'uploads', videoPath);
        }

        // Prevent directory traversal attempts
        if (!videoFilePath.startsWith(path.join(process.cwd(), 'uploads')) && 
            !videoFilePath.startsWith(path.join(process.cwd(), 'clips'))) {
            console.error('Invalid video path (directory traversal attempt):', videoFilePath);
            return new Response('Invalid video path', { status: 403 });
        }

        try {
            await accessAsync(videoFilePath, fs.constants.R_OK);
        } catch (error) {
            console.error('File access error:', {
                path: videoFilePath,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            
            // Try with sample video before giving up
            const sampleVideoPath = path.join(process.cwd(), 'public', 'sample-video.mp4');
            
            // Create a debug response with information about the paths
            const debugInfo = {
                requestedPath: videoPath,
                resolvedPath: videoFilePath,
                exists: fs.existsSync(videoFilePath),
                cwd: process.cwd(),
                directoryExists: {
                    uploads: fs.existsSync(path.join(process.cwd(), 'uploads')),
                    clips: fs.existsSync(path.join(process.cwd(), 'clips')),
                    publicDir: fs.existsSync(path.join(process.cwd(), 'public'))
                },
                hasReadPermission: {
                    videoFile: false,
                    sampleVideo: false
                }
            };
            
            try {
                // Check if sample video exists and is readable
                await accessAsync(sampleVideoPath, fs.constants.R_OK);
                debugInfo.hasReadPermission.sampleVideo = true;
                
                // If sample video exists, use it
                console.log('Using sample video instead:', sampleVideoPath);
                console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
                videoFilePath = sampleVideoPath;
            } catch (e) {
                // If no sample video either, return 404 with debug info
                console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
                return new Response(`Video file not found or not readable. Debug info: ${JSON.stringify(debugInfo)}`, 
                    { status: 404 });
            }
        }

        const stat = fs.statSync(videoFilePath);
        const fileSize = stat.size;
        // Get the correct content type - if we're using the sample video, derive from that path instead
        const effectivePath = videoFilePath.includes('sample-video.mp4') ? 'sample-video.mp4' : videoPath;
        const contentType = getContentType(effectivePath);

        console.log('Serving video:', {
            path: videoPath,
            fullPath: videoFilePath,
            size: fileSize,
            type: contentType,
            modified: stat.mtime,
            exists: fs.existsSync(videoFilePath),
            isReadable: true,
            extension: videoPath ? videoPath.toLowerCase().split('.').pop() : 'unknown'
        });

        const range = request.headers.get('range');

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1000000, fileSize - 1);
            const chunkSize = end - start + 1;

            if (start >= fileSize) {
                console.error('Range not satisfiable:', { start, fileSize });
                return new Response('Requested range not satisfiable', { status: 416 });
            }

            console.log('Range request:', { start, end, chunkSize });

            const stream = fs.createReadStream(videoFilePath, { start, end });

            return new Response(stream as any, {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize.toString(),
                    'Content-Type': contentType,
                    'Cache-Control': 'no-cache',
                    'Last-Modified': stat.mtime.toUTCString(),
                    'Access-Control-Allow-Origin': '*',
                },
            });
        } else {
            const stream = fs.createReadStream(videoFilePath);

            return new Response(stream as any, {
                status: 200,
                headers: {
                    'Accept-Ranges': 'bytes',
                    'Content-Type': contentType,
                    'Content-Length': fileSize.toString(),
                    'Cache-Control': 'no-cache',
                    'Last-Modified': stat.mtime.toUTCString(),
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
    } catch (error: any) {
        console.error('Error serving video:', {
            error: error.message,
            stack: error.stack,
            code: error.code
        });
        return new Response(`Error serving video: ${error.message}`, { status: 500 });
    }
} 