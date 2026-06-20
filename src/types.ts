export type UserRole = 'admin' | 'client';

export type JobStatus =
  | 'scheduled'
  | 'on_my_way'
  | 'arrived'
  | 'shoot_started'
  | 'shoot_complete'
  | 'editing_media'
  | 'media_delivered'
  | 'job_complete';

export type AppUser = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
};

export type Attachment = {
  uri: string;
  type: 'image' | 'video';
  name?: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: number;
  attachment?: Attachment;
};

export type ChatThread = {
  id: string;
  clientId: string;
  clientName: string;
  lastMessage: string;
  updatedAt: number;
};

export type JobUpdate = {
  id: string;
  jobId: string;
  status: JobStatus;
  note: string;
  createdAt: number;
  attachment?: Attachment;
};

export type LiveLocation = {
  latitude: number;
  longitude: number;
  updatedAt: number;
};

export type Job = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  address: string;
  status: JobStatus;
  scheduledAt: number;
  updates: JobUpdate[];
  liveLocation?: LiveLocation;
};

export type AppData = {
  user: AppUser | null;
  threads: ChatThread[];
  messages: ChatMessage[];
  jobs: Job[];
};

export const jobStatuses: { value: JobStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'on_my_way', label: 'On my way' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'shoot_started', label: 'Shoot started' },
  { value: 'shoot_complete', label: 'Shoot complete' },
  { value: 'editing_media', label: 'Editing media' },
  { value: 'media_delivered', label: 'Media delivered' },
  { value: 'job_complete', label: 'Job complete' },
];

export const locationVisibleStatuses: JobStatus[] = [
  'on_my_way',
  'arrived',
  'shoot_started',
  'shoot_complete',
];
