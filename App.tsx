import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, isFirebaseConfigured, storage } from './src/firebase';
import {
  AppData,
  AppUser,
  Attachment,
  ChatMessage,
  ChatThread,
  Job,
  JobStatus,
  JobUpdate,
  FinishedVideoLength,
  NotificationPreference,
  RecurrenceFrequency,
  ShootRequest,
  ShootService,
  VideoEditFormat,
  finishedVideoLengths,
  jobStatuses,
  locationVisibleStatuses,
  recurrenceFrequencies,
  shootServices,
  videoEditFormats,
} from './src/types';

const websiteUrl = 'https://www.theknoxvilledroneguy.com';
const HOME_BASE_ADDRESS = '742 Whitesburg Dr, Knoxville, TN 37918';
const addressSuggestions = [
  '742 Whitesburg Dr, Knoxville, TN 37918',
  '1234 Keller Bend Rd, Knoxville, TN 37922',
  'Market Square, Knoxville, TN 37902',
  'Worlds Fair Park Dr, Knoxville, TN 37916',
  'Neyland Dr, Knoxville, TN 37916',
  'Gay St, Knoxville, TN 37902',
  'Hardin Valley Rd, Knoxville, TN 37932',
  'Kingston Pike, Knoxville, TN 37919',
  'Chapman Hwy, Knoxville, TN 37920',
  'Emory Rd, Powell, TN 37849',
];
const routeCache = new Map<string, DrivingRouteResult | null>();
const adminUser: AppUser = {
  uid: 'admin-demo',
  email: 'kent@theknoxvilledroneguy.com',
  displayName: 'The Knoxville Drone Guy',
  role: 'admin',
};
const clientUser: AppUser = {
  uid: 'client-demo',
  email: 'client@example.com',
  displayName: 'Demo Client',
  role: 'client',
  notificationPreference: 'all',
};

const now = Date.now();

const demoThread: ChatThread = {
  id: 'thread-demo-client',
  clientId: clientUser.uid,
  clientName: clientUser.displayName,
  lastMessage: 'Thanks, I will keep you updated here.',
  updatedAt: now - 1000 * 60 * 12,
};

const demoJob: Job = {
  id: 'job-demo-home-tour',
  clientId: clientUser.uid,
  clientName: clientUser.displayName,
  title: 'Residential drone photo and video shoot',
  address: 'Knoxville, TN',
  homeBaseAddress: HOME_BASE_ADDRESS,
  routeDistanceStatus: 'not_checked',
  status: 'scheduled',
  scheduledAt: now + 1000 * 60 * 60 * 24,
  liveLocation: {
    latitude: 35.9606,
    longitude: -83.9207,
    updatedAt: now - 1000 * 60 * 4,
  },
  updates: [
    {
      id: 'update-1',
      jobId: 'job-demo-home-tour',
      status: 'scheduled',
      note: 'Your shoot is scheduled. You will get notifications as the job moves forward.',
      createdAt: now - 1000 * 60 * 60,
    },
  ],
};

const demoSecondJob: Job = {
  id: 'job-demo-commercial-lot',
  clientId: clientUser.uid,
  clientName: clientUser.displayName,
  title: 'Commercial property overview',
  address: 'West Knoxville, TN',
  homeBaseAddress: HOME_BASE_ADDRESS,
  routeDistanceStatus: 'not_checked',
  status: 'editing_media',
  scheduledAt: now + 1000 * 60 * 60 * 5,
  updates: [
    {
      id: 'update-2',
      jobId: 'job-demo-commercial-lot',
      status: 'editing_media',
      note: 'Shoot is complete and media editing is underway.',
      createdAt: now - 1000 * 60 * 20,
    },
  ],
};

const demoShootRequest: ShootRequest = {
  id: 'request-demo-1',
  clientId: clientUser.uid,
  clientName: clientUser.displayName,
  requesterName: clientUser.displayName,
  title: 'Lake house listing shoot',
  requestedWhen: 'Tomorrow afternoon',
  requestedDate: new Date(now + 1000 * 60 * 60 * 24).toISOString(),
  projectAddress: '1234 Keller Bend Rd, Knoxville, TN 37922',
  homeBaseAddress: HOME_BASE_ADDRESS,
  routeDistanceStatus: 'not_checked',
  services: ['drone_video', 'drone_photo', 'ground_photo', 'edit_into_video'],
  details: 'Need exterior aerials, a few ground photos, and a short vertical reel if weather cooperates.',
  isRecurring: false,
  status: 'requested',
  createdAt: now - 1000 * 60 * 7,
};

const initialData: AppData = {
  user: clientUser,
  threads: [demoThread],
  messages: [
    {
      id: 'message-1',
      threadId: demoThread.id,
      senderId: adminUser.uid,
      senderName: adminUser.displayName,
      body: 'Thanks, I will keep you updated here.',
      createdAt: demoThread.updatedAt,
    },
  ],
  jobs: [demoJob, demoSecondJob],
  shootRequests: [demoShootRequest],
};

type TabKey = 'website' | 'chat' | 'jobs' | 'notifications' | 'account';
type ShootRequestDraft = Omit<ShootRequest, 'id' | 'clientId' | 'clientName' | 'status' | 'createdAt'>;
type ChatReference = NonNullable<ChatMessage['reference']>;
type ShootRequestEdit = Pick<ShootRequest, 'title' | 'requestedWhen' | 'projectAddress' | 'details'>;
type DrivingRouteResult = {
  distanceMiles: number;
  travelTimeMinutes: number;
};
type Coordinate = {
  lat: number;
  lon: number;
};

const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'website', label: 'Website', icon: 'globe-outline' },
  { key: 'chat', label: 'Chat', icon: 'chatbubble-ellipses-outline' },
  { key: 'jobs', label: 'Projects', icon: 'briefcase-outline' },
  { key: 'notifications', label: 'Alerts', icon: 'notifications-outline' },
  { key: 'account', label: 'Account', icon: 'person-circle-outline' },
];

const notificationPreferenceOptions: {
  value: NotificationPreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'all', label: 'All', icon: 'notifications-outline' },
  { value: 'messages', label: 'Messages', icon: 'chatbubble-ellipses-outline' },
  { value: 'progress_updates', label: 'Progress Updates', icon: 'briefcase-outline' },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('website');
  const [data, setData] = useState<AppData>(initialData);
  const [selectedThreadId, setSelectedThreadId] = useState(demoThread.id);
  const [selectedJobId, setSelectedJobId] = useState(demoJob.id);
  const [selectedMedia, setSelectedMedia] = useState<Attachment | null>(null);
  const [chatViewedAtByUser, setChatViewedAtByUser] = useState<Record<string, number>>({});
  const [seenAlertKeysByUser, setSeenAlertKeysByUser] = useState<Record<string, string[]>>({});
  const [pendingChatReference, setPendingChatReference] = useState<ChatReference | undefined>();
  const [focusedRequestId, setFocusedRequestId] = useState<string | undefined>();
  const user = data.user;
  const isAdmin = user?.role === 'admin';

  const visibleJobs = useMemo(() => {
    if (!user) return [];
    return isAdmin ? data.jobs : data.jobs.filter((job) => job.clientId === user.uid);
  }, [data.jobs, isAdmin, user]);

  const visibleShootRequests = useMemo(() => {
    if (!user) return [];
    return isAdmin ? data.shootRequests : data.shootRequests.filter((request) => request.clientId === user.uid);
  }, [data.shootRequests, isAdmin, user]);

  const visibleThreads = useMemo(() => {
    if (!user) return [];
    return isAdmin
      ? data.threads
      : data.threads.filter((thread) => thread.clientId === user.uid);
  }, [data.threads, isAdmin, user]);

  const selectedThread = visibleThreads.find((thread) => thread.id === selectedThreadId) ?? visibleThreads[0];
  const selectedJob = visibleJobs.find((job) => job.id === selectedJobId) ?? visibleJobs[0];
  const unreadMessageCount = useMemo(() => {
    if (!user) return 0;
    const lastViewedAt = chatViewedAtByUser[user.uid] ?? 0;
    return data.messages.filter((message) => message.senderId !== user.uid && message.createdAt > lastViewedAt).length;
  }, [chatViewedAtByUser, data.messages, user]);
  const actionNeededRequests = useMemo(() => {
    if (!user) return [];
    return visibleShootRequests.filter((request) =>
      isAdmin ? request.status === 'requested' : request.status === 'accepted' || request.status === 'needs_details',
    );
  }, [isAdmin, user, visibleShootRequests]);
  const alertKeys = useMemo(
    () => actionNeededRequests.map((request) => `${request.status}:${request.id}`),
    [actionNeededRequests],
  );
  const notificationBadgeCount = useMemo(() => {
    if (!user) return 0;
    const seenKeys = new Set(seenAlertKeysByUser[user.uid] ?? []);
    return alertKeys.filter((key) => !seenKeys.has(key)).length;
  }, [alertKeys, seenAlertKeysByUser, user]);

  const markChatViewed = () => {
    if (!user) return;
    setChatViewedAtByUser((current) => ({ ...current, [user.uid]: Date.now() }));
  };

  const markAlertsViewed = () => {
    if (!user) return;
    setSeenAlertKeysByUser((current) => {
      const mergedKeys = new Set([...(current[user.uid] ?? []), ...alertKeys]);
      return { ...current, [user.uid]: [...mergedKeys] };
    });
  };

  useEffect(() => {
    if (activeTab === 'chat') markChatViewed();
  }, [activeTab, selectedThreadId, data.messages.length, user?.uid]);

  useEffect(() => {
    if (activeTab === 'notifications') markAlertsViewed();
  }, [activeTab, alertKeys.join('|'), user?.uid]);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) return undefined;
    const firestore = db;
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setData((current) => ({ ...current, user: null, threads: [], messages: [], jobs: [], shootRequests: [] }));
        return;
      }

      const token = await firebaseUser.getIdTokenResult();
      const role: AppUser['role'] = token.claims.admin === true ? 'admin' : 'client';
      const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
      const appUser: AppUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        displayName:
          userDoc.data()?.displayName ??
          firebaseUser.displayName ??
          firebaseUser.email?.split('@')[0] ??
          'Client',
        role,
        notificationPreference: userDoc.data()?.notificationPreference ?? 'all',
      };

      await setDoc(
        doc(firestore, 'users', firebaseUser.uid),
        {
          email: appUser.email,
          displayName: appUser.displayName,
          role,
          notificationPreference: appUser.notificationPreference,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      setData((current) => ({ ...current, user: appUser }));
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !user) return undefined;
    const threadsQuery =
      user.role === 'admin'
        ? query(collection(db, 'chatThreads'), orderBy('updatedAt', 'desc'))
        : query(collection(db, 'chatThreads'), where('clientId', '==', user.uid), orderBy('updatedAt', 'desc'));

    return onSnapshot(threadsQuery, (snapshot) => {
      const threads = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ChatThread);
      setData((current) => ({ ...current, threads }));
      if (threads[0]) setSelectedThreadId((current) => current || threads[0].id);
    });
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !selectedJob) return undefined;
    const firestore = db;
    const updatesQuery = query(
      collection(firestore, 'jobs', selectedJob.id, 'updates'),
      orderBy('createdAt', 'desc'),
    );

    return onSnapshot(updatesQuery, (snapshot) => {
      const updates = snapshot.docs.map((item) => {
        const data = item.data() as JobUpdate;
        return {
          ...data,
          id: data.id ?? item.id,
          firestoreId: item.id,
        };
      });
      setData((current) => ({
        ...current,
        jobs: current.jobs.map((job) => (job.id === selectedJob.id ? { ...job, updates } : job)),
      }));
    });
  }, [selectedJob?.id]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !selectedThread) return undefined;
    const firestore = db;
    const messagesQuery = query(
      collection(firestore, 'chatThreads', selectedThread.id, 'messages'),
      orderBy('createdAt', 'asc'),
    );

    return onSnapshot(messagesQuery, (snapshot) => {
      const threadMessages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ChatMessage);
      setData((current) => ({
        ...current,
        messages: [
          ...current.messages.filter((message) => message.threadId !== selectedThread.id),
          ...threadMessages,
        ],
      }));
    });
  }, [selectedThread?.id]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !user) return undefined;
    const firestore = db;
    const jobsQuery =
      user.role === 'admin'
        ? query(collection(firestore, 'jobs'), orderBy('scheduledAt', 'desc'))
        : query(collection(firestore, 'jobs'), where('clientId', '==', user.uid), orderBy('scheduledAt', 'desc'));

    return onSnapshot(jobsQuery, (snapshot) => {
      const jobs = snapshot.docs.map((item) => ({ id: item.id, updates: [], ...item.data() } as unknown as Job));
      setData((current) => ({ ...current, jobs }));
      if (jobs[0]) setSelectedJobId((current) => current || jobs[0].id);
    });
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !user) return undefined;
    const firestore = db;
    const requestsQuery =
      user.role === 'admin'
        ? query(collection(firestore, 'shootRequests'), orderBy('createdAt', 'desc'))
        : query(collection(firestore, 'shootRequests'), where('clientId', '==', user.uid), orderBy('createdAt', 'desc'));

    return onSnapshot(requestsQuery, (snapshot) => {
      const shootRequests = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ShootRequest));
      setData((current) => ({ ...current, shootRequests }));
    });
  }, [user]);

  const switchRole = (role: AppUser['role']) => {
    setData((current) => ({ ...current, user: role === 'admin' ? adminUser : clientUser }));
    setActiveTab('jobs');
  };

  const sendMessage = async (body: string, attachment?: Attachment, reference = pendingChatReference) => {
    if (!selectedThread || !user) return;
    const trimmed = body.trim();
    if (!trimmed && !attachment) return;
    const savedAttachment =
      isFirebaseConfigured && attachment ? await uploadAttachment(`chat/${selectedThread.id}`, attachment) : attachment;
    const message: ChatMessage = {
      id: `message-${Date.now()}`,
      threadId: selectedThread.id,
      senderId: user.uid,
      senderName: user.displayName,
      body: trimmed || (savedAttachment?.type === 'video' ? 'Sent a video.' : 'Sent a photo.'),
      attachment: savedAttachment,
      reference,
      createdAt: Date.now(),
    };
    const shouldMarkRequestNeedsDetails =
      reference?.type === 'shoot_request' &&
      isAdmin &&
      data.shootRequests.find((request) => request.id === reference.id)?.status !== 'accepted';
    if (isFirebaseConfigured && db) {
      await addDoc(collection(db, 'chatThreads', selectedThread.id, 'messages'), message);
      await updateDoc(doc(db, 'chatThreads', selectedThread.id), {
        lastMessage: message.body,
        updatedAt: message.createdAt,
      });
      if (shouldMarkRequestNeedsDetails) {
        await updateDoc(doc(db, 'shootRequests', reference.id), { status: 'needs_details' });
      }
    }
    setData((current) => ({
      ...current,
      shootRequests: shouldMarkRequestNeedsDetails
        ? current.shootRequests.map((item) => (item.id === reference.id ? { ...item, status: 'needs_details' } : item))
        : current.shootRequests,
      messages: [...current.messages, message],
      threads: current.threads.map((thread) =>
        thread.id === selectedThread.id
          ? { ...thread, lastMessage: message.body, updatedAt: message.createdAt }
          : thread,
      ),
    }));
    if (reference?.id === pendingChatReference?.id) setPendingChatReference(undefined);
    scheduleLocalNotification('New chat message', `${message.senderName}: ${message.body}`);
  };

  const updateJobStatus = async (job: Job, status: JobStatus, note?: string, attachment?: Attachment) => {
    let liveLocation = job.liveLocation;
    if (status === 'on_my_way') {
      liveLocation = await getCurrentLocation(job.liveLocation);
    }
    if (status === 'shoot_complete' || status === 'job_complete') {
      liveLocation = undefined;
    }
    const update = {
      id: `update-${Date.now()}`,
      jobId: job.id,
      status,
      note: note?.trim() || `Status changed to ${statusLabel(status)}.`,
      createdAt: Date.now(),
      attachment: isFirebaseConfigured && attachment ? await uploadAttachment(`jobs/${job.id}`, attachment) : attachment,
    };
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'jobs', job.id), {
        status,
        liveLocation: liveLocation ?? null,
      });
      await setDoc(doc(db, 'jobs', job.id, 'updates', update.id), update);
    }
    setData((current) => ({
      ...current,
      jobs: current.jobs.map((item) =>
        item.id === job.id
          ? {
              ...item,
              status,
              liveLocation,
              updates: [update, ...item.updates],
            }
          : item,
      ),
    }));
    scheduleLocalNotification('Project status updated', `${job.clientName} would be notified: ${statusLabel(status)}.`);
  };

  const updateJobTitle = async (job: Job, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'jobs', job.id), { title: trimmed });
    }
    setData((current) => ({
      ...current,
      jobs: current.jobs.map((item) => (item.id === job.id ? { ...item, title: trimmed } : item)),
    }));
  };

  const updateAccountSettings = async ({
    displayName,
    email,
    newPassword,
    notificationPreference,
  }: {
    displayName: string;
    email: string;
    newPassword?: string;
    notificationPreference: NotificationPreference;
  }) => {
    if (!user) return;
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) throw new Error('Name and email are required.');

    if (isFirebaseConfigured && auth?.currentUser && db) {
      if (auth.currentUser.displayName !== trimmedName) {
        await updateProfile(auth.currentUser, { displayName: trimmedName });
      }
      if (auth.currentUser.email !== trimmedEmail) {
        await updateEmail(auth.currentUser, trimmedEmail);
      }
      if (newPassword?.trim()) {
        const passwordProblem = getPasswordProblem(newPassword);
        if (passwordProblem) throw new Error(passwordProblem);
        await updatePassword(auth.currentUser, newPassword);
      }
      await setDoc(
        doc(db, 'users', user.uid),
        {
          displayName: trimmedName,
          email: trimmedEmail,
          notificationPreference,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    }

    setData((current) => ({
      ...current,
      user: current.user
        ? {
            ...current.user,
            displayName: trimmedName,
            email: trimmedEmail,
            notificationPreference,
          }
        : current.user,
    }));
  };

  const editJobUpdate = async (
    job: Job,
    updateId: string,
    changes: Pick<JobUpdate, 'status' | 'note' | 'createdAt'>,
  ) => {
    const editedUpdates = job.updates
      .map((update) => (update.id === updateId ? { ...update, ...changes } : update))
      .sort((first, second) => second.createdAt - first.createdAt);
    const currentStatus = editedUpdates[0]?.status ?? job.status;

    if (isFirebaseConfigured && db) {
      const targetUpdate = job.updates.find((update) => update.id === updateId);
      const updateDocId = targetUpdate?.firestoreId ?? updateId;
      await updateDoc(doc(db, 'jobs', job.id, 'updates', updateDocId), changes);
      await updateDoc(doc(db, 'jobs', job.id), { status: currentStatus });
    }

    setData((current) => ({
      ...current,
      jobs: current.jobs.map((item) =>
        item.id === job.id
          ? {
              ...item,
              status: currentStatus,
              updates: editedUpdates,
            }
          : item,
      ),
    }));
  };

  const submitShootRequest = async (request: ShootRequestDraft) => {
    if (!user) return;
    const route = await calculateDrivingRoute(HOME_BASE_ADDRESS, request.projectAddress);
    const shootRequest: ShootRequest = {
      ...request,
      id: `request-${Date.now()}`,
      clientId: user.uid,
      clientName: user.displayName,
      homeBaseAddress: HOME_BASE_ADDRESS,
      routeDistanceMiles: route?.distanceMiles,
      routeTravelTimeMinutes: route?.travelTimeMinutes,
      routeDistanceStatus: route ? 'ready' : 'failed',
      routeDistanceUpdatedAt: Date.now(),
      status: 'requested',
      createdAt: Date.now(),
    };
    if (isFirebaseConfigured && db) {
      await addDoc(collection(db, 'shootRequests'), shootRequest);
    }
    setData((current) => ({
      ...current,
      shootRequests: [shootRequest, ...current.shootRequests],
    }));
    scheduleLocalNotification('New shoot request', 'Admin would receive this new project request.');
  };

  const acceptShootRequest = async (request: ShootRequest) => {
    const jobId = `job-${Date.now()}`;
    const acceptedJob: Job = {
      id: jobId,
      clientId: request.clientId,
      clientName: request.clientName,
      title: request.title,
      address: request.projectAddress,
      homeBaseAddress: request.homeBaseAddress ?? HOME_BASE_ADDRESS,
      routeDistanceMiles: request.routeDistanceMiles,
      routeTravelTimeMinutes: request.routeTravelTimeMinutes,
      routeDistanceStatus: request.routeDistanceStatus ?? 'not_checked',
      routeDistanceUpdatedAt: request.routeDistanceUpdatedAt,
      status: 'scheduled',
      scheduledAt: Date.now(),
      updates: [
        {
          id: `update-${Date.now()}`,
          jobId,
          status: 'scheduled',
          note: `Accepted shoot request for ${request.requestedWhen}.`,
          createdAt: Date.now(),
        },
      ],
    };
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'shootRequests', request.id), { status: 'accepted' });
      await setDoc(doc(db, 'jobs', acceptedJob.id), { ...acceptedJob, updates: [] });
      await setDoc(doc(db, 'jobs', acceptedJob.id, 'updates', acceptedJob.updates[0].id), acceptedJob.updates[0]);
    }
    setData((current) => ({
      ...current,
      shootRequests: current.shootRequests.map((item) => (item.id === request.id ? { ...item, status: 'accepted' } : item)),
      jobs: [acceptedJob, ...current.jobs],
    }));
    setSelectedJobId(acceptedJob.id);
    scheduleLocalNotification('Shoot accepted', `${request.clientName} would be notified that the project was accepted.`);
  };

  const updateShootRequest = async (request: ShootRequest, changes: ShootRequestEdit) => {
    const trimmedChanges = {
      title: changes.title.trim(),
      requestedWhen: changes.requestedWhen.trim(),
      projectAddress: changes.projectAddress.trim(),
      details: changes.details.trim(),
    };
    if (!trimmedChanges.title || !trimmedChanges.requestedWhen || !trimmedChanges.projectAddress || !trimmedChanges.details) {
      Alert.alert('Request not saved', 'Project name, when, address, and description are required.');
      return;
    }
    const addressChanged = trimmedChanges.projectAddress !== request.projectAddress;
    const route = addressChanged ? await calculateDrivingRoute(HOME_BASE_ADDRESS, trimmedChanges.projectAddress) : null;
    const updatedFields = {
      ...trimmedChanges,
      ...(addressChanged
        ? {
            routeDistanceMiles: route?.distanceMiles,
            routeTravelTimeMinutes: route?.travelTimeMinutes,
            routeDistanceStatus: route ? 'ready' as const : 'failed' as const,
            routeDistanceUpdatedAt: Date.now(),
          }
        : {}),
    };
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'shootRequests', request.id), updatedFields);
    }
    setData((current) => ({
      ...current,
      shootRequests: current.shootRequests.map((item) => (item.id === request.id ? { ...item, ...updatedFields } : item)),
    }));
  };

  const requestShootDetails = async (request: ShootRequest) => {
    const existingThread = data.threads.find((thread) => thread.clientId === request.clientId);
    const thread =
      existingThread ??
      ({
        id: `thread-${request.clientId}`,
        clientId: request.clientId,
        clientName: request.clientName,
        lastMessage: '',
        updatedAt: Date.now(),
      } satisfies ChatThread);
    if (!existingThread) {
      if (isFirebaseConfigured && db) {
        await setDoc(doc(db, 'chatThreads', thread.id), thread);
      }
      setData((current) => ({ ...current, threads: [thread, ...current.threads] }));
    }
    setPendingChatReference({ type: 'shoot_request', id: request.id, title: request.title });
    setSelectedThreadId(thread.id);
    setActiveTab('chat');
  };

  const openShootRequestReference = (requestId: string) => {
    setFocusedRequestId(requestId);
    setActiveTab('jobs');
  };

  const renderContent = () => {
    if (!user) return <AccountScreen onUpdateSettings={updateAccountSettings} user={user} switchRole={switchRole} />;
    if (activeTab === 'website') return <WebsiteScreen />;
    if (activeTab === 'chat') {
      return (
        <ChatScreen
          isAdmin={isAdmin}
          messages={data.messages.filter((message) => message.threadId === selectedThread?.id)}
          onClearReference={() => setPendingChatReference(undefined)}
          onOpenMedia={setSelectedMedia}
          onOpenReference={openShootRequestReference}
          onSend={sendMessage}
          pendingReference={pendingChatReference}
          selectedThread={selectedThread}
          setSelectedThreadId={setSelectedThreadId}
          threads={visibleThreads}
          user={user}
        />
      );
    }
    if (activeTab === 'jobs') {
      return (
        <JobsScreen
          isAdmin={isAdmin}
          jobs={visibleJobs}
          onAcceptShootRequest={acceptShootRequest}
          onOpenMedia={setSelectedMedia}
          onRequestShootDetails={requestShootDetails}
          onSubmitShootRequest={submitShootRequest}
          onEditUpdate={editJobUpdate}
          onUpdateShootRequest={updateShootRequest}
          onUpdateStatus={updateJobStatus}
          onUpdateTitle={updateJobTitle}
          focusedRequestId={focusedRequestId}
          selectedJob={selectedJob}
          setSelectedJobId={setSelectedJobId}
          shootRequests={visibleShootRequests}
          user={user}
        />
      );
    }
    if (activeTab === 'notifications') {
      return (
        <NotificationsScreen
          isAdmin={isAdmin}
          onOpenProjects={() => setActiveTab('jobs')}
          pendingRequests={actionNeededRequests}
          user={user}
        />
      );
    }
    return <AccountScreen onUpdateSettings={updateAccountSettings} user={user} switchRole={switchRole} />;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>App Store v1</Text>
          <Text style={styles.title}>The Knoxville Drone Guy</Text>
        </View>
        <View style={[styles.rolePill, isAdmin ? styles.adminPill : styles.clientPill]}>
          <Text style={styles.roleText}>{isAdmin ? 'Admin' : 'Client'}</Text>
        </View>
      </View>
      {!isFirebaseConfigured && (
        <View style={styles.notice}>
          <Ionicons name="construct-outline" size={22} color="#0f766e" />
          <Text style={styles.noticeText}>Demo mode: add Firebase env values to connect live auth, chat, projects, media, and notifications.</Text>
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {renderContent()}
      </KeyboardAvoidingView>
      <MediaViewer attachment={selectedMedia} onClose={() => setSelectedMedia(null)} />
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={styles.tabButton}
              onPress={() => {
                if (tab.key === 'chat') markChatViewed();
                if (tab.key === 'notifications') markAlertsViewed();
                setActiveTab(tab.key);
              }}
            >
              <View style={styles.tabIconWrap}>
                <Ionicons name={tab.icon} size={22} color={active ? '#0f766e' : '#687076'} />
                {tab.key === 'chat' && unreadMessageCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{unreadMessageCount > 99 ? '99+' : unreadMessageCount}</Text>
                  </View>
                )}
                {tab.key === 'notifications' && notificationBadgeCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function WebsiteScreen() {
  return (
    <View style={styles.webContainer}>
      <WebView
        source={{ uri: websiteUrl }}
        startInLoadingState
        style={styles.webview}
        renderError={() => (
          <View style={styles.emptyState}>
            <Text style={styles.sectionTitle}>Website unavailable</Text>
            <Text style={styles.muted}>Open the site in Safari or try again when the connection is available.</Text>
            <PrimaryButton label="Open Website" icon="open-outline" onPress={() => Linking.openURL(websiteUrl)} />
          </View>
        )}
      />
    </View>
  );
}

function ChatScreen({
  isAdmin,
  messages,
  onClearReference,
  onOpenMedia,
  onOpenReference,
  onSend,
  pendingReference,
  selectedThread,
  setSelectedThreadId,
  threads,
  user,
}: {
  isAdmin: boolean;
  messages: ChatMessage[];
  onClearReference: () => void;
  onOpenMedia: (attachment: Attachment) => void;
  onOpenReference: (requestId: string) => void;
  onSend: (body: string, attachment?: Attachment, reference?: ChatReference) => Promise<void>;
  pendingReference?: ChatReference;
  selectedThread?: ChatThread;
  setSelectedThreadId: (threadId: string) => void;
  threads: ChatThread[];
  user: AppUser;
}) {
  const [body, setBody] = useState('');

  const attachFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Camera access is needed to attach photos or videos to chat.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      await onSend(body, assetToAttachment(result.assets[0]), pendingReference);
      setBody('');
      Keyboard.dismiss();
    }
  };

  const attachFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo library permission needed', 'Photo library access is needed to attach existing media to chat.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      await onSend(body, assetToAttachment(result.assets[0]), pendingReference);
      setBody('');
      Keyboard.dismiss();
    }
  };

  if (!selectedThread) {
    return <EmptyState title="No chats yet" body="Client conversations will appear here after an invite or website chat." />;
  }

  return (
    <View style={styles.screen}>
      {isAdmin && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector}>
          {threads.map((thread) => (
            <Chip
              key={thread.id}
              label={thread.clientName}
              active={selectedThread.id === thread.id}
              onPress={() => setSelectedThreadId(thread.id)}
            />
          ))}
        </ScrollView>
      )}
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.sectionTitle}>{isAdmin ? selectedThread.clientName : 'Chat with The Knoxville Drone Guy'}</Text>
          <Text style={styles.muted}>Push notifications are sent for new messages in production.</Text>
        </View>
      </View>
      <ScrollView
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((message) => {
          const mine = message.senderId === user.uid;
          return (
            <View key={message.id} style={[styles.messageBubble, mine ? styles.myMessage : styles.theirMessage]}>
              {message.reference?.type === 'shoot_request' && (
                <Pressable style={styles.messageReference} onPress={() => onOpenReference(message.reference!.id)}>
                  <Text style={styles.messageReferenceText}>Referencing Project Request: {message.reference.title}</Text>
                </Pressable>
              )}
              <Text style={styles.messageSender}>{message.senderName}</Text>
              <Text style={styles.messageText}>{message.body}</Text>
              {message.attachment?.type === 'image' && (
                <Pressable onPress={() => message.attachment && onOpenMedia(message.attachment)}>
                  <Image source={{ uri: message.attachment.uri }} style={styles.messageImage} />
                </Pressable>
              )}
              {message.attachment?.type === 'video' && (
                <MediaAttachmentButton attachment={message.attachment} onPress={() => onOpenMedia(message.attachment!)} />
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.composer}>
        {pendingReference && (
          <View style={styles.composerReference}>
            <Pressable style={styles.flexOne} onPress={() => onOpenReference(pendingReference.id)}>
              <Text style={styles.composerReferenceText}>Referencing Project Request: {pendingReference.title}</Text>
            </Pressable>
            <Pressable style={styles.composerReferenceClose} onPress={onClearReference}>
              <Ionicons name="close-outline" size={18} color="#0f766e" />
            </Pressable>
          </View>
        )}
        <View style={styles.composerRow}>
          <Pressable style={styles.iconButton} onPress={attachFromCamera}>
            <Ionicons name="camera-outline" size={22} color="#0f766e" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={attachFromLibrary}>
            <Ionicons name="image-outline" size={22} color="#0f766e" />
          </Pressable>
          <TextInput
            style={[styles.input, styles.composerInput]}
            placeholder="Type a message"
            value={body}
            onChangeText={setBody}
            multiline
          />
          <Pressable
            style={[styles.sendButton, !body.trim() && styles.disabledButton]}
            onPress={async () => {
              await onSend(body, undefined, pendingReference);
              setBody('');
              Keyboard.dismiss();
            }}
            disabled={!body.trim()}
          >
            <Ionicons name="send" size={19} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function NotificationsScreen({
  isAdmin,
  onOpenProjects,
  pendingRequests,
  user,
}: {
  isAdmin: boolean;
  onOpenProjects: () => void;
  pendingRequests: ShootRequest[];
  user: AppUser;
}) {
  const hasAlerts = pendingRequests.length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.notificationsPanel}>
        <View style={styles.notificationsHeader}>
          <View style={styles.flexOne}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <Text style={styles.muted}>Updates that need your attention.</Text>
          </View>
          <View style={styles.historyCountPill}>
            <Text style={styles.historyCountText}>{pendingRequests.length}</Text>
          </View>
        </View>
        {!hasAlerts ? (
          <View style={styles.historyEmpty}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#687076" />
            <Text style={[styles.muted, styles.historyEmptyText]}>No new notifications right now.</Text>
          </View>
        ) : (
          <>
            {pendingRequests.map((request) => (
              <Pressable key={request.id} style={styles.notificationCard} onPress={onOpenProjects}>
                <View style={styles.notificationIconWrap}>
                  <Ionicons
                    name={isAdmin ? 'briefcase-outline' : request.status === 'accepted' ? 'checkmark-circle-outline' : 'information-circle-outline'}
                    size={20}
                    color="#0f766e"
                  />
                </View>
                <View style={styles.flexOne}>
                  <Text style={styles.notificationTitle}>
                    {isAdmin ? 'New Project Request' : request.status === 'accepted' ? 'Project Accepted' : 'Project Needs Details'}
                  </Text>
                  <Text style={styles.muted}>
                    {request.title} · {request.requesterName || request.clientName || user.displayName}
                  </Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={18} color="#687076" />
              </Pressable>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function JobsScreen({
  focusedRequestId,
  isAdmin,
  jobs,
  onAcceptShootRequest,
  onEditUpdate,
  onOpenMedia,
  onRequestShootDetails,
  onSubmitShootRequest,
  onUpdateShootRequest,
  onUpdateStatus,
  onUpdateTitle,
  selectedJob,
  setSelectedJobId,
  shootRequests,
  user,
}: {
  focusedRequestId?: string;
  isAdmin: boolean;
  jobs: Job[];
  onAcceptShootRequest: (request: ShootRequest) => Promise<void>;
  onEditUpdate: (job: Job, updateId: string, changes: Pick<JobUpdate, 'status' | 'note' | 'createdAt'>) => Promise<void>;
  onOpenMedia: (attachment: Attachment) => void;
  onRequestShootDetails: (request: ShootRequest) => Promise<void>;
  onSubmitShootRequest: (request: ShootRequestDraft) => Promise<void>;
  onUpdateShootRequest: (request: ShootRequest, changes: ShootRequestEdit) => Promise<void>;
  onUpdateStatus: (job: Job, status: JobStatus, note?: string, attachment?: Attachment) => Promise<void>;
  onUpdateTitle: (job: Job, title: string) => Promise<void>;
  selectedJob?: Job;
  setSelectedJobId: (jobId: string) => void;
  shootRequests: ShootRequest[];
  user: AppUser;
}) {
  const [note, setNote] = useState('');
  const [draftTitle, setDraftTitle] = useState(selectedJob?.title ?? '');
  const [pendingMedia, setPendingMedia] = useState<Attachment | null>(null);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [requestDraft, setRequestDraft] = useState<ShootRequestEdit>({
    title: '',
    requestedWhen: '',
    projectAddress: '',
    details: '',
  });

  useEffect(() => {
    setDraftTitle(selectedJob?.title ?? '');
    setPendingMedia(null);
  }, [selectedJob?.id, selectedJob?.title]);

  if (!selectedJob) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {!isAdmin && <ShootRequestForm onSubmit={onSubmitShootRequest} user={user} />}
        <EmptyState title="No projects yet" body="Assigned projects and progress updates will appear here." />
      </ScrollView>
    );
  }

  const activeJobs = jobs.filter((job) => job.status !== 'job_complete');
  const historyJobs = jobs.filter((job) => job.status === 'job_complete');

  const addMediaUpdate = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo library permission needed', 'Photo library access is needed to attach job updates.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPendingMedia(assetToAttachment(result.assets[0]));
    }
  };

  const postPendingMediaUpdate = () => {
    if (!pendingMedia) return;
    onUpdateStatus(selectedJob, selectedJob.status, note || 'Media update added.', pendingMedia);
    setPendingMedia(null);
    setNote('');
  };

  const startEditingRequest = (request: ShootRequest) => {
    setEditingRequestId(request.id);
    setRequestDraft({
      title: request.title,
      requestedWhen: request.requestedWhen,
      projectAddress: request.projectAddress,
      details: request.details,
    });
  };

  const saveRequestEdit = async (request: ShootRequest) => {
    await onUpdateShootRequest(request, requestDraft);
    setEditingRequestId(null);
  };

  const renderProjectCard = (job: Job, isHistory = false) => {
    const selected = selectedJob.id === job.id;
    const showMap = job.liveLocation && locationVisibleStatuses.includes(job.status);
    return (
      <View
        key={job.id}
        style={[styles.projectListCard, isHistory && styles.historyJobListItem, selected && styles.activeJobListItem]}
      >
        <Pressable style={styles.jobListItem} onPress={() => setSelectedJobId(job.id)}>
          <View style={styles.flexOne}>
            <Text style={styles.jobListTitle}>{job.title}</Text>
            <Text style={styles.muted}>{job.clientName} · {job.address}</Text>
          </View>
          <View style={styles.statusPillSmall}>
            <Text style={styles.statusTextSmall}>{statusLabel(job.status)}</Text>
          </View>
          <Ionicons name={selected ? 'chevron-up' : 'chevron-down'} size={18} color="#687076" />
        </Pressable>
        {selected && (
          <View style={styles.projectProgressPanel}>
            <Text style={styles.projectProgressHeading}>Progress updates</Text>
            {job.updates.map((update, index) => (
              <JobUpdateRow
                key={update.id}
                isAdmin={isAdmin}
                job={job}
                isLast={index === job.updates.length - 1}
                onOpenMedia={onOpenMedia}
                onSave={onEditUpdate}
                update={update}
              />
            ))}
            <View style={styles.projectMapSection}>
              <Text style={styles.projectMapHeading}>Production Crew Live</Text>
              {showMap ? (
                <View style={styles.projectMapWrap}>
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: job.liveLocation!.latitude,
                      longitude: job.liveLocation!.longitude,
                      latitudeDelta: 0.04,
                      longitudeDelta: 0.04,
                    }}
                    region={{
                      latitude: job.liveLocation!.latitude,
                      longitude: job.liveLocation!.longitude,
                      latitudeDelta: 0.04,
                      longitudeDelta: 0.04,
                    }}
                  >
                    <Marker
                      coordinate={{
                        latitude: job.liveLocation!.latitude,
                        longitude: job.liveLocation!.longitude,
                      }}
                      title="Production Crew Live"
                      description="Live production crew location for this active project"
                    />
                  </MapView>
                  <Text style={styles.mapCaption}>Live location updated {formatClockTime(new Date(job.liveLocation!.updatedAt))}.</Text>
                </View>
              ) : (
                <View style={styles.projectLocationClosed}>
                  <Ionicons name="location-outline" size={20} color="#687076" />
                  <Text style={[styles.muted, styles.projectLocationText]}>
                    Live map is available only while the job is on the way or actively shooting.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      {!isAdmin && <ShootRequestForm onSubmit={onSubmitShootRequest} user={user} />}
      {(isAdmin || shootRequests.length > 0) && (
        <View style={styles.adminPanel}>
          <Text style={styles.smallTitle}>{isAdmin ? 'Project Shoot Requests' : 'My Project Requests'}</Text>
          {shootRequests.length === 0 ? (
            <Text style={styles.muted}>New client requests will appear here.</Text>
          ) : (
            shootRequests.map((request) => {
              const accepted = request.status === 'accepted';
              const editing = editingRequestId === request.id;
              const canEdit = isAdmin || request.status !== 'accepted';
              return (
                <View
                  key={request.id}
                  style={[
                    styles.requestCard,
                    accepted && styles.acceptedRequestCard,
                    focusedRequestId === request.id && styles.focusedRequestCard,
                  ]}
                >
                  <View style={styles.requestHeader}>
                    <View style={styles.flexOne}>
                      <Text style={styles.requestTitle}>{request.title}</Text>
                      <Text style={styles.muted}>{request.requesterName || request.clientName}</Text>
                    </View>
                    <View style={[styles.requestStatusPill, accepted && styles.acceptedRequestPill]}>
                      <Text style={styles.requestStatusText}>{requestStatusLabel(request.status)}</Text>
                    </View>
                  </View>
                  {editing ? (
                    <>
                      <TextInput
                        style={styles.input}
                        value={requestDraft.title}
                        onChangeText={(title) => setRequestDraft((current) => ({ ...current, title }))}
                        placeholder="Project name"
                      />
                      <TextInput
                        style={styles.input}
                        value={requestDraft.requestedWhen}
                        onChangeText={(requestedWhen) => setRequestDraft((current) => ({ ...current, requestedWhen }))}
                        placeholder="When"
                      />
                      <TextInput
                        style={styles.input}
                        value={requestDraft.projectAddress}
                        onChangeText={(projectAddress) => setRequestDraft((current) => ({ ...current, projectAddress }))}
                        placeholder="Project address"
                      />
                      <TextInput
                        style={[styles.input, styles.noteInput]}
                        value={requestDraft.details}
                        onChangeText={(details) => setRequestDraft((current) => ({ ...current, details }))}
                        placeholder="Describe the project"
                        multiline
                      />
                      <View style={styles.rowActions}>
                        <SecondaryButton label="Cancel" icon="close-outline" onPress={() => setEditingRequestId(null)} />
                        <SecondaryButton label="Save" icon="save-outline" onPress={() => saveRequestEdit(request)} />
                      </View>
                    </>
                  ) : (
                    <>
                      {!accepted && (
                        <>
                          <Text style={styles.timelineText}>When: {request.requestedWhen}</Text>
                          <Text style={styles.timelineText}>Address: {request.projectAddress}</Text>
                          <Text style={styles.timelineText}>Services: {formatServices(request.services)}</Text>
                          {!!request.videoEditFormat && (
                            <Text style={styles.timelineText}>Video Edit: {formatVideoEditDetails(request)}</Text>
                          )}
                          {request.isRecurring && (
                            <Text style={styles.timelineText}>Recurring: {formatRecurrence(request)}</Text>
                          )}
                          {!!request.otherDescription && <Text style={styles.timelineText}>Other: {request.otherDescription}</Text>}
                          {!!request.details && <Text style={styles.timelineText}>{request.details}</Text>}
                          <RouteDistancePanel
                            projectAddress={request.projectAddress}
                            routeDistanceMiles={request.routeDistanceMiles}
                            routeTravelTimeMinutes={request.routeTravelTimeMinutes}
                            routeDistanceStatus={request.routeDistanceStatus}
                          />
                        </>
                      )}
                      <View style={styles.rowActions}>
                        {isAdmin && (
                          <SecondaryButton label="Message" icon="chatbubble-outline" onPress={() => onRequestShootDetails(request)} />
                        )}
                        {canEdit && <SecondaryButton label="Edit" icon="create-outline" onPress={() => startEditingRequest(request)} />}
                        {isAdmin && !accepted && (
                          <SecondaryButton label="Accept" icon="checkmark-outline" onPress={() => onAcceptShootRequest(request)} />
                        )}
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
      <View style={styles.jobsList}>
        <Pressable style={styles.accordionHeader} onPress={() => setProjectsExpanded((current) => !current)}>
          <View style={styles.accordionTitleWrap}>
            <Text style={styles.accordionTitle}>Projects</Text>
            <Text style={styles.accordionSubtitle}>Active projects and progress updates.</Text>
          </View>
          <View style={styles.historyCountPill}>
            <Text style={styles.historyCountText}>{activeJobs.length}</Text>
          </View>
          <Ionicons name={projectsExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color="#687076" />
        </Pressable>
        {projectsExpanded && (
          activeJobs.length === 0 ? (
            <Text style={styles.muted}>No active projects right now.</Text>
          ) : (
            activeJobs.map((job) => renderProjectCard(job))
          )
        )}
        <Pressable
          style={[styles.accordionHeader, styles.historyHeader]}
          onPress={() => setHistoryExpanded((current) => !current)}
        >
          <View style={styles.accordionTitleWrap}>
            <Text style={styles.accordionTitle}>History</Text>
            <Text style={styles.accordionSubtitle}>Completed projects are saved here.</Text>
          </View>
          <View style={styles.historyCountPill}>
            <Text style={styles.historyCountText}>{historyJobs.length}</Text>
          </View>
          <Ionicons name={historyExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color="#687076" />
        </Pressable>
        {historyExpanded && (
          historyJobs.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Ionicons name="archive-outline" size={18} color="#687076" />
              <Text style={[styles.muted, styles.historyEmptyText]}>
                Projects marked Job Completed will appear here.
              </Text>
            </View>
          ) : (
            historyJobs.map((job) => renderProjectCard(job, true))
          )
        )}
      </View>
      {isAdmin && (
        <View style={styles.adminPanel}>
          <Text style={styles.smallTitle}>Route Distance</Text>
          <RouteDistancePanel
            projectAddress={selectedJob.address}
            routeDistanceMiles={selectedJob.routeDistanceMiles}
            routeTravelTimeMinutes={selectedJob.routeTravelTimeMinutes}
            routeDistanceStatus={selectedJob.routeDistanceStatus}
          />
        </View>
      )}
      {isAdmin && (
        <View style={styles.adminPanel}>
          <Text style={styles.smallTitle}>Admin project controls</Text>
          <TextInput
            style={styles.input}
            placeholder="Project name"
            value={draftTitle}
            onChangeText={setDraftTitle}
            onBlur={() => onUpdateTitle(selectedJob, draftTitle)}
          />
          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder="Optional update note"
            value={note}
            onChangeText={setNote}
            multiline
          />
          <View style={styles.statusGrid}>
            {jobStatuses.map((status) => (
              <Pressable
                key={status.value}
                style={[styles.statusButton, selectedJob.status === status.value && styles.activeStatusButton]}
                onPress={() => {
                  onUpdateStatus(selectedJob, status.value, note);
                  setNote('');
                }}
              >
                <Text style={[styles.statusButtonText, selectedJob.status === status.value && styles.activeStatusButtonText]}>
                  {status.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton label="Attach Media Update" icon="cloud-upload-outline" onPress={addMediaUpdate} />
          {pendingMedia && (
            <View style={styles.pendingMediaPanel}>
              <View style={styles.pendingMediaInfo}>
                <Ionicons name={pendingMedia.type === 'video' ? 'videocam-outline' : 'image-outline'} size={20} color="#0f766e" />
                <Text style={styles.pendingMediaText}>
                  {pendingMedia.type === 'video' ? 'Video ready to post' : 'Photo ready to post'}
                </Text>
              </View>
              <View style={styles.rowActions}>
                <SecondaryButton label="Remove" icon="trash-outline" onPress={() => setPendingMedia(null)} />
                <PrimaryButton label="Post" icon="send-outline" onPress={postPendingMediaUpdate} />
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function ShootRequestForm({
  onSubmit,
  user,
}: {
  onSubmit: (request: ShootRequestDraft) => Promise<void>;
  user: AppUser;
}) {
  const tomorrow = useMemo(() => startOfTomorrow(), []);
  const [title, setTitle] = useState('');
  const [requesterName, setRequesterName] = useState(user.displayName);
  const [requestedDate, setRequestedDate] = useState<Date | null>(null);
  const [requestedTime, setRequestedTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [projectAddress, setProjectAddress] = useState('');
  const [details, setDetails] = useState('');
  const [services, setServices] = useState<ShootService[]>([]);
  const [otherDescription, setOtherDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | null>(null);
  const [recurrenceOther, setRecurrenceOther] = useState('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [showRecurrenceEndPicker, setShowRecurrenceEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSentBanner, setShowSentBanner] = useState(false);
  const [videoEditFormat, setVideoEditFormat] = useState<VideoEditFormat | null>(null);
  const [showVideoEditFormatPicker, setShowVideoEditFormatPicker] = useState(false);
  const [videoEditOther, setVideoEditOther] = useState('');
  const [finishedVideoLength, setFinishedVideoLength] = useState<FinishedVideoLength | null>(null);
  const [showFinishedVideoLengthPicker, setShowFinishedVideoLengthPicker] = useState(false);
  const [finishedVideoLengthOther, setFinishedVideoLengthOther] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [requestExpanded, setRequestExpanded] = useState(false);

  const filteredAddresses = useMemo(() => {
    const needle = projectAddress.trim().toLowerCase();
    if (needle.length < 3) return [];
    return addressSuggestions
      .filter((address) => address.toLowerCase().includes(needle) && address !== projectAddress)
      .slice(0, 4);
  }, [projectAddress]);

  const toggleService = (service: ShootService) => {
    setServices((current) => {
      const nextServices = current.includes(service) ? current.filter((item) => item !== service) : [...current, service];
      if (service === 'edit_into_video' && current.includes(service)) {
        setVideoEditFormat(null);
        setVideoEditOther('');
        setFinishedVideoLength(null);
        setFinishedVideoLengthOther('');
        setShowVideoEditFormatPicker(false);
        setShowFinishedVideoLengthPicker(false);
        setValidationErrors((errors) =>
          errors.filter(
            (item) =>
              !['videoEditFormat', 'videoEditOther', 'finishedVideoLength', 'finishedVideoLengthOther'].includes(item),
          ),
        );
      }
      if (service === 'other' && current.includes(service)) {
        setOtherDescription('');
        setValidationErrors((errors) => errors.filter((item) => item !== 'otherDescription'));
      }
      return nextServices;
    });
    setValidationErrors((current) => current.filter((item) => item !== 'services'));
  };

  const submit = async () => {
    if (submitting) return;
    const selectedOther = services.includes('other');
    const selectedVideoEdit = services.includes('edit_into_video');
    const requiresFinishedVideoLength = selectedVideoEdit && (videoEditFormat === 'long_format' || videoEditFormat === 'other');
    const errors = [
      ...(!requesterName.trim() ? ['requesterName'] : []),
      ...(!title.trim() ? ['title'] : []),
      ...(!requestedDate ? ['requestedDate'] : []),
      ...(!requestedTime ? ['requestedTime'] : []),
      ...(!projectAddress.trim() ? ['projectAddress'] : []),
      ...(!details.trim() ? ['details'] : []),
      ...(services.length === 0 ? ['services'] : []),
      ...(selectedOther && !otherDescription.trim() ? ['otherDescription'] : []),
      ...(selectedVideoEdit && !videoEditFormat ? ['videoEditFormat'] : []),
      ...(selectedVideoEdit && videoEditFormat === 'other' && !videoEditOther.trim() ? ['videoEditOther'] : []),
      ...(requiresFinishedVideoLength && !finishedVideoLength ? ['finishedVideoLength'] : []),
      ...(requiresFinishedVideoLength && finishedVideoLength === 'other' && !finishedVideoLengthOther.trim()
        ? ['finishedVideoLengthOther']
        : []),
      ...(isRecurring && !recurrenceFrequency ? ['recurrenceFrequency'] : []),
      ...(isRecurring && !recurrenceEndDate ? ['recurrenceEndDate'] : []),
      ...(isRecurring && recurrenceFrequency === 'other' && !recurrenceOther.trim() ? ['recurrenceOther'] : []),
    ];

    setValidationErrors(errors);
    if (errors.length > 0) {
      return;
    }

    const confirmedRequestedDate = requestedDate;
    const confirmedRequestedTime = requestedTime;
    if (!confirmedRequestedDate || !confirmedRequestedTime) return;

    const requestedDateTime = new Date(confirmedRequestedDate);
    requestedDateTime.setHours(confirmedRequestedTime.getHours(), confirmedRequestedTime.getMinutes(), 0, 0);

    if (requestedDateTime < tomorrow) {
      Alert.alert('Choose another date', 'Same-day project requests are disabled.');
      return;
    }

    setSubmitting(true);
    setShowSentBanner(false);
    try {
      await onSubmit({
        requesterName: requesterName.trim(),
        title: title.trim(),
        requestedWhen: `${formatProjectDate(confirmedRequestedDate)} at ${formatClockTime(confirmedRequestedTime)}`,
        requestedDate: requestedDateTime.toISOString(),
        requestedTime: formatClockTime(confirmedRequestedTime),
        projectAddress: projectAddress.trim(),
        services,
        otherDescription: selectedOther ? otherDescription.trim() : undefined,
        videoEditFormat: selectedVideoEdit ? videoEditFormat ?? undefined : undefined,
        videoEditOther: selectedVideoEdit && videoEditFormat === 'other' ? videoEditOther.trim() : undefined,
        finishedVideoLength: requiresFinishedVideoLength ? finishedVideoLength ?? undefined : undefined,
        finishedVideoLengthOther:
          requiresFinishedVideoLength && finishedVideoLength === 'other' ? finishedVideoLengthOther.trim() : undefined,
        details: details.trim(),
        isRecurring,
        recurrenceFrequency: isRecurring ? recurrenceFrequency ?? undefined : undefined,
        recurrenceOther: isRecurring && recurrenceFrequency === 'other' ? recurrenceOther.trim() : undefined,
        recurrenceEndDate: isRecurring && recurrenceEndDate ? recurrenceEndDate.toISOString() : undefined,
      });
      setTitle('');
      setRequesterName(user.displayName);
      setRequestedDate(null);
      setRequestedTime(null);
      setProjectAddress('');
      setDetails('');
      setServices([]);
      setOtherDescription('');
      setIsRecurring(false);
      setRecurrenceFrequency(null);
      setRecurrenceOther('');
      setRecurrenceEndDate(null);
      setVideoEditFormat(null);
      setVideoEditOther('');
      setFinishedVideoLength(null);
      setFinishedVideoLengthOther('');
      setValidationErrors([]);
      setShowSentBanner(true);
    } finally {
      setSubmitting(false);
    }
  };

  const hasError = (field: string) => validationErrors.includes(field);
  const clearValidationError = (field: string) => {
    setValidationErrors((current) => current.filter((item) => item !== field));
  };
  const selectedVideoEdit = services.includes('edit_into_video');
  const requiresFinishedVideoLength = selectedVideoEdit && (videoEditFormat === 'long_format' || videoEditFormat === 'other');

  return (
    <View style={styles.shootRequestCard}>
      <Pressable style={styles.accordionHeader} onPress={() => setRequestExpanded((current) => !current)}>
        <View style={styles.accordionTitleWrap}>
          <Text style={styles.accordionTitle}>Request a Project Shoot</Text>
          <Text style={styles.accordionSubtitle}>Send project details, timing, and scope.</Text>
        </View>
        <Ionicons name={requestExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color="#687076" />
      </Pressable>
      {showSentBanner && (
        <View style={styles.requestSentBanner}>
          <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" />
          <Text style={styles.requestSentText}>Request Sent!</Text>
        </View>
      )}
      {requestExpanded && (
        <>
          <IconTextInput
            error={hasError('requesterName')}
            icon="person-outline"
            placeholder="Your name or business name"
            value={requesterName}
            onChangeText={(value) => {
              setRequesterName(value);
              clearValidationError('requesterName');
            }}
            textContentType="organizationName"
          />
          <IconTextInput
            error={hasError('title')}
            icon="document-outline"
            placeholder="Project name"
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              clearValidationError('title');
            }}
          />
          <Pressable
            style={[styles.formSelectRow, hasError('requestedDate') && styles.validationErrorBorder]}
            onPress={() => setShowDatePicker((current) => !current)}
          >
            <Ionicons name="calendar-outline" size={22} color="#8b95a1" />
            <Text style={[styles.formSelectText, !requestedDate && styles.formPlaceholderText]}>
              {requestedDate ? formatProjectDate(requestedDate) : 'Select Date'}
            </Text>
            <Ionicons name={showDatePicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color="#8b95a1" />
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={requestedDate ?? tomorrow}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              minimumDate={tomorrow}
              onChange={(_, date) => {
                if (Platform.OS !== 'ios') setShowDatePicker(false);
                if (date) {
                  setRequestedDate(date < tomorrow ? tomorrow : date);
                  clearValidationError('requestedDate');
                }
              }}
            />
          )}
          <Pressable
            style={[styles.formSelectRow, hasError('requestedTime') && styles.validationErrorBorder]}
            onPress={() => setShowTimePicker((current) => !current)}
          >
            <Ionicons name="time-outline" size={22} color="#8b95a1" />
            <Text style={[styles.formSelectText, !requestedTime && styles.formPlaceholderText]}>
              {requestedTime ? formatClockTime(requestedTime) : 'Select Time'}
            </Text>
            <Ionicons name={showTimePicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color="#8b95a1" />
          </Pressable>
          {showTimePicker && (
            <DateTimePicker
              value={requestedTime ?? new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                if (Platform.OS !== 'ios') setShowTimePicker(false);
                if (date) {
                  setRequestedTime(date);
                  clearValidationError('requestedTime');
                }
              }}
            />
          )}
          <IconTextInput
            error={hasError('projectAddress')}
            icon="location-outline"
            placeholder="Project address"
            value={projectAddress}
            onChangeText={(value) => {
              setProjectAddress(value);
              clearValidationError('projectAddress');
            }}
            textContentType="fullStreetAddress"
          />
          {filteredAddresses.length > 0 && (
            <View style={styles.suggestionBox}>
              {filteredAddresses.map((address) => (
                <Pressable
                  key={address}
                  style={styles.suggestionItem}
                  onPress={() => {
                    setProjectAddress(address);
                    clearValidationError('projectAddress');
                  }}
                >
                  <Ionicons name="location-outline" size={16} color="#0f766e" />
                  <Text style={styles.suggestionText}>{address}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={styles.formLabel}>Project Scope</Text>
          <View style={[styles.serviceGrid, hasError('services') && styles.validationErrorGroup]}>
            {shootServices.map((service) => {
              const active = services.includes(service.value);
              return (
                <Pressable
                  key={service.value}
                  style={[styles.serviceButton, active && styles.activeServiceButton]}
                  onPress={() => toggleService(service.value)}
                >
                  <Ionicons name={serviceIcon(service.value)} size={21} color={active ? '#ffffff' : '#0f766e'} />
                  <Text style={[styles.serviceButtonText, active && styles.activeServiceButtonText]}>{service.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {selectedVideoEdit && (
            <View style={styles.conditionalPanel}>
              <Text style={styles.formLabel}>Video Type</Text>
              <Pressable
                style={[styles.formSelectRow, hasError('videoEditFormat') && styles.validationErrorBorder]}
                onPress={() => setShowVideoEditFormatPicker((current) => !current)}
              >
                <Ionicons name="film-outline" size={22} color="#8b95a1" />
                <Text style={[styles.formSelectText, !videoEditFormat && styles.formPlaceholderText]}>
                  {formatVideoEditFormat(videoEditFormat)}
                </Text>
                <Ionicons name={showVideoEditFormatPicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color="#8b95a1" />
              </Pressable>
              {showVideoEditFormatPicker && (
                <View style={styles.selectOptionList}>
                  {videoEditFormats.map((format) => (
                    <Pressable
                      key={format.value}
                      style={styles.selectOptionRow}
                      onPress={() => {
                        setVideoEditFormat(format.value);
                        setShowVideoEditFormatPicker(false);
                        setFinishedVideoLength(null);
                        setFinishedVideoLengthOther('');
                        clearValidationError('videoEditFormat');
                        clearValidationError('videoEditOther');
                        clearValidationError('finishedVideoLength');
                        clearValidationError('finishedVideoLengthOther');
                      }}
                    >
                      <Text style={styles.selectOptionText}>{format.label}</Text>
                      {videoEditFormat === format.value && <Ionicons name="checkmark-outline" size={18} color="#0f766e" />}
                    </Pressable>
                  ))}
                </View>
              )}
              {videoEditFormat === 'other' && (
                <View style={[styles.formInputRow, styles.formTextAreaRow, hasError('videoEditOther') && styles.validationErrorBorder]}>
                  <Ionicons name="create-outline" size={22} color="#8b95a1" />
                  <TextInput
                    style={[styles.formTextInput, styles.formTextArea]}
                    placeholder="Describe the video type"
                    placeholderTextColor="#a4abb4"
                    value={videoEditOther}
                    onChangeText={(value) => {
                      setVideoEditOther(value);
                      clearValidationError('videoEditOther');
                    }}
                    multiline
                  />
                </View>
              )}
              {requiresFinishedVideoLength && (
                <>
                  <Text style={styles.formLabel}>Length of Finished Video</Text>
                  <Pressable
                    style={[styles.formSelectRow, hasError('finishedVideoLength') && styles.validationErrorBorder]}
                    onPress={() => setShowFinishedVideoLengthPicker((current) => !current)}
                  >
                    <Ionicons name="time-outline" size={22} color="#8b95a1" />
                    <Text style={[styles.formSelectText, !finishedVideoLength && styles.formPlaceholderText]}>
                      {formatFinishedVideoLength(finishedVideoLength)}
                    </Text>
                    <Ionicons name={showFinishedVideoLengthPicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color="#8b95a1" />
                  </Pressable>
                  {showFinishedVideoLengthPicker && (
                    <View style={styles.selectOptionList}>
                      {finishedVideoLengths.map((length) => (
                        <Pressable
                          key={length.value}
                          style={styles.selectOptionRow}
                          onPress={() => {
                            setFinishedVideoLength(length.value);
                            setShowFinishedVideoLengthPicker(false);
                            setFinishedVideoLengthOther('');
                            clearValidationError('finishedVideoLength');
                            clearValidationError('finishedVideoLengthOther');
                          }}
                        >
                          <Text style={styles.selectOptionText}>{length.label}</Text>
                          {finishedVideoLength === length.value && <Ionicons name="checkmark-outline" size={18} color="#0f766e" />}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {finishedVideoLength === 'other' && (
                    <IconTextInput
                      error={hasError('finishedVideoLengthOther')}
                      icon="create-outline"
                      placeholder="Enter finished video length"
                      value={finishedVideoLengthOther}
                      onChangeText={(value) => {
                        setFinishedVideoLengthOther(value);
                        clearValidationError('finishedVideoLengthOther');
                      }}
                    />
                  )}
                </>
              )}
            </View>
          )}
          {services.includes('other') && (
            <TextInput
              style={[styles.input, styles.noteInput, styles.modernTextArea, hasError('otherDescription') && styles.validationErrorBorder]}
              placeholder="Describe the project"
              value={otherDescription}
              onChangeText={(value) => {
                setOtherDescription(value);
                clearValidationError('otherDescription');
              }}
              multiline
            />
          )}
          <View style={[styles.formInputRow, styles.formTextAreaRow, hasError('details') && styles.validationErrorBorder]}>
            <Ionicons name="chatbubble-outline" size={22} color="#8b95a1" />
            <TextInput
              style={[styles.formTextInput, styles.formTextArea]}
              placeholder="Describe the project the best you can"
              placeholderTextColor="#a4abb4"
              value={details}
              onChangeText={(value) => {
                setDetails(value);
                clearValidationError('details');
              }}
              multiline
            />
          </View>
          <Pressable
            style={styles.radioRow}
            onPress={() => {
              setIsRecurring((current) => !current);
              if (isRecurring) {
                setRecurrenceFrequency(null);
                setRecurrenceOther('');
                setRecurrenceEndDate(null);
                setValidationErrors((errors) =>
                  errors.filter((item) => !['recurrenceFrequency', 'recurrenceOther', 'recurrenceEndDate'].includes(item)),
                );
              }
            }}
          >
            <Ionicons name={isRecurring ? 'radio-button-on' : 'ellipse-outline'} size={30} color="#0f766e" />
            <View style={styles.flexOne}>
              <Text style={styles.radioText}>Recurring shoot</Text>
              <Text style={styles.radioSubText}>This is an ongoing or repeating project</Text>
            </View>
          </Pressable>
          {isRecurring && (
            <View style={styles.recurringBox}>
              <Text style={styles.formLabel}>Frequency</Text>
              <View style={[styles.serviceGrid, hasError('recurrenceFrequency') && styles.validationErrorGroup]}>
                {recurrenceFrequencies.map((frequency) => {
                  const active = recurrenceFrequency === frequency.value;
                  return (
                    <Pressable
                      key={frequency.value}
                      style={[styles.serviceButton, active && styles.activeServiceButton]}
                      onPress={() => {
                        setRecurrenceFrequency(frequency.value);
                        clearValidationError('recurrenceFrequency');
                        clearValidationError('recurrenceOther');
                      }}
                    >
                      <Text style={[styles.serviceButtonText, active && styles.activeServiceButtonText]}>
                        {frequency.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {recurrenceFrequency === 'other' && (
                <IconTextInput
                  error={hasError('recurrenceOther')}
                  icon="repeat-outline"
                  placeholder="Custom recurrence"
                  value={recurrenceOther}
                  onChangeText={(value) => {
                    setRecurrenceOther(value);
                    clearValidationError('recurrenceOther');
                  }}
                />
              )}
              <Pressable
                style={[styles.formSelectRow, hasError('recurrenceEndDate') && styles.validationErrorBorder]}
                onPress={() => setShowRecurrenceEndPicker((current) => !current)}
              >
                <Ionicons name="calendar-clear-outline" size={22} color="#8b95a1" />
                <Text style={[styles.formSelectText, !recurrenceEndDate && styles.formPlaceholderText]}>
                  {recurrenceEndDate ? `Ends ${formatProjectDate(recurrenceEndDate)}` : 'Select End Date'}
                </Text>
                <Ionicons name={showRecurrenceEndPicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color="#8b95a1" />
              </Pressable>
              {showRecurrenceEndPicker && (
                <DateTimePicker
                  value={recurrenceEndDate ?? requestedDate ?? tomorrow}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                  minimumDate={requestedDate ?? tomorrow}
                  onChange={(_, date) => {
                    if (Platform.OS !== 'ios') setShowRecurrenceEndPicker(false);
                    if (date) {
                      setRecurrenceEndDate(date);
                      clearValidationError('recurrenceEndDate');
                    }
                  }}
                />
              )}
            </View>
          )}
          <PrimaryButton
            label={submitting ? 'Sending Request...' : 'Send Shoot Request'}
            icon="paper-plane-outline"
            loading={submitting}
            disabled={submitting}
            onPress={submit}
          />
        </>
      )}
    </View>
  );
}

function JobUpdateRow({
  isAdmin,
  isLast,
  job,
  onOpenMedia,
  onSave,
  update,
}: {
  isAdmin: boolean;
  isLast: boolean;
  job: Job;
  onOpenMedia: (attachment: Attachment) => void;
  onSave: (job: Job, updateId: string, changes: Pick<JobUpdate, 'status' | 'note' | 'createdAt'>) => Promise<void>;
  update: JobUpdate;
}) {
  const [editing, setEditing] = useState(false);
  const [draftStatus, setDraftStatus] = useState<JobStatus>(update.status);
  const [draftNote, setDraftNote] = useState(update.note);
  const [draftDate, setDraftDate] = useState(new Date(update.createdAt));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) return;
    setDraftStatus(update.status);
    setDraftNote(update.note);
    setDraftDate(new Date(update.createdAt));
  }, [editing, update.createdAt, update.note, update.status]);

  const save = async () => {
    if (!draftNote.trim()) {
      Alert.alert('Update note needed', 'Add a note for this progress update.');
      return;
    }

    setSaving(true);
    try {
      await onSave(job, update.id, {
        status: draftStatus,
        note: draftNote.trim(),
        createdAt: draftDate.getTime(),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraftStatus(update.status);
    setDraftNote(update.note);
    setDraftDate(new Date(update.createdAt));
    setEditing(false);
  };

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>
        <View style={styles.timelineDot} />
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineBody}>
        {editing ? (
          <View style={styles.updateEditor}>
            <Text style={styles.formLabel}>Status</Text>
            <View style={styles.statusGrid}>
              {jobStatuses.map((status) => {
                const active = draftStatus === status.value;
                return (
                  <Pressable
                    key={status.value}
                    style={[styles.statusButton, active && styles.activeStatusButton]}
                    onPress={() => setDraftStatus(status.value)}
                  >
                    <Text style={[styles.statusButtonText, active && styles.activeStatusButtonText]}>
                      {status.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="Progress note"
              value={draftNote}
              onChangeText={setDraftNote}
              multiline
            />
            <View style={styles.rowActions}>
              <SecondaryButton
                label={formatProjectDate(draftDate)}
                icon="calendar-outline"
                onPress={() => setShowDatePicker((current) => !current)}
              />
              <SecondaryButton
                label={formatClockTime(draftDate)}
                icon="time-outline"
                onPress={() => setShowTimePicker((current) => !current)}
              />
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={draftDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                onChange={(_, date) => {
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                  if (!date) return;
                  const nextDate = new Date(draftDate);
                  nextDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                  setDraftDate(nextDate);
                }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={draftDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  if (Platform.OS !== 'ios') setShowTimePicker(false);
                  if (!date) return;
                  const nextDate = new Date(draftDate);
                  nextDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
                  setDraftDate(nextDate);
                }}
              />
            )}
            <View style={styles.rowActions}>
              <SecondaryButton label="Cancel" icon="close-outline" onPress={cancel} />
              <PrimaryButton label={saving ? 'Saving...' : 'Save Update'} icon="save-outline" onPress={save} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.timelineTitleRow}>
              <Text style={styles.timelineTitle}>{statusLabel(update.status)}</Text>
              {isAdmin && (
                <Pressable style={styles.timelineEditButton} onPress={() => setEditing(true)}>
                  <Ionicons name="create-outline" size={17} color="#0f766e" />
                  <Text style={styles.timelineEditText}>Edit</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.timelineText}>{update.note}</Text>
            <View style={styles.timelineTimeRow}>
              <Ionicons name="time-outline" size={18} color="#8b95a1" />
              <Text style={styles.timelineTime}>{formatDateTime(new Date(update.createdAt))}</Text>
            </View>
            {update.attachment?.type === 'image' && (
              <Pressable onPress={() => update.attachment && onOpenMedia(update.attachment)}>
                <Image source={{ uri: update.attachment.uri }} style={styles.updateImage} />
              </Pressable>
            )}
            {update.attachment?.type === 'video' && (
              <MediaAttachmentButton attachment={update.attachment} onPress={() => onOpenMedia(update.attachment!)} />
            )}
          </>
        )}
      </View>
    </View>
  );
}

function AccountScreen({
  onUpdateSettings,
  user,
  switchRole,
}: {
  onUpdateSettings: (settings: {
    displayName: string;
    email: string;
    newPassword?: string;
    notificationPreference: NotificationPreference;
  }) => Promise<void>;
  user: AppUser | null;
  switchRole: (role: AppUser['role']) => void;
}) {
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsName, setSettingsName] = useState(user?.displayName ?? '');
  const [settingsEmail, setSettingsEmail] = useState(user?.email ?? '');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [notificationPreference, setNotificationPreference] = useState<NotificationPreference>(user?.notificationPreference ?? 'all');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [openLegal, setOpenLegal] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    setSettingsName(user?.displayName ?? '');
    setSettingsEmail(user?.email ?? '');
    setNotificationPreference(user?.notificationPreference ?? 'all');
  }, [user?.displayName, user?.email, user?.notificationPreference]);

  const handleSignIn = async () => {
    if (!auth) return;
    if (!email.trim() || !password) {
      Alert.alert('Sign in failed', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      Alert.alert('Sign in failed', 'Check your email and password.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    if (!auth || !db) return;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();
    const passwordProblem = getPasswordProblem(password);

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      Alert.alert('Sign up failed', 'Fill out your name, email, password, and confirmation.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Sign up failed', 'Enter a valid email address.');
      return;
    }
    if (passwordProblem) {
      Alert.alert('Password needs work', passwordProblem);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Sign up failed', 'Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const created = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(created.user, { displayName: trimmedName });
      await setDoc(doc(db, 'users', created.user.uid), {
        email: trimmedEmail,
        displayName: trimmedName,
        role: 'client',
        notificationPreference: 'all',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Sign up failed', 'This email may already be used, or the password was not accepted.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const handleSaveSettings = async () => {
    if (!settingsName.trim() || !settingsEmail.trim()) {
      Alert.alert('Settings not saved', 'Name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settingsEmail.trim())) {
      Alert.alert('Settings not saved', 'Enter a valid email address.');
      return;
    }
    if (settingsPassword.trim()) {
      const passwordProblem = getPasswordProblem(settingsPassword);
      if (passwordProblem) {
        Alert.alert('Password needs work', passwordProblem);
        return;
      }
    }

    setSettingsBusy(true);
    try {
      await onUpdateSettings({
        displayName: settingsName,
        email: settingsEmail,
        newPassword: settingsPassword.trim() || undefined,
        notificationPreference,
      });
      setSettingsPassword('');
      Alert.alert('Settings saved', 'Your account settings were updated.');
    } catch (error) {
      Alert.alert(
        'Settings not saved',
        error instanceof Error ? error.message : 'Try signing in again before changing email or password.',
      );
    } finally {
      setSettingsBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.accountCard}>
        <Text style={styles.sectionTitle}>{user?.displayName ?? 'Sign in'}</Text>
        <Text style={styles.muted}>{user?.email ?? 'Firebase invite sign-in will be enabled after configuration.'}</Text>
        {isFirebaseConfigured && (
          <View style={styles.signInBox}>
            {!user && (
              <View style={styles.authToggle}>
                <Pressable
                  style={[styles.authToggleButton, mode === 'sign_in' && styles.activeAuthToggleButton]}
                  onPress={() => setMode('sign_in')}
                >
                  <Text style={[styles.authToggleText, mode === 'sign_in' && styles.activeAuthToggleText]}>Sign In</Text>
                </Pressable>
                <Pressable
                  style={[styles.authToggleButton, mode === 'sign_up' && styles.activeAuthToggleButton]}
                  onPress={() => setMode('sign_up')}
                >
                  <Text style={[styles.authToggleText, mode === 'sign_up' && styles.activeAuthToggleText]}>Sign Up</Text>
                </Pressable>
              </View>
            )}
            {!user && mode === 'sign_up' && (
              <TextInput
                style={styles.input}
                placeholder="Name or business name"
                value={displayName}
                onChangeText={setDisplayName}
                textContentType="name"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={mode === 'sign_up' ? 'newPassword' : 'password'}
            />
            {!user && mode === 'sign_up' && (
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
              />
            )}
            {user ? (
              <PrimaryButton label="Sign Out" icon="log-out-outline" onPress={handleSignOut} />
            ) : mode === 'sign_up' ? (
              <PrimaryButton label={busy ? 'Creating...' : 'Create Account'} icon="person-add-outline" onPress={handleSignUp} />
            ) : (
              <PrimaryButton label={busy ? 'Signing In...' : 'Sign In'} icon="log-in-outline" onPress={handleSignIn} />
            )}
          </View>
        )}
        <View style={styles.accountActions}>
          <PrimaryButton label="Use Client Demo" icon="person-outline" onPress={() => switchRole('client')} />
          <PrimaryButton label="Use Admin Demo" icon="shield-checkmark-outline" onPress={() => switchRole('admin')} />
        </View>
      </View>
      {user && (
        <View style={styles.accountCard}>
          <Text style={styles.smallTitle}>Settings</Text>
          <TextInput
            style={styles.input}
            placeholder="Name or Business Name"
            value={settingsName}
            onChangeText={setSettingsName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={settingsEmail}
            onChangeText={setSettingsEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="New Password"
            value={settingsPassword}
            onChangeText={setSettingsPassword}
            secureTextEntry
            textContentType="newPassword"
          />
          <Text style={styles.formLabel}>Notify Me About</Text>
          <View style={styles.serviceGrid}>
            {notificationPreferenceOptions.map((option) => {
              const active = notificationPreference === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.serviceButton, active && styles.activeServiceButton]}
                  onPress={() => setNotificationPreference(option.value)}
                >
                  <Ionicons name={option.icon} size={19} color={active ? '#ffffff' : '#0f766e'} />
                  <Text style={[styles.serviceButtonText, active && styles.activeServiceButtonText]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <PrimaryButton
            label={settingsBusy ? 'Saving Settings...' : 'Save Settings'}
            icon="save-outline"
            loading={settingsBusy}
            disabled={settingsBusy}
            onPress={handleSaveSettings}
          />
        </View>
      )}
      <View style={styles.accountCard}>
        <Text style={styles.smallTitle}>Legal</Text>
        <Pressable
          style={styles.legalLinkRow}
          onPress={() => setOpenLegal((current) => (current === 'terms' ? null : 'terms'))}
        >
          <Text style={styles.legalLinkText}>Terms of Service</Text>
          <Ionicons name={openLegal === 'terms' ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color="#0f766e" />
        </Pressable>
        {openLegal === 'terms' && (
          <Text style={styles.legalText}>
            By using this app, clients agree to provide accurate project details, confirm they have permission for filming locations, and use delivered media according to the agreed project terms. Scheduling, weather, airspace restrictions, and safety requirements may affect shoot timing.
          </Text>
        )}
        <Pressable
          style={styles.legalLinkRow}
          onPress={() => setOpenLegal((current) => (current === 'privacy' ? null : 'privacy'))}
        >
          <Text style={styles.legalLinkText}>Privacy Policy</Text>
          <Ionicons name={openLegal === 'privacy' ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color="#0f766e" />
        </Pressable>
        {openLegal === 'privacy' && (
          <Text style={styles.legalText}>
            This app uses account details, chat messages, project requests, media attachments, notifications, and job progress information to manage client projects. Location sharing is limited to active shoot progress when enabled by the admin for a specific project.
          </Text>
        )}
      </View>
      <PrimaryButton
        label="Request Notification Permission"
        icon="notifications-outline"
        onPress={registerForNotifications}
      />
    </ScrollView>
  );
}

function RouteDistancePanel({
  projectAddress,
  routeDistanceMiles,
  routeTravelTimeMinutes,
  routeDistanceStatus,
}: {
  projectAddress: string;
  routeDistanceMiles?: number;
  routeTravelTimeMinutes?: number;
  routeDistanceStatus?: ShootRequest['routeDistanceStatus'];
}) {
  const [calculatedRoute, setCalculatedRoute] = useState<DrivingRouteResult | null>(
    typeof routeDistanceMiles === 'number' && typeof routeTravelTimeMinutes === 'number'
      ? { distanceMiles: routeDistanceMiles, travelTimeMinutes: routeTravelTimeMinutes }
      : null,
  );
  const [status, setStatus] = useState(routeDistanceStatus ?? 'not_checked');

  useEffect(() => {
    let active = true;
    const savedRoute =
      typeof routeDistanceMiles === 'number' && typeof routeTravelTimeMinutes === 'number'
        ? { distanceMiles: routeDistanceMiles, travelTimeMinutes: routeTravelTimeMinutes }
        : null;

    if (savedRoute) {
      setCalculatedRoute(savedRoute);
      setStatus('ready');
      return undefined;
    }

    setCalculatedRoute(null);
    setStatus('checking');
    calculateDrivingRoute(HOME_BASE_ADDRESS, projectAddress)
      .then((route) => {
        if (!active) return;
        setCalculatedRoute(route);
        setStatus(route ? 'ready' : 'failed');
      })
      .catch(() => {
        if (!active) return;
        setCalculatedRoute(null);
        setStatus('failed');
      });

    return () => {
      active = false;
    };
  }, [projectAddress, routeDistanceMiles, routeTravelTimeMinutes]);

  const statusText =
    status === 'checking'
      ? 'Calculating route...'
      : status === 'failed'
        ? 'Could not calculate automatically'
        : 'Driving route from home base';

  return (
    <View style={styles.distancePanel}>
      <View style={styles.distanceTextWrap}>
        <Text style={styles.formLabel}>{statusText}</Text>
        <Text style={styles.distanceValue}>
          {calculatedRoute ? `${calculatedRoute.distanceMiles.toFixed(1)} miles` : 'Distance unavailable'}
        </Text>
        <Text style={styles.distanceSubValue}>
          {calculatedRoute ? `About ${formatTravelTime(calculatedRoute.travelTimeMinutes)}` : 'Tap Check Distance to open Apple Maps.'}
        </Text>
      </View>
      <SecondaryButton
        label="Check Distance"
        icon="map-outline"
        onPress={() => openAppleMapsRoute(projectAddress)}
      />
    </View>
  );
}

function MediaAttachmentButton({ attachment, onPress }: { attachment: Attachment; onPress: () => void }) {
  return (
    <Pressable style={styles.mediaAttachmentButton} onPress={onPress}>
      <Ionicons name="play-circle-outline" size={24} color="#0f766e" />
      <View style={styles.flexOne}>
        <Text style={styles.mediaAttachmentTitle}>Video attached</Text>
        <Text style={styles.mediaAttachmentName}>{attachment.name ?? 'Open video'}</Text>
      </View>
      <Ionicons name="expand-outline" size={18} color="#8b95a1" />
    </Pressable>
  );
}

function MediaViewer({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  return (
    <Modal visible={!!attachment} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.mediaViewerBackdrop}>
        <View style={styles.mediaViewerHeader}>
          <Text style={styles.mediaViewerTitle}>{attachment?.type === 'video' ? 'Video' : 'Photo'}</Text>
          <Pressable style={styles.mediaViewerClose} hitSlop={18} onPress={onClose}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>
        <View style={styles.mediaViewerBody}>
          {attachment?.type === 'image' && (
            <Image source={{ uri: attachment.uri }} style={styles.mediaViewerImage} resizeMode="contain" />
          )}
          {attachment?.type === 'video' && <FullscreenVideo uri={attachment.uri} />}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function FullscreenVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);

  return (
    <VideoView
      player={player}
      style={styles.mediaViewerVideo}
      contentFit="contain"
      nativeControls
      allowsPictureInPicture
    />
  );
}

function PrimaryButton({
  disabled,
  icon,
  label,
  loading,
  onPress,
}: {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.primaryButton, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled}>
      {loading ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name={icon} size={18} color="#ffffff" />}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function IconTextInput({
  error,
  icon,
  multiline,
  onChangeText,
  placeholder,
  textContentType,
  value,
}: {
  error?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  textContentType?: ComponentProps<typeof TextInput>['textContentType'];
  value: string;
}) {
  return (
    <View style={[styles.formInputRow, multiline && styles.formTextAreaRow, error && styles.validationErrorBorder]}>
      <Ionicons name={icon} size={22} color="#8b95a1" />
      <TextInput
        style={[styles.formTextInput, multiline && styles.formTextArea]}
        placeholder={placeholder}
        placeholderTextColor="#a4abb4"
        value={value}
        onChangeText={onChangeText}
        textContentType={textContentType}
        multiline={multiline}
      />
    </View>
  );
}

function SecondaryButton({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Ionicons name={icon} size={17} color="#0f766e" />
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.activeChip]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.activeChipText]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <View style={styles.checkItem}>
      <Ionicons name="checkmark-circle-outline" size={18} color="#0f766e" />
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

function startOfTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function formatProjectDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatClockTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateTime(date: Date) {
  return `${date.toLocaleDateString()} ${formatClockTime(date)}`;
}

function statusLabel(status: JobStatus) {
  return jobStatuses.find((item) => item.value === status)?.label ?? status;
}

function formatServices(services: ShootService[]) {
  return services
    .map((service) => shootServices.find((item) => item.value === service)?.label ?? service)
    .join(', ');
}

function formatVideoEditFormat(format?: VideoEditFormat | null) {
  if (!format) return 'Select Video Type';
  return videoEditFormats.find((item) => item.value === format)?.label ?? format;
}

function formatFinishedVideoLength(length?: FinishedVideoLength | null) {
  if (!length) return 'Select Finished Video Length';
  return finishedVideoLengths.find((item) => item.value === length)?.label ?? length;
}

function formatVideoEditDetails(request: ShootRequest) {
  const format =
    request.videoEditFormat === 'other'
      ? request.videoEditOther
      : formatVideoEditFormat(request.videoEditFormat);
  const length =
    request.finishedVideoLength === 'other'
      ? request.finishedVideoLengthOther
      : request.finishedVideoLength
        ? formatFinishedVideoLength(request.finishedVideoLength)
        : null;
  return length ? `${format} - ${length}` : format;
}

function serviceIcon(service: ShootService): keyof typeof Ionicons.glyphMap {
  const icons: Record<ShootService, keyof typeof Ionicons.glyphMap> = {
    drone_video: 'videocam-outline',
    drone_photo: 'camera-outline',
    ground_video: 'videocam-outline',
    ground_photo: 'image-outline',
    edit_photos: 'options-outline',
    edit_into_video: 'film-outline',
    '360_tour': 'scan-outline',
    construction: 'construct-outline',
    actors: 'person-outline',
    other: 'ellipsis-horizontal-circle-outline',
  };
  return icons[service];
}

function formatRecurrence(request: ShootRequest) {
  const frequency =
    request.recurrenceFrequency === 'other'
      ? request.recurrenceOther
      : recurrenceFrequencies.find((item) => item.value === request.recurrenceFrequency)?.label;
  const endDate = request.recurrenceEndDate ? formatProjectDate(new Date(request.recurrenceEndDate)) : 'No end date';
  return `${frequency ?? 'Recurring'} until ${endDate}`;
}

function requestStatusLabel(status: ShootRequest['status']) {
  if (status === 'accepted') return 'Accepted';
  if (status === 'needs_details') return 'Needs Details';
  return 'Requested';
}

function getPasswordProblem(password: string) {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[a-z]/.test(password)) return 'Use at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Use at least one uppercase letter.';
  if (!/\d/.test(password)) return 'Use at least one number.';
  return null;
}

async function calculateDrivingRoute(sourceAddress: string, destinationAddress: string): Promise<DrivingRouteResult | null> {
  const cacheKey = `${sourceAddress.toLowerCase()}::${destinationAddress.toLowerCase()}`;
  if (routeCache.has(cacheKey)) return routeCache.get(cacheKey) ?? null;

  try {
    const [source, destination] = await Promise.all([
      geocodeAddress(sourceAddress),
      geocodeAddress(destinationAddress),
    ]);
    if (!source || !destination) {
      routeCache.set(cacheKey, null);
      return null;
    }

    const coordinates = `${source.lon},${source.lat};${destination.lon},${destination.lat}`;
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&alternatives=false&steps=false`;
    const response = await fetch(routeUrl);
    if (!response.ok) throw new Error(`Route lookup failed with ${response.status}`);
    const payload = (await response.json()) as {
      routes?: { distance?: number; duration?: number }[];
    };
    const route = payload.routes?.[0];
    if (typeof route?.distance !== 'number' || typeof route.duration !== 'number') {
      routeCache.set(cacheKey, null);
      return null;
    }

    const result = {
      distanceMiles: route.distance / 1609.344,
      travelTimeMinutes: Math.max(1, Math.round(route.duration / 60)),
    };
    routeCache.set(cacheKey, result);
    return result;
  } catch {
    routeCache.set(cacheKey, null);
    return null;
  }
}

async function geocodeAddress(address: string): Promise<Coordinate | null> {
  const censusResult = await geocodeAddressWithCensus(address);
  if (censusResult) return censusResult;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'TheKnoxvilleDroneGuyApp/1.0',
    },
  });
  if (!response.ok) return null;
  const results = (await response.json()) as { lat?: string; lon?: string }[];
  const match = results[0];
  if (!match?.lat || !match.lon) return null;
  return {
    lat: Number(match.lat),
    lon: Number(match.lon),
  };
}

async function geocodeAddressWithCensus(address: string): Promise<Coordinate | null> {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(
    address,
  )}&benchmark=Public_AR_Current&format=json`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      result?: {
        addressMatches?: {
          coordinates?: {
            x?: number;
            y?: number;
          };
        }[];
      };
    };
    const coordinates = payload.result?.addressMatches?.[0]?.coordinates;
    if (typeof coordinates?.x !== 'number' || typeof coordinates.y !== 'number') return null;
    return {
      lat: coordinates.y,
      lon: coordinates.x,
    };
  } catch {
    return null;
  }
}

function formatTravelTime(minutes: number) {
  if (minutes < 60) return `${minutes} min drive`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min drive` : `${hours} hr drive`;
}

function openAppleMapsRoute(projectAddress: string) {
  const source = encodeURIComponent(HOME_BASE_ADDRESS);
  const destination = encodeURIComponent(projectAddress);
  Linking.openURL(`http://maps.apple.com/?saddr=${source}&daddr=${destination}&dirflg=d`);
}

function assetToAttachment(asset: ImagePicker.ImagePickerAsset): Attachment {
  return {
    uri: asset.uri,
    type: asset.type === 'video' ? 'video' : 'image',
    name: asset.fileName ?? asset.uri.split('/').pop(),
  };
}

async function uploadAttachment(folder: string, attachment: Attachment): Promise<Attachment> {
  if (!storage) return attachment;
  const response = await fetch(attachment.uri);
  const blob = await response.blob();
  const extension = attachment.name?.split('.').pop() ?? (attachment.type === 'video' ? 'mov' : 'jpg');
  const storagePath = `${folder}/${Date.now()}.${extension}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, {
    contentType: attachment.type === 'video' ? 'video/quicktime' : 'image/jpeg',
  });
  return {
    ...attachment,
    uri: await getDownloadURL(storageRef),
    name: attachment.name ?? storagePath.split('/').pop(),
  };
}

async function getCurrentLocation(fallback?: Job['liveLocation']) {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Location permission needed', 'Location is only shared with the assigned client during active job work.');
    return fallback;
  }
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    updatedAt: Date.now(),
  };
}

async function registerForNotifications() {
  if (!Device.isDevice) {
    Alert.alert('Notifications', 'Push notifications require a physical device for final testing.');
    return;
  }
  const existing = await Notifications.getPermissionsAsync();
  const finalStatus = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!finalStatus.granted) {
    Alert.alert('Notifications disabled', 'Enable notifications to receive chat and job progress alerts.');
    return;
  }
  const token = await Notifications.getExpoPushTokenAsync();
  Alert.alert('Notification token ready', token.data);
}

async function scheduleLocalNotification(title: string, body: string) {
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fbfcfc',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dce5df',
  },
  kicker: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#17221d',
    fontSize: 20,
    fontWeight: '800',
  },
  rolePill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adminPill: {
    backgroundColor: '#0f766e',
  },
  clientPill: {
    backgroundColor: '#285f8f',
  },
  roleText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  notice: {
    margin: 12,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f7fbfb',
    borderWidth: 1,
    borderColor: '#e1e8e8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticeText: {
    flex: 1,
    color: '#315c5a',
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    flex: 1,
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 32,
    gap: 4,
  },
  selector: {
    maxHeight: 48,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  chip: {
    height: 36,
    maxWidth: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cdd9d2',
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  activeChip: {
    borderColor: '#0f766e',
    backgroundColor: '#e3f5f1',
  },
  chipText: {
    color: '#405048',
    fontWeight: '700',
  },
  activeChipText: {
    color: '#0f766e',
  },
  panelHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionTitle: {
    color: '#17221d',
    fontSize: 20,
    fontWeight: '800',
  },
  smallTitle: {
    color: '#17221d',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  accordionHeader: {
    minHeight: 52,
    borderRadius: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accordionTitleWrap: {
    flex: 1,
  },
  accordionTitle: {
    color: '#17221d',
    fontSize: 18,
    fontWeight: '800',
  },
  accordionSubtitle: {
    color: '#687076',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  muted: {
    color: '#687076',
    fontSize: 14,
    lineHeight: 20,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 14,
  },
  messageListContent: {
    paddingBottom: 16,
  },
  messageBubble: {
    width: '82%',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#d9f4ee',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  messageSender: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  messageText: {
    color: '#17221d',
    fontSize: 15,
    lineHeight: 21,
  },
  messageReference: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: '#f0f8f6',
  },
  messageReferenceText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  messageImage: {
    height: 150,
    borderRadius: 8,
    marginTop: 8,
  },
  mediaAttachmentButton: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce5df',
    padding: 10,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
  },
  mediaAttachmentTitle: {
    color: '#17221d',
    fontSize: 13,
    fontWeight: '800',
  },
  mediaAttachmentName: {
    color: '#687076',
    fontSize: 12,
    marginTop: 2,
  },
  mediaViewerBackdrop: {
    flex: 1,
    backgroundColor: '#050708',
  },
  mediaViewerHeader: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
    elevation: 20,
  },
  mediaViewerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  mediaViewerClose: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mediaViewerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    zIndex: 1,
  },
  mediaViewerImage: {
    width: '100%',
    height: '100%',
  },
  mediaViewerVideo: {
    width: '100%',
    height: '72%',
    backgroundColor: '#000000',
  },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dce5df',
  },
  composerReference: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7e3dc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f8f6',
  },
  composerReferenceText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '800',
  },
  composerReferenceClose: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f5f1',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f5f1',
  },
  input: {
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cdd9d2',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
    color: '#17221d',
  },
  composerInput: {
    flex: 1,
  },
  noteInput: {
    minHeight: 74,
    marginBottom: 12,
  },
  modernTextArea: {
    borderColor: '#e1e5e8',
    color: '#17221d',
    fontSize: 15,
    marginBottom: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  disabledButton: {
    opacity: 0.45,
  },
  jobsList: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  projectListCard: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cfdad3',
    marginBottom: 14,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  jobListItem: {
    minHeight: 68,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeJobListItem: {
    borderColor: '#0f766e',
    backgroundColor: '#e3f5f1',
  },
  projectProgressPanel: {
    borderTopWidth: 1,
    borderTopColor: '#cce3df',
    paddingHorizontal: 14,
    paddingTop: 14,
    backgroundColor: '#ffffff',
  },
  projectProgressHeading: {
    color: '#101820',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  historyHeader: {
    minHeight: 58,
    borderTopWidth: 1,
    borderTopColor: '#e6ece8',
    paddingTop: 14,
    marginTop: 6,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyTitle: {
    color: '#17221d',
    fontSize: 16,
    fontWeight: '800',
  },
  historySubtitle: {
    color: '#687076',
    fontSize: 12,
    marginTop: 2,
  },
  historyCountPill: {
    minWidth: 30,
    height: 28,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f5f2',
  },
  historyCountText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  historyEmpty: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f7fbfb',
  },
  historyEmptyText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  historyJobListItem: {
    backgroundColor: '#fbfcfc',
  },
  jobListTitle: {
    color: '#17221d',
    fontSize: 15,
    fontWeight: '800',
  },
  statusPillSmall: {
    maxWidth: 112,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f0f5f2',
  },
  statusTextSmall: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  projectMapSection: {
    borderTopWidth: 1,
    borderTopColor: '#e6ece8',
    paddingTop: 14,
    marginTop: 2,
    marginBottom: 14,
  },
  projectMapHeading: {
    color: '#101820',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  projectMapWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dce5df',
    backgroundColor: '#ffffff',
  },
  map: {
    height: 230,
  },
  mapCaption: {
    padding: 10,
    color: '#405048',
    fontSize: 12,
  },
  projectLocationClosed: {
    minHeight: 58,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  projectLocationText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  adminPanel: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e8e6',
    gap: 12,
  },
  notificationsPanel: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e8e6',
    gap: 12,
  },
  notificationsHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationCard: {
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce5df',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fbfdfc',
  },
  notificationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f5f1',
  },
  notificationTitle: {
    color: '#17221d',
    fontSize: 15,
    fontWeight: '800',
  },
  shootRequestCard: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e8e6',
    gap: 12,
  },
  formTitle: {
    color: '#101820',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  formInputRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e8',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
  },
  formTextInput: {
    flex: 1,
    color: '#17221d',
    fontSize: 15,
    minHeight: 44,
  },
  formTextAreaRow: {
    minHeight: 78,
    alignItems: 'flex-start',
    paddingTop: 14,
  },
  formTextArea: {
    minHeight: 56,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  formSelectRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e8',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
  },
  formSelectText: {
    flex: 1,
    color: '#17221d',
    fontSize: 15,
    fontWeight: '600',
  },
  formPlaceholderText: {
    color: '#a4abb4',
    fontWeight: '500',
  },
  conditionalPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e8e8',
    padding: 12,
    gap: 10,
    backgroundColor: '#f7fbfb',
  },
  selectOptionList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e8',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  selectOptionRow: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e1e5e8',
  },
  selectOptionText: {
    color: '#17221d',
    fontSize: 14,
    fontWeight: '700',
  },
  validationErrorBorder: {
    borderColor: '#dc2626',
    borderWidth: 1.5,
  },
  validationErrorGroup: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#dc2626',
    padding: 8,
  },
  requestCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce5df',
    padding: 12,
    backgroundColor: '#fbfdfc',
    gap: 4,
  },
  acceptedRequestCard: {
    backgroundColor: '#f7fbfb',
  },
  focusedRequestCard: {
    borderColor: '#0f766e',
    borderWidth: 1.5,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  requestTitle: {
    color: '#17221d',
    fontSize: 15,
    fontWeight: '800',
  },
  requestStatusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#e3f5f1',
  },
  acceptedRequestPill: {
    backgroundColor: '#dff3ee',
  },
  requestStatusText: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '800',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  pendingMediaPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e8e8',
    padding: 12,
    gap: 10,
    backgroundColor: '#f7fbfb',
  },
  pendingMediaInfo: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingMediaText: {
    color: '#17221d',
    fontSize: 14,
    fontWeight: '800',
  },
  flexOne: {
    flex: 1,
  },
  formLabel: {
    color: '#17221d',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  suggestionBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce5df',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  suggestionItem: {
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dce5df',
  },
  suggestionText: {
    flex: 1,
    color: '#17221d',
    fontSize: 13,
    lineHeight: 18,
  },
  radioRow: {
    minHeight: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e8',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
  },
  radioText: {
    color: '#101820',
    fontWeight: '800',
  },
  radioSubText: {
    color: '#7c8590',
    fontSize: 12,
    marginTop: 2,
  },
  requestSentBanner: {
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
  },
  requestSentText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  recurringBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e8',
    padding: 14,
    gap: 12,
    backgroundColor: '#fbfcfc',
  },
  distancePanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce5df',
    padding: 12,
    gap: 10,
    backgroundColor: '#ffffff',
  },
  distanceTextWrap: {
    gap: 3,
  },
  distanceValue: {
    color: '#17221d',
    fontSize: 16,
    fontWeight: '800',
  },
  distanceSubValue: {
    color: '#405048',
    fontSize: 14,
    fontWeight: '700',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  serviceButton: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e8',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  activeServiceButton: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  serviceButtonText: {
    color: '#17221d',
    fontSize: 13,
    fontWeight: '700',
  },
  activeServiceButtonText: {
    color: '#ffffff',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statusButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cdd9d2',
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  activeStatusButton: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  statusButtonText: {
    color: '#405048',
    fontSize: 13,
    fontWeight: '700',
  },
  activeStatusButtonText: {
    color: '#ffffff',
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 16,
    minHeight: 118,
  },
  timelineRail: {
    width: 18,
    alignItems: 'center',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0f9488',
    marginTop: 7,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
    backgroundColor: '#e0e6e9',
  },
  timelineBody: {
    flex: 1,
    paddingBottom: 22,
  },
  timelineTitleRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timelineTitle: {
    color: '#101820',
    fontSize: 20,
    fontWeight: '800',
  },
  timelineEditButton: {
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e3f5f1',
  },
  timelineEditText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  timelineText: {
    color: '#59616b',
    marginTop: 8,
    fontSize: 16,
    lineHeight: 23,
  },
  timelineTimeRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  timelineTime: {
    color: '#7c8590',
    fontSize: 15,
  },
  updateImage: {
    height: 160,
    borderRadius: 8,
    marginTop: 8,
  },
  updateEditor: {
    gap: 10,
  },
  accountCard: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  accountActions: {
    gap: 10,
    marginTop: 14,
  },
  signInBox: {
    gap: 10,
    marginTop: 14,
  },
  authToggle: {
    minHeight: 42,
    borderRadius: 8,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#f0f5f2',
  },
  authToggleButton: {
    flex: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAuthToggleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  authToggleText: {
    color: '#687076',
    fontWeight: '800',
  },
  activeAuthToggleText: {
    color: '#0f766e',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#0f766e',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontWeight: '800',
  },
  checkItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 9,
  },
  checkText: {
    flex: 1,
    color: '#405048',
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    gap: 10,
  },
  tabBar: {
    height: 68,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dce5df',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabIconWrap: {
    minWidth: 28,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -7,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  tabLabel: {
    color: '#687076',
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabLabel: {
    color: '#0f766e',
  },
  legalText: {
    color: '#405048',
    fontSize: 14,
    lineHeight: 21,
  },
  legalLinkRow: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f7fbfb',
  },
  legalLinkText: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '800',
  },
});
