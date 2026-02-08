import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getOptimizedImageUrl(url: string, width: number = 1080) {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  // If it already has transformations, this might be tricky, 
  // but usually simple upload URLs look like .../upload/v123...
  // We insert our transformation after /upload/
  return url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`);
}
