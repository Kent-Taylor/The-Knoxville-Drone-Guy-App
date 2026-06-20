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
  firestoreId?: string;
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

export type RouteDistanceStatus = 'not_checked' | 'checking' | 'ready' | 'failed';

export type Job = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  address: string;
  homeBaseAddress?: string;
  routeDistanceMiles?: number;
  routeTravelTimeMinutes?: number;
  routeDistanceStatus?: RouteDistanceStatus;
  routeDistanceUpdatedAt?: number;
  status: JobStatus;
  scheduledAt: number;
  updates: JobUpdate[];
  liveLocation?: LiveLocation;
};

export type ShootService =
  | 'drone_video'
  | 'drone_photo'
  | 'ground_video'
  | 'ground_photo'
  | 'edit_photos'
  | 'edit_into_video'
  | 'construction'
  | 'actors'
  | 'other';

export type ShootRequestStatus = 'requested' | 'accepted' | 'needs_details';
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'bi_annually' | 'yearly' | 'other';

export type ShootRequest = {
  id: string;
  clientId: string;
  clientName: string;
  requesterName: string;
  title: string;
  requestedWhen: string;
  requestedDate: string;
  projectAddress: string;
  homeBaseAddress?: string;
  routeDistanceMiles?: number;
  routeTravelTimeMinutes?: number;
  routeDistanceStatus?: RouteDistanceStatus;
  routeDistanceUpdatedAt?: number;
  services: ShootService[];
  otherDescription?: string;
  details: string;
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceOther?: string;
  recurrenceEndDate?: string;
  status: ShootRequestStatus;
  createdAt: number;
};

export type AppData = {
  user: AppUser | null;
  threads: ChatThread[];
  messages: ChatMessage[];
  jobs: Job[];
  shootRequests: ShootRequest[];
};

export const jobStatuses: { value: JobStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'on_my_way', label: 'On My Way' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'shoot_started', label: 'Shoot Started' },
  { value: 'shoot_complete', label: 'Shoot Complete' },
  { value: 'editing_media', label: 'Editing Media' },
  { value: 'media_delivered', label: 'Media Delivered' },
  { value: 'job_complete', label: 'Job Complete' },
];

export const locationVisibleStatuses: JobStatus[] = [
  'on_my_way',
  'arrived',
  'shoot_started',
];

export const shootServices: { value: ShootService; label: string }[] = [
  { value: 'drone_video', label: 'Drone Video' },
  { value: 'drone_photo', label: 'Drone Photo' },
  { value: 'ground_video', label: 'Ground Video' },
  { value: 'ground_photo', label: 'Ground Photo' },
  { value: 'edit_photos', label: 'Edit My Photos' },
  { value: 'edit_into_video', label: 'Edit Into a Video' },
  { value: 'construction', label: 'Construction' },
  { value: 'actors', label: 'Actors' },
  { value: 'other', label: 'Other' },
];

export const recurrenceFrequencies: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'bi_annually', label: 'Bi Annually' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'other', label: 'Other' },
];
