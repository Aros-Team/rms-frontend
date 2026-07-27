import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@environments/environment';
import { Logging } from '@app/core/services/logging/logging';

export const urlInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(Logging);

  // Skip if the URL is already absolute (contains http:// or https://)
  if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
    logger.http(`Skipping URL transformation for absolute URL: ${req.url}`);
    return next(req);
  }

  // Transform relative URLs to absolute URLs using environment API URL
  const absoluteUrl = transformUrl(req.url);
  logger.http(`Transforming URL: ${req.url} -> ${absoluteUrl}`);

  const newReq = req.clone({
    url: absoluteUrl
  });

  return next(newReq);
};

function transformUrl(url: string): string {
  // If the URL already starts with the API URL, return as is
  if (url.startsWith(environment.apiUrl)) {
    return url;
  }

  // If the URL starts with /, remove it to avoid double slashes
  const cleanUrl = url.startsWith('/') ? url.substring(1) : url;

  // Combine the API URL with the clean URL
  return `${environment.apiUrl}/${cleanUrl}`;
}