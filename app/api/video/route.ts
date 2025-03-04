import { NextRequest } from 'next/server';
import { createReadStream, statSync, access, constants } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const accessAsync = promisify(access);

function getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
        case 'mp4':
            return 'video/mp4';
        case 'mov':
            return 'video/quicktime';
        case 'webm':
            return 'video/webm';
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
            'Access-Control-Allow-Headers': 'Range, Content-Type',
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

        const fullPath = join(process.cwd(), 'uploads', videoPath);
        
        if (!fullPath.startsWith(join(process.cwd(), 'uploads'))) {
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

        const fullPath = join(process.cwd(), 'uploads', videoPath);

        if (!fullPath.startsWith(join(process.cwd(), 'uploads'))) {
            console.error('Invalid video path (directory traversal attempt):', fullPath);
            return new Response('Invalid video path', { status: 403 });
        }

        try {
            await accessAsync(fullPath, constants.R_OK);
        } catch (error) {
            console.error('File access error:', {
                path: fullPath,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return new Response('Video file not found or not readable', { status: 404 });
        }

        const stat = statSync(fullPath);
        const fileSize = stat.size;
        const contentType = getContentType(videoPath);

        console.log('Serving video:', {
            path: videoPath,
            fullPath,
            size: fileSize,
            type: contentType,
            modified: stat.mtime
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

            const stream = createReadStream(fullPath, { start, end });

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
            const stream = createReadStream(fullPath);

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