import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Logging } from '@app/core/services/logging/logging';
import { WorkerImageResponse } from '@app/shared/models/dto/workers/worker-image-response';

/** Uploads and reads the profile photo of a worker. */
@Injectable({
  providedIn: 'root',
})
export class WorkerImage {
  private http = inject(HttpClient);
  private logger = inject(Logging);

  /** Uploads one portrait; the endpoint appends it to the worker's images. */
  uploadImage(workerId: number, file: File): Observable<WorkerImageResponse> {
    this.logger.debug('WorkerImage: Calling POST worker image with id:', workerId);
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<WorkerImageResponse>(`v1/workers/${String(workerId)}/images`, formData);
  }

  /** Replaces every portrait of the worker with the given file. */
  replaceImage(workerId: number, file: File): Observable<WorkerImageResponse[]> {
    this.logger.debug('WorkerImage: Calling PUT worker images with id:', workerId);
    const formData = new FormData();
    formData.append('files', file);
    return this.http.put<WorkerImageResponse[]>(`v1/workers/${String(workerId)}/images`, formData);
  }

  /** Lists the worker's portraits, newest last. */
  getImages(workerId: number): Observable<WorkerImageResponse[]> {
    return this.http.get<WorkerImageResponse[]>(`v1/workers/${String(workerId)}/images`);
  }

  /** Deletes one image (and its size variants) by image ID. */
  deleteImage(imageId: number): Observable<unknown> {
    return this.http.delete<unknown>(`v1/images/${String(imageId)}`);
  }
}
