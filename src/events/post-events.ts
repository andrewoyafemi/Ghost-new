import { EventEmitter } from "events";
import { Post } from "../models";

// Type definitions for post events
export interface PostEventPayload {
  post: Post;
}

// Event types
export enum PostEventType {
  CREATED = "post:created",
  UPDATED = "post:updated",
  SCHEDULED = "post:scheduled",
  PUBLISHED = "post:published",
  DELETED = "post:deleted",
}

// Create a global event emitter for post events
const postEventEmitter = new EventEmitter();

// Set a higher limit for listeners to avoid memory leak warnings
postEventEmitter.setMaxListeners(20);

export { postEventEmitter };
