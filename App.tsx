import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
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
  RecurrenceFrequency,
  ShootRequest,
  ShootService,
  jobStatuses,
  locationVisibleStatuses,
  recurrenceFrequencies,
  shootServices,
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

type TabKey = 'website' | 'chat' | 'jobs' | 'account';
type ShootRequestDraft = Omit<ShootRequest, 'id' | 'clientId' | 'clientName' | 'status' | 'createdAt'>;
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
  { key: 'jobs', label: 'Jobs', icon: 'briefcase-outline' },
  { key: 'account', label: 'Account', icon: 'person-circle-outline' },
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
      };

      await setDoc(
        doc(firestore, 'users', firebaseUser.uid),
        {
          email: appUser.email,
          displayName: appUser.displayName,
          role,
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
      const updates = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as JobUpdate);
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

  const sendMessage = async (body: string, attachment?: Attachment) => {
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
      createdAt: Date.now(),
    };
    if (isFirebaseConfigured && db) {
      await addDoc(collection(db, 'chatThreads', selectedThread.id, 'messages'), message);
      await updateDoc(doc(db, 'chatThreads', selectedThread.id), {
        lastMessage: message.body,
        updatedAt: message.createdAt,
      });
    }
    setData((current) => ({
      ...current,
      messages: [...current.messages, message],
      threads: current.threads.map((thread) =>
        thread.id === selectedThread.id
          ? { ...thread, lastMessage: message.body, updatedAt: message.createdAt }
          : thread,
      ),
    }));
    scheduleLocalNotification(
      isAdmin ? 'Client notification ready' : 'Admin notification ready',
      isAdmin ? 'The client would receive this reply as a push notification.' : 'Admin would receive this message as a push notification.',
    );
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
      await addDoc(collection(db, 'jobs', job.id, 'updates'), update);
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
    scheduleLocalNotification('Job status updated', `${job.clientName} would be notified: ${statusLabel(status)}.`);
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
      await addDoc(collection(db, 'jobs', acceptedJob.id, 'updates'), acceptedJob.updates[0]);
    }
    setData((current) => ({
      ...current,
      shootRequests: current.shootRequests.map((item) => (item.id === request.id ? { ...item, status: 'accepted' } : item)),
      jobs: [acceptedJob, ...current.jobs],
    }));
    setSelectedJobId(acceptedJob.id);
    scheduleLocalNotification('Shoot accepted', `${request.clientName} would be notified that the project was accepted.`);
  };

  const requestShootDetails = async (request: ShootRequest) => {
    const messageText = `Thanks for the request for "${request.title}". Can you send a few more details or a better day and time?`;
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'shootRequests', request.id), { status: 'needs_details' });
    }
    const existingThread = data.threads.find((thread) => thread.clientId === request.clientId);
    if (existingThread) {
      const message: ChatMessage = {
        id: `message-${Date.now()}`,
        threadId: existingThread.id,
        senderId: adminUser.uid,
        senderName: adminUser.displayName,
        body: messageText,
        createdAt: Date.now(),
      };
      if (isFirebaseConfigured && db) {
        await addDoc(collection(db, 'chatThreads', existingThread.id, 'messages'), message);
        await updateDoc(doc(db, 'chatThreads', existingThread.id), {
          lastMessage: message.body,
          updatedAt: message.createdAt,
        });
      }
      setData((current) => ({
        ...current,
        shootRequests: current.shootRequests.map((item) => (item.id === request.id ? { ...item, status: 'needs_details' } : item)),
        messages: [...current.messages, message],
        threads: current.threads.map((thread) =>
          thread.id === existingThread.id ? { ...thread, lastMessage: message.body, updatedAt: message.createdAt } : thread,
        ),
      }));
      setSelectedThreadId(existingThread.id);
      setActiveTab('chat');
    }
  };

  const renderContent = () => {
    if (!user) return <AccountScreen user={user} switchRole={switchRole} />;
    if (activeTab === 'website') return <WebsiteScreen />;
    if (activeTab === 'chat') {
      return (
        <ChatScreen
          isAdmin={isAdmin}
          messages={data.messages.filter((message) => message.threadId === selectedThread?.id)}
          onSend={sendMessage}
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
          onRequestShootDetails={requestShootDetails}
          onSubmitShootRequest={submitShootRequest}
          onUpdateStatus={updateJobStatus}
          onUpdateTitle={updateJobTitle}
          selectedJob={selectedJob}
          setSelectedJobId={setSelectedJobId}
          shootRequests={visibleShootRequests}
          user={user}
        />
      );
    }
    return <AccountScreen user={user} switchRole={switchRole} />;
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
          <Ionicons name="construct-outline" size={18} color="#75530e" />
          <Text style={styles.noticeText}>Demo mode: add Firebase env values to connect live auth, chat, jobs, media, and notifications.</Text>
        </View>
      )}
      <View style={styles.content}>{renderContent()}</View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} style={styles.tabButton} onPress={() => setActiveTab(tab.key)}>
              <Ionicons name={tab.icon} size={22} color={active ? '#0f766e' : '#687076'} />
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
  onSend,
  selectedThread,
  setSelectedThreadId,
  threads,
  user,
}: {
  isAdmin: boolean;
  messages: ChatMessage[];
  onSend: (body: string, attachment?: Attachment) => Promise<void>;
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
      onSend(body, assetToAttachment(result.assets[0]));
      setBody('');
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
      onSend(body, assetToAttachment(result.assets[0]));
      setBody('');
    }
  };

  if (!selectedThread) {
    return <EmptyState title="No chats yet" body="Client conversations will appear here after an invite or website chat." />;
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
      <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListContent}>
        {messages.map((message) => {
          const mine = message.senderId === user.uid;
          return (
            <View key={message.id} style={[styles.messageBubble, mine ? styles.myMessage : styles.theirMessage]}>
              <Text style={styles.messageSender}>{message.senderName}</Text>
              <Text style={styles.messageText}>{message.body}</Text>
              {message.attachment?.type === 'image' && <Image source={{ uri: message.attachment.uri }} style={styles.messageImage} />}
              {message.attachment?.type === 'video' && <Text style={styles.attachmentText}>Video attached: {message.attachment.name ?? 'clip'}</Text>}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.composer}>
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
          onPress={() => {
            onSend(body);
            setBody('');
          }}
          disabled={!body.trim()}
        >
          <Ionicons name="send" size={19} color="#ffffff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function JobsScreen({
  isAdmin,
  jobs,
  onAcceptShootRequest,
  onRequestShootDetails,
  onSubmitShootRequest,
  onUpdateStatus,
  onUpdateTitle,
  selectedJob,
  setSelectedJobId,
  shootRequests,
  user,
}: {
  isAdmin: boolean;
  jobs: Job[];
  onAcceptShootRequest: (request: ShootRequest) => Promise<void>;
  onRequestShootDetails: (request: ShootRequest) => Promise<void>;
  onSubmitShootRequest: (request: ShootRequestDraft) => Promise<void>;
  onUpdateStatus: (job: Job, status: JobStatus, note?: string, attachment?: Attachment) => Promise<void>;
  onUpdateTitle: (job: Job, title: string) => Promise<void>;
  selectedJob?: Job;
  setSelectedJobId: (jobId: string) => void;
  shootRequests: ShootRequest[];
  user: AppUser;
}) {
  const [note, setNote] = useState('');
  const [draftTitle, setDraftTitle] = useState(selectedJob?.title ?? '');

  useEffect(() => {
    setDraftTitle(selectedJob?.title ?? '');
  }, [selectedJob?.id, selectedJob?.title]);

  if (!selectedJob) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        {!isAdmin && <ShootRequestForm onSubmit={onSubmitShootRequest} user={user} />}
        <EmptyState title="No jobs yet" body="Assigned jobs and progress updates will appear here." />
      </ScrollView>
    );
  }

  const showMap = selectedJob.liveLocation && locationVisibleStatuses.includes(selectedJob.status);

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
      onUpdateStatus(selectedJob, selectedJob.status, note || 'Media update added.', assetToAttachment(result.assets[0]));
      setNote('');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      {!isAdmin && <ShootRequestForm onSubmit={onSubmitShootRequest} user={user} />}
      {isAdmin && (
        <View style={styles.adminPanel}>
          <Text style={styles.smallTitle}>Project Shoot Requests</Text>
          {shootRequests.length === 0 ? (
            <Text style={styles.muted}>New client requests will appear here.</Text>
          ) : (
            shootRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.flexOne}>
                    <Text style={styles.requestTitle}>{request.title}</Text>
                    <Text style={styles.muted}>{request.requesterName || request.clientName}</Text>
                  </View>
                  <View style={styles.requestStatusPill}>
                    <Text style={styles.requestStatusText}>{requestStatusLabel(request.status)}</Text>
                  </View>
                </View>
                <Text style={styles.timelineText}>When: {request.requestedWhen}</Text>
                <Text style={styles.timelineText}>Address: {request.projectAddress}</Text>
                <Text style={styles.timelineText}>Services: {formatServices(request.services)}</Text>
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
                  <SecondaryButton label="Message" icon="chatbubble-outline" onPress={() => onRequestShootDetails(request)} />
                  <SecondaryButton label="Accept" icon="checkmark-outline" onPress={() => onAcceptShootRequest(request)} />
                </View>
              </View>
            ))
          )}
        </View>
      )}
      <View style={styles.jobsList}>
        <Text style={styles.smallTitle}>Jobs</Text>
        {jobs.map((job) => (
          <Pressable
            key={job.id}
            style={[styles.jobListItem, selectedJob.id === job.id && styles.activeJobListItem]}
            onPress={() => setSelectedJobId(job.id)}
          >
            <View style={styles.flexOne}>
              <Text style={styles.jobListTitle}>{job.title}</Text>
              <Text style={styles.muted}>{job.clientName} · {job.address}</Text>
            </View>
            <View style={styles.statusPillSmall}>
              <Text style={styles.statusTextSmall}>{statusLabel(job.status)}</Text>
            </View>
            <Ionicons name={selectedJob.id === job.id ? 'chevron-up' : 'chevron-down'} size={18} color="#687076" />
          </Pressable>
        ))}
      </View>
      <View style={styles.jobHero}>
        <Text style={styles.sectionTitle}>{selectedJob.title}</Text>
        <Text style={styles.muted}>{selectedJob.address}</Text>
        <View style={styles.statusPill}>
          <Ionicons name="radio-button-on" size={14} color="#0f766e" />
          <Text style={styles.statusText}>{statusLabel(selectedJob.status)}</Text>
        </View>
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
      {showMap ? (
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: selectedJob.liveLocation!.latitude,
              longitude: selectedJob.liveLocation!.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            region={{
              latitude: selectedJob.liveLocation!.latitude,
              longitude: selectedJob.liveLocation!.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
          >
            <Marker
              coordinate={{
                latitude: selectedJob.liveLocation!.latitude,
                longitude: selectedJob.liveLocation!.longitude,
              }}
              title="The Knoxville Drone Guy"
              description="Live admin phone location for this active job"
            />
          </MapView>
          <Text style={styles.mapCaption}>Live location updated {new Date(selectedJob.liveLocation!.updatedAt).toLocaleTimeString()}.</Text>
        </View>
      ) : (
        <View style={styles.locationClosed}>
          <Ionicons name="location-outline" size={20} color="#687076" />
          <Text style={styles.muted}>Live map is available only while the job is on the way or actively shooting.</Text>
        </View>
      )}
      {isAdmin && (
        <View style={styles.adminPanel}>
          <Text style={styles.smallTitle}>Admin job controls</Text>
          <TextInput
            style={styles.input}
            placeholder="Job name"
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
        </View>
      )}
      <View style={styles.timeline}>
        <Text style={styles.smallTitle}>Progress updates</Text>
        {selectedJob.updates.map((update) => (
          <View key={update.id} style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineBody}>
              <Text style={styles.timelineTitle}>{statusLabel(update.status)}</Text>
              <Text style={styles.timelineText}>{update.note}</Text>
              <Text style={styles.timelineTime}>{new Date(update.createdAt).toLocaleString()}</Text>
              {update.attachment?.type === 'image' && <Image source={{ uri: update.attachment.uri }} style={styles.updateImage} />}
              {update.attachment?.type === 'video' && <Text style={styles.attachmentText}>Video attached: {update.attachment.name ?? 'clip'}</Text>}
            </View>
          </View>
        ))}
      </View>
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [projectAddress, setProjectAddress] = useState('');
  const [details, setDetails] = useState('');
  const [services, setServices] = useState<ShootService[]>([]);
  const [otherDescription, setOtherDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | null>(null);
  const [recurrenceOther, setRecurrenceOther] = useState('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [showRecurrenceEndPicker, setShowRecurrenceEndPicker] = useState(false);

  const filteredAddresses = useMemo(() => {
    const needle = projectAddress.trim().toLowerCase();
    if (needle.length < 3) return [];
    return addressSuggestions
      .filter((address) => address.toLowerCase().includes(needle) && address !== projectAddress)
      .slice(0, 4);
  }, [projectAddress]);

  const toggleService = (service: ShootService) => {
    setServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service],
    );
  };

  const submit = async () => {
    const selectedOther = services.includes('other');
    const missingRequired =
      !requesterName.trim() ||
      !title.trim() ||
      !requestedDate ||
      !projectAddress.trim() ||
      !details.trim() ||
      services.length === 0 ||
      (selectedOther && !otherDescription.trim()) ||
      (isRecurring && (!recurrenceEndDate || !recurrenceFrequency)) ||
      (isRecurring && recurrenceFrequency === 'other' && !recurrenceOther.trim());

    if (missingRequired) {
      Alert.alert('More details needed', 'Fill out every field and select at least one shoot option.');
      return;
    }

    if (requestedDate < tomorrow) {
      Alert.alert('Choose another date', 'Same-day project requests are disabled.');
      return;
    }

    await onSubmit({
      requesterName: requesterName.trim(),
      title: title.trim(),
      requestedWhen: formatProjectDate(requestedDate),
      requestedDate: requestedDate.toISOString(),
      projectAddress: projectAddress.trim(),
      services,
      otherDescription: selectedOther ? otherDescription.trim() : undefined,
      details: details.trim(),
      isRecurring,
      recurrenceFrequency: isRecurring ? recurrenceFrequency ?? undefined : undefined,
      recurrenceOther: isRecurring && recurrenceFrequency === 'other' ? recurrenceOther.trim() : undefined,
      recurrenceEndDate: isRecurring && recurrenceEndDate ? recurrenceEndDate.toISOString() : undefined,
    });
    setTitle('');
    setRequesterName(user.displayName);
    setRequestedDate(null);
    setProjectAddress('');
    setDetails('');
    setServices([]);
    setOtherDescription('');
    setIsRecurring(false);
    setRecurrenceFrequency(null);
    setRecurrenceOther('');
    setRecurrenceEndDate(null);
    Alert.alert('Request sent', `${user.displayName}, your shoot request was sent.`);
  };

  return (
    <View style={styles.adminPanel}>
      <Text style={styles.smallTitle}>Request a Project Shoot</Text>
      <TextInput
        style={styles.input}
        placeholder="Your name or business name"
        value={requesterName}
        onChangeText={setRequesterName}
        textContentType="organizationName"
      />
      <TextInput style={styles.input} placeholder="Project name" value={title} onChangeText={setTitle} />
      <SecondaryButton
        label={requestedDate ? formatProjectDate(requestedDate) : 'Select Date'}
        icon="calendar-outline"
        onPress={() => setShowDatePicker((current) => !current)}
      />
      {showDatePicker && (
        <DateTimePicker
          value={requestedDate ?? tomorrow}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          minimumDate={tomorrow}
          onChange={(_, date) => {
            if (Platform.OS !== 'ios') setShowDatePicker(false);
            if (date) setRequestedDate(date < tomorrow ? tomorrow : date);
          }}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Project address"
        value={projectAddress}
        onChangeText={setProjectAddress}
        textContentType="fullStreetAddress"
      />
      {filteredAddresses.length > 0 && (
        <View style={styles.suggestionBox}>
          {filteredAddresses.map((address) => (
            <Pressable key={address} style={styles.suggestionItem} onPress={() => setProjectAddress(address)}>
              <Ionicons name="location-outline" size={16} color="#0f766e" />
              <Text style={styles.suggestionText}>{address}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={styles.formLabel}>Check all that apply</Text>
      <View style={styles.statusGrid}>
        {shootServices.map((service) => {
          const active = services.includes(service.value);
          return (
            <Pressable
              key={service.value}
              style={[styles.statusButton, active && styles.activeStatusButton]}
              onPress={() => toggleService(service.value)}
            >
              <Text style={[styles.statusButtonText, active && styles.activeStatusButtonText]}>{service.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {services.includes('other') && (
        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="Describe the project"
          value={otherDescription}
          onChangeText={setOtherDescription}
          multiline
        />
      )}
      <TextInput
        style={[styles.input, styles.noteInput]}
        placeholder="Anything else I should know?"
        value={details}
        onChangeText={setDetails}
        multiline
      />
      <Pressable
        style={styles.radioRow}
        onPress={() => {
          setIsRecurring((current) => !current);
          if (isRecurring) {
            setRecurrenceFrequency(null);
            setRecurrenceOther('');
            setRecurrenceEndDate(null);
          }
        }}
      >
        <Ionicons name={isRecurring ? 'radio-button-on' : 'radio-button-off'} size={20} color="#0f766e" />
        <Text style={styles.radioText}>Recurring shoot</Text>
      </Pressable>
      {isRecurring && (
        <View style={styles.recurringBox}>
          <Text style={styles.formLabel}>Frequency</Text>
          <View style={styles.statusGrid}>
            {recurrenceFrequencies.map((frequency) => {
              const active = recurrenceFrequency === frequency.value;
              return (
                <Pressable
                  key={frequency.value}
                  style={[styles.statusButton, active && styles.activeStatusButton]}
                  onPress={() => setRecurrenceFrequency(frequency.value)}
                >
                  <Text style={[styles.statusButtonText, active && styles.activeStatusButtonText]}>
                    {frequency.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {recurrenceFrequency === 'other' && (
            <TextInput
              style={styles.input}
              placeholder="Custom recurrence"
              value={recurrenceOther}
              onChangeText={setRecurrenceOther}
            />
          )}
          <SecondaryButton
            label={recurrenceEndDate ? `Ends ${formatProjectDate(recurrenceEndDate)}` : 'Select End Date'}
            icon="calendar-clear-outline"
            onPress={() => setShowRecurrenceEndPicker((current) => !current)}
          />
          {showRecurrenceEndPicker && (
            <DateTimePicker
              value={recurrenceEndDate ?? requestedDate ?? tomorrow}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              minimumDate={requestedDate ?? tomorrow}
              onChange={(_, date) => {
                if (Platform.OS !== 'ios') setShowRecurrenceEndPicker(false);
                if (date) setRecurrenceEndDate(date);
              }}
            />
          )}
        </View>
      )}
      <PrimaryButton label="Send Shoot Request" icon="send-outline" onPress={submit} />
    </View>
  );
}

function AccountScreen({
  user,
  switchRole,
}: {
  user: AppUser | null;
  switchRole: (role: AppUser['role']) => void;
}) {
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
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
      <View style={styles.accountCard}>
        <Text style={styles.smallTitle}>Production setup checklist</Text>
        <ChecklistItem text="Add Firebase environment variables." />
        <ChecklistItem text="Deploy Firestore and Storage rules." />
        <ChecklistItem text="Configure APNs key in Firebase for iOS notifications." />
        <ChecklistItem text="Create admin custom claim for your account." />
        <ChecklistItem text="Add website chat widget using the same Firebase project." />
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

function PrimaryButton({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color="#ffffff" />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
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

function statusLabel(status: JobStatus) {
  return jobStatuses.find((item) => item.value === status)?.label ?? status;
}

function formatServices(services: ShootService[]) {
  return services
    .map((service) => shootServices.find((item) => item.value === service)?.label ?? service)
    .join(', ');
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
    backgroundColor: '#f7faf8',
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
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff7dc',
    borderWidth: 1,
    borderColor: '#f1d27c',
    flexDirection: 'row',
    gap: 8,
  },
  noticeText: {
    flex: 1,
    color: '#75530e',
    fontSize: 12,
    lineHeight: 17,
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
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
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
  messageImage: {
    height: 150,
    borderRadius: 8,
    marginTop: 8,
  },
  attachmentText: {
    color: '#285f8f',
    fontWeight: '700',
    marginTop: 8,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dce5df',
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
  jobHero: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
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
  jobListItem: {
    minHeight: 68,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce5df',
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  activeJobListItem: {
    borderColor: '#0f766e',
    backgroundColor: '#e3f5f1',
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
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e3f5f1',
  },
  statusText: {
    color: '#0f766e',
    fontWeight: '800',
  },
  mapWrap: {
    marginHorizontal: 14,
    marginBottom: 14,
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
  locationClosed: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  adminPanel: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
    gap: 10,
  },
  requestCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce5df',
    padding: 12,
    backgroundColor: '#fbfdfc',
    gap: 4,
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
  flexOne: {
    flex: 1,
  },
  formLabel: {
    color: '#405048',
    fontSize: 13,
    fontWeight: '800',
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
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f5f2',
  },
  radioText: {
    color: '#17221d',
    fontWeight: '800',
  },
  recurringBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce5df',
    padding: 12,
    gap: 10,
    backgroundColor: '#fbfdfc',
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
  timeline: {
    marginHorizontal: 14,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  timelineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#0f766e',
    marginTop: 5,
  },
  timelineBody: {
    flex: 1,
  },
  timelineTitle: {
    color: '#17221d',
    fontWeight: '800',
  },
  timelineText: {
    color: '#405048',
    marginTop: 3,
    lineHeight: 20,
  },
  timelineTime: {
    color: '#687076',
    fontSize: 12,
    marginTop: 4,
  },
  updateImage: {
    height: 160,
    borderRadius: 8,
    marginTop: 8,
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
    minHeight: 44,
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
  tabLabel: {
    color: '#687076',
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabLabel: {
    color: '#0f766e',
  },
});
