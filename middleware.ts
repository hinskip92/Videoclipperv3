import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { join } from 'path'
import { stat, createReadStream } from 'fs'
import { promisify } from 'util'

const statAsync = promisify(stat)

function parseRange(rangeHeader: string | null, fileSize: number) {
    if (!rangeHeader) {
        return { start: 0, end: fileSize - 1 }
    }

    const parts = rangeHeader.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

    return {
        start: Math.max(0, start),
        end: Math.min(end, fileSize - 1)
    }
}

export async function middleware(request: NextRequest) {
    // Only handle requests to /uploads/*
    if (!request.nextUrl.pathname.startsWith('/uploads/')) {
        return NextResponse.next()
    }

    console.log('Request URL:', request.nextUrl.toString())
    console.log('Request method:', request.method)
    console.log('Request headers:', Object.fromEntries(request.headers.entries()))

    try {
        // Get the file path
        const filePath = join(process.cwd(), request.nextUrl.pathname.replace(/\//g, '\\'))
        console.log('Attempting to serve:', filePath)

        // Get file stats
        const stats = await statAsync(filePath)
        const fileSize = stats.size
        console.log('File size:', fileSize)

        // Get content type
        const ext = filePath.split('.').pop()?.toLowerCase()
        const contentType = ext === 'mp4' ? 'video/mp4' : 
                          ext === 'mov' ? 'video/quicktime' : 
                          'application/octet-stream'

        // Common headers
        const commonHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000',
            'Content-Type': contentType,
        }

        // Handle OPTIONS request
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, {
                status: 204,
                headers: commonHeaders
            })
        }

        // Parse range header
        const range = parseRange(request.headers.get('range'), fileSize)
        const chunkSize = range.end - range.start + 1
        console.log('Range:', range.start, '-', range.end, '(', chunkSize, 'bytes)')

        if (request.headers.get('range')) {
            console.log('Range request:', range.start, '-', range.end)
            
            // Create read stream for the range
            const stream = createReadStream(filePath, { start: range.start, end: range.end })

            // Convert stream to buffer
            const chunks: Buffer[] = []
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk))
            }
            const buffer = Buffer.concat(chunks)

            return new NextResponse(buffer, {
                status: 206,
                headers: {
                    ...commonHeaders,
                    'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
                    'Content-Length': chunkSize.toString(),
                }
            })
        } else {
            console.log('Full file request')
            
            // For non-range requests, stream the entire file
            const stream = createReadStream(filePath)
            const chunks: Buffer[] = []
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk))
            }
            const buffer = Buffer.concat(chunks)

            return new NextResponse(buffer, {
                headers: {
                    ...commonHeaders,
                    'Content-Length': fileSize.toString(),
                }
            })
        }
    } catch (error) {
        console.error('Error serving video:', error)
        if (error instanceof Error) {
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            })
        }
        return new NextResponse('Error serving video', { status: 500 })
    }
}

// Configure the middleware to only run for /uploads/* paths
export const config = {
    matcher: '/uploads/:path*',
} 