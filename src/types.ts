export type UserRole = 'admin' | 'client';
export type NotificationPreference = 'all' | 'messages' | 'progress_updates';

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
  notificationPreference?: NotificationPreference;
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
  reference?: {
    type: 'shoot_request';
    id: string;
    title: string;
  };
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
  clientEmail?: string;
  clientPhone?: string;
  title: string;
  address: string;
  projectClaimCode?: string;
  claimStatus?: 'unclaimed' | 'claimed';
  claimedByUid?: string;
  claimedAt?: number;
  homeBaseAddress?: string;
  routeDistanceMiles?: number;
  routeTravelTimeMinutes?: number;
  routeDistanceStatus?: RouteDistanceStatus;
  routeDistanceUpdatedAt?: number;
  status: JobStatus;
  scheduledAt: number;
  services?: ShootService[];
  otherDescription?: string;
  videoEditFormat?: VideoEditFormat;
  videoEditOther?: string;
  finishedVideoLength?: FinishedVideoLength;
  finishedVideoLengthOther?: string;
  updates: JobUpdate[];
  liveLocation?: LiveLocation;
};

export type ShootService =
  | 'drone_video'
  | 'indoor_drone_video'
  | 'drone_photo'
  | 'ground_video'
  | 'ground_photo'
  | 'edit_photos'
  | 'edit_into_video'
  | '360_tour'
  | 'construction'
  | 'actors'
  | 'other';

export type ShootRequestStatus = 'requested' | 'accepted' | 'needs_details';
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'bi_annually' | 'yearly' | 'other';
export type VideoEditFormat = 'social_media_reel' | 'long_format' | 'other';
export type FinishedVideoLength =
  | '15_30_seconds'
  | '30_60_seconds'
  | '2_3_minutes'
  | '4_6_minutes'
  | '8_10_minutes'
  | 'other';

export type ShootRequest = {
  id: string;
  clientId: string;
  clientName: string;
  requesterName: string;
  title: string;
  requestedWhen: string;
  requestedDate: string;
  requestedTime?: string;
  projectAddress: string;
  homeBaseAddress?: string;
  routeDistanceMiles?: number;
  routeTravelTimeMinutes?: number;
  routeDistanceStatus?: RouteDistanceStatus;
  routeDistanceUpdatedAt?: number;
  services: ShootService[];
  otherDescription?: string;
  videoEditFormat?: VideoEditFormat;
  videoEditOther?: string;
  finishedVideoLength?: FinishedVideoLength;
  finishedVideoLengthOther?: string;
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
  clients: AppUser[];
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
  { value: 'job_complete', label: 'Job Completed' },
];

export const locationVisibleStatuses: JobStatus[] = [
  'on_my_way',
  'arrived',
  'shoot_started',
];

export const shootServices: { value: ShootService; label: string }[] = [
  { value: 'drone_video', label: 'Outdoor Drone Video' },
  { value: 'indoor_drone_video', label: 'Indoor Drone Video' },
  { value: 'drone_photo', label: 'Drone Photo' },
  { value: 'ground_video', label: 'Ground Video' },
  { value: 'ground_photo', label: 'Ground Photo' },
  { value: 'edit_photos', label: 'Edit My Photos' },
  { value: 'edit_into_video', label: 'Edit Into a Video' },
  { value: '360_tour', label: '360° Tour' },
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

export const videoEditFormats: { value: VideoEditFormat; label: string }[] = [
  { value: 'social_media_reel', label: 'Social Media Reel' },
  { value: 'long_format', label: 'Long Format' },
  { value: 'other', label: 'Other' },
];

export const finishedVideoLengths: { value: FinishedVideoLength; label: string }[] = [
  { value: '15_30_seconds', label: '15-30 Seconds' },
  { value: '30_60_seconds', label: '30-60 Seconds' },
  { value: '2_3_minutes', label: '2-3 Minutes' },
  { value: '4_6_minutes', label: '4-6 Minutes' },
  { value: '8_10_minutes', label: '8-10 Minutes' },
  { value: 'other', label: 'Other' },
];
