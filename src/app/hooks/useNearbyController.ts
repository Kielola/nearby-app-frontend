import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useProcessPayment } from '../../features/premium/hooks/useProcessPayment';
import { useCancelVoiceRecording } from '../../features/chat/hooks/useCancelVoiceRecording';
import { useStopAndSendVoice } from '../../features/chat/hooks/useStopAndSendVoice';
import { useStartVoiceRecording } from '../../features/chat/hooks/useStartVoiceRecording';
import { useDoodleCanvas } from '../../features/camera/hooks/useDoodleCanvas';
import { useCapturePhoto } from '../../features/camera/hooks/useCapturePhoto';
import { useCallSessionTimers } from '../../features/calls/hooks/useCallSessionTimers';
import { useStoryAutoAdvance } from '../../features/stories/hooks/useStoryAutoAdvance';
import { useStoryViewerPlayback } from '../../features/stories/hooks/useStoryViewerPlayback';
import { useTypingIndicatorPublisher } from '../../features/chat/hooks/useTypingIndicatorPublisher';
import { useMeetupsSync } from '../../features/meetups/hooks/useMeetupsSync';
import { useAppearanceModeEffect } from '../../features/settings/hooks/useAppearanceModeEffect';
import { useMyHighlights } from '../../features/profile/hooks/useMyHighlights';
import { useViewedUserContent } from '../../features/neighbors/hooks/useViewedUserContent';
import { useViewedNeighborContent } from '../../features/neighbors/hooks/useViewedNeighborContent';
import { usePresenceMapSync } from '../../features/presence/hooks/usePresenceMapSync';
import { useNearbyNeighbors } from '../../features/neighbors/hooks/useNearbyNeighbors';
import { useServerProfileAdoption } from '../../features/profile/hooks/useServerProfileAdoption';
import { useProfileBackendPersistence } from '../../features/profile/hooks/useProfileBackendPersistence';
import { useIncomingRequestsRef } from '../../features/social/hooks/useIncomingRequestsRef';
import { useMeetupRatingsSync } from '../../features/meetups/hooks/useMeetupRatingsSync';
import { useChatSearchMatches } from '../../features/chat/hooks/useChatSearchMatches';
import { useOnlineStatus } from '../../features/system/hooks/useOnlineStatus';
import { useFirestoreHealthCheck } from '../../features/system/hooks/useFirestoreHealthCheck';
import { useNotifications } from '../../features/notifications/hooks/useNotifications';
import { sendPasswordReset } from '../../features/authentication/services/passwordReset';
import { useAuthRedirect } from '../../features/authentication/hooks/useAuthRedirect';
import { usePresenceHeartbeat } from '../../features/presence/hooks/usePresenceHeartbeat';
import { useChatScrollAnchoring } from '../../features/chat/hooks/useChatScrollAnchoring';
import { useChatReadReceipts } from '../../features/chat/hooks/useChatReadReceipts';
import { useStoryExpiry } from '../../features/stories/hooks/useStoryExpiry';
import { APIProvider, Map, AdvancedMarker, Pin as GMapPin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Instagram,
  Music,
  MessageCircle,
  Camera,
  User,
  Phone,
  Video as VideoIcon,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Upload,
  Radio,
  Navigation,
  Compass,
  Radar,
  Heart,
  Palette,
  Check,
  CheckCheck,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Mail,
  Plus,
  X,
  Play,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Volume2,
  Tv,
  Smile,
  Info,
  Sun,
  Moon,
  UserPlus,
  Settings,
  Menu,
  Grid,
  Key,
  Lock,
  Bell,
  Globe,
  Link,
  Share2,
  HelpCircle,
  Shield,
  ShieldAlert,
  CheckCircle2,
  LogOut,
  Image as ImageIcon,
  Home,
  Users,
  Paperclip,
  FileText,
  Download,
  Crown,
  SlidersHorizontal,
  Reply,
  Trash2,
  Pin,
  Archive,
  ArrowLeft,
  MessageSquare,
  RefreshCw,
  Wifi,
  WifiOff,
  Signal,
  VolumeX,
  MoreVertical,
  MoreHorizontal,
  Bluetooth,
  Star
} from 'lucide-react';
import { Neighbor, DirectMessage, CallState, StorySnap, PublicSnap, Meetup, MeetupRating } from '../../types';
import { radarApi, usersApi, chatApi, presenceApi, aiApi } from '../../lib/api';
import { mediaApi } from '../../lib/api/mediaApi';
import { useNearbyUsersQuery } from '../../features/maps/hooks/useNearbyUsersQuery';
import { useAuth } from '../../features/authentication/context/AuthContext';
import { useChatSync } from '../../features/chat/hooks/useChatSync';
import { useFriendsSync } from '../../features/friends/hooks/useFriendsSync';
import { useUserContent } from '../../features/content/hooks/useUserContent';
import { getCallSocket } from '../../lib/socket/callSocket';
import { getChatSocket } from '../../lib/socket/chatSocket';
import {
  reverseGeocode,
  fallbackLabelFor,
  locationService,
  clearLocationCache,
} from '../../features/maps/services/locationService';
import {
  acquireLocation,
  clearStoredLocation,
  isLocationFailure,
  isLocationSuccess,
  type LocationFailure,
  type LocationOutcome,
} from '../../features/maps/services/geolocation';
import { useCallSignaling } from '../../features/calls/hooks/useCallSignaling';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePresenceSync } from '../../features/presence/hooks/usePresenceSync';
import { friendsApi } from '../../lib/api';
import { postsApi, highlightsApi } from '../../lib/api';
import { getAppTheme } from '../theme/getAppTheme';
import { useLocationTracking } from '../../features/maps/hooks/useLocationTracking';
import { useAuthProfileSync } from '../../features/authentication/hooks/useAuthProfileSync';
import { useChatActions } from '../../features/chat/hooks/useChatActions';
import { useAuthActions } from '../../features/authentication/hooks/useAuthActions.ts';
import { useChatManagement } from '../../features/chat/hooks/useChatManagement.ts';
import { useSocialActions } from '../../features/friends/hooks/useSocialActions.ts';
import { useMediaUploads } from '../../features/media/hooks/useMediaUploads.ts';
import {
  playNotificationSound as playNotificationSoundImpl,
  playSynthesizedVoiceNote as playSynthesizedVoiceNoteImpl,
  triggerBeep as triggerBeepImpl,
} from '../../features/audio/audioEngine';
import { UNKNOWN_LOCATION, NEIGHBORHOODS, NIGERIAN_STATES, INITIAL_NEIGHBORS, INITIAL_MESSAGES, LocationPreset, INITIAL_NOTES, UserNote } from '../../mockData';
import { getStateStreets } from '../../utils';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  where,
  arrayUnion,
  arrayRemove,
  getDocFromServer,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  uploadToStorage,
} from '../../firebase';
import { createNotification, AppNotification } from '../../features/notifications/services/createNotification';
import { useNotificationsSync } from '../../features/notifications/hooks/useNotificationsSync';
import { notificationsApi } from '../../lib/api';
import { reportsApi } from '../../lib/api';
import { meetupsApi } from '../../lib/api';
import {
  User as FirebaseUser,
  sendPasswordResetEmail,
  sendEmailVerification,
  getRedirectResult,
  signInWithRedirect,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { useMessages } from '../../features/chat/hooks/useMessages';
import { useChatList } from '../../features/chat/hooks/useChatList';
import { useNeighborPresence } from '../../features/presence/hooks/useNeighborPresence';
import { useStories } from '../../features/content/hooks/useStories';
import { useLocationActions } from '../../features/maps/hooks/useLocationActions';
import { useContactsSync } from '../../features/friends/hooks/useContactsSync';
import { useUiFlags } from '../../features/settings/hooks/useUiFlags';
import { useCallMediaElements } from '../../features/calls/hooks/useCallMediaElements';
import { useProfileState, initialProfile } from '../../features/profile/hooks/useProfileState';
import { useOnboardingState } from '../../features/authentication/hooks/useOnboardingState';
import { useChatRoomState } from '../../features/chat/hooks/useChatRoomState';
import { useCameraState } from '../../features/camera/hooks/useCameraState';
import { useStoryState } from '../../features/stories/hooks/useStoryState';


const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof process !== 'undefined' ? process.env?.GOOGLE_MAPS_PLATFORM_KEY : '') ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidGoogleMapsKey = Boolean(GOOGLE_MAPS_API_KEY) && GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY';

/**
 * Nearby application controller.
 *
 * This hook owns the existing application state, effects, and event handlers.
 * UI composition lives in feature/screen components and consumes this runtime
 * through NearbyRuntimeContext. No application behavior is intentionally changed
 * by this extraction.
 */
export function useNearbyController() {
  // Bridges to the same backend user record AuthContext resolves — needed
  // here because chat/radar/friends all key off the Postgres user id, not
  // the Firebase uid, once talking to the new backend.
  const { appUser } = useAuth();

  const hasSavedAccountOnDisk = (() => {
    try {
      const raw = localStorage.getItem('nearby_saved_accounts');
      if (raw) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) && arr.length > 0;
      }
    } catch (_) {}
    return false;
  })();

  const useProfileStateDomain = useProfileState();

  const useOnboardingStateDomain = useOnboardingState();
  const {
    onboardingAgeRange,
    onboardingBio,
    onboardingCommunities,
    onboardingCoords,
    onboardingGender,
    onboardingInterests,
    onboardingName,
    onboardingPhoto,
    onboardingState,
    onboardingStreetName,
    onboardingUsername,
    setOnboardingBio,
    setOnboardingName,
    setOnboardingPhoto,
    setOnboardingStep,
    setOnboardingUsername,
  } = useOnboardingStateDomain;
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    customAccentColor,
    customChatBg,
    customChatBubbleStyle,
    customChatFont,
    customProfilePhoto,
    isProfileLoaded,
    setCustomAccentColor,
    setCustomChatBg,
    setCustomChatBubbleStyle,
    setCustomChatFont,
    setCustomProfilePhoto,
    setIsProfileLoaded,
    setUserAddress,
    setUserAgeRange,
    setUserBio,
    setUserCommunities,
    setUserCoords,
    setUserDisplayName,
    setUserFollowers,
    setUserFollowersCount,
    setUserFollowing,
    setUserFollowingCount,
    setUserGender,
    setUserGroupCallPolicy,
    setUserGroupInvitePolicy,
    setUserHighlights,
    setUserInterests,
    setUserMeetupCount,
    setUserNoteText,
    setUserPosts,
    setUserRadarEmoji,
    setUserRadarStatusText,
    setUserTrustScore,
    setUserUsername,
    setUserWebsite,
    userAddress,
    userBio,
    userCoords,
    userDisplayName,
    userFollowers,
    userFollowersCount,
    userFollowing,
    userFollowingCount,
    userGroupCallPolicy,
    userGroupInvitePolicy,
    userMeetupCount,
    userNoteText,
    userRadarEmoji,
    userRadarStatusText,
    userTrustScore,
    userUsername,
    userWebsite,
  } = useProfileStateDomain;

  const useUiFlagsDomain = useUiFlags({
    hasSavedAccountOnDisk,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    setShowContactsPermissionPrompt,
    setShowCreateGroupModal,
    setShowForwardModal,
    setShowLandingMode,
    setShowNoteModal,
    setShowOnboarding,
    showArchivedOnly,
    showOnboarding,
  } = useUiFlagsDomain;
  const [activeTab, setActiveTab] = useState<'radar' | 'chat' | 'status' | 'menu' | 'explore'>('chat');

  const [selectedPreset, setSelectedPreset] = useState<LocationPreset>(() => {
    try {
      const saved = localStorage.getItem('nearby_selected_preset');
      if (saved) {
        // Only trust a stored preset that was actually derived from a GPS fix.
        // A placeholder is discarded rather than shown as the user's location.
        const parsed = JSON.parse(saved);
        if (parsed && !parsed.isPlaceholder) return parsed;
      }
    } catch (_) {}
    // NOT NEIGHBORHOODS[0]. That entry is "Ogo-Oluwa, Osogbo" — 200 km from
    // Lagos — and it was being presented on the location screen as the user's
    // location when geolocation silently failed on iOS Safari.
    return UNKNOWN_LOCATION;
  });

  // -----------------------------------------
  // Location truth
  // -----------------------------------------
  // The app previously defaulted `selectedPreset` to a DEMO neighbourhood, so
  // when no real GPS fix ever arrived — which is what happens on iOS Safari if
  // the prompt is dismissed — the UI went right on showing that demo place as
  // the user's location while they were in Lagos. `locationStatus` makes the
  // truth visible so the UI can say "we don't have your location yet".
  const [locationStatus, setLocationStatus] = useState<
    | { state: 'idle' }
    | { state: 'locating' }
    | { state: 'ready' }
    | { state: 'failed'; failure: LocationFailure }
  >({ state: 'idle' });
  // True when the user must change a setting before location can work at all.
  const locationNeedsUserAction =
    locationStatus.state === 'failed' ? locationStatus.failure.requiresUserAction : false;
  const locationFailureMessage =
    locationStatus.state === 'failed' ? locationStatus.failure.message : null;
  /**
   * Throttles live location writes to the backend.
   *
   * A permission prompt that fires before the user has interacted is exactly
   * what iOS Safari suppresses; a gesture-driven call is far more likely to show
   * it. Once we do have a fix, this ref keeps us from posting every GPS tick —
   * `{lat, lng, time}` of the last accepted write, so `useLocationActions` can
   * decide whether the movement is worth a round trip.
   */
  const lastLocationWriteRef = useRef<{ lat: number; lng: number; time: number }>({ lat: 0, lng: 0, time: 0 });

  /**
 * Sends a profile patch through the API.
 *
 * The backend owns the shape of the user row, so this maps only the fields
 * the API actually supports. Previously each of these call sites did
 * `setDoc(doc(db, 'users', uid), { ...appLanguage, isSubscribed })` with real
 * profile fields mixed in, and one of them even wrote a whole `friendIds`
 * array — which silently reverted server-authored columns. The API exists for
 * exactly this purpose: the server owns what it owns.
 */
const persistProfileToBackend = async (patch: Record<string, unknown>) => {
const payload: Record<string, unknown> = {};
if (typeof patch.name === 'string' && patch.name.trim()) payload.displayName = patch.name;
if (typeof patch.customProfilePhoto === 'string') payload.avatarUrl = patch.customProfilePhoto;
if (typeof patch.customStatus === 'string') payload.customStatus = patch.customStatus;
await usersApi.updateMe(payload);
};

  /**
   * Lets the content-upload path ask the user-content query to refetch.
   *
   * That query is declared further down — it needs the auth state to exist
   * first — while the upload handler is needed near the top. The ref bridges
   * the two without reordering either.
   */
  const refetchMyContentRef = useRef<() => void>(() => {});

  const updateRadarPresenceInFirestore = async (enabled: boolean, mode: 'everyone' | 'friends' | 'hidden') => {
    const currentUserId = auth.currentUser?.uid || localStorage.getItem('nearby_current_uid') || '';
    if (!currentUserId || !auth.currentUser || auth.currentUser.uid !== currentUserId) return;
    try {
      // Server now enforces this in RadarService.findNearby (banned check,
      // hidden/friends-only modes, with friend/existing-chat overrides) —
      // this call just persists the setting.
      await radarApi.setVisibility(enabled, mode);
    } catch (err) {
      console.warn("Could not sync visibility settings to backend:", err);
    }
  };


  const [neighbors, setNeighbors] = useState<Neighbor[]>(INITIAL_NEIGHBORS);
  const [selectedNeighborState, setSelectedNeighbor] = useState<Neighbor | null>(null); // For active chat thread

  // Load real presence in real-time o!
  const [presenceMap, setPresenceMap] = useState<Record<string, { online: boolean, status: 'active' | 'away' | 'offline', typing: string, lastSeen: string, currentConversation: string }>>({});

  const syncedNeighbors = useMemo(() => {
    return neighbors.map(nb => {
      const pData = presenceMap[nb.id];
      if (pData) {
        return {
          ...nb,
          onlineStatus: pData.status || (pData.online ? 'active' : 'offline'),
          typingTo: pData.typing,
          lastSeen: pData.lastSeen
        };
      }
      return nb;
    });
  }, [neighbors, presenceMap]);

  const selectedNeighbor = useMemo(() => {
    if (!selectedNeighborState) return null;
    const synced = syncedNeighbors.find(nb => nb.id === selectedNeighborState.id);
    return synced ? { ...selectedNeighborState, ...synced } : selectedNeighborState;
  }, [selectedNeighborState, syncedNeighbors]);

  // Derived straight from `selectedNeighbor`. It reads as part of the same
  // idea, and a dozen effects below depend on it, so it stays here rather
  // than being threaded back out of a hook.
  const selectedNeighborId = selectedNeighbor?.id;
  const [chatLimit, setChatLimit] = useState<number>(50);
  const [activeNotes, setActiveNotes] = useState<UserNote[]>(INITIAL_NOTES);

  // New visual states for Redesign
  const [searchWideSop, setSearchWideSop] = useState<string>('');
  const [chatSubTab, setChatSubTab] = useState<'messages' | 'requests'>('messages');
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'favorites' | 'requests' | 'calls'>('all');
  const [pendingFriendRequests, setPendingFriendRequests] = useState<string[]>([]); // Dynamic pending requests o!
  const [sentFriendRequestIds, setSentFriendRequestIds] = useState<string[]>([]); // Track outgoing requests o!
  const [showPremiumModal, setShowPremiumModal] = useState<boolean>(false);
  const [exploreSubTab, setExploreSubTab] = useState<'feed' | 'communities' | 'radar' | 'crossed' | 'safety'>('radar');
  const [isCurrentMeBanned, setIsCurrentMeBanned] = useState<boolean>(false);

  // File input references for gallery uploads
  const storyFileRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);
  const postFileRef = useRef<HTMLInputElement>(null);
  const autoLoginAttemptedRef = useRef<boolean>(false);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const latestCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Profile & Settings states


  // Multi-language state helper
  const [appLanguage, setAppLanguage] = useState<'english' | 'hausa' | 'igbo' | 'yoruba' | 'pidgin'>('english');
  const [contactsList, setContactsList] = useState<Array<{ name: string; phone: string; nearby: boolean }>>([]);
  const [isRequestingContacts, setIsRequestingContacts] = useState<boolean>(false);
  // `showNearbyNotification` / `nearbyNotificationCount` used to live here. They
  // drove the fabricated "23 neighbours nearby" popup and are gone with it —
  // including the initial value of 23, which was itself invented.
  //
  // Removing the declarations as well as the timer means the compilers enforce
  // that nothing reads them: if any component still tried, the build fails
  // instead of silently rendering a stale number forever.

  // Neighbor Profile view overlay
  const [viewingNeighborProfile, setViewingNeighborProfile] = useState<Neighbor | null>(null);

  // Edit profile modal trigger
  const [viewingUserPostDetail, setViewingUserPostDetail] = useState<{ id: string; mediaUrl: string; caption?: string; timestamp: string; type: 'image' | 'video' } | null>(null);
  const [neighborPosts, setNeighborPosts] = useState<any[]>([]);
  const [neighborHighlights, setNeighborHighlights] = useState<any[]>([]);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [meetupRatings, setMeetupRatings] = useState<MeetupRating[]>([]);

  // Schedule Meetup Modal States
  const [scheduleMeetupTargetNeighbor, setScheduleMeetupTargetNeighbor] = useState<Neighbor | null>(null);
  const [scheduleMeetupPoint, setScheduleMeetupPoint] = useState<string>("");
  const [scheduleMeetupTime, setScheduleMeetupTime] = useState<string>("");
  const [scheduleMeetupLat, setScheduleMeetupLat] = useState<number>(0);
  const [scheduleMeetupLng, setScheduleMeetupLng] = useState<number>(0);

  // Inline Rating States
  const [ratingReviewText, setRatingReviewText] = useState<string>("");
  const [activeRatingStars, setActiveRatingStars] = useState<number>(5);
  const [ratingFormMeetupId, setRatingFormMeetupId] = useState<string | null>(null);

  // GB WhatsApp Premium toggles that are unlocked!
  const [gbFreezeLastSeen, setGbFreezeLastSeen] = useState<boolean>(false);
  const [gbAntiDelete, setGbAntiDelete] = useState<boolean>(true);
  const [gbHideOnline, setGbHideOnline] = useState<boolean>(false);
  const [gbBlueTickOnReply, setGbBlueTickOnReply] = useState<boolean>(false);

  // Apple-Level Settings subviews
  const [settingsSubView, setSettingsSubView] = useState<'main' | 'privacy' | 'notifications' | 'radar' | 'meetups' | 'chats' | 'appearance' | 'about'>('main');

  const [notifMessages, setNotifMessages] = useState<boolean>(true);
  const [notifFriendRequests, setNotifFriendRequests] = useState<boolean>(true);
  const [notifMeetups, setNotifMeetups] = useState<boolean>(true);
  const [notifRatings, setNotifRatings] = useState<boolean>(true);
  const [notifNearbyUsers, setNotifNearbyUsers] = useState<boolean>(true);
  const [notifEvents, setNotifEvents] = useState<boolean>(true);

  const [appearanceMode, setAppearanceMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('appearanceMode') as 'light' | 'dark' | 'system') || 'dark';
  });

  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<boolean>(false);

  // Dynamic gallery handling functions
  
  // Under the hood state for messages
  const [chatMessages, _setChatMessages] = useState<Record<string, DirectMessage[]>>(INITIAL_MESSAGES);

  // The message array is shared state: `useCallSignaling`, `useChatActions`,
  // `useChatManagement` and `useSocialActions` all write to it, and every one
  // of them runs before `useMessages` does. So the setter lives here and is
  // passed in, rather than being owned by the hook that mostly uses it.
  const setChatMessages = (
    value: Record<string, DirectMessage[]> | ((prev: Record<string, DirectMessage[]>) => Record<string, DirectMessage[]>)
  ) => {
    _setChatMessages(prev => {
      return typeof value === 'function' ? value(prev) : value;
    });
  };

  // Kept in sync below purely so the users-listener effect (which builds the `neighbors`
  // list) can check "do I already have a conversation with this person" without needing
  // chatMessages in its dependency array - that list re-subscribes to a Firestore
  // collection listener, and we don't want it tearing down/rebuilding on every message.
  // Message ids we've already raised a "New Message" notification for, so the
  // update path (edits/reactions/read receipts re-save the same doc) can't spam
  // the recipient with duplicate pings for one message.
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());

  const chatMessagesRef = useRef<Record<string, DirectMessage[]>>(chatMessages);
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);
  
  // Custom wrapper to update messages state locally

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  // Presence + typing live further down, after nearbyUsersData and
  // textInput are in scope.


  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isSplashActive, setIsSplashActive] = useState<boolean>(true);
  const [welcomeTourStep, setWelcomeTourStep] = useState<number>(0);

  const [authScreenState, setAuthScreenState] = useState<'login' | 'signup' | 'forgot' | 'verification'>('login');
  const [authSuccess, setAuthSuccess] = useState<string>('');

  useEffect(() => {
    if (authSuccess) {
      const timer = setTimeout(() => {
        setAuthSuccess("");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [authSuccess]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashActive(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  // Authentication inputs state
  /**
   * Credentials from the most recent sign-in attempt.
   *
   * A ref, not state: this is read by `saveOnboardingDetails` and the two
   * registration paths, none of which re-render on the value, and putting it in
   * state is the exact thing that made typing lag. It replaces the old
   * `authEmailOrPhone` / `authPassword` state, which held the same information
   * but caused a full application re-render on every keystroke.
   *
   * Never rendered, never persisted beyond `nearby_saved_accounts`.
   */
  const lastCredentialsRef = useRef<{ emailOrPhone: string; password: string }>({
    emailOrPhone: '',
    password: '',
  });

  // NOTE: `authEmailOrPhone`, `authPassword` and `authConfirmPassword` used to
  // live here. They now live in `useAuthFormState`, owned by the screen that
  // renders the fields. Keeping them in this hook meant every keystroke
  // re-rendered this entire controller and every consumer of its context — see
  // the comment on that hook for the full explanation. The values arrive here as
  // function arguments instead.
  const [authIsSignUp, setAuthIsSignUp] = useState<boolean>(!hasSavedAccountOnDisk);
  const [isPhoneAuthOption, setIsPhoneAuthOption] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  // Permission statuses for onboarding

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>('');
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Custom states for Nigerian users
  const [usingGoogleMaps, setUsingGoogleMaps] = useState<boolean>(hasValidGoogleMapsKey);
  const [radarRadius, setRadarRadius] = useState<number>(500); // meters Slider filter
  const [showRadarDrawer, setShowRadarDrawer] = useState<boolean>(false);

  // -----------------------------------------
  // Premium Subscription & Monetized Features
  // -----------------------------------------
  const [isSubscribed, setIsSubscribed] = useState<boolean>(true); // Gold Unlocked o!
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [premiumUpgradeFeature, setPremiumUpgradeFeature] = useState<string>('');
  const [pendingPremiumAction, setPendingPremiumAction] = useState<() => void>(() => {});
  const [friendsAddedTodayCount, setFriendsAddedTodayCount] = useState<number>(0);
  const [uploadMode, setUploadModeState] = useState<'post' | 'highlight'>('post');
  const uploadModeRef = useRef<'post' | 'highlight'>('post');
  const setUploadMode = (mode: 'post' | 'highlight') => {
    uploadModeRef.current = mode;
    setUploadModeState(mode);
  };
  
  // GB WhatsApp Style User Custom Interface Accent Theme / Background / Bubble / Fonts
  const [audioFeedback, setAudioFeedback] = useState<string>('');
  const [friendIds, setFriendIds] = useState<string[]>([]); // derived from /friendships

  // triggerBeep + audioContextRef + the call-signaling hook are hoisted
  // here (well before their "natural" position further down) because
  // several effects/functions throughout this file reference callState,
  // localStream, etc. — putting the hook call after ALL of its consumers
  // isn't possible in one file, so it goes right after its own
  // dependencies (friendIds, neighbors, appUser) are available instead.
  // -----------------------------------------
  // Audio output
  // -----------------------------------------
  //
  // The three Web Audio functions that used to be written out here — and the
  // `audioContextRef` they shared — now live in `features/audio/audioEngine`.
  // That module owns one AudioContext for the page rather than the ref owning
  // one per hook instance, and it centralises Safari's autoplay handling in a
  // single place instead of three copies of the same six-line preamble.
  //
  // These aliases keep every existing call site working unchanged.
  const triggerBeep = triggerBeepImpl;
  const playNotificationSound = playNotificationSoundImpl;
  const playSynthesizedVoiceNote = playSynthesizedVoiceNoteImpl;

  const {
    callState, setCallState,
    micMuted, setMicMuted,
    videoOff, setVideoOff,
    isSpeakerOn, setIsSpeakerOn,
    beautyMode, setBeautyMode,
    bluetoothOn, setBluetoothOn,
    cameraFacingMode, setCameraFacingMode,
    networkQuality, networkQualityDesc, iceConnectionState,
    localStream, remoteStream,
    pcRef, localStreamRef, remoteStreamRef, localVideoRef, remoteVideoRef,
    startCall, receiveCallSimulation, answerIncomingCall, endCall,
    switchCamera, toggleMicMute, toggleVideoOff,
  } = useCallSignaling({
    currentUser,
    appUser,
    friendIds,
    neighbors,
    triggerBeep,
    setAudioFeedback,
    setChatMessages,
  });

  // Deterministic friendship document id - both devices compute the same one,
  // so a relationship is exactly one document and duplicates are impossible.
  const friendshipDocId = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);

  // User Radar Presence / Visibility (Adding yourself on the radar app!)
  const [isUserVisibleOnRadar, setIsUserVisibleOnRadar] = useState<boolean>(true);
  const [radarVisibilityMode, setRadarVisibilityMode] = useState<'everyone' | 'friends' | 'hidden'>('everyone');

  // Live status descriptions for mutual friends
  
  // Group creation States
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupDesc, setNewGroupDesc] = useState<string>('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [newGroupEmoji, setNewGroupEmoji] = useState<string>('⚽️');
  const [newGroupColor, setNewGroupColor] = useState<string>('bg-emerald-600');

  // Simulated invitations modals (Privacy Policies trigger)
  const [pendingIncomingInviteGroup, setPendingIncomingInviteGroup] = useState<{
    id: string;
    name: string;
    desc: string;
    emoji: string;
    color: string;
    senderId: string;
    senderName: string;
  } | null>(null);

  const [pendingIncomingCall, setPendingIncomingCall] = useState<{
    groupId: string;
    groupName: string;
    senderId: string;
    senderName: string;
  } | null>(null);

  // Theme & Location Accuracy Custom States
  const [appTheme, setAppTheme] = useState<'dark' | 'light'>('dark');

  useAppearanceModeEffect({
    appearanceMode,
    setAppTheme,
  });

  useEffect(() => {
    if (appTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appTheme]);
  const [gpsSynced, setGpsSynced] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nearby_last_user_coords') !== null;
    } catch (_) {
      return false;
    }
  });
  const [searchStateQuery, setSearchStateQuery] = useState<string>('');

  // -----------------------------------------
  // Call States & Simulated Engines — moved below, after triggerBeep is
  // declared (useCallSignaling needs it, and it isn't defined until later
  // in this file).
  // -----------------------------------------

  // Real voice recording ref parameters
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // (The streetName sync that used to live here was removed.)
  // updatePresetWithCoordinates already PATCHes the resolved label to the
  // backend, and only when it is genuinely a street-level match. Keeping
  // this second writer meant a coarse "Approximate location" label could
  // race a good one and win.

  // Listen to Google Maps API authentication failure events to automatically fall back to Leaflet
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn("⚠️ Google Maps API Key auth failure detected! Automatically switching to high-performance Leaflet OpenStreetMap.");
      setUsingGoogleMaps(false);
      setGoogleBillingError(true); // Display the helpful notification banner o!
    };
    return () => {
      delete (window as any).gm_authFailure;
    };
  }, []);

  // -----------------------------------------
  // Camera, Filters, Drawings
  // -----------------------------------------

  const useCameraStateDomain = useCameraState({
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    activeFilter,
    brushColor,
    cameraActive,
    canvasDrawing,
    capturedImage,
    isDrawing,
    photoCaption,
    setActiveFilter,
    setBrushColor,
    setCameraActive,
    setCanvasDrawing,
    setCapturedImage,
    setIsDrawing,
    setPhotoCaption,
  } = useCameraStateDomain;

  const useStoryStateDomain = useStoryState({
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    isMutedStoriesExpanded,
    isPublishingStory,
    isStoryPaused,
    mutedStoryUserIds,
    myStorySnaps,
    neighborStories,
    playingSnapIndex,
    playingStorySnaps,
    setIsMutedStoriesExpanded,
    setIsPublishingStory,
    setIsStoryPaused,
    setMutedStoryUserIds,
    setMyStorySnaps,
    setNeighborStories,
    setPlayingSnapIndex,
    setPlayingStorySnaps,
    setStoryCompositionCaption,
    setStoryCompositionCustomList,
    setStoryCompositionPrivacy,
    setStoryPlaylist,
    setStoryPlaylistIndex,
    setStoryUploadData,
    setStoryViewer,
    setStoryViewerReplies,
    storyCompositionCaption,
    storyCompositionCustomList,
    storyCompositionPrivacy,
    storyPlaylist,
    storyPlaylistIndex,
    storyUploadData,
    storyViewer,
    storyViewerReplies,
  } = useStoryStateDomain;
  const [myUploadedStory, setMyUploadedStory] = useState<StorySnap | null>(null);
  
  // Auto-dismiss all notifications/toasts after 2 seconds
  useEffect(() => {
    if (audioFeedback) {
      const timer = setTimeout(() => {
        setAudioFeedback('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [audioFeedback]);
  
  // Custom states to handle API billing and Quotas o!
  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState<boolean>(false);
  const [googleBillingError, setGoogleBillingError] = useState<boolean>(false);
  const [dismissedIframeWarning, setDismissedIframeWarning] = useState<boolean>(false);

  // WhatsApp-specific states

  const useChatRoomStateDomain = useChatRoomState({
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    activeChatSearchQuery,
    activeMediaGalleryTab,
    blockedNeighborIds,
    currentSearchMatchIndex,
    editingMessage,
    emojiCategory,
    emojiSearchQuery,
    isLockVoiceRecording,
    isMessageSelectMode,
    longPressedNeighborForMenu,
    mutedNeighborIds,
    recentlyUsedEmojis,
    replyingToMessage,
    searchMatchIds,
    selectedMessageIds,
    selectedSkinTone,
    setActiveChatSearchQuery,
    setActiveMediaGalleryTab,
    setBlockedNeighborIds,
    setCurrentSearchMatchIndex,
    setEditingMessage,
    setEmojiCategory,
    setEmojiSearchQuery,
    setIsLockVoiceRecording,
    setIsMessageSelectMode,
    setLongPressedNeighborForMenu,
    setMutedNeighborIds,
    setRecentlyUsedEmojis,
    setReplyingToMessage,
    setSearchMatchIds,
    setSelectedMessageIds,
    setSelectedSkinTone,
    setSimulatedTypingMap,
    setUnreadNeighborIds,
    setVoicePlaybackSpeedMap,
    simulatedTypingMap,
    unreadNeighborIds,
    voicePlaybackSpeedMap,
  } = useChatRoomStateDomain;
  
  // Archived Chats support o!
  const [archivedNeighborIds, setArchivedNeighborIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('whatsapp_archived_chats') || '[]');
    } catch {
      return [];
    }
  });

  // Touch Gestures State for Swipe to Reply
  const [swipeOffsetMsgId, setSwipeOffsetMsgId] = useState<string | null>(null);
  const [swipeOffsetAmount, setSwipeOffsetAmount] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number>(0);

  const handleMessageTouchStart = (e: React.TouchEvent, msgId: string) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setSwipeOffsetMsgId(msgId);
    setSwipeOffsetAmount(0);
  };

  const handleMessageTouchMove = (e: React.TouchEvent, msgId: string) => {
    if (swipeOffsetMsgId !== msgId) return;
    const diffX = e.touches[0].clientX - touchStartX;
    const diffY = e.touches[0].clientY - touchStartY;
    if (Math.abs(diffY) < 25) {
      if (diffX > 0) {
        setSwipeOffsetAmount(Math.min(diffX, 75));
      }
    }
  };


  const [activeBubbleDropdownId, setActiveBubbleDropdownId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('whatsapp_archived_chats', JSON.stringify(archivedNeighborIds));
  }, [archivedNeighborIds]);

  useChatSearchMatches({
    activeChatSearchQuery,
    chatMessages,
    currentUser,
    selectedNeighborId,
    setCurrentSearchMatchIndex,
    setSearchMatchIds,
  });

  useFirestoreHealthCheck({
    setFirestoreQuotaExceeded,
  });

  // Online / Offline state tracking
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useOnlineStatus({
    setIsOnline,
    triggerBeep,
  });

  // Voice Note states
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceRecordingLocked, setVoiceRecordingLocked] = useState<boolean>(false);

  // -----------------------------------------
  // Firebase Authentication & State Synchronization
  // -----------------------------------------
  useEffect(() => {
    // Validate Connection to Firestore on boot (mandated by SKILL.md)
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  const handleSendResetLink = async (emailOrPhone: string) => {
    if (!emailOrPhone || !emailOrPhone.trim().includes('@')) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      // See features/authentication/services/passwordReset.ts — routes the user
      // back to our own domain when VITE_AUTH_CONTINUE_URL is configured.
      await sendPasswordReset(emailOrPhone.trim());
      setAuthSuccess("We've sent a secure reset link to your email.");
      setAuthScreenState('login');
    } catch (err: any) {
      console.error("Password reset failure: ", err);
      setAuthError(err.message || "Failed to send reset link.");
    } finally {
      setAuthLoading(false);
    }
  };



  useAuthRedirect({
    setAuthError,
    setAuthLoading,
    setCurrentUser,
    setShowLandingMode,
  });

  // -----------------------------------------
  // Session lifecycle and profile hydration
  // -----------------------------------------
  //
  // This was a ~320-line effect — the largest single block in this file. It
  // listens for Firebase's auth state, applies the stored profile across the
  // dozens of pieces of UI state that make it up, provisions the Postgres row on
  // a first-ever sign-in, and attempts one silent re-login for a returning
  // device.
  //
  // It is now `features/authentication/hooks/useAuthProfileSync`. Every value it
  // reads or writes is an explicit parameter, so the coupling it always had is
  // now visible and type-checked instead of hidden in the closure.
  useAuthProfileSync({
    setSavedAccounts,
      appLanguage,
      autoLoginAttemptedRef,
      customAccentColor,
      customChatBg,
      customChatBubbleStyle,
      customChatFont,
      customProfilePhoto,
      friendIds,
      isSubscribed,
      isUserVisibleOnRadar,
      lastCredentialsRef,
      persistProfileToBackend,
      userGroupCallPolicy,
      userGroupInvitePolicy,
      userRadarEmoji,
      userRadarStatusText,
      setActiveNotes,
      setAppLanguage,
      setAudioFeedback,
      setAuthIsSignUp,
      setAuthLoading,
      setContactsList,
      setCurrentUser,
      setCustomAccentColor,
      setCustomChatBg,
      setCustomChatBubbleStyle,
      setCustomChatFont,
      setCustomProfilePhoto,
      setGbAntiDelete,
      setGbBlueTickOnReply,
      setGbFreezeLastSeen,
      setGbHideOnline,
      setIsProfileLoaded,
      setIsSubscribed,
      setIsSyncing,
      setIsUserVisibleOnRadar,
      setMyUploadedStory,
      setOnboardingBio,
      setOnboardingName,
      setOnboardingPhoto,
      setOnboardingStep,
      setOnboardingUsername,
      setRadarVisibilityMode,
      setShowLandingMode,
      setShowOnboarding,
      setUserAgeRange,
      setUserBio,
      setUserCommunities,
      setUserDisplayName,
      setUserFollowers,
      setUserFollowersCount,
      setUserFollowing,
      setUserFollowingCount,
      setUserGender,
      setUserGroupCallPolicy,
      setUserGroupInvitePolicy,
      setUserInterests,
      setUserMeetupCount,
      setUserRadarEmoji,
      setUserRadarStatusText,
      setUserTrustScore,
      setUserUsername,
      setUserWebsite,
  });

  // -----------------------------------------
  usePresenceHeartbeat({
    currentUser,
    selectedNeighborId,
    showOnboarding,
  });

  // -----------------------------------------

  useStoryExpiry({
    currentUser,
    myUploadedStory,
    setAudioFeedback,
    setMyUploadedStory,
  });

  useCallMediaElements({
    callState,
    isSpeakerOn,
    localStream,
    localVideoRef,
    remoteStream,
    remoteVideoRef,
    videoOff,
  });

  // Real-time chat sync via our backend (replaces a Firestore query across
  // ALL messages with `array-contains` on participants). History loads once
  // per conversation over REST; new messages arrive over one shared
  // Socket.IO connection — both participants receive the identical event
  // from the identical source of truth, which is what actually fixes
  // one-sided delivery (no per-client listener race to fall out of sync).
  // `markMessageFailed` is declared further down this file — `useMessages` is
  // called AFTER `useChatSync`, and reordering ~200 hooks to move it up would be
  // a far bigger risk than this one indirection. The socket event that needs it
  // fires long after mount, so the ref is always populated by then.
  const markMessageFailedRef = useRef<((threadId: string, msgId: string) => void) | null>(null);

  const { sendChatMessage: sendChatMessageViaSocket, unreadCounts: chatUnreadCounts, totalUnread: totalUnreadMessages } = useChatSync({
    myUserId: appUser?.id ?? null,
    enabled: Boolean(currentUser) && Boolean(appUser),
    activeNeighborId: selectedNeighborState?.id ?? null,
    // Server refused the message (not a participant, invalid payload, storage
    // failure). Mark the optimistic bubble failed so it shows "Not sent"
    // instead of sitting on a single tick that claims it was delivered.
    onMessageFailed: (neighborId: string, clientId: string) =>
      markMessageFailedRef.current?.(neighborId, clientId),
    onMessagesForThread: (neighborId, serverList) => {
      _setChatMessages(prev => {
        const combined = { ...prev };
        const withReceiver = serverList.map(m => ({ ...m, receiverId: neighborId, chatThreadId: neighborId }));
        const serverIds = new Set(withReceiver.map(m => m.id));
        const serverClientIds = new Set(
          withReceiver.map(m => m.clientId).filter((id): id is string => Boolean(id)),
        );
        // Never drop a local message the server snapshot doesn't know about
        // yet — it may still be mid-flight (or its echo in flight). Matched on
        // server id AND client id, so a re-fetch can't reintroduce a copy of
        // something already reconciled.
        //
        // 'sent' is included: since the bubble is no longer marked 'sent' until
        // transmission succeeds, a 'sent' local that is absent from the server
        // list means the fetch raced the write, not that the server rejected it.
        const pendingLocal = (combined[neighborId] || []).filter(
          m =>
            !serverIds.has(m.id) &&
            !(m.clientId && serverClientIds.has(m.clientId)) &&
            (m.status === 'sending' || m.status === 'sent' || m.status === 'failed'),
        );
        combined[neighborId] = [...withReceiver, ...pendingLocal].sort((a, b) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return ta - tb;
        });
        return combined;
      });
    },
    onIncomingMessage: (neighborId, message) => {
      _setChatMessages(prev => {
        const list = prev[neighborId] || [];
        const settled: DirectMessage = {
          ...message,
          receiverId: neighborId,
          chatThreadId: neighborId,
        };

        // 1. Already holding this exact server message — a re-delivery, or the
        //    same echo arriving twice after a socket reconnect. Nothing to do.
        if (list.some(m => m.id === message.id)) return prev;

        // 2. Is this the echo of a message THIS device sent? The broadcast goes
        //    to the whole room including the sender, so every message we send
        //    comes back to us.
        //
        //    Match on the idempotency key, which we control end to end. This is
        //    the fix for the sender seeing duplicates: the previous logic keyed
        //    off `status === 'sending'`, but the bubble had already been flipped
        //    to 'sent' before transmission, so nothing matched and the message
        //    was appended a second time.
        //
        //    The status heuristic is kept only as a fallback for messages sent
        //    before this key existed (e.g. a queued send across an app update).
        let localIdx = -1;
        if (message.clientId) {
          localIdx = list.findIndex(m => m.clientId === message.clientId);
        } else if (message.senderId === 'user') {
          localIdx = list.findIndex(m => m.status === 'sending');
        }

        if (localIdx > -1) {
          // REPLACE, don't append — and adopt the server's id. Checking the id
          // first (step 1) means a repeated echo stops here naturally, because
          // after this replacement the local row already carries that id.
          const copy = [...list];
          copy[localIdx] = settled;
          return { ...prev, [neighborId]: copy };
        }

        // 3. Genuinely a new message from the other person.
        return { ...prev, [neighborId]: [...list, settled] };
      });
    },
  });



  const {
    notifications,
    unreadNotificationsCount,
    setNotifications,
    setUnreadNotificationsCount,
    handleMarkAllNotificationsRead,
    handleClearAllNotifications,
    handleDeleteNotification,
    handleToggleReadNotification,
  } = useNotifications({
    appUser,
    currentUser,
    triggerBeep,
  });


  // Meetups now come from the backend (polled). Location text and
  // scheduledAt now round-trip through Postgres — before this backend
  // addition, they'd have vanished on reload.
  const { data: myMeetupsData } = useQuery({
    queryKey: ['meetups', 'mine'],
    queryFn: () => meetupsApi.list(),
    enabled: Boolean(currentUser) && Boolean(appUser),
    refetchInterval: 30_000,
  });

  useMeetupsSync({
    myMeetupsData,
    setMeetups,
  });

  // Ratings for whichever profile is currently open (mine, or a real
  // neighbor's) — matches how the UI actually consumes this (PremiumProfileView
  // filters by the viewed profile's id), rather than loading every rating
  // I've ever given or received up front.
  const ratingsProfileId = viewingNeighborProfile
    ? (!viewingNeighborProfile.id.startsWith('nb-') ? viewingNeighborProfile.id : null)
    : (appUser?.id ?? null);
  const { data: profileRatingsData } = useQuery({
    queryKey: ['meetupRatings', ratingsProfileId],
    queryFn: () => meetupsApi.ratingsForUser(ratingsProfileId!),
    enabled: Boolean(ratingsProfileId),
  });

  useMeetupRatingsSync({
    profileRatingsData,
    setMeetupRatings,
  });

  // Friend state now comes from the backend (polled — see useFriendsSync
  // for why this isn't a live socket) instead of a single Firestore
  // `array-contains` listener. incomingRequestsByUserIdRef is kept
  // alongside pendingFriendRequests because accept/decline need the
  // actual friend_request row id, which the old Firestore model never
  // needed (it just mutated the one shared doc directly).
  const {
    friendIds: syncedFriendIds,
    incomingRequestsByUserId,
    sentRequestUserIds,
    refetchAll: refetchFriends,
  } = useFriendsSync(Boolean(currentUser) && Boolean(appUser));

  useEffect(() => {
    setFriendIds(syncedFriendIds);
    setPendingFriendRequests(Object.keys(incomingRequestsByUserId));
    setSentFriendRequestIds(sentRequestUserIds);
  }, [syncedFriendIds, incomingRequestsByUserId, sentRequestUserIds]);

  useProfileBackendPersistence({
    activeNotes,
    appLanguage,
    contactsList,
    customAccentColor,
    customChatBg,
    customChatBubbleStyle,
    customChatFont,
    customProfilePhoto,
    gbAntiDelete,
    gbBlueTickOnReply,
    gbFreezeLastSeen,
    gbHideOnline,
    isProfileLoaded,
    isSubscribed,
    isSyncing,
    isUserVisibleOnRadar,
    persistProfileToBackend,
    userBio,
    userDisplayName,
    userFollowers,
    userFollowersCount,
    userFollowing,
    userFollowingCount,
    userGroupCallPolicy,
    userGroupInvitePolicy,
    userMeetupCount,
    userRadarEmoji,
    userRadarStatusText,
    userTrustScore,
    userUsername,
    userWebsite,
  });

  useServerProfileAdoption({
    appUser,
    customProfilePhoto,
    setCustomProfilePhoto,
    setGpsSynced,
    setSelectedPreset,
    setUserAddress,
    setUserBio,
    setUserCoords,
    setUserDisplayName,
    setUserRadarStatusText,
    userCoords,
  });

  // Load real nearby users from our backend (replaces a Firestore listener
  // that downloaded the ENTIRE users collection to every client and
  // computed distance/visibility rules client-side). The backend now does
  // the spatial filtering (PostGIS ST_DWithin) AND the visibility/ban/
  // relationship rules (RadarService.findNearby) that used to live here.
  const { data: nearbyUsersData } = useNearbyUsersQuery(
    Boolean(currentUser) && Boolean(userCoords),
    radarRadius / 1000,
  );

  const useNeighborPresenceDomain = useNeighborPresence({
    nearbyUsersData,
    neighbors,
    viewingNeighborProfile,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    incomingRequestsByUserIdRef,
    onlineIds,
    realNeighborIds,
    viewingRealProfileId,
  } = useNeighborPresenceDomain;

  useIncomingRequestsRef({
    incomingRequestsByUserId,
    incomingRequestsByUserIdRef,
  });
  useNearbyNeighbors({
    currentUser,
    nearbyUsersData,
    neighborStories,
    radarRadius,
    setNeighbors,
  });

  // -----------------------------------------
  // Presence
  // -----------------------------------------
  // This used to be onSnapshot(collection(db, 'presence')) — a listener on
  // the ENTIRE collection, so every connected client downloaded every
  // user's presence document and re-downloaded it whenever ANY user's
  // status changed. O(n^2) reads, and a direct line to your Firestore bill.
  //
  // It is now owned by the backend: usePresenceSync sends a heartbeat to
  // keep this user's Redis key alive, and the radar response carries
  // `is_online` for every neighbour (one mget per page of results).
  // Real-time typing comes over the chat socket instead of a document write.

  useEffect(() => {
    if (!currentUser) return;
    const pm: Record<string, { online: boolean; status: 'active' | 'away' | 'offline'; typing: string; lastSeen: string; currentConversation: string }> = {};
    for (const id of onlineIds) {
      pm[id] = {
        online: true,
        status: 'active',
        typing: '',
        lastSeen: '',
        currentConversation: '',
      };
    }
    setPresenceMap((prev) => ({ ...pm, ...prev, ...pm }));
  }, [currentUser, onlineIds.join(',')]);

  useTypingIndicatorPublisher({
    currentUser,
    selectedNeighbor,
    selectedNeighborId,
    textInput,
  });

  // Real presence: heartbeat while the app is open, plus batch online/
  // offline status for the real (non-mock, non-group) neighbors currently
  // in view. This is what actually feeds presenceMap now — it existed
  // before but nothing ever called setPresenceMap, so onlineStatus was
  // permanently stuck on whatever default the radar mapping set.
  const { onlineStatusByUserId } = usePresenceSync(
    Boolean(currentUser) && Boolean(appUser),
    realNeighborIds,
  );

  usePresenceMapSync({
    onlineStatusByUserId,
    setPresenceMap,
  });

  useViewedNeighborContent({
    currentUser,
    setNeighborHighlights,
    setNeighborPosts,
    viewingNeighborProfile,
  });

  // Posts/highlights for whichever real (non-mock) neighbor profile is
  // currently open. Polled rather than a live Firestore listener — a
  // profile view isn't something that needs sub-minute freshness.
  const { posts: viewedUserPosts, highlights: viewedUserHighlights } = useUserContent(
    viewingRealProfileId,
    Boolean(currentUser),
  );

  useViewedUserContent({
    setNeighborHighlights,
    setNeighborPosts,
    viewedUserHighlights,
    viewedUserPosts,
    viewingRealProfileId,
  });


  // -----------------------------------------
  // My own content (posts + status/highlights)
  // -----------------------------------------
  // Status/stories now live in the backend `highlights` table. This single
  // hook replaces what used to be a live per-user Firestore subcollection
  // listener plus a lazy delete-on-read expiry sweep.
  const { posts: myBackendPosts, highlights: myBackendHighlights, refetch: refetchMyContent } = useUserContent(
    appUser?.id ?? null,
    Boolean(appUser),
  );
  useMyHighlights({
    appUser,
    myBackendHighlights,
    refetchMyContent,
    refetchMyContentRef,
    setMyStorySnaps,
    setUserHighlights,
  });

  // Group chats previously came from a live listener on the ENTIRE
  // `groups` collection — every client downloaded every group in the app
  // and filtered locally. Chat lists now come from chatApi.listConversations,
  // which returns your direct chats and any group conversations you're in.

  // Group and direct messages both arrive over the same chat socket, keyed
  // by conversation id — the extra Firestore listener for each open group
  // thread is gone.

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const callTimerRef = useRef<any>(null);
  const voiceRecorderTimerRef = useRef<any>(null);

  // -----------------------------------------
  // Premium Instagram & WhatsApp Story Playback Engine
  // -----------------------------------------
  const [storyProgress, setStoryProgress] = useState<number>(0);


  const handleStoryViewerNext = () => {
    triggerBeep(450, 0.05);
    if (playingSnapIndex < playingStorySnaps.length - 1) {
      setPlayingSnapIndex(idx => idx + 1);
      setStoryProgress(0);
    } else {
      setStoryViewer(null);
    }
  };


  // The fake "X neighbours nearby" popup that used to live here has been
  // removed.
  //
  // It ran on a 30-second timer regardless of what the app actually knew, and
  // invented its number — `Math.floor(Math.random() * 12) + 15` when there was
  // nobody around — then announced it with a sound. That is a notification that
  // is guaranteed to be wrong, and on a proximity app it is the single most
  // corrosive thing to get wrong: the whole promise is that the people it shows
  // you are real and nearby.
  //
  // Real proximity notifications come from the notifications service and the
  // chat socket, which are unchanged. If a periodic "people near you" summary is
  // wanted later, it must be driven by the actual count from /radar/nearby.
  //

  // -----------------------------------------
  // Geolocation Walk Distance Scaling & Compass Offsets Mapping
  // -----------------------------------------
  useEffect(() => {
    // Coordinate tracking initialized successfully
  }, [selectedPreset, userCoords]);

  // -----------------------------------------
  // Live GPS tracking, the heartbeat, and the initial acquisition
  const useLocationActionsDomain = useLocationActions({
    lastLocationWriteRef,
    setLocationStatus,
    setUserAddress,
    userAddress,
    setSelectedPreset,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    requestLocation,
    updatePresetWithCoordinates,
  } = useLocationActionsDomain;
  useLocationTracking({
    currentUser,
    latestCoordsRef,
    requestLocation,
    updatePresetWithCoordinates,
    setUserCoords,
    setGpsSynced,
    setLocationStatus,
  });

  useCallSessionTimers({
    callState,
    callTimerRef,
    currentUser,
    endCall,
    setAudioFeedback,
    setCallState,
  });

  // Ringtone synthesizer simulation for calls
  useEffect(() => {
    let interval: any = null;
    if (callState.active && callState.status === 'ringing') {
      interval = setInterval(() => {
        triggerBeep(callState.incoming ? 480 : 350, 0.25);
        if (callState.incoming) {
          setTimeout(() => triggerBeep(520, 0.2), 150);
        }
      }, 1400);
    }
    return () => clearInterval(interval);
  }, [callState.active, callState.status, callState.incoming]);

  // -----------------------------------------
  // Synthesizer Tone Generator (Web Audio API)
  // -----------------------------------------

  // triggerBeep + useCallSignaling moved earlier in the file (right after
  // friendIds is declared) — see there for why.



  // -----------------------------------------
  // Chat actions
  // -----------------------------------------
  //
  // ~445 lines moved into `features/chat/hooks/useChatActions`: sending (with the
  // clientId idempotency key), forwarding, reacting, deleting, the voice-note
  // playback fallback, and the canned demo replies. 18 declared dependencies.
  const useMessagesDomain = useMessages({
    _setChatMessages,
    chatMessages,
    chatMessagesEndRef,
    currentUser,
    neighbors,
    notifications,
    notifiedMessageIdsRef,
    selectedNeighbor,
    selectedNeighborId,
    setAudioFeedback,
    setReplyingToMessage,
    setSwipeOffsetAmount,
    setSwipeOffsetMsgId,
    swipeOffsetAmount,
    swipeOffsetMsgId,
    triggerBeep,
    userDisplayName,
    setChatMessages,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    markMessageFailed,
    markMessagesAsRead,
    saveOrUpdateMessageInFirestore,
    scrollToLastMessage,
  } = useMessagesDomain;

  // Now that it exists, hand it to the chat socket layer (see the ref declared
  // beside useChatSync above).
  useEffect(() => {
    markMessageFailedRef.current = markMessageFailed;
  }, [markMessageFailed]);

  useChatScrollAnchoring({
    chatMessages,
    scrollToLastMessage,
    selectedNeighborId,
    setChatLimit,
  });

  useChatReadReceipts({
    chatMessages,
    currentUser,
    markMessagesAsRead,
    selectedNeighborId,
  });
  const {
    playVoiceNote,
    triggerSimulatedResponse,
    sendMessage,
    handleReaction,
    handleDeleteForMe,
    handleDeleteForEveryone,
    handleForwardMessage,
  } = useChatActions({
    _setChatMessages,
    friendIds,
    markMessageFailed,
    neighbors,
    playSynthesizedVoiceNote,
    playingVoiceId,
    replyingToMessage,
    saveOrUpdateMessageInFirestore,
    selectedNeighbor,
    sendChatMessageViaSocket,
    textInput,
    triggerBeep,
    setAudioFeedback,
    setPlayingVoiceId,
    setReplyingToMessage,
    setShowForwardModal,
    setSimulatedTypingMap,
    setTextInput,
  });

  // -----------------------------------------
  // Camera Simulation & Filters
  // -----------------------------------------
  const startCamera = async () => {
    setCapturedImage(null);
    setCanvasDrawing(null);
    setCameraActive(true);
    triggerBeep(600, 0.12, 'triangle');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setAudioFeedback("Using simulated camera sensor.");
      setTimeout(() => setAudioFeedback(""), 3000);
    }
  };

  const { capturePhoto } = useCapturePhoto({
    activeFilter,
    setCapturedImage,
    triggerBeep,
    videoRef,
  });

  // Close camera block
  const closeCamera = () => {
    setCameraActive(false);
    setCapturedImage(null);
    setCanvasDrawing(null);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const { handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp } = useDoodleCanvas({
    brushColor,
    canvasRef,
    isDrawing,
    setCanvasDrawing,
    setIsDrawing,
  });

  // Upload taken picture to your public story (Snapshot style!)
  const postToMyStory = () => {
    if (!capturedImage) return;
    const finalSrc = canvasDrawing || capturedImage;
    setStoryUploadData({
      mediaUrl: finalSrc,
      type: 'image'
    });
    closeCamera();
  };

  const sendCapturedSnapDirectly = (neighbor: Neighbor) => {
    if (!capturedImage) return;
    const finalSrc = canvasDrawing || capturedImage;
    
    // Add direct message with caption
    const textDesc = photoCaption ? `[Snap]: ${photoCaption}` : "[Sent a Snap 📸]";
    sendMessage(textDesc, finalSrc);
    
    setAudioFeedback(`Snap sent to ${neighbor.name}!`);
    setTimeout(() => setAudioFeedback(""), 3000);
    closeCamera();
  };

  const { startRecordingVoice } = useStartVoiceRecording({
    audioChunksRef,
    mediaRecorderRef,
    setIsRecordingVoice,
    setVoiceDuration,
    triggerBeep,
    voiceRecorderTimerRef,
  });

  const { stopAndSendVoice } = useStopAndSendVoice({
    audioChunksRef,
    mediaRecorderRef,
    sendMessage,
    setIsRecordingVoice,
    setVoiceDuration,
    triggerBeep,
    voiceDuration,
    voiceRecorderTimerRef,
  });

  const { cancelRecordingVoice } = useCancelVoiceRecording({
    mediaRecorderRef,
    setIsRecordingVoice,
    setVoiceDuration,
    setVoiceRecordingLocked,
    triggerBeep,
    voiceRecorderTimerRef,
  });

  // -----------------------------------------
  // Monetization & Subscription Gated Actions
  // -----------------------------------------
  const verifyPremiumSelection = (featureName: string, action: () => void) => {
    action();
  };

  const { handleProcessPayment } = useProcessPayment({
    pendingPremiumAction,
    setAudioFeedback,
    setIsSubscribed,
    setShowPayModal,
    triggerBeep,
  });

  // 1. Group construction logic


  const saveContactsToFirestore = async (updatedContacts: Array<{ name: string; phone: string; nearby: boolean }>) => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await persistProfileToBackend({
        contacts: updatedContacts
      });
    } catch (err) {
      console.error("Failed to save contacts to Firestore:", err);
    }
  };

  const handleSyncContacts = () => {
    triggerBeep(440, 0.1);
    setShowContactsPermissionPrompt(true);
  };




  // -----------------------------------------
  // Custom Notes Gist Status Actions
  // -----------------------------------------

  // -----------------------------------------
  // Distance & Gating Helpers
  // -----------------------------------------
  const formatStreetName = (nb: Neighbor) => {
    return nb.streetName;
  };

  const formatDistanceMeters = (nb: Neighbor) => {
    if (nb.id === 'nb-myai') return '';
    return ` (${nb.distanceMeters}m)`;
  };

  // -----------------------------------------
  // Unified Theme Classes Map & GB Customization Helpers
  // -----------------------------------------
  const getAccentBg = (col: string) => {
    switch(col) {
      case 'emerald': return 'bg-emerald-600 hover:bg-emerald-500';
      case 'blue': return 'bg-blue-600 hover:bg-blue-500';
      case 'rose': return 'bg-rose-600 hover:bg-rose-500';
      case 'amber': return 'bg-amber-500 hover:bg-amber-400';
      case 'purple': return 'bg-purple-600 hover:bg-purple-500';
      default: return 'bg-indigo-600 hover:bg-indigo-500';
    }
  };

  const getAccentText = (col: string) => {
    switch(col) {
      case 'emerald': return 'text-emerald-400';
      case 'blue': return 'text-blue-400';
      case 'rose': return 'text-rose-400';
      case 'amber': return 'text-amber-400';
      case 'purple': return 'text-purple-400';
      default: return 'text-indigo-400';
    }
  };

  const getAccentBorder = (col: string) => {
    switch(col) {
      case 'emerald': return 'border-emerald-600 focus-within:border-emerald-500';
      case 'blue': return 'border-blue-600 focus-within:border-blue-500';
      case 'rose': return 'border-rose-600 focus-within:border-rose-500';
      case 'amber': return 'border-amber-500 focus-within:border-amber-500';
      case 'purple': return 'border-purple-600 focus-within:border-purple-500';
      default: return 'border-indigo-600 focus-within:border-indigo-500';
    }
  };

  // The ~80 Tailwind class strings for light/dark used to be written out inline
  // here. They are constant data, so they now live in `app/theme/getAppTheme`.
  //
  // They are also memoised now, which they were not before: the original was a
  // bare ternary, so every render rebuilt the whole object whether or not the
  // theme had changed. The object identity is unchanged while the theme is, so
  // consumers behave exactly as they did.
  const theme = useMemo(() => getAppTheme(appTheme as 'light' | 'dark'), [appTheme]);

  // Filter neighbors based on selected meter distance radar cutoff
  const filteredNeighbors = useMemo(() => {
    return syncedNeighbors.filter(nb => {
      // A conversation you already have should never disappear just because the other
      // person's live GPS distance currently reads outside your radar radius (they closed
      // the app, walked off, or their location simply hasn't refreshed). Without the
      // "already have messages" clause below, this filter was silently hiding entire chat
      // threads from the Chats tab - the messages were still safely in Firestore, they
      // just never rendered, which looked exactly like "replies aren't coming through".
      const hasExistingChat = (chatMessages[nb.id]?.length ?? 0) > 0;
      // `distanceMeters` is optional now (we only know it when both sides have fresh
      // GPS). `undefined <= radarRadius` is false, which would have silently hidden
      // every friend we can't currently range-find. Treat unknown distance as "keep".
      const isWithinRadius = nb.id === 'nb-myai'
        || nb.distanceMeters === undefined
        || nb.distanceMeters <= radarRadius
        || hasExistingChat;
      const matchesSearch = nb.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            nb.username.toLowerCase().includes(searchQuery.toLowerCase());
      return isWithinRadius && matchesSearch;
    });
  }, [syncedNeighbors, radarRadius, searchQuery, chatMessages]);

  // Memoize sorted & filtered chat lists to prevent expensive computations on every render frame


  const useMediaUploadsDomain = useMediaUploads({
    currentUser,
    sendMessage,
    customProfilePhoto,
    refetchMyContentRef,
    setAudioFeedback,
    setCustomProfilePhoto,
    setIsPublishingStory,
    setOnboardingPhoto,
    setStoryCompositionCaption,
    setStoryCompositionCustomList,
    setStoryCompositionPrivacy,
    setStoryUploadData,
    setUserHighlights,
    setUserPosts,
    storyCompositionCaption,
    storyCompositionCustomList,
    storyCompositionPrivacy,
    storyUploadData,
    triggerBeep,
    uploadModeRef,
    userDisplayName,
    userUsername,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
  } = useMediaUploadsDomain;
  const useSocialActionsDomain = useSocialActions({
    currentUser,
    friendIds,
    incomingRequestsByUserIdRef,
    neighbors,
    newGroupColor,
    newGroupDesc,
    newGroupEmoji,
    newGroupName,
    pendingFriendRequests,
    sendChatMessageViaSocket,
    sentFriendRequestIds,
    setAudioFeedback,
    setChatMessages,
    setFriendsAddedTodayCount,
    setNeighbors,
    setNewGroupDesc,
    setNewGroupMembers,
    setNewGroupName,
    setShowCreateGroupModal,
    setViewingNeighborProfile,
    triggerBeep,
    userDisplayName,
    viewingNeighborProfile,
    newGroupMembers,
    refetchFriends,
    appUser,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
  } = useSocialActionsDomain;
  const useChatManagementDomain = useChatManagement({
    friendIds,
    saveOrUpdateMessageInFirestore,
    selectedMessageIds,
    selectedNeighbor,
    setActiveTab,
    setArchivedNeighborIds,
    setAudioFeedback,
    setBlockedNeighborIds,
    setEditingMessage,
    setIsMessageSelectMode,
    setMutedNeighborIds,
    setNeighbors,
    setSelectedMessageIds,
    setSelectedNeighbor,
    setUnreadNeighborIds,
    triggerBeep,
    _setChatMessages,
    chatMessages,
    currentUser,
    neighbors,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
  } = useChatManagementDomain;
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.

  // Chat-list ordering reads the radar-filtered neighbour list, which is only
  // known this late in the file. `useMessages` cannot be — the send path
  // consumes it — so the two were split.
  const useChatListDomain = useChatList({
    archivedNeighborIds,
    chatFilter,
    chatMessages,
    filteredNeighbors,
    notifications,
    searchWideSop,
    showArchivedOnly,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
  } = useChatListDomain;
  const useStoriesDomain = useStories({
    activeNotes,
    currentUser,
    neighbors,
    playingSnapIndex,
    setActiveNotes,
    setAudioFeedback,
    setMutedStoryUserIds,
    setPlayingSnapIndex,
    setShowNoteModal,
    setStoryPlaylist,
    setStoryPlaylistIndex,
    setStoryProgress,
    setStoryViewer,
    setUserNoteText,
    userDisplayName,
    userNoteText,
    userUsername,
    myUploadedStory,
    triggerBeep,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    markStoryAsViewedInFirestore,
  } = useStoriesDomain;

  useStoryAutoAdvance({
    isStoryPaused,
    markStoryAsViewedInFirestore,
    playingSnapIndex,
    playingStorySnaps,
    setPlayingSnapIndex,
    setStoryProgress,
    setStoryViewer,
    storyViewer,
  });

  useStoryViewerPlayback({
    myStorySnaps,
    neighborStories,
    setPlayingSnapIndex,
    setPlayingStorySnaps,
    setStoryProgress,
    storyViewer,
  });
  const useContactsSyncDomain = useContactsSync({
    saveContactsToFirestore,
    setAudioFeedback,
    setContactsList,
    setIsRequestingContacts,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
  } = useContactsSyncDomain;

  const useAuthActionsDomain = useAuthActions({
    _setChatMessages,
    activeNotes,
    appLanguage,
    currentUser,
    customAccentColor,
    customChatBg,
    customChatBubbleStyle,
    customChatFont,
    customProfilePhoto,
    isSubscribed,
    isUserVisibleOnRadar,
    lastCredentialsRef,
    onboardingAgeRange,
    onboardingBio,
    onboardingCommunities,
    onboardingCoords,
    onboardingGender,
    onboardingInterests,
    onboardingName,
    onboardingPhoto,
    onboardingState,
    onboardingStreetName,
    onboardingUsername,
    persistProfileToBackend,
    setActiveNotes,
    setAppLanguage,
    setAudioFeedback,
    setAuthError,
    setAuthLoading,
    setCurrentUser,
    setCustomAccentColor,
    setCustomChatBg,
    setCustomChatBubbleStyle,
    setCustomChatFont,
    setCustomProfilePhoto,
    setFriendIds,
    setIsProfileLoaded,
    setIsSubscribed,
    setIsSyncing,
    setMyUploadedStory,
    setOnboardingBio,
    setOnboardingName,
    setOnboardingPhoto,
    setOnboardingStep,
    setOnboardingUsername,
    setSavedAccounts,
    setShowLandingMode,
    setShowOnboarding,
    setUserAgeRange,
    setUserBio,
    setUserCommunities,
    setUserDisplayName,
    setUserFollowers,
    setUserFollowersCount,
    setUserFollowing,
    setUserFollowingCount,
    setUserGender,
    setUserGroupCallPolicy,
    setUserGroupInvitePolicy,
    setUserInterests,
    setUserMeetupCount,
    setUserTrustScore,
    setUserUsername,
    setUserWebsite,
    triggerBeep,
    userFollowers,
    userFollowersCount,
    userFollowing,
    userFollowingCount,
    userGroupCallPolicy,
    userGroupInvitePolicy,
    userMeetupCount,
    userRadarEmoji,
    userRadarStatusText,
    userTrustScore,
  });
  // Destructured for use below; the object itself is spread into the
  // return so its keys do not have to be listed individually.
  const {
    saveOnboardingDetails,
  } = useAuthActionsDomain;

  return {
    ...useStoryStateDomain,
    ...useCameraStateDomain,
    ...useChatRoomStateDomain,
    ...useOnboardingStateDomain,
    ...useProfileStateDomain,
    ...useUiFlagsDomain,
    ...useContactsSyncDomain,
    ...useLocationActionsDomain,
    ...useStoriesDomain,
    ...useNeighborPresenceDomain,
    archivedNeighborIds,
    chatFilter,
    chatMessages,
    filteredNeighbors,
    notifications,
    searchWideSop,
    ...useChatListDomain,
    setChatMessages,
    ...useMessagesDomain,
    ...useAuthActionsDomain,
    ...useChatManagementDomain,
    ...useSocialActionsDomain,
    ...useMediaUploadsDomain,
    hasSavedAccountOnDisk,
    chatUnreadCounts,
    totalUnreadMessages,
    activeTab,
    setActiveTab,
    selectedPreset,
    theme,
    // Location surface. `locationStatus` is authoritative about whether we
    // actually know where the user is — render "Location not set" rather than a
    // preset name when it is not 'ready'.
    locationStatus,
    locationNeedsUserAction,
    locationFailureMessage,
    setSelectedPreset,
    lastLocationWriteRef,
    updateRadarPresenceInFirestore,
    neighbors,
    setNeighbors,
    selectedNeighborState,
    setSelectedNeighbor,
    presenceMap,
    setPresenceMap,
    syncedNeighbors,
    selectedNeighbor,
    chatLimit,
    setChatLimit,
    activeNotes,
    setActiveNotes,
    setSearchWideSop,
    chatSubTab,
    setChatSubTab,
    setChatFilter,
    pendingFriendRequests,
    setPendingFriendRequests,
    sentFriendRequestIds,
    setSentFriendRequestIds,
    showPremiumModal,
    setShowPremiumModal,
    exploreSubTab,
    setExploreSubTab,
    isCurrentMeBanned,
    setIsCurrentMeBanned,
    setNotifications,
    unreadNotificationsCount,
    setUnreadNotificationsCount,
    storyFileRef,
    chatFileRef,
    profileFileRef,
    postFileRef,
    autoLoginAttemptedRef,
    chatSearchInputRef,
    latestCoordsRef,
    initialProfile,
    appLanguage,
    setAppLanguage,
    contactsList,
    setContactsList,
    isRequestingContacts,
    setIsRequestingContacts,
    viewingNeighborProfile,
    setViewingNeighborProfile,
    viewingUserPostDetail,
    setViewingUserPostDetail,
    neighborPosts,
    setNeighborPosts,
    neighborHighlights,
    setNeighborHighlights,
    meetups,
    setMeetups,
    meetupRatings,
    setMeetupRatings,
    scheduleMeetupTargetNeighbor,
    setScheduleMeetupTargetNeighbor,
    scheduleMeetupPoint,
    setScheduleMeetupPoint,
    scheduleMeetupTime,
    setScheduleMeetupTime,
    scheduleMeetupLat,
    setScheduleMeetupLat,
    scheduleMeetupLng,
    setScheduleMeetupLng,
    ratingReviewText,
    setRatingReviewText,
    activeRatingStars,
    setActiveRatingStars,
    ratingFormMeetupId,
    setRatingFormMeetupId,
    gbFreezeLastSeen,
    setGbFreezeLastSeen,
    gbAntiDelete,
    setGbAntiDelete,
    gbHideOnline,
    setGbHideOnline,
    gbBlueTickOnReply,
    setGbBlueTickOnReply,
    settingsSubView,
    setSettingsSubView,
    notifMessages,
    setNotifMessages,
    notifFriendRequests,
    setNotifFriendRequests,
    notifMeetups,
    setNotifMeetups,
    notifRatings,
    setNotifRatings,
    notifNearbyUsers,
    setNotifNearbyUsers,
    notifEvents,
    setNotifEvents,
    appearanceMode,
    setAppearanceMode,
    confirmDeleteAccount,
    setConfirmDeleteAccount,
    _setChatMessages,
    currentUser,
    setCurrentUser,
    authLoading,
    setAuthLoading,
    isSplashActive,
    setIsSplashActive,
    welcomeTourStep,
    setWelcomeTourStep,
    authScreenState,
    setAuthScreenState,
    authSuccess,
    setAuthSuccess,
    // The three typed form fields are deliberately absent: they are owned by
    // `useAuthFormState` inside AuthGate so that typing cannot re-render this
    // controller. Pass them to `loginWithEmailOrPhone` at call time.
    authIsSignUp,
    setAuthIsSignUp,
    isPhoneAuthOption,
    setIsPhoneAuthOption,
    authError,
    setAuthError,
    isSyncing,
    setIsSyncing,
    textInput,
    setTextInput,
    isAiTyping,
    setIsAiTyping,
    searchQuery,
    setSearchQuery,
    usingGoogleMaps,
    setUsingGoogleMaps,
    hasValidGoogleMapsKey,
    radarRadius,
    setRadarRadius,
    showRadarDrawer,
    setShowRadarDrawer,
    isSubscribed,
    setIsSubscribed,
    showPayModal,
    setShowPayModal,
    premiumUpgradeFeature,
    setPremiumUpgradeFeature,
    pendingPremiumAction,
    setPendingPremiumAction,
    friendsAddedTodayCount,
    setFriendsAddedTodayCount,
    uploadMode,
    setUploadModeState,
    uploadModeRef,
    setUploadMode,
    friendIds,
    setFriendIds,
    isUserVisibleOnRadar,
    setIsUserVisibleOnRadar,
    radarVisibilityMode,
    setRadarVisibilityMode,
    newGroupName,
    setNewGroupName,
    newGroupDesc,
    setNewGroupDesc,
    newGroupMembers,
    setNewGroupMembers,
    newGroupEmoji,
    setNewGroupEmoji,
    newGroupColor,
    setNewGroupColor,
    pendingIncomingInviteGroup,
    setPendingIncomingInviteGroup,
    pendingIncomingCall,
    setPendingIncomingCall,
    appTheme,
    setAppTheme,
    gpsSynced,
    setGpsSynced,
    searchStateQuery,
    setSearchStateQuery,
    callState,
    setCallState,
    micMuted,
    setMicMuted,
    videoOff,
    setVideoOff,
    isSpeakerOn,
    setIsSpeakerOn,
    beautyMode,
    setBeautyMode,
    bluetoothOn,
    setBluetoothOn,
    cameraFacingMode,
    setCameraFacingMode,
    networkQuality,
    networkQualityDesc,
    iceConnectionState,
    localStream,
    remoteStream,
    pcRef,
    localStreamRef,
    remoteStreamRef,
    localVideoRef,
    remoteVideoRef,
    mediaRecorderRef,
    audioChunksRef,
    savedAccounts,
    setSavedAccounts,
    chatMessagesEndRef,
    myUploadedStory,
    setMyUploadedStory,
    audioFeedback,
    setAudioFeedback,
    firestoreQuotaExceeded,
    setFirestoreQuotaExceeded,
    googleBillingError,
    setGoogleBillingError,
    dismissedIframeWarning,
    setDismissedIframeWarning,
    setArchivedNeighborIds,
    swipeOffsetMsgId,
    setSwipeOffsetMsgId,
    swipeOffsetAmount,
    setSwipeOffsetAmount,
    touchStartX,
    setTouchStartX,
    touchStartY,
    setTouchStartY,
    handleMessageTouchStart,
    handleMessageTouchMove,
    activeBubbleDropdownId,
    setActiveBubbleDropdownId,
    isOnline,
    setIsOnline,
    isRecordingVoice,
    setIsRecordingVoice,
    voiceDuration,
    setVoiceDuration,
    playingVoiceId,
    setPlayingVoiceId,
    voiceRecordingLocked,
    setVoiceRecordingLocked,
    handleSendResetLink,
    handleMarkAllNotificationsRead,
    handleClearAllNotifications,
    handleDeleteNotification,
    handleToggleReadNotification,
    videoRef,
    canvasRef,
    callTimerRef,
    voiceRecorderTimerRef,
    storyProgress,
    setStoryProgress,
    handleStoryViewerNext,
    playNotificationSound,
    triggerBeep,
    playSynthesizedVoiceNote,
    playVoiceNote,
    startCall,
    receiveCallSimulation,
    answerIncomingCall,
    endCall,
    switchCamera,
    toggleMicMute,
    toggleVideoOff,
    triggerSimulatedResponse,
    sendMessage,
    handleReaction,
    handleDeleteForMe,
    handleDeleteForEveryone,
    handleForwardMessage,
    startCamera,
    capturePhoto,
    closeCamera,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    postToMyStory,
    sendCapturedSnapDirectly,
    startRecordingVoice,
    stopAndSendVoice,
    cancelRecordingVoice,
    verifyPremiumSelection,
    handleProcessPayment,
    saveContactsToFirestore,
    handleSyncContacts,
    formatStreetName,
    formatDistanceMeters,
    getAccentBg,
    getAccentText,
    getAccentBorder,
  };
}

export type NearbyRuntime = ReturnType<typeof useNearbyController>;
