'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/utils';

export function Navigation() {
    const pathname = usePathname();

    return (
        <nav className="border-b">
            <div className="container mx-auto px-4">
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center">
                        <Link 
                            href="/" 
                            className="text-xl font-bold"
                        >
                            Video Clipper
                        </Link>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Link
                            href="/"
                            className={cn(
                                "px-3 py-2 rounded-md text-sm font-medium",
                                pathname === "/" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                            )}
                        >
                            Upload
                        </Link>
                        <Link
                            href="/clips"
                            className={cn(
                                "px-3 py-2 rounded-md text-sm font-medium",
                                pathname === "/clips" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                            )}
                        >
                            Clips
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
} 