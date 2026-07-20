import { TimeBucket } from './time-bucket';
export interface Period {
  bucket: TimeBucket;
  from: string;
  to: string;
  keys: string[];
}