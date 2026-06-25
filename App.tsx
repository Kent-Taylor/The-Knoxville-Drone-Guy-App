import { StatusBar } from 'expo-status-bar';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Google from 'expo-auth-session/providers/google';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { ComponentProps, ErrorInfo, ReactNode } from 'react';
import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, functions, isFirebaseConfigured, storage } from './src/firebase';
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

WebBrowser.maybeCompleteAuthSession();

const websiteUrl = 'https://www.theknoxvilledroneguy.com';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const googlePlatformClientId =
  Platform.select({
    ios: googleIosClientId,
    android: googleAndroidClientId,
    default: googleWebClientId,
  }) || googleWebClientId;
const isRunningInExpoGo = Constants.appOwnership === 'expo';
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
  user: isFirebaseConfigured ? null : clientUser,
  clients: isFirebaseConfigured ? [] : [clientUser],
  threads: isFirebaseConfigured ? [] : [demoThread],
  messages: isFirebaseConfigured
    ? []
    : [
        {
          id: 'message-1',
          threadId: demoThread.id,
          senderId: adminUser.uid,
          senderName: adminUser.displayName,
          body: 'Thanks, I will keep you updated here.',
          createdAt: demoThread.updatedAt,
        },
      ],
  jobs: isFirebaseConfigured ? [] : [demoJob, demoSecondJob],
  shootRequests: isFirebaseConfigured ? [] : [demoShootRequest],
};

type TabKey = 'website' | 'chat' | 'jobs' | 'notifications' | 'account';
type ShootRequestDraft = Omit<ShootRequest, 'id' | 'clientId' | 'clientName' | 'status' | 'createdAt'>;
type AdminProjectDraft = {
  linkedClient?: AppUser;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  title: string;
  address: string;
  notes: string;
  scheduledAt: number;
  services: ShootService[];
  otherDescription?: string;
  videoEditFormat?: VideoEditFormat;
  videoEditOther?: string;
  finishedVideoLength?: FinishedVideoLength;
  finishedVideoLengthOther?: string;
};
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

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App startup error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.errorScreen}>
          <Text style={styles.errorTitle}>The app hit a startup error</Text>
          <Text style={styles.errorText}>{this.state.error.message}</Text>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

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
  return (
    <AppErrorBoundary>
      <RootApp />
    </AppErrorBoundary>
  );
}

function RootApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('website');
  const [data, setData] = useState<AppData>(initialData);
  const [selectedThreadId, setSelectedThreadId] = useState(demoThread.id);
  const [selectedJobId, setSelectedJobId] = useState(demoJob.id);
  const [selectedMedia, setSelectedMedia] = useState<Attachment | null>(null);
  const [chatViewedAtByUser, setChatViewedAtByUser] = useState<Record<string, number>>({});
  const [seenAlertKeysByUser, setSeenAlertKeysByUser] = useState<Record<string, string[]>>({});
  const [pendingChatReference, setPendingChatReference] = useState<ChatReference | undefined>();
  const [focusedRequestId, setFocusedRequestId] = useState<string | undefined>();
  const referenceSlide = useRef(new Animated.Value(0)).current;
  const lastSignedInUid = useRef<string | null>(null);
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
        lastSignedInUid.current = null;
        setData((current) => ({ ...current, user: null, clients: [], threads: [], messages: [], jobs: [], shootRequests: [] }));
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
      if (lastSignedInUid.current !== firebaseUser.uid) {
        lastSignedInUid.current = firebaseUser.uid;
        setActiveTab('jobs');
      }
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
    if (!isFirebaseConfigured || !db || user?.role !== 'admin') {
      if (user?.role === 'admin') {
        setData((current) => ({ ...current, clients: [clientUser] }));
      }
      return undefined;
    }
    const usersQuery = query(collection(db, 'users'), orderBy('displayName', 'asc'));

    return onSnapshot(usersQuery, (snapshot) => {
      const clients = snapshot.docs
        .map((item) => ({ uid: item.id, ...item.data() }) as AppUser)
        .filter((item) => item.role === 'client')
        .sort((first, second) => first.displayName.localeCompare(second.displayName));
      setData((current) => ({ ...current, clients }));
    });
  }, [user?.role]);

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
    setData((current) => ({ ...current, user: role === 'admin' ? adminUser : clientUser, clients: [clientUser] }));
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
      await addDoc(collection(db, 'chatThreads', selectedThread.id, 'messages'), toFirestoreData(message));
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
      await setDoc(doc(db, 'jobs', job.id, 'updates', update.id), toFirestoreData(update));
      scheduleLocalNotification('Project status updated', `${job.clientName} would be notified: ${statusLabel(status)}.`);
      return;
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

  const createAdminProject = async (project: AdminProjectDraft) => {
    if (!isAdmin) return '';
    const route = await calculateDrivingRoute(HOME_BASE_ADDRESS, project.address);
    const linkedClient = project.linkedClient;
    const claimCode = linkedClient
      ? undefined
      : generateProjectClaimCode(data.jobs.map((job) => job.projectClaimCode).filter(Boolean) as string[]);
    const placeholderClientId = claimCode ? `unclaimed-${claimCode}` : undefined;
    const jobId = `job-${Date.now()}`;
    const initialUpdate: JobUpdate = {
      id: `update-${Date.now()}`,
      jobId,
      status: 'scheduled',
      note: project.notes.trim() || 'Project created.',
      createdAt: Date.now(),
    };
    const job: Job = {
      id: jobId,
      clientId: linkedClient?.uid ?? placeholderClientId ?? `unclaimed-${jobId}`,
      clientName: linkedClient?.displayName ?? project.clientName.trim(),
      clientEmail: linkedClient?.email ?? project.clientEmail?.trim() ?? undefined,
      clientPhone: project.clientPhone?.trim() || undefined,
      title: project.title.trim(),
      address: project.address.trim(),
      projectClaimCode: claimCode,
      claimStatus: linkedClient ? 'claimed' : 'unclaimed',
      claimedByUid: linkedClient?.uid,
      claimedAt: linkedClient ? Date.now() : undefined,
      homeBaseAddress: HOME_BASE_ADDRESS,
      routeDistanceMiles: route?.distanceMiles,
      routeTravelTimeMinutes: route?.travelTimeMinutes,
      routeDistanceStatus: route ? 'ready' : 'failed',
      routeDistanceUpdatedAt: Date.now(),
      status: 'scheduled',
      scheduledAt: project.scheduledAt,
      services: project.services,
      otherDescription: project.otherDescription,
      videoEditFormat: project.videoEditFormat,
      videoEditOther: project.videoEditOther,
      finishedVideoLength: project.finishedVideoLength,
      finishedVideoLengthOther: project.finishedVideoLengthOther,
      updates: [initialUpdate],
    };

    if (isFirebaseConfigured && db) {
      if (!linkedClient && placeholderClientId) {
        await setDoc(
          doc(db, 'users', placeholderClientId),
          toFirestoreData({
            email: project.clientEmail?.trim() || '',
            displayName: project.clientName.trim(),
            phone: project.clientPhone?.trim() || '',
            role: 'client',
            notificationPreference: 'all',
            placeholder: true,
            projectClaimCode: claimCode,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }),
          { merge: true },
        );
      }
      await setDoc(doc(db, 'jobs', job.id), toFirestoreData({ ...job, updates: [] }));
      await setDoc(doc(db, 'jobs', job.id, 'updates', initialUpdate.id), toFirestoreData(initialUpdate));
    }

    setData((current) => ({
      ...current,
      clients:
        !linkedClient && placeholderClientId
          ? [
              {
                uid: placeholderClientId,
                email: project.clientEmail?.trim() || '',
                displayName: project.clientName.trim(),
                role: 'client',
                notificationPreference: 'all',
              },
              ...current.clients,
            ]
          : current.clients,
      jobs: [job, ...current.jobs],
    }));
    setSelectedJobId(job.id);
    scheduleLocalNotification(
      'Project created',
      linkedClient ? `Project linked to ${linkedClient.displayName}.` : `Client signup code: ${claimCode}`,
    );
    return claimCode ?? '';
  };

  const deleteProject = async (job: Job) => {
    if (!isAdmin) return;
    if (isFirebaseConfigured && db) {
      const firestore = db;
      await Promise.all(
        job.updates.map((update) =>
          deleteDoc(doc(firestore, 'jobs', job.id, 'updates', update.firestoreId ?? update.id)),
        ),
      );
      await deleteDoc(doc(firestore, 'jobs', job.id));
    }
    setData((current) => ({
      ...current,
      jobs: current.jobs.filter((item) => item.id !== job.id),
    }));
    if (selectedJobId === job.id) {
      const nextJob = data.jobs.find((item) => item.id !== job.id);
      setSelectedJobId(nextJob?.id ?? '');
    }
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

  const deleteJobUpdate = async (job: Job, updateId: string) => {
    const targetUpdate = job.updates.find((update) => update.id === updateId);
    const remainingUpdates = job.updates
      .filter((update) => update.id !== updateId)
      .sort((first, second) => second.createdAt - first.createdAt);
    const currentStatus = remainingUpdates[0]?.status ?? job.status;

    if (isFirebaseConfigured && db && targetUpdate) {
      await deleteDoc(doc(db, 'jobs', job.id, 'updates', targetUpdate.firestoreId ?? targetUpdate.id));
      await updateDoc(doc(db, 'jobs', job.id), { status: currentStatus });
    }

    setData((current) => ({
      ...current,
      jobs: current.jobs.map((item) =>
        item.id === job.id
          ? {
              ...item,
              status: currentStatus,
              updates: remainingUpdates,
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
      await addDoc(collection(db, 'shootRequests'), toFirestoreData(shootRequest));
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
      await setDoc(doc(db, 'jobs', acceptedJob.id), toFirestoreData({ ...acceptedJob, updates: [] }));
      await setDoc(doc(db, 'jobs', acceptedJob.id, 'updates', acceptedJob.updates[0].id), toFirestoreData(acceptedJob.updates[0]));
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
      await updateDoc(doc(db, 'shootRequests', request.id), toFirestoreData(updatedFields));
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
        await setDoc(doc(db, 'chatThreads', thread.id), toFirestoreData(thread));
      }
      setData((current) => ({ ...current, threads: [thread, ...current.threads] }));
    }
    setPendingChatReference({ type: 'shoot_request', id: request.id, title: request.title });
    setSelectedThreadId(thread.id);
    setActiveTab('chat');
  };

  const startChatThread = async (client?: AppUser) => {
    if (!user) return;
    const targetClient = isAdmin ? client : user;
    if (!targetClient) {
      Alert.alert('Choose a client', 'Select a client before starting a new message.');
      return;
    }
    const existingThread = data.threads.find((thread) => thread.clientId === targetClient.uid);
    if (existingThread) {
      setSelectedThreadId(existingThread.id);
      return;
    }

    const thread: ChatThread = {
      id: `thread-${targetClient.uid}`,
      clientId: targetClient.uid,
      clientName: targetClient.displayName,
      lastMessage: '',
      updatedAt: Date.now(),
    };

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'chatThreads', thread.id), toFirestoreData(thread));
    }
    setData((current) => ({ ...current, threads: [thread, ...current.threads] }));
    setSelectedThreadId(thread.id);
  };

  const openShootRequestReference = (requestId: string) => {
    setFocusedRequestId(requestId);
    referenceSlide.setValue(1);
    setActiveTab('jobs');
    Animated.timing(referenceSlide, {
      toValue: 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const referenceSlideStyle = {
    opacity: referenceSlide.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.98],
    }),
    transform: [
      {
        translateX: referenceSlide.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 24],
        }),
      },
    ],
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
          onStartThread={startChatThread}
          pendingReference={pendingChatReference}
          selectedThread={selectedThread}
          setSelectedThreadId={setSelectedThreadId}
          threads={visibleThreads}
          clients={data.clients}
          user={user}
        />
      );
    }
    if (activeTab === 'jobs') {
      return (
        <JobsScreen
          isAdmin={isAdmin}
          clients={data.clients}
          jobs={visibleJobs}
          onAcceptShootRequest={acceptShootRequest}
          onCreateAdminProject={createAdminProject}
          onDeleteProject={deleteProject}
          onDeleteUpdate={deleteJobUpdate}
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
        {user && (
          <View style={[styles.rolePill, isAdmin ? styles.adminPill : styles.clientPill]}>
            <Text style={styles.roleText}>{isAdmin ? 'Admin' : 'Client'}</Text>
          </View>
        )}
      </View>
      {!isFirebaseConfigured && (
        <View style={styles.notice}>
          <Ionicons name="construct-outline" size={22} color={theme.indigo} />
          <Text style={styles.noticeText}>Demo mode: add Firebase env values to connect live auth, chat, projects, media, and notifications.</Text>
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Animated.View style={[styles.content, referenceSlideStyle]}>
          {renderContent()}
        </Animated.View>
      </KeyboardAvoidingView>
      <MediaViewer attachment={selectedMedia} onClose={() => setSelectedMedia(null)} />
      {user && (
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
                  <Ionicons name={tab.icon} size={22} color={active ? theme.indigo : theme.muted} />
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
      )}
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
  clients,
  isAdmin,
  messages,
  onClearReference,
  onOpenMedia,
  onOpenReference,
  onSend,
  onStartThread,
  pendingReference,
  selectedThread,
  setSelectedThreadId,
  threads,
  user,
}: {
  clients: AppUser[];
  isAdmin: boolean;
  messages: ChatMessage[];
  onClearReference: () => void;
  onOpenMedia: (attachment: Attachment) => void;
  onOpenReference: (requestId: string) => void;
  onSend: (body: string, attachment?: Attachment, reference?: ChatReference) => Promise<void>;
  onStartThread: (client?: AppUser) => Promise<void>;
  pendingReference?: ChatReference;
  selectedThread?: ChatThread;
  setSelectedThreadId: (threadId: string) => void;
  threads: ChatThread[];
  user: AppUser;
}) {
  const [body, setBody] = useState('');
  const [startingThread, setStartingThread] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const filteredClients = useMemo(() => {
    const needle = clientSearch.trim().toLowerCase();
    const existingClientIds = new Set(threads.map((thread) => thread.clientId));
    return clients
      .filter((client) => !existingClientIds.has(client.uid))
      .filter((client) => {
        if (!needle) return true;
        return `${client.displayName} ${client.email}`.toLowerCase().includes(needle);
      })
      .sort((first, second) => first.displayName.localeCompare(second.displayName));
  }, [clientSearch, clients, threads]);

  const startNewThread = async (client?: AppUser) => {
    if (startingThread) return;
    setStartingThread(true);
    try {
      await onStartThread(client);
      setShowClientPicker(false);
      setClientSearch('');
    } catch (error) {
      Alert.alert('Message not started', getFirebaseWriteMessage(error));
    } finally {
      setStartingThread(false);
    }
  };

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
      try {
        await onSend(body, assetToAttachment(result.assets[0]), pendingReference);
        setBody('');
        Keyboard.dismiss();
      } catch (error) {
        Alert.alert('Message not sent', getFirebaseWriteMessage(error));
      }
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
      try {
        await onSend(body, assetToAttachment(result.assets[0]), pendingReference);
        setBody('');
        Keyboard.dismiss();
      } catch (error) {
        Alert.alert('Message not sent', getFirebaseWriteMessage(error));
      }
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.newMessagePanel}>
        <View style={styles.flexOne}>
          <Text style={styles.smallTitle}>New Message</Text>
          <Text style={styles.muted}>
            {isAdmin ? 'Choose a client to start a direct conversation.' : 'Send a direct message to The Knoxville Drone Guy.'}
          </Text>
        </View>
        <SecondaryButton
          label={isAdmin ? 'Choose Client' : 'New Message'}
          icon="create-outline"
          onPress={() => {
            if (isAdmin) {
              setShowClientPicker((current) => !current);
              return;
            }
            startNewThread(user);
          }}
        />
      </View>
      {isAdmin && showClientPicker && (
        <View style={styles.clientPickerPanel}>
          <IconTextInput
            icon="search-outline"
            placeholder="Search clients"
            value={clientSearch}
            onChangeText={setClientSearch}
          />
          <View style={styles.clientPickerList}>
            {filteredClients.length === 0 ? (
              <Text style={styles.muted}>No clients without chats found.</Text>
            ) : (
              filteredClients.map((client) => (
                <Pressable key={client.uid} style={styles.clientPickerRow} onPress={() => startNewThread(client)}>
                  <View style={styles.flexOne}>
                    <Text style={styles.clientPickerName}>{client.displayName}</Text>
                    <Text style={styles.clientPickerEmail}>{client.email}</Text>
                  </View>
                  {startingThread ? (
                    <ActivityIndicator color={theme.indigo} />
                  ) : (
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.indigo} />
                  )}
                </Pressable>
              ))
            )}
          </View>
        </View>
      )}
      {isAdmin && threads.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector}>
          {threads.map((thread) => (
            <Chip
              key={thread.id}
              label={thread.clientName}
              active={selectedThread?.id === thread.id}
              onPress={() => setSelectedThreadId(thread.id)}
            />
          ))}
        </ScrollView>
      )}
      {!selectedThread ? (
        <EmptyState
          title="No messages yet"
          body={isAdmin ? 'Start a conversation by choosing a client.' : 'Tap New Message to send The Knoxville Drone Guy a direct message.'}
        />
      ) : (
        <>
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
              <Ionicons name="close-outline" size={18} color={theme.pink} />
            </Pressable>
          </View>
        )}
        <View style={styles.composerRow}>
          <Pressable style={styles.iconButton} onPress={attachFromCamera}>
            <Ionicons name="camera-outline" size={22} color={theme.indigo} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={attachFromLibrary}>
            <Ionicons name="image-outline" size={22} color={theme.indigo} />
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
              try {
                await onSend(body, undefined, pendingReference);
                setBody('');
                Keyboard.dismiss();
              } catch (error) {
                Alert.alert('Message not sent', getFirebaseWriteMessage(error));
              }
            }}
            disabled={!body.trim()}
          >
            <Ionicons name="send" size={19} color="#ffffff" />
          </Pressable>
        </View>
      </View>
        </>
      )}
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
            <Ionicons name="checkmark-circle-outline" size={18} color={theme.muted} />
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
                    color={theme.indigo}
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
                <Ionicons name="chevron-forward-outline" size={18} color={theme.muted} />
              </Pressable>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function JobsScreen({
  clients,
  focusedRequestId,
  isAdmin,
  jobs,
  onAcceptShootRequest,
  onCreateAdminProject,
  onDeleteProject,
  onDeleteUpdate,
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
  clients: AppUser[];
  focusedRequestId?: string;
  isAdmin: boolean;
  jobs: Job[];
  onAcceptShootRequest: (request: ShootRequest) => Promise<void>;
  onCreateAdminProject: (project: AdminProjectDraft) => Promise<string>;
  onDeleteProject: (job: Job) => Promise<void>;
  onDeleteUpdate: (job: Job, updateId: string) => Promise<void>;
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
  const [requestsExpanded, setRequestsExpanded] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(focusedRequestId ?? null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [statusUpdatingKey, setStatusUpdatingKey] = useState('');
  const statusUpdateLock = useRef('');
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

  useEffect(() => {
    if (focusedRequestId) {
      setRequestsExpanded(true);
      setExpandedRequestId(focusedRequestId);
    }
  }, [focusedRequestId]);

  if (!selectedJob) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {isAdmin && <AdminCreateProjectForm clients={clients} onSubmit={onCreateAdminProject} />}
        {!isAdmin && <ShootRequestForm onSubmit={onSubmitShootRequest} user={user} />}
        <EmptyState title="No projects yet" body="Assigned projects and progress updates will appear here." />
      </ScrollView>
    );
  }

  const activeJobs = jobs.filter((job) => job.status !== 'job_complete');
  const historyJobs = jobs.filter((job) => job.status === 'job_complete');
  const openShootRequests = shootRequests.filter((request) => request.status !== 'accepted');

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

  const runStatusUpdate = async (job: Job, status: JobStatus, updateNote?: string, attachment?: Attachment) => {
    const lockKey = `${job.id}:${status}`;
    if (statusUpdateLock.current) return;
    statusUpdateLock.current = lockKey;
    setStatusUpdatingKey(lockKey);
    try {
      await onUpdateStatus(job, status, updateNote, attachment);
    } catch (error) {
      Alert.alert('Status not updated', getFirebaseWriteMessage(error));
    } finally {
      statusUpdateLock.current = '';
      setStatusUpdatingKey('');
    }
  };

  const postPendingMediaUpdate = async () => {
    if (!pendingMedia) return;
    await runStatusUpdate(selectedJob, selectedJob.status, note || 'Media update added.', pendingMedia);
    setPendingMedia(null);
    setNote('');
  };

  const startEditingRequest = (request: ShootRequest) => {
    setRequestsExpanded(true);
    setExpandedRequestId(request.id);
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

  const confirmDeleteProject = (job: Job) => {
    Alert.alert(
      'Delete project?',
      `This will remove "${job.title}" from the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDeleteProject(job);
            } catch (error) {
              Alert.alert('Project not deleted', getFirebaseWriteMessage(error));
            }
          },
        },
      ],
    );
  };

  const renderProjectCard = (job: Job, isHistory = false) => {
    const selected = selectedJob.id === job.id;
    const showMap = job.liveLocation && locationVisibleStatuses.includes(job.status);
    const statusColors = jobStatusColors(job.status);
    const visibleUpdates = dedupeRapidStatusUpdates(job.updates);
    return (
      <View
        key={job.id}
        style={[styles.projectListCard, isHistory && styles.historyJobListItem, selected && styles.activeJobListItem]}
      >
        <Pressable style={styles.jobListItem} onPress={() => setSelectedJobId(job.id)}>
          <View style={styles.flexOne}>
            <Text style={styles.jobListTitle}>{job.title}</Text>
            <Text style={styles.muted}>{job.clientName} · {job.address}</Text>
            {job.services && job.services.length > 0 && (
              <Text style={styles.claimCodeInline}>Project Scope: {formatServices(job.services)}</Text>
            )}
            {isAdmin && job.projectClaimCode && (
              <Text style={styles.claimCodeInline}>
                Client Signup Code: {job.projectClaimCode} · {job.claimStatus === 'claimed' ? 'Claimed' : 'Unclaimed'}
              </Text>
            )}
          </View>
          <View style={[styles.statusPillSmall, { backgroundColor: statusColors.backgroundColor }]}>
            <Text style={[styles.statusTextSmall, { color: statusColors.color }]}>{statusLabel(job.status)}</Text>
          </View>
          <Ionicons name={selected ? 'chevron-up' : 'chevron-down'} size={18} color={theme.muted} />
        </Pressable>
        {selected && (
          <View style={styles.projectProgressPanel}>
            <Text style={styles.projectProgressHeading}>Progress updates</Text>
            {visibleUpdates.map((update, index) => (
              <JobUpdateRow
                key={update.id}
                isAdmin={isAdmin}
                job={job}
                isLast={index === visibleUpdates.length - 1}
                onOpenMedia={onOpenMedia}
                onDelete={onDeleteUpdate}
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
                  <Ionicons name="location-outline" size={20} color={theme.muted} />
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
      {isAdmin && <AdminCreateProjectForm clients={clients} onSubmit={onCreateAdminProject} />}
      {!isAdmin && <ShootRequestForm onSubmit={onSubmitShootRequest} user={user} />}
      {(isAdmin || openShootRequests.length > 0) && (
        <View style={styles.adminPanel}>
          <Pressable
            style={styles.accordionHeader}
            onPress={() => {
              setRequestsExpanded((current) => {
                if (current) {
                  setExpandedRequestId(null);
                  setEditingRequestId(null);
                }
                return !current;
              });
            }}
          >
            <View style={styles.accordionTitleWrap}>
              <Text style={styles.accordionTitle}>{isAdmin ? 'Project Shoot Requests' : 'My Project Requests'}</Text>
              <Text style={styles.accordionSubtitle}>
                {isAdmin ? 'Review client project requests.' : 'Submitted project requests and updates.'}
              </Text>
            </View>
            <View style={styles.historyCountPill}>
              <Text style={styles.historyCountText}>{openShootRequests.length}</Text>
            </View>
            <Ionicons name={requestsExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={theme.muted} />
          </Pressable>
          {requestsExpanded && (
            openShootRequests.length === 0 ? (
              <Text style={styles.muted}>New client requests will appear here.</Text>
            ) : (
              openShootRequests.map((request) => {
                const editing = editingRequestId === request.id;
                const expanded = expandedRequestId === request.id || editing;
                const requestColors = shootRequestStatusColors(request.status);
                return (
                  <View
                    key={request.id}
                    style={[
                      styles.requestCard,
                      focusedRequestId === request.id && styles.focusedRequestCard,
                    ]}
                  >
                    <Pressable
                      style={styles.requestHeader}
                      onPress={() => {
                        if (editing) return;
                        setExpandedRequestId((current) => (current === request.id ? null : request.id));
                      }}
                    >
                      <View style={styles.flexOne}>
                        <Text style={styles.requestTitle}>{request.title}</Text>
                        <Text style={styles.muted}>{request.requesterName || request.clientName}</Text>
                      </View>
                      <View style={[styles.requestStatusPill, { backgroundColor: requestColors.backgroundColor }]}>
                        <Text style={[styles.requestStatusText, { color: requestColors.color }]}>
                          {requestStatusLabel(request.status)}
                        </Text>
                      </View>
                      <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.muted} />
                    </Pressable>
                    {expanded && (
                      editing ? (
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
                          <View style={styles.rowActions}>
                            {isAdmin && (
                              <SecondaryButton label="Message" icon="chatbubble-outline" onPress={() => onRequestShootDetails(request)} />
                            )}
                            <SecondaryButton label="Edit" icon="create-outline" onPress={() => startEditingRequest(request)} />
                            {isAdmin && (
                              <SecondaryButton label="Accept" icon="checkmark-outline" onPress={() => onAcceptShootRequest(request)} />
                            )}
                          </View>
                        </>
                      )
                    )}
                  </View>
                );
              })
            )
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
          <Ionicons name={projectsExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={theme.muted} />
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
          <Ionicons name={historyExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={theme.muted} />
        </Pressable>
        {historyExpanded && (
          historyJobs.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Ionicons name="archive-outline" size={18} color={theme.muted} />
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
            {jobStatuses.map((status) => {
              const updating = statusUpdatingKey === `${selectedJob.id}:${status.value}`;
              return (
                <Pressable
                  key={status.value}
                  style={[
                    styles.statusButton,
                    selectedJob.status === status.value && styles.activeStatusButton,
                    statusUpdateLock.current && styles.disabledButton,
                  ]}
                  disabled={Boolean(statusUpdateLock.current)}
                  onPress={async () => {
                    await runStatusUpdate(selectedJob, status.value, note);
                    setNote('');
                  }}
                >
                  {updating && <ActivityIndicator size="small" color={selectedJob.status === status.value ? '#ffffff' : theme.indigo} />}
                  <Text style={[styles.statusButtonText, selectedJob.status === status.value && styles.activeStatusButtonText]}>
                    {updating ? 'Updating...' : status.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <PrimaryButton label="Attach Media Update" icon="cloud-upload-outline" onPress={addMediaUpdate} />
          <SecondaryButton label="Delete Project" icon="trash-outline" variant="danger" onPress={() => confirmDeleteProject(selectedJob)} />
          {pendingMedia && (
            <View style={styles.pendingMediaPanel}>
              <View style={styles.pendingMediaInfo}>
                <Ionicons name={pendingMedia.type === 'video' ? 'videocam-outline' : 'image-outline'} size={20} color={theme.indigo} />
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

function AdminCreateProjectForm({
  clients,
  onSubmit,
}: {
  clients: AppUser[];
  onSubmit: (project: AdminProjectDraft) => Promise<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [services, setServices] = useState<ShootService[]>([]);
  const [otherDescription, setOtherDescription] = useState('');
  const [videoEditFormat, setVideoEditFormat] = useState<VideoEditFormat | null>(null);
  const [showVideoEditFormatPicker, setShowVideoEditFormatPicker] = useState(false);
  const [videoEditOther, setVideoEditOther] = useState('');
  const [finishedVideoLength, setFinishedVideoLength] = useState<FinishedVideoLength | null>(null);
  const [showFinishedVideoLengthPicker, setShowFinishedVideoLengthPicker] = useState(false);
  const [finishedVideoLengthOther, setFinishedVideoLengthOther] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const submitLock = useRef(false);

  const sortedClients = useMemo(
    () => [...clients].sort((first, second) => first.displayName.localeCompare(second.displayName)),
    [clients],
  );
  const selectedClient = sortedClients.find((client) => client.uid === selectedClientId);
  const filteredClients = useMemo(() => {
    const needle = clientSearch.trim().toLowerCase();
    if (!needle) return sortedClients;
    return sortedClients.filter((client) =>
      `${client.displayName} ${client.email}`.toLowerCase().includes(needle),
    );
  }, [clientSearch, sortedClients]);

  const onlyClientId = sortedClients.length === 1 ? sortedClients[0].uid : '';
  useEffect(() => {
    if (!selectedClientId && onlyClientId) {
      setSelectedClientId(onlyClientId);
    }
  }, [onlyClientId, selectedClientId]);

  useEffect(() => {
    if (sortedClients.length === 0) {
      setClientMode('new');
      setSelectedClientId('');
    }
  }, [sortedClients.length]);

  const filteredAddresses = useMemo(() => {
    const needle = address.trim().toLowerCase();
    if (needle.length < 3) return [];
    return addressSuggestions
      .filter((suggestion) => suggestion.toLowerCase().includes(needle) && suggestion !== address)
      .slice(0, 4);
  }, [address]);

  const clearValidationError = (field: string) => {
    setValidationErrors((current) => current.filter((item) => item !== field));
  };
  const hasError = (field: string) => validationErrors.includes(field);
  const selectedOther = services.includes('other');
  const selectedVideoEdit = services.includes('edit_into_video');
  const requiresFinishedVideoLength = selectedVideoEdit && (videoEditFormat === 'long_format' || videoEditFormat === 'other');

  const toggleService = (service: ShootService) => {
    setServices((current) => {
      const nextServices = current.includes(service) ? current.filter((item) => item !== service) : [...current, service];
      if (service === 'edit_into_video' && current.includes(service)) {
        setVideoEditFormat(null);
        setVideoEditOther('');
        setFinishedVideoLength(null);
        setFinishedVideoLengthOther('');
      }
      if (service === 'other' && current.includes(service)) {
        setOtherDescription('');
      }
      return nextServices;
    });
    setValidationErrors((current) =>
      current.filter(
        (item) =>
          ![
            'services',
            'otherDescription',
            'videoEditFormat',
            'videoEditOther',
            'finishedVideoLength',
            'finishedVideoLengthOther',
          ].includes(item),
      ),
    );
  };

  const submit = async () => {
    if (submitting || submitLock.current) return;
    submitLock.current = true;
    const errors = [
      ...(clientMode === 'existing' && !selectedClient ? ['selectedClient'] : []),
      ...(clientMode === 'new' && !clientName.trim() ? ['clientName'] : []),
      ...(!title.trim() ? ['title'] : []),
      ...(!scheduledDate ? ['scheduledDate'] : []),
      ...(!scheduledTime ? ['scheduledTime'] : []),
      ...(!address.trim() ? ['address'] : []),
      ...(services.length === 0 ? ['services'] : []),
      ...(selectedOther && !otherDescription.trim() ? ['otherDescription'] : []),
      ...(selectedVideoEdit && !videoEditFormat ? ['videoEditFormat'] : []),
      ...(selectedVideoEdit && videoEditFormat === 'other' && !videoEditOther.trim() ? ['videoEditOther'] : []),
      ...(requiresFinishedVideoLength && !finishedVideoLength ? ['finishedVideoLength'] : []),
      ...(requiresFinishedVideoLength && finishedVideoLength === 'other' && !finishedVideoLengthOther.trim()
        ? ['finishedVideoLengthOther']
        : []),
      ...(!notes.trim() ? ['notes'] : []),
    ];
    setValidationErrors(errors);
    if (errors.length > 0 || !scheduledDate || !scheduledTime) {
      submitLock.current = false;
      Alert.alert('Project not created', 'Fill out the required project details, then tap Create Project again.');
      return;
    }

    const scheduledAtDate = new Date(scheduledDate);
    scheduledAtDate.setHours(scheduledTime.getHours(), scheduledTime.getMinutes(), 0, 0);

    setSubmitting(true);
    setCreatedCode('');
    try {
      const claimCode = await onSubmit({
        linkedClient: clientMode === 'existing' ? selectedClient : undefined,
        clientName: clientMode === 'existing' ? selectedClient?.displayName ?? '' : clientName.trim(),
        clientEmail: clientMode === 'existing' ? selectedClient?.email : clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        title: title.trim(),
        address: address.trim(),
        notes: notes.trim(),
        scheduledAt: scheduledAtDate.getTime(),
        services,
        otherDescription: selectedOther ? otherDescription.trim() : undefined,
        videoEditFormat: selectedVideoEdit ? videoEditFormat ?? undefined : undefined,
        videoEditOther: selectedVideoEdit && videoEditFormat === 'other' ? videoEditOther.trim() : undefined,
        finishedVideoLength: requiresFinishedVideoLength ? finishedVideoLength ?? undefined : undefined,
        finishedVideoLengthOther:
          requiresFinishedVideoLength && finishedVideoLength === 'other' ? finishedVideoLengthOther.trim() : undefined,
      });
      const createdMessage =
        clientMode === 'existing'
          ? `Project Created! Linked to ${selectedClient?.displayName ?? 'client'}.`
          : `Project Created! Client Signup Code: ${claimCode}`;
      setSelectedClientId('');
      setClientSearch('');
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setTitle('');
      setAddress('');
      setNotes('');
      setServices([]);
      setOtherDescription('');
      setVideoEditFormat(null);
      setVideoEditOther('');
      setFinishedVideoLength(null);
      setFinishedVideoLengthOther('');
      setScheduledDate(null);
      setScheduledTime(null);
      setValidationErrors([]);
      setCreatedCode(createdMessage);
    } catch (error) {
      Alert.alert('Project not created', getFirebaseWriteMessage(error));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.shootRequestCard}>
      <Pressable style={styles.accordionHeader} onPress={() => setExpanded((current) => !current)}>
        <View style={styles.accordionTitleWrap}>
          <Text style={styles.accordionTitle}>Create Project</Text>
          <Text style={styles.accordionSubtitle}>Start a project before the client has an account.</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={theme.muted} />
      </Pressable>
      {!!createdCode && (
        <View style={styles.requestSentBanner}>
          <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" />
          <Text style={styles.requestSentText}>{createdCode}</Text>
        </View>
      )}
      {expanded && (
        <>
          <View style={styles.authToggle}>
            <Pressable
              style={[styles.authToggleButton, clientMode === 'existing' && styles.activeAuthToggleButton]}
              onPress={() => {
                setClientMode('existing');
                clearValidationError('clientName');
              }}
            >
              <Text style={[styles.authToggleText, clientMode === 'existing' && styles.activeAuthToggleText]}>Existing Client</Text>
            </Pressable>
            <Pressable
              style={[styles.authToggleButton, clientMode === 'new' && styles.activeAuthToggleButton]}
              onPress={() => {
                setClientMode('new');
                clearValidationError('selectedClient');
              }}
            >
              <Text style={[styles.authToggleText, clientMode === 'new' && styles.activeAuthToggleText]}>No Account Yet</Text>
            </Pressable>
          </View>
          {clientMode === 'existing' ? (
            <View style={[styles.clientPickerPanel, hasError('selectedClient') && styles.validationErrorBorder]}>
              <IconTextInput
                icon="search-outline"
                placeholder="Search clients"
                value={clientSearch}
                onChangeText={setClientSearch}
              />
              <View style={styles.clientPickerList}>
                {filteredClients.length === 0 ? (
                  <Text style={styles.muted}>No client accounts found.</Text>
                ) : (
                  filteredClients.map((client) => {
                    const selected = selectedClientId === client.uid;
                    return (
                      <Pressable
                        key={client.uid}
                        style={[styles.clientPickerRow, selected && styles.activeClientPickerRow]}
                        onPress={() => {
                          setSelectedClientId(client.uid);
                          clearValidationError('selectedClient');
                        }}
                      >
                        <View style={styles.flexOne}>
                          <Text style={[styles.clientPickerName, selected && styles.activeClientPickerName]}>{client.displayName}</Text>
                          <Text style={styles.clientPickerEmail}>{client.email}</Text>
                        </View>
                        {selected && <Ionicons name="checkmark-circle-outline" size={20} color={theme.indigo} />}
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>
          ) : (
            <>
              <IconTextInput
                error={hasError('clientName')}
                icon="person-outline"
                placeholder="Client name or business name"
                value={clientName}
                onChangeText={(value) => {
                  setClientName(value);
                  clearValidationError('clientName');
                }}
              />
              <IconTextInput
                icon="mail-outline"
                placeholder="Client email (optional)"
                value={clientEmail}
                onChangeText={setClientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
              />
              <IconTextInput
                icon="call-outline"
                placeholder="Client phone (optional)"
                value={clientPhone}
                onChangeText={setClientPhone}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
              />
            </>
          )}
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
            style={[styles.formSelectRow, hasError('scheduledDate') && styles.validationErrorBorder]}
            onPress={() => setShowDatePicker((current) => !current)}
          >
            <Ionicons name="calendar-outline" size={22} color={theme.muted} />
            <Text style={[styles.formSelectText, !scheduledDate && styles.formPlaceholderText]}>
              {scheduledDate ? formatProjectDate(scheduledDate) : 'Select Project Date'}
            </Text>
            <Ionicons name={showDatePicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={theme.muted} />
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={scheduledDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              onChange={(_, date) => {
                if (Platform.OS !== 'ios') setShowDatePicker(false);
                if (date) {
                  setScheduledDate(date);
                  clearValidationError('scheduledDate');
                }
              }}
            />
          )}
          <Pressable
            style={[styles.formSelectRow, hasError('scheduledTime') && styles.validationErrorBorder]}
            onPress={() => setShowTimePicker((current) => !current)}
          >
            <Ionicons name="time-outline" size={22} color={theme.muted} />
            <Text style={[styles.formSelectText, !scheduledTime && styles.formPlaceholderText]}>
              {scheduledTime ? formatClockTime(scheduledTime) : 'Select Project Time'}
            </Text>
            <Ionicons name={showTimePicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={theme.muted} />
          </Pressable>
          {showTimePicker && (
            <DateTimePicker
              value={scheduledTime ?? new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                if (Platform.OS !== 'ios') setShowTimePicker(false);
                if (date) {
                  setScheduledTime(date);
                  clearValidationError('scheduledTime');
                }
              }}
            />
          )}
          <IconTextInput
            error={hasError('address')}
            icon="location-outline"
            placeholder="Project address"
            value={address}
            onChangeText={(value) => {
              setAddress(value);
              clearValidationError('address');
            }}
            textContentType="fullStreetAddress"
          />
          {filteredAddresses.length > 0 && (
            <View style={styles.suggestionBox}>
              {filteredAddresses.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  style={styles.suggestionItem}
                  onPress={() => {
                    setAddress(suggestion);
                    clearValidationError('address');
                  }}
                >
                  <Ionicons name="location-outline" size={16} color={theme.indigo} />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
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
                  <Ionicons name={serviceIcon(service.value)} size={21} color={active ? '#ffffff' : theme.indigo} />
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
                <Ionicons name="film-outline" size={22} color={theme.muted} />
                <Text style={[styles.formSelectText, !videoEditFormat && styles.formPlaceholderText]}>
                  {formatVideoEditFormat(videoEditFormat)}
                </Text>
                <Ionicons name={showVideoEditFormatPicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={theme.muted} />
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
                      {videoEditFormat === format.value && <Ionicons name="checkmark-outline" size={18} color={theme.indigo} />}
                    </Pressable>
                  ))}
                </View>
              )}
              {videoEditFormat === 'other' && (
                <IconTextInput
                  error={hasError('videoEditOther')}
                  icon="create-outline"
                  placeholder="Describe the video type"
                  value={videoEditOther}
                  onChangeText={(value) => {
                    setVideoEditOther(value);
                    clearValidationError('videoEditOther');
                  }}
                  multiline
                />
              )}
              {requiresFinishedVideoLength && (
                <>
                  <Text style={styles.formLabel}>Length of Finished Video</Text>
                  <Pressable
                    style={[styles.formSelectRow, hasError('finishedVideoLength') && styles.validationErrorBorder]}
                    onPress={() => setShowFinishedVideoLengthPicker((current) => !current)}
                  >
                    <Ionicons name="time-outline" size={22} color={theme.muted} />
                    <Text style={[styles.formSelectText, !finishedVideoLength && styles.formPlaceholderText]}>
                      {formatFinishedVideoLength(finishedVideoLength)}
                    </Text>
                    <Ionicons name={showFinishedVideoLengthPicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={theme.muted} />
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
                          {finishedVideoLength === length.value && <Ionicons name="checkmark-outline" size={18} color={theme.indigo} />}
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
            <IconTextInput
              error={hasError('otherDescription')}
              icon="ellipsis-horizontal-circle-outline"
              placeholder="Describe the project scope"
              value={otherDescription}
              onChangeText={(value) => {
                setOtherDescription(value);
                clearValidationError('otherDescription');
              }}
              multiline
            />
          )}
          <IconTextInput
            error={hasError('notes')}
            icon="chatbubble-outline"
            placeholder="Project notes"
            value={notes}
            onChangeText={(value) => {
              setNotes(value);
              clearValidationError('notes');
            }}
            multiline
          />
          <PrimaryButton
            label={submitting ? 'Creating Project...' : 'Create Project'}
            icon="briefcase-outline"
            loading={submitting}
            disabled={submitting}
            onPress={submit}
          />
        </>
      )}
    </View>
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
  const submitLock = useRef(false);

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
    if (submitting || submitLock.current) return;
    submitLock.current = true;
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
      submitLock.current = false;
      Alert.alert('Request not sent', 'Fill out every required field and choose at least one project scope option.');
      return;
    }

    const confirmedRequestedDate = requestedDate;
    const confirmedRequestedTime = requestedTime;
    if (!confirmedRequestedDate || !confirmedRequestedTime) {
      submitLock.current = false;
      return;
    }

    const requestedDateTime = new Date(confirmedRequestedDate);
    requestedDateTime.setHours(confirmedRequestedTime.getHours(), confirmedRequestedTime.getMinutes(), 0, 0);

    if (requestedDateTime < tomorrow) {
      submitLock.current = false;
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
    } catch (error) {
      Alert.alert('Request not sent', getFirebaseWriteMessage(error));
    } finally {
      submitLock.current = false;
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
        <Ionicons name={requestExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={theme.muted} />
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
            <Ionicons name="calendar-outline" size={22} color={theme.muted} />
            <Text style={[styles.formSelectText, !requestedDate && styles.formPlaceholderText]}>
              {requestedDate ? formatProjectDate(requestedDate) : 'Select Date'}
            </Text>
            <Ionicons name={showDatePicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={theme.muted} />
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
            <Ionicons name="time-outline" size={22} color={theme.muted} />
            <Text style={[styles.formSelectText, !requestedTime && styles.formPlaceholderText]}>
              {requestedTime ? formatClockTime(requestedTime) : 'Select Time'}
            </Text>
            <Ionicons name={showTimePicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={theme.muted} />
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
                  <Ionicons name="location-outline" size={16} color={theme.indigo} />
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
                  <Ionicons name={serviceIcon(service.value)} size={21} color={active ? '#ffffff' : theme.indigo} />
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
                <Ionicons name="film-outline" size={22} color={theme.muted} />
                <Text style={[styles.formSelectText, !videoEditFormat && styles.formPlaceholderText]}>
                  {formatVideoEditFormat(videoEditFormat)}
                </Text>
                <Ionicons name={showVideoEditFormatPicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={theme.muted} />
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
                      {videoEditFormat === format.value && <Ionicons name="checkmark-outline" size={18} color={theme.indigo} />}
                    </Pressable>
                  ))}
                </View>
              )}
              {videoEditFormat === 'other' && (
                <View style={[styles.formInputRow, styles.formTextAreaRow, hasError('videoEditOther') && styles.validationErrorBorder]}>
                  <Ionicons name="create-outline" size={22} color={theme.muted} />
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
                    <Ionicons name="time-outline" size={22} color={theme.muted} />
                    <Text style={[styles.formSelectText, !finishedVideoLength && styles.formPlaceholderText]}>
                      {formatFinishedVideoLength(finishedVideoLength)}
                    </Text>
                    <Ionicons name={showFinishedVideoLengthPicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={theme.muted} />
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
                          {finishedVideoLength === length.value && <Ionicons name="checkmark-outline" size={18} color={theme.indigo} />}
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
            <Ionicons name="chatbubble-outline" size={22} color={theme.muted} />
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
            <Ionicons name={isRecurring ? 'radio-button-on' : 'ellipse-outline'} size={30} color={theme.indigo} />
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
                <Ionicons name="calendar-clear-outline" size={22} color={theme.muted} />
                <Text style={[styles.formSelectText, !recurrenceEndDate && styles.formPlaceholderText]}>
                  {recurrenceEndDate ? `Ends ${formatProjectDate(recurrenceEndDate)}` : 'Select End Date'}
                </Text>
                <Ionicons name={showRecurrenceEndPicker ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={theme.muted} />
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
  onDelete,
  onOpenMedia,
  onSave,
  update,
}: {
  isAdmin: boolean;
  isLast: boolean;
  job: Job;
  onDelete: (job: Job, updateId: string) => Promise<void>;
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

  const confirmDelete = () => {
    Alert.alert(
      'Delete status update?',
      `This will remove the ${statusLabel(update.status)} progress update.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(job, update.id);
            } catch (error) {
              Alert.alert('Status not deleted', getFirebaseWriteMessage(error));
            }
          },
        },
      ],
    );
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
              <SecondaryButton label="Delete" icon="trash-outline" variant="danger" onPress={confirmDelete} />
              <PrimaryButton label={saving ? 'Saving...' : 'Save Update'} icon="save-outline" onPress={save} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.timelineTitleRow}>
              <Text style={styles.timelineTitle} numberOfLines={2}>{statusLabel(update.status)}</Text>
              {isAdmin && (
                <View style={styles.rowActionsCompact}>
                  <Pressable style={styles.timelineEditButton} onPress={() => setEditing(true)}>
                    <Ionicons name="create-outline" size={17} color={theme.indigo} />
                    <Text style={styles.timelineEditText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.timelineEditButton, styles.timelineDeleteButton]} onPress={confirmDelete}>
                    <Ionicons name="trash-outline" size={17} color={theme.danger} />
                    <Text style={styles.timelineDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              )}
            </View>
            <Text style={styles.timelineText}>{update.note}</Text>
            <View style={styles.timelineTimeRow}>
              <Ionicons name="time-outline" size={18} color={theme.muted} />
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

function ConfiguredGoogleSignInButton({
  disabled,
  onToken,
}: {
  disabled: boolean;
  onToken: (idToken: string) => Promise<void>;
}) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googlePlatformClientId,
    iosClientId: googleIosClientId || undefined,
    androidClientId: googleAndroidClientId || undefined,
    webClientId: googleWebClientId || undefined,
    selectAccount: true,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    if (idToken) {
      onToken(idToken);
    }
  }, [onToken, response]);

  return (
    <Pressable
      style={[styles.socialAuthButton, (!request || disabled) && styles.disabledButton]}
      disabled={!request || disabled}
      onPress={() => promptAsync()}
    >
      <Ionicons name="logo-google" size={20} color={theme.indigo} />
      <Text style={styles.socialAuthText}>Continue With Google</Text>
    </Pressable>
  );
}

function GoogleSignInButton({
  disabled,
  onToken,
}: {
  disabled: boolean;
  onToken: (idToken: string) => Promise<void>;
}) {
  if (isRunningInExpoGo) {
    return (
      <Pressable
        style={styles.socialAuthButton}
        onPress={() =>
          Alert.alert(
            'Google sign-in needs a development build',
            'Google blocks this Expo Go browser sign-in flow. The app is ready for Google sign-in, but it needs a native development/TestFlight build with Google Sign-In configured.',
          )
        }
      >
        <Ionicons name="logo-google" size={20} color={theme.indigo} />
        <Text style={styles.socialAuthText}>Continue With Google</Text>
      </Pressable>
    );
  }

  if (!googlePlatformClientId) {
    return (
      <Pressable
        style={styles.socialAuthButton}
        onPress={() =>
          Alert.alert(
            'Google sign-in needs one more value',
            'Google is enabled in Firebase, but the app still needs the OAuth client ID for this platform before Google sign-in can run.',
          )
        }
      >
        <Ionicons name="logo-google" size={20} color={theme.indigo} />
        <Text style={styles.socialAuthText}>Continue With Google</Text>
      </Pressable>
    );
  }

  return <ConfiguredGoogleSignInButton disabled={disabled} onToken={onToken} />;
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
  const [projectSignupCode, setProjectSignupCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsName, setSettingsName] = useState(user?.displayName ?? '');
  const [settingsEmail, setSettingsEmail] = useState(user?.email ?? '');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [notificationPreference, setNotificationPreference] = useState<NotificationPreference>(user?.notificationPreference ?? 'all');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [openLegal, setOpenLegal] = useState<'terms' | 'privacy' | null>(null);
  const [showSettingsPage, setShowSettingsPage] = useState(false);

  useEffect(() => {
    setSettingsName(user?.displayName ?? '');
    setSettingsEmail(user?.email ?? '');
    setNotificationPreference(user?.notificationPreference ?? 'all');
  }, [user?.displayName, user?.email, user?.notificationPreference]);

  useEffect(() => {
    if (!user) setShowSettingsPage(false);
  }, [user]);

  const handleGoogleToken = useCallback(async (idToken: string) => {
    if (!auth) {
      Alert.alert('Firebase not connected', 'Restart Expo so the app can load the Firebase settings.');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (error) {
      Alert.alert('Google sign-in failed', getFirebaseAuthMessage(error));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const handleAppleSignIn = async () => {
    if (!auth) {
      Alert.alert('Firebase not connected', 'Restart Expo so the app can load the Firebase settings.');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        Alert.alert('Apple sign-in unavailable', 'Sign in with Apple is only available on supported Apple devices.');
        return;
      }
      const rawNonce = generateNonce();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!appleCredential.identityToken) {
        Alert.alert('Apple sign-in failed', 'Apple did not return an identity token.');
        return;
      }
      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({
        idToken: appleCredential.identityToken,
        rawNonce,
      });
      const result = await signInWithCredential(auth, firebaseCredential);
      const appleName = appleCredential.fullName
        ? AppleAuthentication.formatFullName(appleCredential.fullName, 'default').trim()
        : '';
      if (appleName && !result.user.displayName) {
        await updateProfile(result.user, { displayName: appleName });
      }
    } catch (error) {
      if (isCanceledAuthError(error)) return;
      Alert.alert('Apple sign-in failed', getFirebaseAuthMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async () => {
    if (!auth) {
      Alert.alert('Firebase not connected', 'Restart Expo so the app can load the Firebase settings.');
      return;
    }
    if (busy) return;
    if (!email.trim() || !password) {
      Alert.alert('Sign in failed', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      Alert.alert('Sign in failed', getFirebaseAuthMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    if (!auth || !db) {
      Alert.alert('Firebase not connected', 'Restart Expo so the app can load the Firebase settings.');
      return;
    }
    if (busy) return;
    const firestore = db;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();
    const normalizedClaimCode = normalizeProjectClaimCode(projectSignupCode);
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
      if (normalizedClaimCode && !(await validateProjectClaimCode(normalizedClaimCode))) {
        Alert.alert('Project not found', 'That project ID is invalid or has already been claimed.');
        return;
      }

      const created = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(created.user, { displayName: trimmedName });
      await setDoc(doc(firestore, 'users', created.user.uid), {
        email: trimmedEmail,
        displayName: trimmedName,
        role: 'client',
        notificationPreference: 'all',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      if (normalizedClaimCode) {
        await claimProjectByCode(normalizedClaimCode);
      }
      setPassword('');
      setConfirmPassword('');
      setProjectSignupCode('');
    } catch (error) {
      Alert.alert('Sign up failed', getFirebaseAuthMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth) {
      Alert.alert('Firebase not connected', 'Restart Expo so the app can load the Firebase settings.');
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Password reset', 'Enter your email address first.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert('Password reset sent', `Check ${trimmedEmail} for the reset link.`);
    } catch (error) {
      Alert.alert('Password reset failed', getFirebaseAuthMessage(error));
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

  if (user && showSettingsPage) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.settingsPageHeader}>
          <Pressable style={styles.settingsBackButton} onPress={() => setShowSettingsPage(false)}>
            <Ionicons name="chevron-back-outline" size={20} color={theme.indigo} />
            <Text style={styles.settingsBackText}>Account</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Text style={styles.muted}>Manage your profile, login, notifications, and legal details.</Text>
        </View>

        <View style={styles.accountCard}>
          <Text style={styles.smallTitle}>Profile and Login</Text>
          <View style={styles.settingsInputStack}>
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
          </View>

          <View style={styles.settingsDivider} />

          <View style={styles.settingsSection}>
            <View>
              <Text style={styles.settingsSectionTitle}>Notify Me About</Text>
              <Text style={styles.accordionSubtitle}>Choose which app updates should alert you.</Text>
            </View>
            <View style={styles.settingsPreferenceGrid}>
              {notificationPreferenceOptions.map((option) => {
                const active = notificationPreference === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.settingsPreferenceButton, active && styles.activeSettingsPreferenceButton]}
                    onPress={() => setNotificationPreference(option.value)}
                  >
                    <Ionicons name={option.icon} size={19} color={active ? '#ffffff' : theme.indigo} />
                    <Text style={[styles.settingsPreferenceText, active && styles.activeSettingsPreferenceText]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.settingsActions}>
            <PrimaryButton
              label={settingsBusy ? 'Saving Settings...' : 'Save Settings'}
              icon="save-outline"
              loading={settingsBusy}
              disabled={settingsBusy}
              onPress={handleSaveSettings}
            />
            <SecondaryButton
              label="Request Notification Permission"
              icon="notifications-outline"
              onPress={registerForNotifications}
            />
          </View>
        </View>

        <View style={styles.accountCard}>
          <Text style={styles.smallTitle}>Legal</Text>
          <Pressable
            style={styles.legalLinkRow}
            onPress={() => setOpenLegal((current) => (current === 'terms' ? null : 'terms'))}
          >
            <Text style={styles.legalLinkText}>Terms of Service</Text>
            <Ionicons name={openLegal === 'terms' ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.indigo} />
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
            <Ionicons name={openLegal === 'privacy' ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.indigo} />
          </Pressable>
          {openLegal === 'privacy' && (
            <Text style={styles.legalText}>
              This app uses account details, chat messages, project requests, media attachments, notifications, and job progress information to manage client projects. Location sharing is limited to active shoot progress when enabled by the admin for a specific project.
            </Text>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.accountCard}>
        <Text style={styles.sectionTitle}>{user?.displayName ?? 'Sign in'}</Text>
        <Text style={styles.muted}>
          {user?.email ??
            (isFirebaseConfigured
              ? 'Use email and password to access your projects, chats, and updates.'
              : 'Firebase sign-in will be enabled after configuration.')}
        </Text>
        {isFirebaseConfigured && user && (
          <View style={styles.signInBox}>
            <PrimaryButton label="Sign Out" icon="log-out-outline" onPress={handleSignOut} />
          </View>
        )}
        {isFirebaseConfigured && !user && (
          <View style={styles.signInBox}>
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
            {mode === 'sign_up' && (
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
            {mode === 'sign_up' && (
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
              />
            )}
            {mode === 'sign_up' && (
              <TextInput
                style={styles.input}
                placeholder="Project ID / Signup Code (optional)"
                value={projectSignupCode}
                onChangeText={setProjectSignupCode}
                autoCapitalize="characters"
                textContentType="oneTimeCode"
              />
            )}
            {mode === 'sign_up' ? (
              <PrimaryButton label={busy ? 'Creating...' : 'Create Account'} icon="person-add-outline" onPress={handleSignUp} />
            ) : (
              <PrimaryButton label={busy ? 'Signing In...' : 'Sign In'} icon="log-in-outline" onPress={handleSignIn} />
            )}
            {mode === 'sign_in' && (
              <Pressable style={styles.linkButton} onPress={handlePasswordReset} disabled={busy}>
                <Text style={styles.linkButtonText}>Forgot Password?</Text>
              </Pressable>
            )}
            <View style={styles.socialAuthGroup}>
              <GoogleSignInButton disabled={busy} onToken={handleGoogleToken} />
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={8}
                  style={styles.appleAuthButton}
                  onPress={handleAppleSignIn}
                />
              )}
            </View>
          </View>
        )}
        {!isFirebaseConfigured && !user && (
          <View style={styles.accountActions}>
            <PrimaryButton label="Use Client Demo" icon="person-outline" onPress={() => switchRole('client')} />
            <PrimaryButton label="Use Admin Demo" icon="shield-checkmark-outline" onPress={() => switchRole('admin')} />
          </View>
        )}
      </View>
      {user && (
        <Pressable style={styles.settingsEntryButton} onPress={() => setShowSettingsPage(true)}>
          <View style={styles.settingsEntryIcon}>
            <Ionicons name="settings-outline" size={22} color={theme.indigo} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.settingsEntryTitle}>Settings</Text>
            <Text style={styles.settingsEntrySubtitle}>Name, email, password, notifications, and legal</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color={theme.muted} />
        </Pressable>
      )}
      {!user && (
        <>
          <View style={styles.accountCard}>
            <Text style={styles.smallTitle}>Legal</Text>
            <Pressable
              style={styles.legalLinkRow}
              onPress={() => setOpenLegal((current) => (current === 'terms' ? null : 'terms'))}
            >
              <Text style={styles.legalLinkText}>Terms of Service</Text>
              <Ionicons name={openLegal === 'terms' ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.indigo} />
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
              <Ionicons name={openLegal === 'privacy' ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.indigo} />
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
        </>
      )}
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
      <Ionicons name="play-circle-outline" size={24} color={theme.indigo} />
      <View style={styles.flexOne}>
        <Text style={styles.mediaAttachmentTitle}>Video attached</Text>
        <Text style={styles.mediaAttachmentName}>{attachment.name ?? 'Open video'}</Text>
      </View>
      <Ionicons name="expand-outline" size={18} color={theme.muted} />
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
  autoCapitalize,
  error,
  icon,
  keyboardType,
  multiline,
  onChangeText,
  placeholder,
  textContentType,
  value,
}: {
  autoCapitalize?: ComponentProps<typeof TextInput>['autoCapitalize'];
  error?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType'];
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  textContentType?: ComponentProps<typeof TextInput>['textContentType'];
  value: string;
}) {
  return (
    <View style={[styles.formInputRow, multiline && styles.formTextAreaRow, error && styles.validationErrorBorder]}>
      <Ionicons name={icon} size={22} color={theme.muted} />
      <TextInput
        style={[styles.formTextInput, multiline && styles.formTextArea]}
        placeholder={placeholder}
        placeholderTextColor="#a4abb4"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        textContentType={textContentType}
        multiline={multiline}
      />
    </View>
  );
}

function SecondaryButton({
  label,
  icon,
  onPress,
  variant = 'default',
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'default' | 'danger';
}) {
  const danger = variant === 'danger';
  return (
    <Pressable style={[styles.secondaryButton, danger && styles.dangerSecondaryButton]} onPress={onPress}>
      <Ionicons name={icon} size={17} color={danger ? theme.danger : theme.pink} />
      <Text style={[styles.secondaryButtonText, danger && styles.dangerSecondaryButtonText]}>{label}</Text>
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
      <Ionicons name="checkmark-circle-outline" size={18} color={theme.indigo} />
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

function jobStatusColors(status: JobStatus) {
  const colors: Record<JobStatus, { backgroundColor: string; color: string }> = {
    scheduled: { backgroundColor: '#f5efe2', color: '#5f4b26' },
    on_my_way: { backgroundColor: '#d7f1ef', color: '#0f615b' },
    arrived: { backgroundColor: '#dff3ee', color: '#126337' },
    shoot_started: { backgroundColor: '#dceeff', color: '#164f7a' },
    shoot_complete: { backgroundColor: '#e5eaf2', color: '#17324d' },
    editing_media: { backgroundColor: '#eadff7', color: '#5b2a7a' },
    media_delivered: { backgroundColor: '#dff3ee', color: '#126337' },
    job_complete: { backgroundColor: '#dff3ee', color: '#126337' },
  };
  return colors[status];
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
    indoor_drone_video: 'business-outline',
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

function shootRequestStatusColors(status: ShootRequest['status']) {
  const colors: Record<ShootRequest['status'], { backgroundColor: string; color: string }> = {
    requested: { backgroundColor: '#ffe7c2', color: '#8a4a00' },
    accepted: { backgroundColor: '#dff3ee', color: '#126337' },
    needs_details: { backgroundColor: '#ffe1df', color: '#9b1c1c' },
  };
  return colors[status];
}

function getPasswordProblem(password: string) {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[a-z]/.test(password)) return 'Use at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Use at least one uppercase letter.';
  if (!/\d/.test(password)) return 'Use at least one number.';
  return null;
}

function generateNonce(length = 32) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
  let nonce = '';
  for (let index = 0; index < length; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return nonce;
}

function isCanceledAuthError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ERR_REQUEST_CANCELED' || error.code === 'ERR_CANCELED')
  );
}

function getFirebaseAuthMessage(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'That email already has an account. Use Sign In or reset the password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'That email and password did not match a Firebase account.',
    'auth/user-not-found': 'No account exists for that email yet. Use Sign Up first.',
    'auth/wrong-password': 'That password is not correct. Use Forgot Password if needed.',
    'auth/weak-password': 'Use a stronger password with at least 8 characters, uppercase, lowercase, and a number.',
    'auth/network-request-failed': 'Network connection failed. Check your connection and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.',
    'auth/too-many-requests': 'Firebase temporarily blocked attempts for this account. Wait a bit, then try again.',
  };
  return messages[code] ?? `Firebase returned ${code || 'an unknown auth error'}. Try again after restarting Expo.`;
}

function getFirebaseWriteMessage(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  const messages: Record<string, string> = {
    'permission-denied': 'Firebase blocked this save. The app rules or your account permissions need an update.',
    'unavailable': 'Firebase is temporarily unavailable. Check your connection and try again.',
    'deadline-exceeded': 'The save timed out. Check your connection and try again.',
    'not-found': 'The linked project or chat was not found. Refresh the app and try again.',
  };
  if (messages[code]) return messages[code];
  if (error instanceof Error && error.message) return error.message;
  return 'Something stopped the save. Check your connection and try again.';
}

function toFirestoreData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => toFirestoreData(item)).filter((item) => item !== undefined) as T;
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, toFirestoreData(entry)]),
  ) as T;
}

function dedupeRapidStatusUpdates(updates: JobUpdate[]) {
  const sortedUpdates = [...updates].sort((first, second) => second.createdAt - first.createdAt);
  return sortedUpdates.filter((update, index) => {
    const nextUpdate = sortedUpdates[index + 1];
    if (!nextUpdate) return true;
    const sameContent =
      update.status === nextUpdate.status &&
      update.note === nextUpdate.note &&
      !update.attachment &&
      !nextUpdate.attachment;
    return !(sameContent && Math.abs(update.createdAt - nextUpdate.createdAt) < 10000);
  });
}

function normalizeProjectClaimCode(code: string) {
  const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return '';
  const withoutPrefix = cleaned.startsWith('KDG') ? cleaned.slice(3) : cleaned;
  return `KDG-${withoutPrefix}`;
}

function generateProjectClaimCode(existingCodes: string[]) {
  const existing = new Set(existingCodes.map(normalizeProjectClaimCode));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let suffix = '';
    for (let index = 0; index < 6; index += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const code = `KDG-${suffix}`;
    if (!existing.has(code)) return code;
  }
  return `KDG-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function validateProjectClaimCode(code: string) {
  if (!functions) return false;
  const validate = httpsCallable<{ code: string }, { valid: boolean }>(functions, 'validateProjectClaimCode');
  const result = await validate({ code });
  return result.data.valid === true;
}

async function claimProjectByCode(code: string) {
  if (!functions) throw new Error('Firebase Functions are not configured.');
  const claim = httpsCallable<{ code: string }, { projectIds: string[] }>(functions, 'claimProjectByCode');
  await claim({ code });
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
  await Notifications.getExpoPushTokenAsync();
  Alert.alert('Notifications enabled', 'This device can receive app notifications.');
}

async function scheduleLocalNotification(title: string, body: string) {
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

const theme = {
  navy: '#15115f',
  indigo: '#2f20a2',
  purple: '#5a2ed6',
  pink: '#ff5c8a',
  coral: '#ff706f',
  danger: '#dc2626',
  ink: '#141827',
  muted: '#6e7283',
  line: '#dedff0',
  surface: '#ffffff',
  appBg: '#f0f1f7',
  softPurple: '#f3efff',
  softPink: '#fff0f5',
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.appBg,
  },
  errorScreen: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: theme.appBg,
  },
  errorTitle: {
    color: theme.ink,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  errorText: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.navy,
    borderBottomWidth: 0,
  },
  kicker: {
    color: '#ff9fbd',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  rolePill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adminPill: {
    backgroundColor: theme.pink,
  },
  clientPill: {
    backgroundColor: theme.indigo,
  },
  roleText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  notice: {
    margin: 12,
    padding: 14,
    borderRadius: 8,
    backgroundColor: theme.softPurple,
    borderWidth: 1,
    borderColor: '#ded7ff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticeText: {
    flex: 1,
    color: theme.navy,
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    flex: 1,
  },
  webContainer: {
    flex: 1,
    backgroundColor: theme.surface,
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
  newMessagePanel: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
  },
  chip: {
    height: 36,
    maxWidth: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  activeChip: {
    borderColor: theme.pink,
    backgroundColor: theme.softPink,
  },
  chipText: {
    color: theme.muted,
    fontWeight: '700',
  },
  activeChipText: {
    color: theme.pink,
  },
  panelHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionTitle: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  smallTitle: {
    color: theme.ink,
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
    color: theme.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  accordionSubtitle: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  muted: {
    color: theme.muted,
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
    backgroundColor: '#ebe6ff',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  messageSender: {
    color: theme.indigo,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  messageText: {
    color: theme.ink,
    fontSize: 15,
    lineHeight: 21,
  },
  messageReference: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: theme.softPink,
  },
  messageReferenceText: {
    color: theme.pink,
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
    borderColor: theme.line,
    padding: 10,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
  },
  mediaAttachmentTitle: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  mediaAttachmentName: {
    color: theme.muted,
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
    backgroundColor: theme.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
  },
  composerReference: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e7c6dc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.softPink,
  },
  composerReferenceText: {
    color: theme.pink,
    fontSize: 13,
    fontWeight: '800',
  },
  composerReferenceClose: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe4ee',
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
    backgroundColor: theme.softPurple,
  },
  input: {
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: theme.surface,
    color: theme.ink,
  },
  composerInput: {
    flex: 1,
  },
  noteInput: {
    minHeight: 74,
    marginBottom: 12,
  },
  modernTextArea: {
    borderColor: theme.line,
    color: theme.ink,
    fontSize: 15,
    marginBottom: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.pink,
  },
  disabledButton: {
    opacity: 0.45,
  },
  jobsList: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  projectListCard: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.line,
    marginBottom: 14,
    backgroundColor: theme.surface,
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
    borderColor: theme.pink,
    backgroundColor: '#fff5f8',
  },
  projectProgressPanel: {
    borderTopWidth: 1,
    borderTopColor: '#eadff7',
    paddingHorizontal: 14,
    paddingTop: 14,
    backgroundColor: theme.surface,
  },
  projectProgressHeading: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  historyHeader: {
    minHeight: 58,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    paddingTop: 14,
    marginTop: 6,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyTitle: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  historySubtitle: {
    color: theme.muted,
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
    backgroundColor: theme.softPurple,
  },
  historyCountText: {
    color: theme.indigo,
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
    backgroundColor: '#f7f5ff',
  },
  historyEmptyText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  historyJobListItem: {
    backgroundColor: '#fbfaff',
  },
  jobListTitle: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  claimCodeInline: {
    color: theme.indigo,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  statusPillSmall: {
    maxWidth: 112,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: theme.softPurple,
  },
  statusTextSmall: {
    color: theme.indigo,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  projectMapSection: {
    borderTopWidth: 1,
    borderTopColor: theme.line,
    paddingTop: 14,
    marginTop: 2,
    marginBottom: 14,
  },
  projectMapHeading: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  projectMapWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
  },
  map: {
    height: 230,
  },
  mapCaption: {
    padding: 10,
    color: theme.muted,
    fontSize: 12,
  },
  projectLocationClosed: {
    minHeight: 58,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
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
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    gap: 12,
  },
  notificationsPanel: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 18,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
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
    borderColor: theme.line,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fbfaff',
  },
  notificationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.softPurple,
  },
  notificationTitle: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  shootRequestCard: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 18,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    gap: 12,
  },
  formTitle: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  formInputRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
  },
  formTextInput: {
    flex: 1,
    color: theme.ink,
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
    borderColor: theme.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
  },
  formSelectText: {
    flex: 1,
    color: theme.ink,
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
    borderColor: '#ded7ff',
    padding: 12,
    gap: 10,
    backgroundColor: '#fbfaff',
  },
  selectOptionList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    overflow: 'hidden',
    backgroundColor: theme.surface,
  },
  selectOptionRow: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  selectOptionText: {
    color: theme.ink,
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
    borderColor: theme.line,
    padding: 12,
    backgroundColor: theme.surface,
    gap: 4,
  },
  acceptedRequestCard: {
    backgroundColor: '#fbfaff',
  },
  focusedRequestCard: {
    borderColor: theme.pink,
    borderWidth: 1.5,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  requestTitle: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  requestStatusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  requestStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  rowActionsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  pendingMediaPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ded7ff',
    padding: 12,
    gap: 10,
    backgroundColor: '#fbfaff',
  },
  pendingMediaInfo: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingMediaText: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  flexOne: {
    flex: 1,
  },
  formLabel: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  suggestionBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
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
    borderBottomColor: theme.line,
  },
  suggestionText: {
    flex: 1,
    color: theme.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  clientPickerPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 10,
    gap: 10,
    backgroundColor: '#fbfaff',
  },
  clientPickerList: {
    gap: 8,
  },
  clientPickerRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
  },
  activeClientPickerRow: {
    borderColor: theme.indigo,
    backgroundColor: theme.softPurple,
  },
  clientPickerName: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  activeClientPickerName: {
    color: theme.indigo,
  },
  clientPickerEmail: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 2,
  },
  radioRow: {
    minHeight: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
  },
  radioText: {
    color: theme.ink,
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
    backgroundColor: theme.indigo,
  },
  requestSentText: {
    flexShrink: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  recurringBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 14,
    gap: 12,
    backgroundColor: '#fbfaff',
  },
  distancePanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
    gap: 10,
    backgroundColor: theme.surface,
  },
  distanceTextWrap: {
    gap: 3,
  },
  distanceValue: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  distanceSubValue: {
    color: theme.muted,
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
    borderColor: theme.line,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.surface,
  },
  activeServiceButton: {
    backgroundColor: theme.indigo,
    borderColor: theme.indigo,
  },
  serviceButtonText: {
    color: theme.ink,
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
    borderColor: theme.line,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  activeStatusButton: {
    backgroundColor: theme.purple,
    borderColor: theme.purple,
  },
  statusButtonText: {
    color: theme.muted,
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
    backgroundColor: theme.pink,
    marginTop: 7,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
    backgroundColor: '#e7e3f3',
  },
  timelineBody: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 22,
  },
  timelineTitleRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  timelineTitle: {
    flex: 1,
    minWidth: 130,
    color: theme.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  timelineEditButton: {
    minWidth: 84,
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#ded7ff',
    backgroundColor: theme.softPurple,
  },
  timelineEditText: {
    color: theme.indigo,
    fontSize: 12,
    fontWeight: '800',
  },
  timelineDeleteButton: {
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
  },
  timelineDeleteText: {
    color: theme.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  timelineText: {
    color: theme.muted,
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
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  settingsEntryButton: {
    minHeight: 76,
    marginBottom: 14,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsEntryIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.softPurple,
  },
  settingsEntryTitle: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  settingsEntrySubtitle: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  settingsPageHeader: {
    marginBottom: 14,
    gap: 6,
  },
  settingsBackButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 8,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  settingsBackText: {
    color: theme.indigo,
    fontSize: 15,
    fontWeight: '800',
  },
  settingsInputStack: {
    gap: 10,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: theme.line,
    marginVertical: 16,
  },
  settingsSection: {
    gap: 12,
  },
  settingsSectionTitle: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  settingsPreferenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  settingsPreferenceButton: {
    minHeight: 50,
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.surface,
  },
  activeSettingsPreferenceButton: {
    backgroundColor: theme.indigo,
    borderColor: theme.indigo,
  },
  settingsPreferenceText: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  activeSettingsPreferenceText: {
    color: '#ffffff',
  },
  settingsActions: {
    gap: 10,
    marginTop: 16,
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
    backgroundColor: theme.softPurple,
  },
  authToggleButton: {
    flex: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAuthToggleButton: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  authToggleText: {
    color: theme.muted,
    fontWeight: '800',
  },
  activeAuthToggleText: {
    color: theme.indigo,
  },
  linkButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonText: {
    color: theme.indigo,
    fontSize: 14,
    fontWeight: '800',
  },
  socialAuthGroup: {
    gap: 10,
    marginTop: 4,
  },
  socialAuthButton: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.surface,
  },
  socialAuthText: {
    color: theme.indigo,
    fontSize: 15,
    fontWeight: '800',
  },
  appleAuthButton: {
    width: '100%',
    height: 50,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.indigo,
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
    borderColor: theme.pink,
    backgroundColor: theme.surface,
  },
  secondaryButtonText: {
    color: theme.pink,
    fontWeight: '800',
  },
  dangerSecondaryButton: {
    borderColor: theme.danger,
    backgroundColor: '#fff1f2',
  },
  dangerSecondaryButtonText: {
    color: theme.danger,
  },
  checkItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 9,
  },
  checkText: {
    flex: 1,
    color: theme.muted,
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
    backgroundColor: theme.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
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
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabLabel: {
    color: theme.indigo,
  },
  legalText: {
    color: theme.muted,
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
    backgroundColor: '#fbfaff',
  },
  legalLinkText: {
    color: theme.indigo,
    fontSize: 15,
    fontWeight: '800',
  },
});
