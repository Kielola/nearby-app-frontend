import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
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
import { useCallSignaling } from '../../features/calls/hooks/useCallSignaling';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePresenceSync } from '../../features/presence/hooks/usePresenceSync';
import { friendsApi } from '../../lib/api';
import { postsApi, highlightsApi } from '../../lib/api';
import { NEIGHBORHOODS, NIGERIAN_STATES, INITIAL_NEIGHBORS, INITIAL_MESSAGES, LocationPreset, INITIAL_NOTES, UserNote } from '../../mockData';
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

  // -----------------------------------------
  // Core Navigation & Application States
  // -----------------------------------------
  const [activeTab, setActiveTab] = useState<'radar' | 'chat' | 'status' | 'menu' | 'explore'>('chat'); // Resetting tabs to Radar, Chat, Status, Menu
  const [selectedPreset, setSelectedPreset] = useState<LocationPreset>(() => {
    try {
      const saved = localStorage.getItem('nearby_selected_preset');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return NEIGHBORHOODS[0]; // Yaba fallback
  });

  const lastLocationWriteRef = useRef<{ lat: number; lng: number; time: number }>({ lat: 0, lng: 0, time: 0 });
  const lastLiveLocationWriteTimeRef = useRef<number>(0);

  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  };

  /**
   * Maps the app's internal profile shape onto the backend's PATCH /me
   * contract and sends only the fields the API actually supports.
   *
   * Previously each of these call sites did `setDoc(doc(db,'users',uid),
   * {...})` with a large payload mixing UI-only preferences (theme,
   * appLanguage, isSubscribed) with real profile fields, and one of them
   * even wrote a whole `friendIds` array — which silently reverted
   * friendships made on another device. Unknown keys are dropped here on
   * purpose: the server owns what it owns.
   */
  const persistProfileToBackend = async (patch: Record<string, unknown>) => {
    const payload: { displayName?: string; bio?: string; avatarUrl?: string; streetName?: string; customStatus?: string } = {};
    if (typeof patch.name === 'string' && patch.name.trim()) payload.displayName = patch.name;
    if (typeof patch.bio === 'string') payload.bio = patch.bio;
    if (typeof patch.customProfilePhoto === 'string') payload.avatarUrl = patch.customProfilePhoto;
    if (typeof patch.streetName === 'string') payload.streetName = patch.streetName;
    if (typeof patch.customStatus === 'string') payload.customStatus = patch.customStatus;
    if (Object.keys(payload).length === 0) return;
    await usersApi.updateMe(payload);
  };

  // refetchMyContent() comes from useUserContent far below, but story
  // upload happens near the top of this hook — a ref bridges the two
  // without reordering a 6,000-line component.
  const refetchMyContentRef = useRef<() => void>(() => {});

  const updatePresetWithCoordinates = async (
    lat: number,
    lng: number,
    force = false,
    extraCoords?: { accuracy?: number | null; heading?: number | null; speed?: number | null },
  ) => {
    const accuracy = extraCoords?.accuracy ?? null;

    // Reject fixes we can't trust before they reach the geocoder. A
    // cold-start reading in the 500m-3km range is normal here and will
    // happily resolve to a street the user has never been on.
    if (!locationService.isUsableFix(lat, lng, accuracy)) {
      console.warn('[location] discarding unusable GPS fix', { lat, lng, accuracy });
      return null;
    }

    try {
      const now = Date.now();
      const lastWrite = lastLocationWriteRef.current;
      const distanceMoved =
        lastWrite.time === 0
          ? 0
          : calculateHaversineDistance(lat, lng, lastWrite.lat, lastWrite.lng);
      const timePassed = now - lastWrite.time;

      // Coordinates go to the backend promptly — radar depends on them and
      // they must never be blocked behind address resolution.
      const shouldWriteToNetwork =
        force || lastWrite.time === 0 || distanceMoved >= 15 || timePassed >= 60000;

      if (shouldWriteToNetwork) {
        lastWrite && (lastLocationWriteRef.current = { lat, lng, time: now });
        try {
          await radarApi.updateLocation(lat, lng);
        } catch (e) {
          console.warn('Could not sync coordinates to backend:', e);
        }
      }

      // Fast path: if we already have a label and nothing meaningful has
      // changed, don't re-resolve. reverseGeocode caches internally too,
      // this just avoids the call entirely on every GPS tick.
      if (!shouldWriteToNetwork && userAddress) {
        return null;
      }

      const resolved =
        (await reverseGeocode(lat, lng, accuracy)) ??
        fallbackLabelFor(lat, lng, accuracy);

      setUserAddress(resolved.label);

      const newPreset: LocationPreset = {
        name: resolved.label,
        city: resolved.state ?? resolved.town ?? '',
        coords: { lat, lng },
        streets: resolved.road ? [resolved.road] : [],
      };
      setSelectedPreset(newPreset);

      try {
        localStorage.setItem('nearby_last_user_coords', JSON.stringify({ lat, lng }));
        localStorage.setItem('nearby_user_address', resolved.label);
        localStorage.setItem('nearby_selected_preset', JSON.stringify(newPreset));
      } catch (_) {}

      // Only publish a street label we actually stand behind. This value
      // is shown to OTHER users on their radar, so a guess here becomes
      // someone else's misinformation. If the fix was too coarse we send
      // coordinates-accuracy only and leave the stored label untouched.
      if (shouldWriteToNetwork && resolved.precision === 'street' && resolved.road) {
        try {
          await usersApi.updateMe({
            streetName: resolved.label,
            locationAccuracy: accuracy,
          });
        } catch (e) {
          console.warn('Could not sync address label to backend:', e);
        }
      }

      return newPreset;
    } catch (err) {
      console.warn('Location update failed:', err);
      return null;
    }
  };

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

  const [onboardingCoords, setOnboardingCoords] = useState<{ lat: number; lng: number } | null>({ lat: 7.7715, lng: 4.5630 });
  const [onboardingAddress, setOnboardingAddress] = useState<string>('Oketunji Street, Osogbo, Osun State');
  const [onboardingState, setOnboardingState] = useState<string>('Osun');
  const [onboardingStreetName, setOnboardingStreetName] = useState<string>('Oketunji Street');

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
  const [showFriendsModal, setShowFriendsModal] = useState<boolean>(false);
  const [showNeighborFriendsModal, setShowNeighborFriendsModal] = useState<string | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [exploreSubTab, setExploreSubTab] = useState<'feed' | 'communities' | 'radar' | 'crossed' | 'safety'>('radar');
  const [isCurrentMeBanned, setIsCurrentMeBanned] = useState<boolean>(false);
  const [showLandingMode, setShowLandingMode] = useState<boolean>(!hasSavedAccountOnDisk);
  const [myVerificationLevel, setMyVerificationLevel] = useState<'Basic' | 'Verified'>('Basic');
  const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);
  const [isScanningFace, setIsScanningFace] = useState<boolean>(false);
  const [scanCountdown, setScanCountdown] = useState<number>(3);
  const [showContactsModal, setShowContactsModal] = useState<boolean>(false);
  const [showContactsPermissionPrompt, setShowContactsPermissionPrompt] = useState<boolean>(false);
  const [newContactName, setNewContactName] = useState<string>("");
  const [newContactPhone, setNewContactPhone] = useState<string>("");
  const [showAddContactForm, setShowAddContactForm] = useState<boolean>(false);
  const [topNotification, setTopNotification] = useState<{ message: string; icon?: string } | null>(null);
  const [chatNotification, setChatNotification] = useState<{ message: string; subtext?: string } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // File input references for gallery uploads
  const storyFileRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);
  const postFileRef = useRef<HTMLInputElement>(null);
  const autoLoginAttemptedRef = useRef<boolean>(false);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const latestCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [showNewChatDrawer, setShowNewChatDrawer] = useState<boolean>(false);

  // Profile & Settings states
  const initialProfile = (() => {
    try {
      const lastUid = localStorage.getItem('nearby_current_uid');
      if (lastUid) {
        const cachedRaw = localStorage.getItem(`nearby_cached_profile_${lastUid}`);
        if (cachedRaw) {
          return JSON.parse(cachedRaw);
        }
      }
    } catch (_) {}
    return null;
  })();

  const [showInstagramProfile, setShowInstagramProfile] = useState<boolean>(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(initialProfile !== null);
  const [userDisplayName, setUserDisplayName] = useState<string>(initialProfile?.name || "Nearby Member");
  const [userUsername, setUserUsername] = useState<string>(initialProfile?.username || "nearby_member");
  const [userBio, setUserBio] = useState<string>(initialProfile?.bio || "Connecting with neighbors face-to-face 👋");
  const [userWebsite, setUserWebsite] = useState<string>(initialProfile?.website || "foslibrary.com.ng");
  const [userAgeRange, setUserAgeRange] = useState<string>(initialProfile?.ageRange || "25-34");
  const [userGender, setUserGender] = useState<string>(initialProfile?.gender || "Male");
  const [userInterests, setUserInterests] = useState<string[]>(initialProfile?.interests || ["Tech", "Music"]);
  const [userCommunities, setUserCommunities] = useState<string[]>(initialProfile?.communities || ["comm-1"]);

  // Multi-language state helper
  const [appLanguage, setAppLanguage] = useState<'english' | 'hausa' | 'igbo' | 'yoruba' | 'pidgin'>('english');
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);

  // Invite & Support modal overlays states
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [contactsList, setContactsList] = useState<Array<{ name: string; phone: string; nearby: boolean }>>([]);
  const [isRequestingContacts, setIsRequestingContacts] = useState<boolean>(false);
  const [showNearbyNotification, setShowNearbyNotification] = useState<boolean>(false);
  const [nearbyNotificationCount, setNearbyNotificationCount] = useState<number>(23);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [helpEmail, setHelpEmail] = useState<string>("");
  const [helpCategory, setHelpCategory] = useState<string>("General Support");
  const [helpMessage, setHelpMessage] = useState<string>("");

  // Account customization modals states
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [showChatsConfigModal, setShowChatsConfigModal] = useState<boolean>(false);
  const [userTelephone, setUserTelephone] = useState<string>("+234 812 345 6789");
  const [privacyDisappearing, setPrivacyDisappearing] = useState<string>("Off");

  // Neighbor Profile view overlay
  const [viewingNeighborProfile, setViewingNeighborProfile] = useState<Neighbor | null>(null);

  // Edit profile modal trigger
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [customProfilePhoto, setCustomProfilePhoto] = useState<string | null>(initialProfile?.customProfilePhoto || null);
  const [viewingUserPostDetail, setViewingUserPostDetail] = useState<{ id: string; mediaUrl: string; caption?: string; timestamp: string; type: 'image' | 'video' } | null>(null);
  const [neighborPosts, setNeighborPosts] = useState<any[]>([]);
  const [neighborHighlights, setNeighborHighlights] = useState<any[]>([]);
  const [userStatusText, setUserStatusText] = useState<string>('Online but not online 😮‍💨');
  const [userPosts, setUserPosts] = useState<{ id: string; mediaUrl: string; caption?: string; timestamp: string; type: 'image' | 'video' }[]>(() => {
    try {
      const cached = localStorage.getItem('nearby_cached_posts');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const [userHighlights, setUserHighlights] = useState<{ id: string; name: string; mediaUrl: string }[]>(() => {
    try {
      const cached = localStorage.getItem('nearby_cached_highlights');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  // Persistent user stats for followers, following, trust rating, and meetup count
  const [userFollowers, setUserFollowers] = useState<string[]>([]);
  const [userFollowing, setUserFollowing] = useState<string[]>([]);
  const [userFollowersCount, setUserFollowersCount] = useState<number>(0);
  const [userFollowingCount, setUserFollowingCount] = useState<number>(0);
  const [userTrustScore, setUserTrustScore] = useState<number>(5.0);
  const [userMeetupCount, setUserMeetupCount] = useState<number>(0);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [meetupRatings, setMeetupRatings] = useState<MeetupRating[]>([]);

  // Schedule Meetup Modal States
  const [showScheduleMeetupModal, setShowScheduleMeetupModal] = useState<boolean>(false);
  const [scheduleMeetupTargetNeighbor, setScheduleMeetupTargetNeighbor] = useState<Neighbor | null>(null);
  const [scheduleMeetupPoint, setScheduleMeetupPoint] = useState<string>("");
  const [scheduleMeetupTime, setScheduleMeetupTime] = useState<string>("");
  const [scheduleMeetupLat, setScheduleMeetupLat] = useState<number>(0);
  const [scheduleMeetupLng, setScheduleMeetupLng] = useState<number>(0);

  // Inline Rating States
  const [ratingReviewText, setRatingReviewText] = useState<string>("");
  const [activeRatingStars, setActiveRatingStars] = useState<number>(5);
  const [showInlineRatingForm, setShowInlineRatingForm] = useState<boolean>(false);
  const [ratingFormMeetupId, setRatingFormMeetupId] = useState<string | null>(null);

  // GB WhatsApp Premium toggles that are unlocked!
  const [gbFreezeLastSeen, setGbFreezeLastSeen] = useState<boolean>(false);
  const [gbAntiDelete, setGbAntiDelete] = useState<boolean>(true);
  const [gbHideOnline, setGbHideOnline] = useState<boolean>(false);
  const [gbBlueTickOnReply, setGbBlueTickOnReply] = useState<boolean>(false);

  // Apple-Level Settings subviews
  const [settingsSubView, setSettingsSubView] = useState<'main' | 'privacy' | 'notifications' | 'radar' | 'meetups' | 'chats' | 'appearance' | 'about'>('main');
  const [privacyLocationVisibility, setPrivacyLocationVisibility] = useState<boolean>(true);
  const [privacyReadReceipts, setPrivacyReadReceipts] = useState<boolean>(true);
  const [privacyTrustedOnly, setPrivacyTrustedOnly] = useState<boolean>(false);

  const [notifMessages, setNotifMessages] = useState<boolean>(true);
  const [notifFriendRequests, setNotifFriendRequests] = useState<boolean>(true);
  const [notifMeetups, setNotifMeetups] = useState<boolean>(true);
  const [notifRatings, setNotifRatings] = useState<boolean>(true);
  const [notifNearbyUsers, setNotifNearbyUsers] = useState<boolean>(true);
  const [notifEvents, setNotifEvents] = useState<boolean>(true);

  const [appearanceMode, setAppearanceMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('appearanceMode') as 'light' | 'dark' | 'system') || 'dark';
  });

  const [aboutDetailModal, setAboutDetailModal] = useState<'privacy' | 'terms' | 'guidelines' | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<boolean>(false);

  // Dynamic gallery handling functions
  const handleGalleryUploadForStory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setStoryUploadData({
        mediaUrl: dataUrl,
        type: file.type.startsWith('video') ? 'video' : 'image'
      });
      triggerBeep(520, 0.1);
    };
    reader.readAsDataURL(file);
  };

  const handlePublishStoryComposition = async () => {
    if (!currentUser || !storyUploadData) return;
    setIsPublishingStory(true);
    triggerBeep(440, 0.15);
    try {
      const snapId = `story-sn-${Date.now()}`;
      
      let finalMediaUrl = storyUploadData.mediaUrl;
      if (finalMediaUrl && finalMediaUrl.startsWith('data:')) {
        try {
          const fileExtension = finalMediaUrl.includes('image/png') ? 'png' : finalMediaUrl.includes('image/gif') ? 'gif' : finalMediaUrl.includes('video/mp4') ? 'mp4' : 'jpeg';
          const storagePath = `stories/${currentUser.uid}/${Date.now()}.${fileExtension}`;
          finalMediaUrl = await uploadToStorage(finalMediaUrl, storagePath);
        } catch (uploadErr) {
          console.warn("Storage upload failed for story status, using original:", uploadErr);
        }
      }

      const newSnap = {
        id: snapId,
        userId: currentUser.uid,
        username: userUsername || 'anonymous',
        name: userDisplayName || 'Anonymous',
        mediaUrl: finalMediaUrl,
        type: storyUploadData.type,
        caption: storyCompositionCaption,
        timestamp: 'Just now',
        viewed: false,
        createdAt: Date.now(),
        viewers: [],
        reactions: [],
        replies: [],
        privacy: storyCompositionPrivacy,
        customList: storyCompositionPrivacy === 'custom' ? storyCompositionCustomList : []
      };

      // Was setDoc(doc(db,'users',uid,'stories',snapId)). Status/stories now
      // live in the Postgres `highlights` table behind the authenticated
      // API, so the client no longer needs write access to Firestore.
      await highlightsApi.create({
        mediaUrl: finalMediaUrl,
        mediaType: storyUploadData.type === 'video' ? 'video' : 'image',
        caption: storyCompositionCaption || undefined,
      });
      refetchMyContentRef.current?.();

      setAudioFeedback("Your status is now live!");
      setTimeout(() => setAudioFeedback(""), 3000);
      
      setStoryUploadData(null);
      setStoryCompositionCaption('');
      setStoryCompositionPrivacy('everyone');
      setStoryCompositionCustomList([]);
    } catch (err) {
      console.error("Story composition failed:", err);
      setAudioFeedback("We couldn't share your story right now. Let's try again.");
      setTimeout(() => setAudioFeedback(""), 3000);
    } finally {
      setIsPublishingStory(false);
    }
  };

  const handleGalleryUploadForChat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      let type: 'image' | 'video' | 'document' = 'image';
      if (file.type.startsWith('image/')) {
        type = 'image';
      } else if (file.type.startsWith('video/')) {
        type = 'video';
      } else {
        type = 'document';
      }
      
      const sizeLabel = file.size > 1024 * 1024 
        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' 
        : (file.size / 1024).toFixed(0) + ' KB';

      sendMessage(undefined, dataUrl, undefined, type, file.name, sizeLabel);
    };
    reader.readAsDataURL(file);
  };

  const handleGalleryUploadForProfilePic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setCustomProfilePhoto(dataUrl);
      setOnboardingPhoto(dataUrl);
      setAudioFeedback("Profile photo registered!");
      setTimeout(() => setAudioFeedback(""), 2000);

      const fUser = auth.currentUser;
      if (fUser) {
        let finalUrl = dataUrl;
        try {
          finalUrl = await mediaApi.uploadFile(file, `nearby/profiles`);
          setCustomProfilePhoto(finalUrl);
          setOnboardingPhoto(finalUrl);
        } catch (err) {
          console.warn("Failed to upload profile photo to Cloudinary, keeping local/dataUrl:", err);
        }

        if (finalUrl.startsWith('data:')) {
          console.error(`Profile photo still base64 after upload attempt - Cloudinary upload likely failed.`);
          setAudioFeedback("⚠️ Photo upload failed - it won't persist. Check your connection.");
          setTimeout(() => setAudioFeedback(""), 4000);
          return;
        }

        try {
          await mediaApi.setProfilePicture(finalUrl);

          const cacheKey = `nearby_cached_profile_${fUser.uid}`;
          const existing = localStorage.getItem(cacheKey);
          if (existing) {
            try {
              const parsed = JSON.parse(existing);
              localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, customProfilePhoto: finalUrl }));
            } catch (_) {}
          }
        } catch (dbErr) {
          console.error("Failed to update profile photo on backend:", dbErr);
          setAudioFeedback("⚠️ Photo failed to save to the cloud - it will disappear on next login.");
          setTimeout(() => setAudioFeedback(""), 4000);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGalleryUploadForPost = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const currentMode = uploadModeRef.current;

    // Reset input so re-selecting the same file fires onChange again
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const fUser = auth.currentUser;

      if (currentMode === 'highlight') {
        // window.prompt() is a blocking, synchronous browser dialog. In a WebView shell
        // that doesn't implement the native prompt bridge (very common for hybrid/mobile
        // app wrappers), calling it can hang the JS thread forever instead of returning -
        // which would freeze this entire upload with no error and no success message ever
        // firing. Auto-name the highlight instead so the upload can never get stuck here;
        // rename support can be added later as a proper in-app modal if needed.
        const title = `Highlight ${new Date().toLocaleDateString()}`;

        const hlId = `usr-hl-${Date.now()}`;
        
        // Optimistic UI update
        const newHl = {
          id: hlId,
          name: title,
          mediaUrl: dataUrl
        };
        setUserHighlights(prev => {
          const updated = [newHl, ...prev.filter(h => h.id !== hlId)];
          try { localStorage.setItem('nearby_cached_highlights', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });

        let finalMediaUrl = dataUrl;
        if (fUser) {
          try {
            // Cloudinary via our backend's signed-upload flow, replacing
            // Firebase Storage — no more silent 1MB Firestore doc cap or
            // "still base64 after upload attempt" failure mode.
            finalMediaUrl = await mediaApi.uploadFile(file, `nearby/highlights`);
          } catch (uploadErr) {
            console.warn("Cloudinary upload failed for highlight, using local fallback:", uploadErr);
          }
        }

        setUserHighlights(prev => {
          const updated = prev.map(h => h.id === hlId ? { id: hlId, name: title, mediaUrl: finalMediaUrl } : h);
          try { localStorage.setItem('nearby_cached_highlights', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });

        if (fUser) {
          if (finalMediaUrl.startsWith('data:')) {
            console.error(`Highlight ${hlId} still base64 after upload attempt - Cloudinary upload likely failed.`);
            setAudioFeedback("⚠️ Highlight upload failed - it won't persist. Check your connection.");
          } else {
            try {
              await highlightsApi.create({ mediaUrl: finalMediaUrl, mediaType: 'image', caption: title });
              refetchMyContentRef.current?.();
              setAudioFeedback("Highlight uploaded & persisted! 📲");
            } catch (err) {
              console.error("Backend write highlight error:", err);
              setAudioFeedback("⚠️ Highlight failed to save to the cloud - it will disappear on next login.");
            }
          }
        } else {
          setAudioFeedback("Highlight added locally!");
        }
      } else {
        const postId = `usr-post-${Date.now()}`;
        const isVideo = file.type.startsWith('video');

        // Optimistic UI update
        const newPost = {
          id: postId,
          mediaUrl: dataUrl,
          caption: 'Uploaded from Gallery! 📸🇳🇬',
          timestamp: 'Just now',
          type: isVideo ? ('video' as const) : ('image' as const)
        };
        setUserPosts(prev => {
          const updated = [newPost, ...prev.filter(p => p.id !== postId)];
          try { localStorage.setItem('nearby_cached_posts', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });

        let finalMediaUrl = dataUrl;
        if (fUser) {
          try {
            finalMediaUrl = await mediaApi.uploadFile(file, `nearby/posts`);
          } catch (uploadErr) {
            console.warn("Cloudinary upload failed for post, using local fallback:", uploadErr);
          }
        }

        setUserPosts(prev => {
          const updated = prev.map(p => p.id === postId ? {
            id: postId,
            mediaUrl: finalMediaUrl,
            caption: 'Uploaded from Gallery! 📸🇳🇬',
            timestamp: 'Just now',
            type: isVideo ? ('video' as const) : ('image' as const)
          } : p);
          try { localStorage.setItem('nearby_cached_posts', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });

        if (fUser) {
          if (finalMediaUrl.startsWith('data:')) {
            console.error(`Post ${postId} still base64 after upload attempt - Cloudinary upload likely failed.`);
            setAudioFeedback("⚠️ Post upload failed - it won't persist. Check your connection.");
          } else {
            try {
              await postsApi.create({
                caption: 'Uploaded from Gallery! 📸🇳🇬',
                mediaUrl: finalMediaUrl,
                mediaType: isVideo ? 'video' : 'image',
              });
              refetchMyContentRef.current?.();
              setAudioFeedback("Post added to your feed! 📸");
            } catch (err) {
              console.error("Backend write post error:", err);
              setAudioFeedback("⚠️ Post failed to save to the cloud - it will disappear on next login.");
            }
          }
        } else {
          setAudioFeedback("Post added locally!");
        }
      }
      setTimeout(() => setAudioFeedback(""), 4000);
    };
    reader.readAsDataURL(file);
  };
  
  // Under the hood state for messages
  const [chatMessages, _setChatMessages] = useState<Record<string, DirectMessage[]>>(INITIAL_MESSAGES);

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
  const setChatMessages = (
    value: Record<string, DirectMessage[]> | ((prev: Record<string, DirectMessage[]>) => Record<string, DirectMessage[]>)
  ) => {
    _setChatMessages(prev => {
      return typeof value === 'function' ? value(prev) : value;
    });
  };

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  // Presence + typing live further down, after nearbyUsersData and
  // textInput are in scope.


  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isSplashActive, setIsSplashActive] = useState<boolean>(true);
  const [showWelcomeTour, setShowWelcomeTour] = useState<boolean>(() => {
    return !localStorage.getItem('nearby_welcome_completed');
  });
  const [welcomeTourStep, setWelcomeTourStep] = useState<number>(0);

  const [authScreenState, setAuthScreenState] = useState<'login' | 'signup' | 'forgot' | 'verification'>('login');
  const [authSuccess, setAuthSuccess] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

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
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [onboardingName, setOnboardingName] = useState<string>('');
  const [onboardingUsername, setOnboardingUsername] = useState<string>('');
  const [onboardingBio, setOnboardingBio] = useState<string>('Hey, I am a new neighbor around! Let\'s connect! 👋');
  const [onboardingPhoto, setOnboardingPhoto] = useState<string | null>(null);
  const [onboardingAgeRange, setOnboardingAgeRange] = useState<string>('25-34');
  const [onboardingGender, setOnboardingGender] = useState<string>('Male');
  const [onboardingInterests, setOnboardingInterests] = useState<string[]>(['Tech', 'Music']);
  const [onboardingCommunities, setOnboardingCommunities] = useState<string[]>(['comm-1']);

  // Authentication inputs state
  const [authEmailOrPhone, setAuthEmailOrPhone] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState<string>('');
  const [authIsSignUp, setAuthIsSignUp] = useState<boolean>(!hasSavedAccountOnDisk);
  const [isPhoneAuthOption, setIsPhoneAuthOption] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  // Permission statuses for onboarding
  const [onboardingGpsStatus, setOnboardingGpsStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [onboardingCamStatus, setOnboardingCamStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>('');
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Custom states for Nigerian users
  const [usingGoogleMaps, setUsingGoogleMaps] = useState<boolean>(hasValidGoogleMapsKey);
  const [userNoteText, setUserNoteText] = useState<string>('');
  const [showNoteModal, setShowNoteModal] = useState<boolean>(false);
  const [radarRadius, setRadarRadius] = useState<number>(500); // meters Slider filter
  const [showRadarDrawer, setShowRadarDrawer] = useState<boolean>(false);
  const [showFloatingSearch, setShowFloatingSearch] = useState<boolean>(false);

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
  const [customAccentColor, setCustomAccentColor] = useState<'indigo' | 'emerald' | 'blue' | 'rose' | 'amber' | 'purple'>('indigo');
  const [customChatBg, setCustomChatBg] = useState<'slate' | 'cosmic' | 'sunset' | 'mint' | 'royal' | 'matrix'>('slate');
  const [customChatBubbleStyle, setCustomChatBubbleStyle] = useState<'modern' | 'sharp' | 'neon' | 'gb_doubletick' | 'playful'>('modern');
  const [customChatFont, setCustomChatFont] = useState<'sans' | 'mono' | 'serif' | 'chunky'>('sans');

  // Groups and Privacy States
  const [userGroupInvitePolicy, setUserGroupInvitePolicy] = useState<'always' | 'ask' | 'never'>('ask');
  const [userGroupCallPolicy, setUserGroupCallPolicy] = useState<'always' | 'ask' | 'never'>('ask');
  const [audioFeedback, setAudioFeedback] = useState<string>('');
  const [friendIds, setFriendIds] = useState<string[]>([]); // derived from /friendships

  // triggerBeep + audioContextRef + the call-signaling hook are hoisted
  // here (well before their "natural" position further down) because
  // several effects/functions throughout this file reference callState,
  // localStream, etc. — putting the hook call after ALL of its consumers
  // isn't possible in one file, so it goes right after its own
  // dependencies (friendIds, neighbors, appUser) are available instead.
  const audioContextRef = useRef<AudioContext | null>(null);

  const triggerBeep = useCallback((freq = 440, duration = 0.2, type: 'sine' | 'square' | 'triangle' = 'sine') => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio fallback silent
    }
  }, []);

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
  const [showMainMenuDropdown, setShowMainMenuDropdown] = useState<boolean>(false);
  const [showActiveChatDropdown, setShowActiveChatDropdown] = useState<boolean>(false);
  const [showActiveChatMoreDropdown, setShowActiveChatMoreDropdown] = useState<boolean>(false);
  const [radarVisibilityMode, setRadarVisibilityMode] = useState<'everyone' | 'friends' | 'hidden'>('everyone');
  const [userRadarEmoji, setUserRadarEmoji] = useState<string>('🙋‍♂️');
  const [userRadarStatusText, setUserRadarStatusText] = useState<string>('Jollof hunting in Yaba');

  // Live status descriptions for mutual friends
  const neighborLiveGists: Record<string, { status: string; checkedInAt: string; activity: string }> = {
    'nb-1': { status: "🍛 Munching firewood jollof at canteens", checkedInAt: "Yaba Rd", activity: "Eating Out" },
    'nb-2': { status: "💻 Debugging server-side endpoints on Vite", checkedInAt: "Herbert Macaulay Way", activity: "Coding" },
    'nb-3': { status: "🛍️ Buying snacks and soft drinks at local stall", checkedInAt: "Tejuosho St", activity: "Shopping" },
    'nb-4': { status: "⚽️ Tuning up for street footy session", checkedInAt: "Alara St", activity: "Playing football" },
    'nb-5': { status: "🎵 Cooking some cool Yaba afro-fusion beats", checkedInAt: "Montgomery Rd", activity: "Music producing" },
  };
  
  // Group creation States
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupDesc, setNewGroupDesc] = useState<string>('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [newGroupEmoji, setNewGroupEmoji] = useState<string>('⚽️');
  const [newGroupColor, setNewGroupColor] = useState<string>('bg-emerald-600');

  // Simulated invitations modals (Privacy Policies trigger)
  const [showGroupInviteConfirmModal, setShowGroupInviteConfirmModal] = useState<boolean>(false);
  const [pendingIncomingInviteGroup, setPendingIncomingInviteGroup] = useState<{
    id: string;
    name: string;
    desc: string;
    emoji: string;
    color: string;
    senderId: string;
    senderName: string;
  } | null>(null);

  const [showGroupCallConfirmModal, setShowGroupCallConfirmModal] = useState<boolean>(false);
  const [pendingIncomingCall, setPendingIncomingCall] = useState<{
    groupId: string;
    groupName: string;
    senderId: string;
    senderName: string;
  } | null>(null);

  // Theme & Location Accuracy Custom States
  const [appTheme, setAppTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    localStorage.setItem('appearanceMode', appearanceMode);
    if (appearanceMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
        const themeVal = e.matches ? 'dark' : 'light';
        setAppTheme(themeVal);
        if (themeVal === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };
      updateTheme(mediaQuery);
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    } else {
      setAppTheme(appearanceMode);
      if (appearanceMode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [appearanceMode]);

  useEffect(() => {
    if (appTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appTheme]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const saved = localStorage.getItem('nearby_last_user_coords');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return null;
  });
  const [gpsSynced, setGpsSynced] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nearby_last_user_coords') !== null;
    } catch (_) {
      return false;
    }
  });
  const [userAddress, setUserAddress] = useState<string>(() => {
    try {
      return localStorage.getItem('nearby_user_address') || '';
    } catch (_) {
      return '';
    }
  });
  const [searchStateQuery, setSearchStateQuery] = useState<string>('');
  const [showStateSearchModal, setShowStateSearchModal] = useState<boolean>(false);

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
  const [showPhotoMenu, setShowPhotoMenu] = useState<boolean>(false);

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
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('normal');
  const [canvasDrawing, setCanvasDrawing] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#e11d48'); // raw rose-600
  const [myUploadedStory, setMyUploadedStory] = useState<StorySnap | null>(null);
  const [myStorySnaps, setMyStorySnaps] = useState<StorySnap[]>([]);
  const [neighborStories, setNeighborStories] = useState<Record<string, StorySnap[]>>({});
  const [mutedStoryUserIds, setMutedStoryUserIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('muted_stories_uids') || '[]');
    } catch (_) {
      return [];
    }
  });

  const toggleMuteNeighborStories = (neighborId: string) => {
    setMutedStoryUserIds(prev => {
      const isMuted = prev.includes(neighborId);
      let updated: string[];
      if (isMuted) {
        updated = prev.filter(id => id !== neighborId);
        setAudioFeedback("🔊 Neighbor status unmuted!");
      } else {
        updated = [...prev, neighborId];
        setAudioFeedback("🔕 Neighbor status muted!");
      }
      setTimeout(() => setAudioFeedback(""), 2000);
      localStorage.setItem('muted_stories_uids', JSON.stringify(updated));
      return updated;
    });
    triggerBeep(450, 0.08);
  };
  const [storyUploadData, setStoryUploadData] = useState<{
    mediaUrl: string;
    type: 'image' | 'video';
  } | null>(null);
  const [storyCompositionCaption, setStoryCompositionCaption] = useState<string>('');
  const [storyCompositionPrivacy, setStoryCompositionPrivacy] = useState<'everyone' | 'friends' | 'custom'>('everyone');
  const [storyCompositionCustomList, setStoryCompositionCustomList] = useState<string[]>([]);
  const [isPublishingStory, setIsPublishingStory] = useState<boolean>(false);
  const [playingStorySnaps, setPlayingStorySnaps] = useState<StorySnap[]>([]);
  const [playingSnapIndex, setPlayingSnapIndex] = useState<number>(0);
  const [isStoryPaused, setIsStoryPaused] = useState<boolean>(false);
  const [storyViewerReplies, setStoryViewerReplies] = useState<string>('');
  const [showStoryViewerList, setShowStoryViewerList] = useState<boolean>(false);
  const [isMutedStoriesExpanded, setIsMutedStoriesExpanded] = useState<boolean>(false);

  const [storyViewer, setStoryViewer] = useState<Neighbor | 'me' | null>(null);
  const [storyPlaylist, setStoryPlaylist] = useState<any[]>([]);
  const [storyPlaylistIndex, setStoryPlaylistIndex] = useState<number>(0);
  const [showStoryChoiceModal, setShowStoryChoiceModal] = useState<{ note: UserNote; neighbor: Neighbor } | null>(null);
  const [showAddFriendsModal, setShowAddFriendsModal] = useState<boolean>(false);
  
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
  const [replyingToMessage, setReplyingToMessage] = useState<DirectMessage | null>(null);
  const [activeChatSearchQuery, setActiveChatSearchQuery] = useState<string>('');
  const [showActiveChatSearch, setShowActiveChatSearch] = useState<boolean>(false);
  const [showForwardModal, setShowForwardModal] = useState<DirectMessage | null>(null);
  const [simulatedTypingMap, setSimulatedTypingMap] = useState<Record<string, boolean>>({});

  // Redesigned Chat States
  const [blockedNeighborIds, setBlockedNeighborIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('whatsapp_blocked_neighbors') || '[]');
    } catch { return []; }
  });
  const [mutedNeighborIds, setMutedNeighborIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('whatsapp_muted_neighbors') || '[]');
    } catch { return []; }
  });
  const [unreadNeighborIds, setUnreadNeighborIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('whatsapp_unread_neighbors') || '[]');
    } catch { return []; }
  });
  const [longPressedNeighborForMenu, setLongPressedNeighborForMenu] = useState<Neighbor | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [emojiCategory, setEmojiCategory] = useState<string>('smileys');
  const [emojiSearchQuery, setEmojiSearchQuery] = useState<string>('');
  const [recentlyUsedEmojis, setRecentlyUsedEmojis] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('whatsapp_recent_emojis') || '["👍", "❤️", "😂", "😮", "😢", "🙏"]');
    } catch { return ["👍", "❤️", "😂", "😮", "😢", "🙏"]; }
  });
  const [selectedSkinTone, setSelectedSkinTone] = useState<string>(''); // '', '🏻', '🏼', '🏽', '🏾', '🏿'
  const [isLockVoiceRecording, setIsLockVoiceRecording] = useState<boolean>(false);
  const [voicePlaybackSpeedMap, setVoicePlaybackSpeedMap] = useState<Record<string, number>>({});
  const [showMediaGalleryModal, setShowMediaGalleryModal] = useState<boolean>(false);
  const [activeMediaGalleryTab, setActiveMediaGalleryTab] = useState<'photos' | 'videos' | 'documents' | 'links' | 'voice'>('photos');
  const [currentSearchMatchIndex, setCurrentSearchMatchIndex] = useState<number>(-1);
  const [searchMatchIds, setSearchMatchIds] = useState<string[]>([]);
  const [isMessageSelectMode, setIsMessageSelectMode] = useState<boolean>(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [editingMessage, setEditingMessage] = useState<DirectMessage | null>(null);
  const [showMessageInfoModal, setShowMessageInfoModal] = useState<DirectMessage | null>(null);
  
  // Archived Chats support o!
  const [archivedNeighborIds, setArchivedNeighborIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('whatsapp_archived_chats') || '[]');
    } catch {
      return [];
    }
  });
  const [showArchivedOnly, setShowArchivedOnly] = useState<boolean>(false);

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

  const handleMessageTouchEnd = (msg: DirectMessage) => {
    if (swipeOffsetMsgId === msg.id && swipeOffsetAmount > 45) {
      setReplyingToMessage(msg);
      triggerBeep(520, 0.05);
    }
    setSwipeOffsetMsgId(null);
    setSwipeOffsetAmount(0);
  };

  const [activeBubbleDropdownId, setActiveBubbleDropdownId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('whatsapp_archived_chats', JSON.stringify(archivedNeighborIds));
  }, [archivedNeighborIds]);

  useEffect(() => {
    if (!selectedNeighborId || !activeChatSearchQuery.trim()) {
      setSearchMatchIds([]);
      setCurrentSearchMatchIndex(-1);
      return;
    }
    const currentUid = currentUser?.uid || 'user';
    const list = chatMessages[selectedNeighborId] || [];
    const query = activeChatSearchQuery.toLowerCase();
    const matches = list
      .filter(m => {
        if (m.deletedForUsers?.includes(currentUid)) return false;
        if (m.deletedForEveryone) return false;
        return m.text && m.text.toLowerCase().includes(query);
      })
      .map(m => m.id);

    setSearchMatchIds(matches);
    setCurrentSearchMatchIndex(matches.length > 0 ? matches.length - 1 : -1);
  }, [activeChatSearchQuery, selectedNeighborId, chatMessages, currentUser]);

  useEffect(() => {
    const handleFirestoreErr = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent?.detail) {
        if (customEvent.detail.isQuota) {
          console.warn("Firestore Quota Exceeded. Fallback operating o!");
          setFirestoreQuotaExceeded(true);
        }
      }
    };
    window.addEventListener('firestore-error-event', handleFirestoreErr);
    return () => window.removeEventListener('firestore-error-event', handleFirestoreErr);
  }, []);

  // Online / Offline state tracking
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerBeep(600, 0.1);
    };
    const handleOffline = () => {
      setIsOnline(false);
      triggerBeep(300, 0.15);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const handleSendResetLink = async () => {
    if (!authEmailOrPhone || !authEmailOrPhone.trim().includes('@')) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      await sendPasswordResetEmail(auth, authEmailOrPhone.trim());
      setAuthSuccess("We've sent a secure reset link to your email.");
      setAuthScreenState('login');
    } catch (err: any) {
      console.error("Password reset failure: ", err);
      setAuthError(err.message || "Failed to send reset link.");
    } finally {
      setAuthLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setAuthError('');
    setAuthLoading(true);
    try {
      triggerBeep(580, 0.1);
      // Make persistence explicit before opening the OAuth flow. This prevents a
      // successful Google credential from disappearing when the OAuth window/tab
      // hands control back to the app on mobile Safari.
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        setCurrentUser(result.user);
        localStorage.setItem('nearby_current_uid', result.user.uid);
        setShowLandingMode(false);
      }
      setAudioFeedback("Signed in with Google.");
      setTimeout(() => setAudioFeedback(""), 2200);
    } catch (err: any) {
      console.error("Login failure: ", err);
      const code = err?.code || '';
      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/network-request-failed') {
        try {
          // Mobile browsers can complete Google OAuth more reliably with a full-page
          // redirect. The result is consumed on app startup by the effect below.
          localStorage.setItem('nearby_google_redirect_pending', '1');
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: any) {
          err = redirectErr;
        }
      }

      let errorMsg = err.message || "Failed to sign in with Google.";
      if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        errorMsg = `🔐 Firebase Domain Unauthorized!\n\nPlease add this domain ("${window.location.hostname}") to Firebase Console → Authentication → Settings → Authorized domains.`;
      }
      setAuthError(errorMsg);
      setAuthLoading(false);
      setAudioFeedback("Google sign-in failed.");
      setTimeout(() => setAudioFeedback(""), 2500);
    }
  };

  const loginWithEmailOrPhone = async (emailOrPhoneRaw: string, passwordRaw: string, isSignUpOption: boolean, isPhoneInput: boolean) => {
    setAuthError('');
    setAuthLoading(true);
    try {
      triggerBeep(580, 0.1);
      const input = emailOrPhoneRaw.trim();
      const pass = passwordRaw.trim();

      if (!input) {
        throw new Error("Please enter your email.");
      }

      if (pass.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      if (isSignUpOption) {
        const confirmPass = authConfirmPassword.trim();
        if (!confirmPass) {
          throw new Error("Please confirm your password.");
        }
        if (pass !== confirmPass) {
          throw new Error("Passwords do not match.");
        }
      }

      let finalEmail = input;
      if (isPhoneInput) {
        // Clean up phone characters
        const cleanPhone = input.replace(/\s+/g, '').replace(/[^\d+]/g, '');
        if (cleanPhone.length < 5) {
          throw new Error("Enter a valid phone number.");
        }
        finalEmail = `phone_${cleanPhone}@nearby.com`;
      } else {
        if (!input.includes('@')) {
          throw new Error("Enter a valid email.");
        }
      }

      if (isSignUpOption) {
        setAudioFeedback("Registering...");
        await createUserWithEmailAndPassword(auth, finalEmail, pass);
        setAudioFeedback("Account created.");
      } else {
        setAudioFeedback("Logging in...");
        await signInWithEmailAndPassword(auth, finalEmail, pass);
        setAudioFeedback("Signed in.");
      }
      setTimeout(() => setAudioFeedback(""), 2200);
    } catch (err: any) {
      console.error("Authentication action failure: ", err);
      let errMsg = err.message || "Authentication failed.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
        errMsg = "Incorrect password or email. If you are registering, switch to Sign Up.";
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = "A profile is already registered using this email.";
      } else if (err.code === 'auth/weak-password') {
        errMsg = "Password is too weak. Choose at least 6 characters.";
      }
      setAuthError(errMsg);
      setAuthLoading(false);
      setAudioFeedback("Authentication failed. Try again.");
      setTimeout(() => setAudioFeedback(""), 2500);
    }
  };

  const saveOnboardingDetails = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    setAudioFeedback("Saving profile...");
    
    try {
      const cleanUsername = onboardingUsername.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '') || `user_${Math.floor(1000 + Math.random() * 9000)}`;
      const cleanName = onboardingName.trim() || 'Nearby Member';
      
      const userDocRef = doc(db, 'users', currentUser.uid);
      const myNoteText = activeNotes.find(n => n.id === 'user-note-me')?.text || 'Checking in on nearby...';
      
      const finalDoc = {
        uid: currentUser.uid,
        username: cleanUsername,
        name: cleanName,
        bio: onboardingBio,
        website: "foslibrary.com.ng",
        avatarEmoji: "🙋‍♂️",
        avatarColor: "bg-neutral-800 border-neutral-700 border",
        isSubscribed: isSubscribed,
        // friendIds deliberately omitted - see the write below. This doc is built
        // from local React state and this handler is reachable again after signup
        // (the profile/onboarding sheet in the header), so including a stale local
        // array here would wipe friendships made on the other device.
        isUserVisibleOnRadar: isUserVisibleOnRadar,
        userRadarStatusText: userRadarStatusText,
        userRadarEmoji: userRadarEmoji,
        customAccentColor: customAccentColor,
        customChatBg: customChatBg,
        customChatBubbleStyle: customChatBubbleStyle,
        customChatFont: customChatFont,
        userGroupInvitePolicy: userGroupInvitePolicy,
        userGroupCallPolicy: userGroupCallPolicy,
        myNoteText: myNoteText,
        customProfilePhoto: onboardingPhoto,
        appLanguage: onboardingCoords ? (onboardingState || 'Unknown') : 'Unknown',
        streetName: onboardingCoords ? (onboardingStreetName || 'Location not set') : 'Location not set',
        latitude: onboardingCoords ? onboardingCoords.lat : null,
        longitude: onboardingCoords ? onboardingCoords.lng : null,
        locationUpdatedAt: onboardingCoords ? new Date().toISOString() : null,
        locationSource: onboardingCoords ? 'gps' : 'none',
        latOffset: 0,
        lngOffset: 0,
        ageRange: onboardingAgeRange,
        gender: onboardingGender,
        interests: onboardingInterests,
        communities: onboardingCommunities,
        followers: userFollowers,
        following: userFollowing,
        followersCount: userFollowersCount,
        followingCount: userFollowingCount,
        trustScore: userTrustScore,
        meetupsCompleted: userMeetupCount,
        onboardingCompleted: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // merge:true is required now that friendIds is omitted above - a plain
      // setDoc() replaces the entire document, which would DELETE the user's
      // friendIds field and instantly unfriend them from everyone.
      await persistProfileToBackend(finalDoc);
      
      // Update local states
      setUserDisplayName(cleanName);
      setUserUsername(cleanUsername);
      setUserBio(onboardingBio);
      setCustomProfilePhoto(onboardingPhoto);
      setAppLanguage((onboardingState || 'Lagos') as any);
      setUserAgeRange(onboardingAgeRange);
      setUserGender(onboardingGender);
      setUserInterests(onboardingInterests);
      setUserCommunities(onboardingCommunities);
      setIsProfileLoaded(true);

      try {
        localStorage.setItem(`nearby_cached_profile_${currentUser.uid}`, JSON.stringify(finalDoc));
      } catch (_) {}

      try {
        const rawAccounts = localStorage.getItem('nearby_saved_accounts');
        let accounts: any[] = [];
        if (rawAccounts) {
          try { accounts = JSON.parse(rawAccounts); } catch (_) {}
        }
        accounts = accounts.filter((a: any) => a.uid !== currentUser.uid);
        const isGoogle = currentUser.providerData.some((p: any) => p.providerId === 'google.com');
        accounts.push({
          uid: currentUser.uid,
          name: cleanName,
          username: cleanUsername,
          avatar: onboardingPhoto || currentUser.photoURL,
          authType: isGoogle ? 'google' : 'credential',
          emailOrPhone: isGoogle ? undefined : authEmailOrPhone || currentUser.email || currentUser.phoneNumber,
          password: isGoogle ? undefined : authPassword || undefined
        });
        localStorage.setItem('nearby_saved_accounts', JSON.stringify(accounts));
        loadLocalAccountsFromDisk();
      } catch (accErr) {
        console.warn("Device local accounts write failure on onboarding complete:", accErr);
      }
      
      setAudioFeedback("Profile updated.");
      setTimeout(() => setAudioFeedback(""), 2000);
      setShowOnboarding(false);
      setIsSyncing(false);
    } catch (err) {
      console.error("Error writing user profile config: ", err);
      setAudioFeedback("Failed to save profile. Try again.");
      setTimeout(() => setAudioFeedback(""), 2000);
      setIsSyncing(false);
    }
  };

  const logoutUser = async () => {
    try {
      triggerBeep(300, 0.1);
      await signOut(auth);
      setAudioFeedback("Logged out.");
      setTimeout(() => setAudioFeedback(""), 2200);
      
      // Reset variables back to default
      setIsProfileLoaded(false);
      setUserDisplayName("Nearby Member");
      setUserUsername("nearby_member");
      setUserBio("Hello from Nearby!");
      setUserWebsite("foslibrary.com.ng");
      setCustomProfilePhoto(null);
      
      setFriendIds(['nb-1', 'nb-2']);
      setUserFollowers([]);
      setUserFollowing([]);
      setUserFollowersCount(0);
      setUserFollowingCount(0);
      setUserTrustScore(5.0);
      setUserMeetupCount(0);
      setIsSubscribed(false);
      setCustomAccentColor('indigo');
      setCustomChatBg('slate');
      setCustomChatBubbleStyle('modern');
      setCustomChatFont('sans');
      setUserGroupInvitePolicy('ask');
      setUserGroupCallPolicy('ask');
      setActiveNotes(INITIAL_NOTES);
      _setChatMessages(INITIAL_MESSAGES);
      setMyUploadedStory(null);
      
      // Onboarding inputs resetting
      setOnboardingName('');
      setOnboardingUsername('');
      setOnboardingBio("Let's connect.");
      setOnboardingPhoto(null);
      setOnboardingStep(1);
      setShowLandingMode(true);
    } catch (err) {
      console.error("Logout error: ", err);
    }
  };

  const loadLocalAccountsFromDisk = () => {
    const rawAccounts = localStorage.getItem('nearby_saved_accounts');
    if (rawAccounts) {
      try {
        setSavedAccounts(JSON.parse(rawAccounts));
      } catch (_) {}
    }
  };

  useEffect(() => {
    loadLocalAccountsFromDisk();
  }, [currentUser]);

  // Complete Google redirect sign-in when the browser returns from Google.
  // Without getRedirectResult(), a successful redirect can land back on the app
  // while the UI still thinks the user is signed out. Firebase documents that the
  // redirect result must be consumed after returning to the app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await getRedirectResult(auth);
        if (!cancelled && result?.user) {
          localStorage.removeItem('nearby_google_redirect_pending');
          localStorage.setItem('nearby_current_uid', result.user.uid);
          setCurrentUser(result.user);
          setShowLandingMode(false);
        }
      } catch (err: any) {
        console.error('Google redirect completion failed:', err);
        if (!cancelled) {
          localStorage.removeItem('nearby_google_redirect_pending');
          setAuthError(err?.message || 'Google sign-in could not be completed.');
          setAuthLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      const applyProfileData = (data: any) => {
        if (data.gbFreezeLastSeen !== undefined) setGbFreezeLastSeen(data.gbFreezeLastSeen);
        if (data.gbAntiDelete !== undefined) setGbAntiDelete(data.gbAntiDelete);
        if (data.gbHideOnline !== undefined) setGbHideOnline(data.gbHideOnline);
        if (data.gbBlueTickOnReply !== undefined) setGbBlueTickOnReply(data.gbBlueTickOnReply);
        // friendIds intentionally NOT read here - /friendships is the single
        // source of truth. Reading the cached array back would race the
        // friendship listener and resurrect deleted friends.
        if (data.isSubscribed !== undefined) setIsSubscribed(data.isSubscribed);
        if (data.isUserVisibleOnRadar !== undefined) setIsUserVisibleOnRadar(data.isUserVisibleOnRadar);
        if (data.radarVisibilityMode !== undefined) setRadarVisibilityMode(data.radarVisibilityMode);
        if (data.userRadarStatusText !== undefined) setUserRadarStatusText(data.userRadarStatusText);
        if (data.userRadarEmoji !== undefined) setUserRadarEmoji(data.userRadarEmoji);
        if (data.customAccentColor) setCustomAccentColor(data.customAccentColor);
        if (data.customChatBg) setCustomChatBg(data.customChatBg);
        if (data.customChatBubbleStyle) setCustomChatBubbleStyle(data.customChatBubbleStyle);
        if (data.customChatFont) setCustomChatFont(data.customChatFont);
        if (data.userGroupInvitePolicy) setUserGroupInvitePolicy(data.userGroupInvitePolicy);
        if (data.userGroupCallPolicy) setUserGroupCallPolicy(data.userGroupCallPolicy);
        
        const effectiveName = (data.name && data.name !== 'Nearby Member')
          ? data.name
          : (auth.currentUser?.displayName || (auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : (data.name || 'Nearby Member')));
        setUserDisplayName(effectiveName);

        const effectiveUsername = (data.username && data.username !== 'nearby_member')
          ? data.username
          : (auth.currentUser?.email ? auth.currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_\-]/g, '') : (data.username || 'nearby_member'));
        setUserUsername(effectiveUsername);

        if (data.bio) setUserBio(data.bio);
        if (data.website) setUserWebsite(data.website);
        if (data.customProfilePhoto || auth.currentUser?.photoURL) setCustomProfilePhoto(data.customProfilePhoto || auth.currentUser?.photoURL || null);
        if (data.appLanguage) setAppLanguage(data.appLanguage as any);
        if (data.ageRange) setUserAgeRange(data.ageRange);
        if (data.gender) setUserGender(data.gender);
        if (data.interests) setUserInterests(data.interests);
        if (data.communities) setUserCommunities(data.communities);
        if (data.contacts && Array.isArray(data.contacts)) setContactsList(data.contacts);
        if (data.followers !== undefined && Array.isArray(data.followers)) setUserFollowers(data.followers);
        if (data.following !== undefined && Array.isArray(data.following)) setUserFollowing(data.following);
        if (data.followersCount !== undefined) setUserFollowersCount(data.followersCount);
        if (data.followingCount !== undefined) setUserFollowingCount(data.followingCount);
        if (data.trustScore !== undefined) setUserTrustScore(data.trustScore);
        if (data.meetupsCompleted !== undefined) setUserMeetupCount(data.meetupsCompleted);
        if (data.myNoteText !== undefined) {
          setActiveNotes(prev => {
            const exists = prev.some(n => n.id === 'user-note-me');
            if (exists) {
              return prev.map(n => n.id === 'user-note-me' ? { ...n, text: data.myNoteText } : n);
            } else if (data.myNoteText) {
              return [{
                id: 'user-note-me',
                name: 'Your note',
                avatarColor: 'bg-neutral-800 border border-neutral-700',
                avatarEmoji: data.avatarEmoji || '🙋‍♂️',
                text: data.myNoteText
              }, ...prev];
            }
            return prev;
          });
        }
      };

      if (user) {
        localStorage.setItem('nearby_current_uid', user.uid);
        setIsSyncing(true);
        setAudioFeedback("Loading...");
        setTimeout(() => setAudioFeedback(""), 2000);

        // 1. Instant restore from local cache to prevent default placeholder flicker
        let cachedProfileData: any = null;
        try {
          const cachedProfileRaw = localStorage.getItem(`nearby_cached_profile_${user.uid}`);
          if (cachedProfileRaw) {
            cachedProfileData = JSON.parse(cachedProfileRaw);
            applyProfileData(cachedProfileData);
            setIsProfileLoaded(true);
            
            // If cache profile exists, immediately bypass landing & onboarding screens!
            if (cachedProfileData) {
              setShowOnboarding(false);
              setShowLandingMode(false);
            }
          }
        } catch (cacheErr) {
          console.warn("Error restoring from local profile cache:", cacheErr);
        }
        
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          const profileExists = userDocSnap.exists();
          
          if (profileExists || cachedProfileData) {
            let data = profileExists ? userDocSnap.data() : cachedProfileData;
            
            // Derive real user name from Google or auth if stored name is placeholder
            const authName = user.displayName || (user.email ? user.email.split('@')[0] : null);
            if ((!data.name || data.name === 'Nearby Member') && authName) {
              data = {
                ...data,
                name: authName,
                username: data.username && data.username !== 'nearby_member' ? data.username : (user.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_\-]/g, '') : `user_${user.uid.slice(0,5)}`)
              };
              persistProfileToBackend(data).catch(e => console.warn("Profile update err:", e));
            }

            // 2. Apply loaded cloud parameters
            applyProfileData(data);

            // 3. Cache the restored profile locally for faster loading
            try {
              localStorage.setItem(`nearby_cached_profile_${user.uid}`, JSON.stringify(data));
            } catch (cacheStoreErr) {
              console.warn("Error caching profile in localStorage:", cacheStoreErr);
            }

            setIsProfileLoaded(true);

            // Existing profile -> Land directly on home dashboard!
            setShowOnboarding(false);
            setShowLandingMode(false);
 
            try {
              const rawAccounts = localStorage.getItem('nearby_saved_accounts');
              let accounts: any[] = [];
              if (rawAccounts) {
                try { accounts = JSON.parse(rawAccounts); } catch (_) {}
              }
              accounts = accounts.filter((a: any) => a.uid !== user.uid);
              const isGoogle = user.providerData.some((p: any) => p.providerId === 'google.com');
              const finalName = data.name || authName || 'Nearby Member';
              const finalUsername = data.username || (user.email ? user.email.split('@')[0].toLowerCase() : 'nearby_member');
              accounts.push({
                uid: user.uid,
                name: finalName,
                username: finalUsername,
                avatar: data.customProfilePhoto || user.photoURL || null,
                authType: isGoogle ? 'google' : 'credential',
                emailOrPhone: isGoogle ? undefined : authEmailOrPhone || user.email || user.phoneNumber,
                password: isGoogle ? undefined : authPassword || undefined
              });
              localStorage.setItem('nearby_saved_accounts', JSON.stringify(accounts));
              loadLocalAccountsFromDisk();
            } catch (accErr) {
              console.warn("Device local accounts write failure o:", accErr);
            }
          } else {
            // First time login. The profile document does not exist yet in Firestore or cache.
            const defaultUsername = user.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9_\-]/g, '') || (user.phoneNumber ? `u_${user.phoneNumber.slice(-4)}` : `user_${Math.floor(1000 + Math.random() * 9000)}`);
            const defaultName = user.displayName || (user.email ? user.email.split('@')[0] : 'Nearby Member');
            const defaultBio = "Hey, I am a new neighbor around! Let's connect! 👋";
            
            const initialDoc = {
              uid: user.uid,
              username: defaultUsername,
              name: defaultName,
              bio: defaultBio,
              website: "foslibrary.com.ng",
              avatarEmoji: "🙋‍♂️",
              avatarColor: "bg-neutral-800 border-neutral-700 border",
              isSubscribed: false,
              friendIds: [],
              isUserVisibleOnRadar: true,
              userRadarStatusText: "Connecting nearby...",
              userRadarEmoji: "🙋‍♂️",
              customAccentColor: "indigo",
              customChatBg: "slate",
              customChatBubbleStyle: "modern",
              customChatFont: "sans",
              userGroupInvitePolicy: "ask",
              userGroupCallPolicy: "ask",
              myNoteText: "",
              customProfilePhoto: user.photoURL || null,
              appLanguage: "Unknown",
              streetName: "Location not set",
              latitude: null,
              longitude: null,
              locationUpdatedAt: null,
              locationSource: "none",
              latOffset: 0,
              lngOffset: 0,
              ageRange: "25-34",
              gender: "Male",
              interests: ["Tech", "Music"],
              communities: ["comm-1"],
              followers: [],
              following: [],
              followersCount: 0,
              followingCount: 0,
              trustScore: 5.0,
              meetupsCompleted: 0,
              onboardingCompleted: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            // The backend provisions the Postgres row on the first
            // authenticated request; this pushes the onboarding fields
            // the user chose (name, bio, avatar) onto it.
            await persistProfileToBackend(initialDoc);
            applyProfileData(initialDoc);

            try {
              localStorage.setItem(`nearby_cached_profile_${user.uid}`, JSON.stringify(initialDoc));
            } catch (_) {}

            try {
              const rawAccounts = localStorage.getItem('nearby_saved_accounts');
              let accounts: any[] = [];
              if (rawAccounts) {
                try { accounts = JSON.parse(rawAccounts); } catch (_) {}
              }
              accounts = accounts.filter((a: any) => a.uid !== user.uid);
              const isGoogle = user.providerData.some((p: any) => p.providerId === 'google.com');
              accounts.push({
                uid: user.uid,
                name: defaultName,
                username: defaultUsername,
                avatar: user.photoURL || null,
                authType: isGoogle ? 'google' : 'credential',
                emailOrPhone: isGoogle ? undefined : authEmailOrPhone || user.email || user.phoneNumber,
                password: isGoogle ? undefined : authPassword || undefined
              });
              localStorage.setItem('nearby_saved_accounts', JSON.stringify(accounts));
              loadLocalAccountsFromDisk();
            } catch (accErr) {
              console.warn("Device local accounts write failure o:", accErr);
            }
            
            setIsProfileLoaded(true);
            setOnboardingName(defaultName);
            setOnboardingUsername(defaultUsername);
            setOnboardingBio(defaultBio);
            setOnboardingPhoto(user.photoURL || null);

            const isGoogleUser = user.providerData.some((p: any) => p.providerId === 'google.com');
            if (isGoogleUser || (defaultName && defaultName !== 'Nearby Member')) {
              setShowOnboarding(false);
            } else {
              setShowOnboarding(true);
              setOnboardingStep(1);
            }
            setShowLandingMode(false);
          }
 
          // Force-load story
          const activeStoryRef = doc(db, 'users', user.uid, 'stories', 'active');
          const activeStorySnap = await getDoc(activeStoryRef);
          if (activeStorySnap.exists()) {
            const data = activeStorySnap.data() as StorySnap;
            const oneDayMs = 24 * 60 * 60 * 1000;
            if (data.createdAt && (Date.now() - data.createdAt > oneDayMs)) {
              // Expired, delete from db o!
              await deleteDoc(activeStoryRef);
              setMyUploadedStory(null);
            } else {
              setMyUploadedStory(data);
            }
          }
 
          setIsSyncing(false);
          setAuthLoading(false);
 
        } catch (err) {
          console.error("Error synchronizing profile data: ", err);
          setIsSyncing(false);
          setAuthLoading(false);
        }
      } else {
        setIsProfileLoaded(false);
        // user is null. Check if we can auto-restore the session (handles sandboxed iframe restrictions) o!
        const lastUid = localStorage.getItem('nearby_current_uid');
        const rawAccounts = localStorage.getItem('nearby_saved_accounts');
        let restored = false;
        const isInitialLoad = !autoLoginAttemptedRef.current;
 
        if (lastUid && rawAccounts && !autoLoginAttemptedRef.current) {
          autoLoginAttemptedRef.current = true;
          try {
            const accounts = JSON.parse(rawAccounts);
            const activeAcc = accounts.find((a: any) => a.uid === lastUid);
            if (activeAcc && activeAcc.authType === 'credential' && activeAcc.emailOrPhone && activeAcc.password) {
              restored = true;
              setAudioFeedback("Restoring session...");
              let finalEmail = activeAcc.emailOrPhone.trim();
              if (!finalEmail.includes('@')) {
                const cleanPhone = finalEmail.replace(/\s+/g, '').replace(/[^\d+]/g, '');
                finalEmail = `phone_${cleanPhone}@nearby.com`;
              }
              await signInWithEmailAndPassword(auth, finalEmail, activeAcc.password.trim());
              setAudioFeedback("Session restored.");
              setTimeout(() => setAudioFeedback(""), 2000);
            }
          } catch (err) {
            console.warn("Session auto-restore error:", err);
            restored = false;
          }
        }
 
        if (!restored) {
          if (lastUid && isInitialLoad) {
            setShowLandingMode(false);
            setAuthIsSignUp(false);
          }
          localStorage.removeItem('nearby_current_uid');
          setIsSyncing(false);
          setAuthLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // -----------------------------------------
  // Real-time Presence Heartbeat
  // -----------------------------------------
  useEffect(() => {
    if (!currentUser || showOnboarding) return;

    let lastActivityTime = Date.now();
    let currentStatus: 'active' | 'away' | 'offline' = 'active';

    const writePresence = async (status: 'active' | 'away' | 'offline') => {
      currentStatus = status;
      try {
        // Was a setDoc to the `presence` collection, which every client
        // subscribed to. The backend keeps this user's Redis key alive
        // instead; online/offline is derived from that key's TTL.
        await presenceApi.heartbeat();
      } catch (e) {
        console.warn('Presence write failed:', e);
      }
    };

    const handleActivity = () => {
      lastActivityTime = Date.now();
      if (currentStatus !== 'active') void writePresence('active');
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastActivityTime = Date.now();
        void writePresence('active');
      } else {
        void writePresence('away');
      }
    };

    void writePresence('active');
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityTime;
      void writePresence(idleMs >= 2 * 60 * 1000 ? 'away' : 'active');
    }, 20000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
      void writePresence('offline');
    };
  }, [currentUser?.uid, showOnboarding, selectedNeighborId]);

  // Real-time Discover Hub and Chat Activity Notifications o!
  useEffect(() => {
    if (!currentUser) return;

    // Discover Hub Activities with friendly wording o!
    const discoverActivities = [
      { message: "Adeola updated their search distance to 200m", icon: "📍" },
      { message: "Chidi matched 'Coding' interest with you", icon: "⚡" },
      { message: "Funmi just entered your Ogo-Oluwa Block", icon: "👀" },
      { message: "Wale updated discovery range to 1km", icon: "🌐" },
      { message: "Sade is looking for a nearby meetup now", icon: "🔥" },
      { message: "Amaka updated her profile details", icon: "🤝" },
      { message: "Yusuf matched 'Music' interest with you", icon: "🎵" },
      { message: "Soji customized their status bubble", icon: "💭" },
      { message: "Ife updated their discovery range to 5km", icon: "📏" },
      { message: "Dunni is within 100 meters of you!", icon: "🚶" }
    ];

    // Every 15 seconds, IF on the discover hub page (explore tab), trigger a top pop-up for 1 second o!
    const topNotificationInterval = setInterval(() => {
      if (activeTab === 'explore') {
        const randomActivity = discoverActivities[Math.floor(Math.random() * discoverActivities.length)];
        setTopNotification(randomActivity);
        playNotificationSound(); // Real phone notification audio tone o!
        
        // Hide after exactly 1 second
        setTimeout(() => {
          setTopNotification(null);
        }, 1000);
      }
    }, 15000); // Check every 15s

    // Also trigger one immediately on tab change to 'explore'
    if (activeTab === 'explore') {
      const randomActivity = discoverActivities[Math.floor(Math.random() * discoverActivities.length)];
      setTopNotification(randomActivity);
      playNotificationSound(); // Real phone notification audio tone o!
      setTimeout(() => {
        setTopNotification(null);
      }, 1000);
    }

    // Every 1 minute, IF on the main chat page, show a chat notification about Discover Hub o!
    const chatActivities = [
      { message: "3 new people are active near your current location!", subtext: "View them on the Discover Hub" },
      { message: "Chidi just changed their status to 'Ready to Gist!'", subtext: "Check who is online in Discover Hub" },
      { message: "Sade shared a new 24h story on Discover Feed!", subtext: "Swipe over to the Discover Feed" },
      { message: "Wale updated his profile details!", subtext: "Discover verified neighbors now" },
      { message: "A user with mutual interest 'Tech' is online near you!", subtext: "Connect face-to-face on your block" }
    ];

    const chatNotificationInterval = setInterval(() => {
      if (activeTab === 'chat') {
        const randomChatAct = chatActivities[Math.floor(Math.random() * chatActivities.length)];
        setChatNotification(randomChatAct);
        playNotificationSound(); // Real phone notification audio tone o!
        
        // Hide after 4 seconds (so they have time to read a 1-minute alert o!)
        setTimeout(() => {
          setChatNotification(null);
        }, 4000);
      }
    }, 60000); // 1 minute (60000 ms)

    return () => {
      clearInterval(topNotificationInterval);
      clearInterval(chatNotificationInterval);
    };
  }, [currentUser, activeTab]);

  // -----------------------------------------
  // Automatic Message Stream Scroll Anchoring o!
  // -----------------------------------------
  const scrollToLastMessage = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    if (selectedNeighborId) {
      setChatLimit(50);
      scrollToLastMessage('auto');
      const timer = setTimeout(() => scrollToLastMessage('auto'), 150);
      return () => clearTimeout(timer);
    }
  }, [selectedNeighborId]);

  useEffect(() => {
    if (selectedNeighborId) {
      const msgs = chatMessages[selectedNeighborId] || [];
      if (msgs.length > 0) {
        scrollToLastMessage('smooth');
      }
    }
  }, [chatMessages, selectedNeighborId]);

  // Typing is now sent over the chat socket (see the effect above) rather
  // than written to a Firestore presence document on every keystroke.

  // -----------------------------------------
  // Core WhatsApp Synced Persistence Helpers o!
  // -----------------------------------------
  const markMessageFailed = (threadId: string, msgId: string) => {
    _setChatMessages(prev => {
      const list = prev[threadId] || [];
      const idx = list.findIndex(m => m.id === msgId);
      if (idx === -1) return prev;
      const copy = [...list];
      copy[idx] = { ...copy[idx], status: 'failed' as const };
      return { ...prev, [threadId]: copy };
    });
  };

  const saveOrUpdateMessageInFirestore = async (msg: DirectMessage, threadId: string) => {
    const fUser = auth.currentUser;
    if (!fUser) {
      // Was a silent `return`: the message sat on screen looking "sent" forever
      // while nothing was ever written. Surface it instead.
      markMessageFailed(threadId, msg.id);
      setAudioFeedback("⚠️ You're signed out - message not sent.");
      setTimeout(() => setAudioFeedback(""), 4000);
      return;
    }
    const isGroupThread = threadId.startsWith('group-') || threadId.startsWith('sim-group-');

    let finalMediaUrl = msg.mediaUrl;
    if (finalMediaUrl && finalMediaUrl.startsWith('data:')) {
      try {
        let folder = 'documents';
        let fileExtension = 'bin';
        if (msg.type === 'image') {
          folder = 'chat-images';
          fileExtension = finalMediaUrl.includes('image/png') ? 'png' : finalMediaUrl.includes('image/gif') ? 'gif' : 'jpeg';
        } else if (msg.type === 'video') {
          folder = 'chat-videos';
          fileExtension = finalMediaUrl.includes('video/mp4') ? 'mp4' : 'mov';
        } else if (msg.type === 'voice') {
          folder = 'voice-notes';
          fileExtension = 'mp3';
        } else {
          folder = 'documents';
          fileExtension = 'pdf';
        }
        const storagePath = `${folder}/${fUser.uid}/${Date.now()}.${fileExtension}`;
        finalMediaUrl = await uploadToStorage(finalMediaUrl, storagePath);
      } catch (uploadErr) {
        console.warn("Storage upload failed, using original url:", uploadErr);
      }
    }

    const msgBody = {
      id: msg.id,
      senderId: msg.senderId === 'user' ? fUser.uid : (msg.senderId || fUser.uid),
      receiverId: msg.receiverId || threadId,
      chatThreadId: msg.chatThreadId || threadId,
      timestamp: msg.timestamp || new Date().toISOString(),
      type: msg.type || 'text',
      ...(msg.text ? { text: msg.text } : {}),
      ...(finalMediaUrl ? { mediaUrl: finalMediaUrl } : {}),
      ...(msg.audioDurationSec !== undefined ? { audioDurationSec: msg.audioDurationSec } : {}),
      ...(msg.fileName ? { fileName: msg.fileName } : {}),
      ...(msg.fileSize ? { fileSize: msg.fileSize } : {}),
      ...(msg.isUnread !== undefined ? { isUnread: msg.isUnread } : {}),
      ...(msg.status ? { status: msg.status } : {}),
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      ...(msg.reactions ? { reactions: msg.reactions } : {}),
      ...(msg.deletedForEveryone !== undefined ? { deletedForEveryone: msg.deletedForEveryone } : {}),
      ...(msg.deletedForUsers ? { deletedForUsers: msg.deletedForUsers } : {}),
      ...(msg.isForwarded !== undefined ? { isForwarded: msg.isForwarded } : {})
    };

    try {
      // Messages are persisted by the backend (ChatService.sendMessage via
      // the `send_message` socket event) — that write used to be mirrored
      // here into Firestore as well, which is exactly what produced
      // one-sided delivery: two independent writers, two orderings, two
      // different thread-id conventions.
      if (isGroupThread) {
        // Group threads are not backed by the new API yet; nothing to mirror.
      } else {
        const participants = [fUser.uid, threadId].sort();
        const chatThreadId = participants.join('_');
        
        const dmBody = {
          ...msgBody,
          chatThreadId,
          participants,
          senderId: msgBody.senderId === 'user' ? fUser.uid : msgBody.senderId,
          receiverId: msgBody.receiverId === 'user' ? threadId : msgBody.receiverId,
        };

        void dmBody; // retained for the notification payload below

        // Add real-time notification.
        //
        // This helper is ALSO the update path (edits, reactions, stars, delete-for-me,
        // read receipts), so unguarded it fired a brand-new "New Message" notification
        // every single time an existing message was touched - the recipient got a fresh
        // ping for a message they'd already read, every edit. Notify exactly once, on
        // the first write of a given message id, and only when *we* are the sender
        // (the notifications rule requires senderId == auth.uid, so notifying on
        // someone else's message was a guaranteed permission-denied anyway).
        const alreadyNotified = notifiedMessageIdsRef.current.has(msg.id);
        if (
          msgBody.type !== 'call_log' &&
          !alreadyNotified &&
          dmBody.senderId === fUser.uid &&
          dmBody.receiverId !== fUser.uid &&
          !msg.reactions &&
          !msg.deletedForEveryone
        ) {
          notifiedMessageIdsRef.current.add(msg.id);
          const senderName = dmBody.senderId === fUser.uid
            ? (userDisplayName || currentUser?.displayName || 'User')
            : (neighbors.find(n => n.id === dmBody.senderId)?.name || 'A neighbor');
          const previewText = msgBody.text || 'Sent media';
          await createNotification({
            userId: dmBody.receiverId,
            senderId: dmBody.senderId,
            senderName,
            type: 'message',
            title: 'New Message',
            message: `${senderName}: ${previewText}`
          });
        }
      }
    } catch (err) {
      console.warn("Firestore message write avoided/failed (quota/offline fallback):", err);
      handleFirestoreError(err, OperationType.WRITE, 'direct_messages');
      // Show the real Firestore error text on-screen (not just a generic "check your
      // connection") so this is diagnosable without needing to open devtools - especially
      // important on mobile where the console usually isn't reachable at all.
      const errMsg = err instanceof Error ? err.message : String(err);
      markMessageFailed(threadId, msg.id);
      setAudioFeedback(`⚠️ Message failed to send: ${errMsg}`);
      setTimeout(() => setAudioFeedback(""), 6000);
    }
  };

  const markMessagesAsRead = async (neighborId: string) => {
    const fUser = auth.currentUser;
    if (!fUser || neighborId.startsWith('nb-')) return;
    const msgs = chatMessages[neighborId] || [];
    const unreadMsgs = msgs.filter(m => m.senderId !== 'user' && m.senderId !== fUser.uid && m.status !== 'read');
    if (unreadMsgs.length === 0) return;

    if (selectedNeighbor?.isGroup) return;

    try {
      // Read state is a per-conversation watermark on the backend rather
      // than a flag on each message — so this is ONE call, instead of a
      // Firestore write per unread message every time a chat is opened.
      const { conversationId } = await chatApi.startConversation(selectedNeighborId);
      await chatApi.markRead(conversationId);
    } catch (err) {
      console.warn("Error marking conversation read:", err);
    }
  };

  useEffect(() => {
    if (selectedNeighborId && currentUser) {
      markMessagesAsRead(selectedNeighborId);
    }
  }, [selectedNeighborId, chatMessages[selectedNeighborId]?.length, currentUser]);

  // -----------------------------------------
  // Real-time Status Story Expiration Check (24-Hour lifetime o!)
  // -----------------------------------------
  useEffect(() => {
    const checkExpiration = async () => {
      if (!myUploadedStory || !currentUser) return;
      const oneDayMs = 24 * 60 * 60 * 1000;
      const createdTime = myUploadedStory.createdAt || Date.now();
      
      if (Date.now() - createdTime > oneDayMs) {
        setMyUploadedStory(null);
        setAudioFeedback("⏰ Your status update has expired after 24 hours.");
        setTimeout(() => setAudioFeedback(""), 3000);
        setMyUploadedStory(null);
        // No client-side deletion: highlight expiry is the server's job, so
        // two devices can't disagree about whether a status is still live.
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 30000); // 30 seconds interval

    return () => clearInterval(interval);
  }, [myUploadedStory, currentUser]);

  // -----------------------------------------
  // WebRTC Media Stream Rendering & Speaker volume adjustments
  // -----------------------------------------
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState.status, callState.active, videoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState.status, callState.active]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = isSpeakerOn ? 1.0 : 0.2;
    }
  }, [isSpeakerOn, remoteStream]);

  // Real-time chat sync via our backend (replaces a Firestore query across
  // ALL messages with `array-contains` on participants). History loads once
  // per conversation over REST; new messages arrive over one shared
  // Socket.IO connection — both participants receive the identical event
  // from the identical source of truth, which is what actually fixes
  // one-sided delivery (no per-client listener race to fall out of sync).
  const { sendChatMessage: sendChatMessageViaSocket, unreadCounts: chatUnreadCounts, totalUnread: totalUnreadMessages } = useChatSync({
    myUserId: appUser?.id ?? null,
    enabled: Boolean(currentUser) && Boolean(appUser),
    activeNeighborId: selectedNeighborState?.id ?? null,
    onMessagesForThread: (neighborId, serverList) => {
      _setChatMessages(prev => {
        const combined = { ...prev };
        const withReceiver = serverList.map(m => ({ ...m, receiverId: neighborId, chatThreadId: neighborId }));
        const serverIds = new Set(withReceiver.map(m => m.id));
        // Same safe-merge rule as before: never drop a locally pending or
        // failed message just because the server snapshot doesn't have it
        // yet — it might still be mid-flight.
        const pendingLocal = (combined[neighborId] || []).filter(
          m => !serverIds.has(m.id) && (m.status === 'sending' || m.status === 'failed'),
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
        if (list.some(m => m.id === message.id)) return prev; // duplicate delivery, ignore

        // If this is an echo of a message WE just sent (senderId mapped to
        // 'user'), reconcile it with our oldest still-"sending" optimistic
        // bubble instead of appending a second copy. A simplification: with
        // the same account open on two devices sending simultaneously, this
        // could in principle match the wrong pending message — acceptable
        // for now, worth revisiting if that becomes a real scenario.
        if (message.senderId === 'user') {
          const pendingIdx = list.findIndex(m => m.status === 'sending');
          if (pendingIdx > -1) {
            const copy = [...list];
            copy[pendingIdx] = { ...message, receiverId: neighborId, chatThreadId: neighborId };
            return { ...prev, [neighborId]: copy };
          }
        }

        return { ...prev, [neighborId]: [...list, { ...message, receiverId: neighborId, chatThreadId: neighborId }] };
      });
    },
  });



  // Notifications now come from the backend (polled — see
  // useNotificationsSync). setNotifications/setUnreadNotificationsCount
  // stay as local state the UI reads from, kept in sync via this effect.
  const { notifications: syncedNotifications, refetch: refetchNotifications } = useNotificationsSync(
    Boolean(currentUser) && Boolean(appUser),
  );

  useEffect(() => {
    setNotifications(syncedNotifications);
    setUnreadNotificationsCount(syncedNotifications.filter(n => n.isUnread).length);
  }, [syncedNotifications]);

  const handleMarkAllNotificationsRead = async () => {
    if (!currentUser) return;
    triggerBeep(520, 0.05);
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isUnread: false })));
      setUnreadNotificationsCount(0);
      await notificationsApi.markAllRead();
      refetchNotifications();
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleClearAllNotifications = async () => {
    if (!currentUser) return;
    triggerBeep(420, 0.05);
    try {
      setNotifications([]);
      setUnreadNotificationsCount(0);
      await notificationsApi.deleteAll();
    } catch (err) {
      console.error("Error clearing all notifications:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    triggerBeep(380, 0.05);
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      await notificationsApi.delete(id);
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleToggleReadNotification = async (id: string, currentUnread: boolean) => {
    triggerBeep(500, 0.05);
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isUnread: !currentUnread } : n));
      await notificationsApi.toggleRead(id, currentUnread); // currentUnread=true means we're marking it READ now
    } catch (err) {
      console.error("Error toggling read status:", err);
    }
  };

  const getGroupedNotifications = () => {
    const today: AppNotification[] = [];
    const yesterday: AppNotification[] = [];
    const earlier: AppNotification[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    notifications.forEach(notif => {
      const notifTime = notif.createdAt ? new Date(notif.createdAt).getTime() : 0;
      if (notifTime >= todayStart) {
        today.push(notif);
      } else if (notifTime >= yesterdayStart) {
        yesterday.push(notif);
      } else {
        earlier.push(notif);
      }
    });

    return { today, yesterday, earlier };
  };

  // Meetups now come from the backend (polled). Location text and
  // scheduledAt now round-trip through Postgres — before this backend
  // addition, they'd have vanished on reload.
  const { data: myMeetupsData } = useQuery({
    queryKey: ['meetups', 'mine'],
    queryFn: () => meetupsApi.list(),
    enabled: Boolean(currentUser) && Boolean(appUser),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!myMeetupsData) return;
    setMeetups(myMeetupsData.map(m => ({
      meetupId: m.id,
      hostUID: m.requesterId,
      participantUID: m.otherUserId,
      meetingPoint: m.location || '',
      meetingLatitude: 0, // backend stores a location description, not coordinates
      meetingLongitude: 0,
      // Backend distinguishes pending/confirmed; the frontend's 3-state
      // model only has 'scheduled' — both map onto it.
      status: m.status === 'completed' ? 'completed' : m.status === 'cancelled' ? 'cancelled' : 'scheduled',
      scheduledTime: m.scheduledAt || '',
      createdAt: m.createdAt,
    })));
  }, [myMeetupsData]);

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

  useEffect(() => {
    setMeetupRatings((profileRatingsData ?? []).map(r => ({
      ratingId: r.id,
      meetupId: r.meetupId,
      reviewerUID: r.raterId,
      receiverUID: r.ratedUserId,
      stars: r.rating,
      review: r.comment || '',
      createdAt: r.createdAt,
    })));
  }, [profileRatingsData]);

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

  const incomingRequestsByUserIdRef = useRef<Record<string, string>>({});
  useEffect(() => {
    incomingRequestsByUserIdRef.current = incomingRequestsByUserId;
  }, [incomingRequestsByUserId]);

  useEffect(() => {
    setFriendIds(syncedFriendIds);
    setPendingFriendRequests(Object.keys(incomingRequestsByUserId));
    setSentFriendRequestIds(sentRequestUserIds);
  }, [syncedFriendIds, incomingRequestsByUserId, sentRequestUserIds]);

  // Debounced effect for auto-persisting settings and note updates to Firebase
  useEffect(() => {
    const fUser = auth.currentUser;
    if (!fUser || isSyncing || !isProfileLoaded) return;

    const timer = setTimeout(async () => {
      try {
        const userDocRef = doc(db, 'users', fUser.uid);
        const myNoteText = activeNotes.find(n => n.id === 'user-note-me')?.text || '';
        await persistProfileToBackend({
          uid: fUser.uid,
          username: userUsername,
          name: userDisplayName,
          bio: userBio,
          website: userWebsite,
          appLanguage,
          isSubscribed,
          // *** friendIds is deliberately NOT written here. ***
          // This payload is built from local React state and runs on a 1.2s debounce
          // after ANY profile-ish change (bio, radar toggle, theme, location update).
          // Writing the local `friendIds` array does a WHOLE-ARRAY OVERWRITE, which
          // silently reverted friendships the other device had just created:
          //   Bob accepts  -> server: alice.friendIds = [bob]
          //   Alice's autosave fires a moment later with her stale local []
          //   -> server: alice.friendIds = []   (friendship erased on her side only)
          // Result: Bob's phone says "Friends", Alice's says "Add friend", and every
          // DM fails areFriends() with "message failed to send".
          // friendIds is now only ever changed via arrayUnion/arrayRemove in the
          // dedicated friend handlers, which are atomic and cannot clobber.
          isUserVisibleOnRadar,
          userRadarStatusText,
          userRadarEmoji,
          customAccentColor,
          customChatBg,
          customChatBubbleStyle,
          customChatFont,
          userGroupInvitePolicy,
          userGroupCallPolicy,
          myNoteText,
          customProfilePhoto,
          gbFreezeLastSeen,
          gbAntiDelete,
          gbHideOnline,
          gbBlueTickOnReply,
          contacts: contactsList,
          followers: userFollowers,
          following: userFollowing,
          followersCount: userFollowersCount,
          followingCount: userFollowingCount,
          trustScore: userTrustScore,
          meetupsCompleted: userMeetupCount,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${fUser.uid}`);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    userDisplayName,
    userUsername,
    userBio,
    userWebsite,
    appLanguage,
    isSubscribed,
    // friendIds removed: it no longer participates in this write.
    isUserVisibleOnRadar,
    userRadarStatusText,
    userRadarEmoji,
    customAccentColor,
    customChatBg,
    customChatBubbleStyle,
    customChatFont,
    userGroupInvitePolicy,
    userGroupCallPolicy,
    activeNotes,
    customProfilePhoto,
    gbFreezeLastSeen,
    gbAntiDelete,
    gbHideOnline,
    gbBlueTickOnReply,
    contactsList,
    userFollowers,
    userFollowing,
    userFollowersCount,
    userFollowingCount,
    userTrustScore,
    userMeetupCount
  ]);

  // -----------------------------------------
  // Synced Multi-Status Stories and Dynamic Listeners o!
  // -----------------------------------------
  // Kept (and left empty) because the hook's return object still exposes
  // it; there are no per-neighbour Firestore story subscriptions any more.
  const neighborStoryUnsubsRef = useRef<Record<string, () => void>>({});

  // Own status/stories now come from the backend `highlights` table, which
  // the effect further down already loads via useUserContent. The old
  // per-user Firestore subcollection listener (and its lazy
  // deleteDoc-on-read expiry sweep) is gone — expiry is a server concern.

  // Neighbour stories are fetched per-profile via useUserContent when you
  // actually open someone's profile, instead of opening a live Firestore
  // subcollection listener for EVERY person currently on the radar.

  // -----------------------------------------
  // Own profile
  // -----------------------------------------
  // This was onSnapshot(doc(db,'users',uid)) — a live Firestore listener
  // purely to read back a document the client itself had written. The
  // Postgres row is the source of truth now (appUser, from AuthContext),
  // so we read it once through the API and derive everything from that.
  useEffect(() => {
    if (!appUser) return;

    if (appUser.displayName && appUser.displayName !== 'Nearby Member') {
      setUserDisplayName(appUser.displayName);
    }
    if (appUser.bio) setUserBio(appUser.bio);
    if (appUser.avatarUrl && appUser.avatarUrl !== customProfilePhoto) {
      setCustomProfilePhoto(appUser.avatarUrl);
    }
    if (appUser.customStatus) {
      setUserRadarStatusText(appUser.customStatus);
    }
    // A saved street label is only applied once we have no live fix, so a
    // stale cached address can never overwrite a fresh GPS reading.
    if (appUser.streetName && !userCoords) {
      setUserAddress(appUser.streetName);
    }
    if (
      typeof appUser.latitude === 'number' &&
      typeof appUser.longitude === 'number' &&
      Number.isFinite(appUser.latitude) &&
      Number.isFinite(appUser.longitude) &&
      !(appUser.latitude === 0 && appUser.longitude === 0)
    ) {
      const lat = appUser.latitude;
      const lng = appUser.longitude;
      setUserCoords((prev) => {
        if (prev) return prev;
        setGpsSynced(true);
        const restoredPreset: LocationPreset = {
          name: appUser.streetName || 'My Location',
          city: '',
          coords: { lat, lng },
          streets: appUser.streetName ? [appUser.streetName] : [],
        };
        setSelectedPreset(restoredPreset);
        return { lat, lng };
      });
    }
  }, [appUser]);

  // Load real nearby users from our backend (replaces a Firestore listener
  // that downloaded the ENTIRE users collection to every client and
  // computed distance/visibility rules client-side). The backend now does
  // the spatial filtering (PostGIS ST_DWithin) AND the visibility/ban/
  // relationship rules (RadarService.findNearby) that used to live here.
  const { data: nearbyUsersData } = useNearbyUsersQuery(
    Boolean(currentUser) && Boolean(userCoords),
    radarRadius / 1000,
  );

  useEffect(() => {
    if (!nearbyUsersData || !currentUser) return;

    const realUsers: Neighbor[] = nearbyUsersData.map((u) => {
      const distanceMeters = u.distance_km != null ? Math.round(parseFloat(u.distance_km) * 1000) : undefined;
      const walkingMins = distanceMeters !== undefined ? Math.max(1, Math.ceil(distanceMeters / 78)) : 1;

      // Fields below with hardcoded fallbacks (avatarColor, avatarEmoji,
      // trustScore, verificationLevel, etc.) mirror the SAME fallback
      // defaults the old Firestore-backed version used — these were never
      // actually backed by real per-user data there either. They're
      // genuine backend gaps (no ratings/reputation/verification system
      // exists yet) rather than something this migration regressed.
      return {
        id: u.id,
        name: u.display_name || 'Anonymous User',
        username: (u.display_name || 'anon').toLowerCase().replace(/\s+/g, '_'),
        avatarColor: 'bg-indigo-600 border border-indigo-700',
        avatarEmoji: '🙋‍♂️',
        customProfilePhoto: u.avatar_url || undefined,
        distanceMeters,
        // Real label resolved by the neighbour's own device and synced to
        // Postgres. Previously this was hardcoded to
        // getStateStreets('Osun')[0] -> every user in the app displayed
        // "Gbongan Rd", a street in Osogbo, regardless of where they were.
        // When they genuinely haven't shared one we say so instead of
        // inventing it.
        streetName:
          u.street_name ||
          (distanceMeters !== undefined ? `${walkingMins} mins trek away` : 'Nearby'),
        bio: u.bio || 'Connected in Nigeria!',
        interests: ['Tech', 'Street Food'],
        publicSnaps: [],
        activeStory: neighborStories[u.id] || [],
        // Comes straight from the backend now (one Redis mget for the
        // whole page) rather than a client-side Firestore listener.
        onlineStatus: u.is_online ? 'online' : 'offline',
        latOffset: 0,
        lngOffset: 0,
        isOutsideRadar: distanceMeters !== undefined ? distanceMeters > radarRadius : true,
        isFriend: u.is_friend,
        ageRange: '25-34',
        gender: 'Male',
        communities: ['comm-1'],
        trustScore: 5.0,
        meetupsCompleted: 0,
        ratingsCount: 0,
        totalRatingPoints: 0,
        reportsCount: 0,
        banned: false, // banned users are already excluded server-side
        verificationLevel: 'Basic',
        dayTimeAvailability: 'Available Right Now',
        ratedBy: {},
      } as Neighbor;
    });

    setNeighbors(prev => {
      // Drop the mock/demo neighbors entirely once real data is flowing —
      // group chats are locally-created and always kept.
      const cleanPrev = prev.filter(n => n.isGroup);
      const combined = [...realUsers, ...cleanPrev];
      const unique: Neighbor[] = [];
      const seen = new Set();
      combined.forEach(n => {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          unique.push(n);
        }
      });
      return unique;
    });
  }, [nearbyUsersData, currentUser, radarRadius]);

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
  const onlineIds = useMemo(
    () =>
      (nearbyUsersData ?? [])
        .filter((u) => u.is_online)
        .map((u) => u.id),
    [nearbyUsersData],
  );

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

  // Typing indicator over the chat socket — replaces the per-keystroke
  // setDoc(presence) write the old implementation did.
  useEffect(() => {
    if (!currentUser) return;
    const typingTarget =
      selectedNeighborId && !selectedNeighbor?.isGroup && textInput.trim()
        ? selectedNeighborId
        : '';

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const socket = await getChatSocket();
        socket.emit('typing', { conversationId: typingTarget, isTyping: Boolean(typingTarget) });
      } catch {
        // Not connected yet — typing is a nice-to-have, never worth an error.
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void cancelled;
    };
  }, [textInput, selectedNeighborId, selectedNeighbor?.isGroup, currentUser?.uid]);

  // Real presence: heartbeat while the app is open, plus batch online/
  // offline status for the real (non-mock, non-group) neighbors currently
  // in view. This is what actually feeds presenceMap now — it existed
  // before but nothing ever called setPresenceMap, so onlineStatus was
  // permanently stuck on whatever default the radar mapping set.
  const realNeighborIds = useMemo(
    () => neighbors.filter(n => !n.id.startsWith('nb-') && !n.isGroup).map(n => n.id),
    [neighbors],
  );
  const { onlineStatusByUserId } = usePresenceSync(
    Boolean(currentUser) && Boolean(appUser),
    realNeighborIds,
  );

  useEffect(() => {
    setPresenceMap(prev => {
      const next = { ...prev };
      for (const [userId, isOnline] of Object.entries(onlineStatusByUserId)) {
        next[userId] = {
          online: isOnline,
          status: isOnline ? 'active' : 'offline',
          typing: next[userId]?.typing || '',
          lastSeen: next[userId]?.lastSeen || '',
          currentConversation: next[userId]?.currentConversation || '',
        };
      }
      return next;
    });
  }, [onlineStatusByUserId]);

  // Synchronize viewed Neighbor's profile posts & highlights in real-time o!
  useEffect(() => {
    if (!viewingNeighborProfile) {
      setNeighborPosts([]);
      setNeighborHighlights([]);
      return;
    }

    const targetId = viewingNeighborProfile.id;
    
    // If it's a simulated neighbor preset (starts with 'nb-'), load static data
    if (targetId.startsWith('nb-')) {
      const dataMap: Record<string, { posts: any[]; highlights: any[] }> = {
        'nb-1': {
          posts: [
            { id: 'nb1-p1', mediaUrl: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=500&auto=format&fit=crop', caption: 'Locally curated firewood jollof! 🍛🔥', timestamp: 'Yesterday' },
            { id: 'nb1-p2', mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop', caption: 'Desk setup looking sharp for weekend coding! 💻🚀', timestamp: '3 days ago' },
            { id: 'nb1-p3', mediaUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=500&auto=format&fit=crop', caption: 'Web dev is poetry in motion. ✍️💻', timestamp: '5 days ago' }
          ],
          highlights: [
            { id: 'nb1-hl1', name: 'Desk Setup', mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop' },
            { id: 'nb1-hl2', name: 'Food runs', mediaUrl: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=200&auto=format&fit=crop' }
          ]
        },
        'nb-2': {
          posts: [
            { id: 'nb2-p1', mediaUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=500&auto=format&fit=crop', caption: 'Lagos traffic is something else... 🚗😩', timestamp: 'Yesterday' },
            { id: 'nb2-p2', mediaUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop', caption: 'Vintage design inspiration in Yaba! 📰✨', timestamp: '4 days ago' }
          ],
          highlights: [
            { id: 'nb2-hl1', name: 'Lekki drive', mediaUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=200&auto=format&fit=crop' }
          ]
        },
        'nb-3': {
          posts: [
            { id: 'nb3-p1', mediaUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop', caption: 'Vintage fashion shoot in Yaba block! 💅✨', timestamp: '2 days ago' },
            { id: 'nb3-p2', mediaUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=500&auto=format&fit=crop', caption: 'Brunch day, fit check. 🥞🥂', timestamp: '5 days ago' }
          ],
          highlights: [
            { id: 'nb3-hl1', name: 'Shoots', mediaUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop' }
          ]
        },
        'nb-4': {
          posts: [
            { id: 'nb4-p1', mediaUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop', caption: 'Morning baking baked goods! 🥐🎸', timestamp: '3 days ago' },
            { id: 'nb4-p2', mediaUrl: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop', caption: 'Playing classic acoustics 🎸🎤', timestamp: 'Yesterday' }
          ],
          highlights: [
            { id: 'nb4-hl1', name: 'Jamming', mediaUrl: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=200&auto=format&fit=crop' }
          ]
        }
      };
      
      const res = dataMap[targetId] || {
        posts: [
          { id: `${targetId}-p1`, mediaUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop', caption: `Nice meeting you! - ${viewingNeighborProfile.name} 🌟`, timestamp: 'Yesterday' },
          { id: `${targetId}-p2`, mediaUrl: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=500&auto=format&fit=crop', caption: `Fun times nearby! ✨`, timestamp: '4 days ago' }
        ],
        highlights: [
          { id: `${targetId}-hl1`, name: 'Vibes', mediaUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=200&auto=format&fit=crop' }
        ]
      };
      setNeighborPosts(res.posts);
      setNeighborHighlights(res.highlights);
      return;
    }

    // Real users' posts/highlights are now handled by the useUserContent
    // hook + sync effect below (hooks can't be called conditionally inside
    // this effect, so that part had to move to the top level of the
    // component instead of living inline here).
  }, [viewingNeighborProfile, currentUser]);

  // Posts/highlights for whichever real (non-mock) neighbor profile is
  // currently open. Polled rather than a live Firestore listener — a
  // profile view isn't something that needs sub-minute freshness.
  const viewingRealProfileId = viewingNeighborProfile && !viewingNeighborProfile.id.startsWith('nb-')
    ? viewingNeighborProfile.id
    : null;
  const { posts: viewedUserPosts, highlights: viewedUserHighlights } = useUserContent(
    viewingRealProfileId,
    Boolean(currentUser),
  );

  useEffect(() => {
    if (!viewingRealProfileId) return;
    setNeighborPosts(viewedUserPosts.map(p => ({
      id: p.id,
      mediaUrl: p.mediaUrl || '',
      caption: p.caption || '',
      timestamp: p.createdAt,
      type: (p.mediaType as 'image' | 'video') || 'image',
    })));
    setNeighborHighlights(viewedUserHighlights.map(h => ({
      id: h.id,
      name: h.caption || 'Highlight',
      mediaUrl: h.mediaUrl,
    })));
  }, [viewingRealProfileId, viewedUserPosts, viewedUserHighlights]);


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
  refetchMyContentRef.current = refetchMyContent;

  useEffect(() => {
    if (!appUser) return;

    const loadedHighlights = myBackendHighlights.map((h) => ({
      id: h.id,
      name: h.caption || 'Highlight',
      mediaUrl: h.mediaUrl,
    }));
    setUserHighlights(loadedHighlights);
    try { localStorage.setItem('nearby_cached_highlights', JSON.stringify(loadedHighlights)); } catch (_) {}

    // Highlights double as "status" snaps for the 24h ring.
    const snaps: StorySnap[] = myBackendHighlights.map((h) => ({
      id: h.id,
      userId: appUser.id,
      username: appUser.displayName?.toLowerCase().replace(/\s+/g, '_') || 'me',
      name: appUser.displayName || 'Me',
      mediaUrl: h.mediaUrl,
      type: (h.mediaType === 'video' ? 'video' : 'image') as 'image' | 'video',
      caption: h.caption || '',
      timestamp: 'Just now',
      viewed: false,
      createdAt: new Date(h.createdAt).getTime(),
      viewers: [],
      reactions: [],
      replies: [],
      privacy: 'everyone' as const,
      customList: [],
    })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    setMyStorySnaps(snaps);
  }, [appUser, myBackendHighlights]);

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

  const markStoryAsViewedInFirestore = async (storyOwnerId: string, storyId: string, currentStory: StorySnap) => {
    if (!currentUser || storyOwnerId === currentUser.uid || storyOwnerId === 'me') return;
    
    const currentViewers = currentStory.viewers || [];
    const alreadyViewed = currentViewers.some(v => v.userId === currentUser.uid);
    if (alreadyViewed) return;

    try {
      const storyDocRef = doc(db, 'users', storyOwnerId, 'stories', storyId);
      const newViewer = {
        userId: currentUser.uid,
        username: userUsername || 'anonymous',
        name: userDisplayName || 'Anonymous User',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      // Story reactions used to be tracked here in a Firestore-only
      // write. Persisting them properly needs a backend endpoint, so this
      // is intentionally a no-op rather than a half-migration that would
      // look like it worked while silently writing nowhere.

    } catch (e) {
      console.warn("Failed to mark story as viewed in Firestore:", e);
    }
  };

  const handleStoryViewerNext = () => {
    triggerBeep(450, 0.05);
    if (playingSnapIndex < playingStorySnaps.length - 1) {
      setPlayingSnapIndex(idx => idx + 1);
      setStoryProgress(0);
    } else {
      setStoryViewer(null);
    }
  };

  const handleStoryViewerPrev = () => {
    triggerBeep(350, 0.05);
    if (playingSnapIndex > 0) {
      setPlayingSnapIndex(idx => idx - 1);
      setStoryProgress(0);
    } else {
      setStoryViewer(null);
    }
  };

  useEffect(() => {
    if (!storyViewer) {
      setPlayingStorySnaps([]);
      setPlayingSnapIndex(0);
      setStoryProgress(0);
      return;
    }

    const snaps = storyViewer === 'me' 
      ? myStorySnaps 
      : (neighborStories[storyViewer.id] || []);

    setPlayingStorySnaps(snaps);
    setPlayingSnapIndex(0);
    setStoryProgress(0);
  }, [storyViewer, myStorySnaps, neighborStories]);

  useEffect(() => {
    if (playingStorySnaps.length === 0 || isStoryPaused) return;

    const currentSnap = playingStorySnaps[playingSnapIndex];
    if (currentSnap && storyViewer && storyViewer !== 'me') {
      markStoryAsViewedInFirestore(storyViewer.id, currentSnap.id, currentSnap);
    }

    const interval = setInterval(() => {
      setStoryProgress(prev => {
        if (prev >= 100) {
          if (playingSnapIndex < playingStorySnaps.length - 1) {
            setPlayingSnapIndex(idx => idx + 1);
            return 0;
          } else {
            setStoryViewer(null);
            return 0;
          }
        }
        return prev + 1.25; // 4 seconds duration
      });
    }, 50);

    return () => clearInterval(interval);
  }, [playingStorySnaps, playingSnapIndex, isStoryPaused, storyViewer]);

  // Periodic Nearby Notification updates every 30s, pops up for 1s
  useEffect(() => {
    // Show initially after 2 seconds
    const initialTimer = setTimeout(() => {
      const activeCount = neighbors.filter(n => !n.isGroup && n.id !== 'nb-myai').length;
      const dynamicCount = activeCount > 0 ? activeCount + Math.floor(Math.random() * 5) : Math.floor(Math.random() * 12) + 15;
      setNearbyNotificationCount(dynamicCount);
      setShowNearbyNotification(true);
      
      // Hide after 1.2 seconds to ensure a full second of clear visibility
      setTimeout(() => {
        setShowNearbyNotification(false);
      }, 1200);
    }, 2000);

    // Then update and pop up every 30 seconds
    const interval = setInterval(() => {
      const activeCount = neighbors.filter(n => !n.isGroup && n.id !== 'nb-myai').length;
      const dynamicCount = activeCount > 0 ? activeCount + Math.floor(Math.random() * 5) : Math.floor(Math.random() * 12) + 15;
      setNearbyNotificationCount(dynamicCount);
      setShowNearbyNotification(true);
      
      // Hide after 1.2 seconds
      setTimeout(() => {
        setShowNearbyNotification(false);
      }, 1200);
    }, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [neighbors]);

  // -----------------------------------------
  // Geolocation Walk Distance Scaling & Compass Offsets Mapping
  // -----------------------------------------
  useEffect(() => {
    // Coordinate tracking initialized successfully
  }, [selectedPreset, userCoords]);

  // -----------------------------------------
  // Live GPS Tracking & Reverse Geocoding
  // -----------------------------------------
  useEffect(() => {
    let watchId: number | null = null;
    let fallbackWatchId: number | null = null;
    
    // Function to start watching position
    const startMappTracking = () => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude, accuracy, heading, speed } = position.coords;
            
            // Check if coordinates have actually changed significantly (e.g., > 0.00002 decimal degrees ~2 meters)
            const prevCoords = latestCoordsRef.current;
            const diffLat = prevCoords ? Math.abs(prevCoords.lat - latitude) : Infinity;
            const diffLng = prevCoords ? Math.abs(prevCoords.lng - longitude) : Infinity;
            
            if (!prevCoords || diffLat > 0.00002 || diffLng > 0.00002) {
              const newCoords = { lat: latitude, lng: longitude };
              latestCoordsRef.current = newCoords;
              setUserCoords(newCoords);
              setGpsSynced(true);
              await updatePresetWithCoordinates(latitude, longitude, false, { accuracy, heading, speed });
            }
          },
          (error) => {
            console.warn("High-accuracy geolocation watch failed, trying standard-accuracy fallback:", error);
            if (navigator.geolocation) {
              if (watchId !== null) {
                try { navigator.geolocation.clearWatch(watchId); } catch(e){}
                watchId = null;
              }
              fallbackWatchId = navigator.geolocation.watchPosition(
                async (fallbackPos) => {
                  const { latitude, longitude, accuracy, heading, speed } = fallbackPos.coords;
                  
                  const prevCoords = latestCoordsRef.current;
                  const diffLat = prevCoords ? Math.abs(prevCoords.lat - latitude) : Infinity;
                  const diffLng = prevCoords ? Math.abs(prevCoords.lng - longitude) : Infinity;
                  
                  if (!prevCoords || diffLat > 0.00002 || diffLng > 0.00002) {
                    const newCoords = { lat: latitude, lng: longitude };
                    latestCoordsRef.current = newCoords;
                    setUserCoords(newCoords);
                    setGpsSynced(true);
                    await updatePresetWithCoordinates(latitude, longitude, false, { accuracy, heading, speed });
                  }
                },
                (fbError) => {
                  console.warn("Standard-accuracy geolocation watch failed/blocked (expected in sandboxed iframes):", fbError);
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
              );
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    };

    startMappTracking();

    // ---------------------------------------------------------------
    // Location HEARTBEAT - this is what makes two real phones see each other.
    //
    // `locationUpdatedAt` is treated as stale after 5 minutes by the users
    // listener, and anyone stale is dropped from the radar. But the ONLY thing
    // that ever refreshed it was the watchPosition callback, and that callback
    // only fires when the device physically moves more than ~2 metres. So a
    // phone sitting still on a table stopped publishing within 5 minutes and
    // then vanished from every other user's radar - which is exactly the
    // "two phones, two accounts, they can't see each other" symptom. Both
    // devices go stale while you're standing there staring at them.
    //
    // A periodic forced re-write keeps the timestamp fresh while the app is
    // open. `force` bypasses the 15s rate-limit and the 15m-moved gate.
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'hidden') return; // don't burn quota in the background
      const coords = latestCoordsRef.current;
      if (!coords || !auth.currentUser) return;
      updatePresetWithCoordinates(coords.lat, coords.lng, true).catch(() => {});
    }, 90000); // 90s - comfortably inside the 5 minute staleness window

    // Also publish immediately on regaining focus, so switching back to the app
    // makes you discoverable again right away instead of after the next tick.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const coords = latestCoordsRef.current;
      if (!coords || !auth.currentUser) return;
      updatePresetWithCoordinates(coords.lat, coords.lng, true).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisible);
      if (navigator.geolocation) {
        if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(e){} }
        if (fallbackWatchId !== null) { try { navigator.geolocation.clearWatch(fallbackWatchId); } catch(e){} }
      }
    };
  }, [currentUser]);

  // Handle active call timing counters, watchdog for ghost calls and frozen calls
  useEffect(() => {
    let watchDogInterval: any = null;
    
    if (callState.active) {
      // 1. Connection Duration Timer (when connected)
      if (callState.status === 'connected') {
        callTimerRef.current = setInterval(() => {
          setCallState(prev => ({
            ...prev,
            durationSeconds: prev.durationSeconds + 1
          }));
        }, 1000);
      }

      // 2. Active Call Watchdog (runs every 5 seconds to prevent frozen or ghost calls)
      let ringTimeCount = 0;
      watchDogInterval = setInterval(async () => {
        // A. If call is ringing for too long (e.g. 40 seconds) without answer, end it
        if (callState.status === 'ringing') {
          ringTimeCount += 5;
          if (ringTimeCount >= 40) {
            console.log("Call Watchdog: Ringing timeout reached. Auto-ending call.");
            setAudioFeedback("⚠️ No answer. Call timed out.");
            setTimeout(() => setAudioFeedback(""), 3500);
            endCall('missed');
            return;
          }
        }

        // B. Ghost Call Check removed — the onSnapshot listener above already handles the
        // doc-deleted case in real time (see the `!snap.exists()` branch), so this redundant
        // getDoc poll only added a chance of a false-positive premature disconnect from a
        // stale/racy one-off read colliding with a real write (e.g. right as someone answers).
      }, 5000);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      if (watchDogInterval) {
        clearInterval(watchDogInterval);
      }
    };
  }, [callState.active, callState.status, currentUser]);

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
  const playNotificationSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const playTone = (freq: number, start: number, duration: number, vol = 0.15) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(vol, start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play a beautiful dual-tone electronic chime: 880Hz then 1320Hz shortly after o!
      const now = ctx.currentTime;
      playTone(880, now, 0.2, 0.15);
      playTone(1320, now + 0.08, 0.35, 0.12);
    } catch (e) {
      console.warn("Could not play notification chime o!:", e);
    }
  };

  // triggerBeep + useCallSignaling moved earlier in the file (right after
  // friendIds is declared) — see there for why.


  const playSynthesizedVoiceNote = (senderName: string, durationSec: number) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const playVocalSweep = (delay: number, duration: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.4, ctx.currentTime + delay + duration);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };

      for (let i = 0; i < durationSec; i++) {
        playVocalSweep(i * 1.0, 0.45, 180);
        playVocalSweep(i * 1.0 + 0.5, 0.4, 150);
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`Voice note from ${senderName}`);
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("Speech Synthesis voice failed o:", e);
    }
  };

  const playVoiceNote = (msg: DirectMessage, senderDisplayName: string) => {
    // Real recordings end up as data:/blob: URLs before upload, and as https:// Cloudinary
    // URLs once persisted via saveOrUpdateMessageInFirestore - all three are real audio.
    // Only fall back to the TTS placeholder when there's genuinely no media at all.
    if (msg.mediaUrl && (msg.mediaUrl.startsWith('data:audio') || msg.mediaUrl.startsWith('blob:') || msg.mediaUrl.startsWith('http'))) {
      try {
        const audio = new Audio(msg.mediaUrl);
        audio.play();
        setPlayingVoiceId(msg.id);
        audio.onended = () => {
          setPlayingVoiceId(null);
        };
        return;
      } catch (err) {
        console.warn("Failed playing bin recording audio:", err);
      }
    }
    playSynthesizedVoiceNote(senderDisplayName, msg.audioDurationSec || 3);
    setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id);
  };

  // -----------------------------------------
  // WhatsApp Core Actions, Forwarding & Deletion o!
  // -----------------------------------------
  const triggerSimulatedResponse = async (neighId: string, userText: string, attachedImage?: string) => {
    let contextPrompt = "";
    if (neighId === 'nb-1') {
      contextPrompt = "You are Ade, the friendly neighborhood waffles canteen owner in Yaba. Keep it young, cool, talk about firewood waffles, puff-puff or local food. Use Lagos English/Pidgin naturally.";
    } else if (neighId === 'nb-2') {
      contextPrompt = "You are Chinedu, a street-smart mechanic in Yaba near the round-about. Speak in streetwise youth Pidgin English. Give mechanic metaphors.";
    } else if (neighId === 'nb-3') {
      contextPrompt = "You are Amara, a creative designer and artist. Talk about colors, graphic designs, beautiful graffiti, and colorful designs.";
    } else if (neighId === 'nb-4') {
      contextPrompt = "You are Temi, a local radio host and podcast presenter. Speak with high energy, radio vibes, music, and local vibes.";
    } else {
      contextPrompt = "You are 'Nearby AI', a streetsmart virtual assistant for Nigerians. Answer with helpful advice, use local pidgin slangs nicely.";
    }

    setSimulatedTypingMap(prev => ({ ...prev, [neighId]: true }));

    try {
      // Was fetch('/api/my-ai/chat') against a separate Express process.
      // Now goes through the API layer, so it hits the NestJS backend with
      // the Firebase bearer token attached (and is rate limited there).
      const data = await aiApi.myAiChat({
        prompt: `User says: "${userText}". Context instructions: ${contextPrompt}`,
        image: attachedImage,
      });
      const replyText = data.response || "I hear you! That sounds great. ✨";

      setSimulatedTypingMap(prev => ({ ...prev, [neighId]: false }));

      const replyMsg: DirectMessage = {
        id: `msg-reply-${auth.currentUser?.uid || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        senderId: neighId,
        receiverId: 'user',
        chatThreadId: neighId,
        timestamp: new Date().toISOString(),
        type: 'text',
        text: replyText,
        isUnread: true,
        status: 'read'
      };

      _setChatMessages(prev => ({
        ...prev,
        [neighId]: [...(prev[neighId] || []), replyMsg]
      }));

      if (neighId === 'nb-myai' || userText.includes("Voice Note") || userText.includes("🎙️")) {
        // `playSynthesizedVoiceNote(senderName, durationSec: number)` loops
        // `i < durationSec` to emit one beep pair per second. This call used
        // to pass `replyText.slice(0, 100)` — a STRING. `0 < "some text"` is
        // `NaN`, so the loop body never executed and the voice-note beeps
        // were silently skipped every time. It only survived because
        // `replyText` was `any`; typing the API response is what surfaced it.
        // Estimate speech length at ~15 characters per second.
        playSynthesizedVoiceNote(
          neighId === 'nb-myai' ? 'Nearby AI' : 'Neighbor',
          Math.max(1, Math.min(30, Math.ceil(replyText.length / 15))),
        );
      }

      triggerBeep(480, 0.12, 'sine');
    } catch (error) {
      console.warn("AI response trigger error:", error);
      setSimulatedTypingMap(prev => ({ ...prev, [neighId]: false }));
    }
  };

  const sendMessage = async (
    customText?: string, 
    customImage?: string, 
    customVoiceDuration?: number,
    customType?: 'text' | 'image' | 'voice' | 'video' | 'document',
    fileName?: string,
    fileSize?: string
  ) => {
    if (!selectedNeighbor) return;
    const inputContent = customText !== undefined ? customText : textInput;
    if (!inputContent.trim() && !customImage && !customVoiceDuration && !customType) return;

    // Friends-only messaging: real users (not the simulated "nb-" demo companions) must be
    // mutual friends before a DM can be sent. This is enforced for real in the Firestore
    // rules too (see firestore.rules) - this check just gives an immediate, friendly
    // message instead of letting the send silently fail against the server rule.
    if (!selectedNeighbor.id.startsWith('nb-') && !friendIds.includes(selectedNeighbor.id)) {
      setAudioFeedback(`⚠️ You can only message friends. Add ${selectedNeighbor.name} as a friend first.`);
      setTimeout(() => setAudioFeedback(""), 3500);
      return;
    }

    triggerBeep(500, 0.08, 'sine');
    
    const resolvedType = customType || (customImage ? 'image' : (customVoiceDuration ? 'voice' : 'text'));
    // Message IDs are the actual Firestore document ID in the shared, global
    // direct_messages collection - a bare Date.now() timestamp with no per-sender
    // component can collide between two DIFFERENT people's messages sent in the same
    // millisecond (easy to hit when testing from two devices). A collision means the
    // second write's merge silently blends into the first document, which is how one
    // person's message can end up displaying as sent by someone else. Namespacing by
    // the sender's own uid plus a random suffix makes a collision effectively impossible.
    const msgId = `msg-${auth.currentUser?.uid || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const newMsg: DirectMessage = {
      id: msgId,
      senderId: 'user',
      receiverId: selectedNeighbor.id,
      chatThreadId: selectedNeighbor.id,
      timestamp: new Date().toISOString(),
      type: resolvedType,
      text: resolvedType === 'text' ? inputContent : undefined,
      mediaUrl: customImage || undefined,
      audioDurationSec: customVoiceDuration || undefined,
      fileName: fileName || undefined,
      fileSize: fileSize || undefined,
      status: 'sending' as const,
    };

    if (replyingToMessage) {
      newMsg.replyTo = {
        msgId: replyingToMessage.id,
        text: replyingToMessage.text || (replyingToMessage.type === 'image' ? 'Attached Photo 📸' : replyingToMessage.type === 'voice' ? 'Voice note 🎙️' : 'Shared media file 📁'),
        senderName: replyingToMessage.senderId === 'user' ? 'You' : (selectedNeighbor.isGroup ? (neighbors.find(n => n.id === replyingToMessage.senderId)?.name || 'Member') : selectedNeighbor.name),
        type: replyingToMessage.type
      };
      setReplyingToMessage(null); // clear replying
    }

    _setChatMessages(prev => ({
      ...prev,
      [selectedNeighbor.id]: [...(prev[selectedNeighbor.id] || []), newMsg]
    }));

    if (customText === undefined) {
      setTextInput('');
    }

    const fUser = auth.currentUser;

    setTimeout(async () => {
      const sentMsg = { ...newMsg, status: 'sent' as const };
      
      _setChatMessages(prev => {
        const list = prev[selectedNeighbor.id] || [];
        const idx = list.findIndex(m => m.id === msgId);
        if (idx > -1) {
          const copy = [...list];
          copy[idx] = sentMsg;
          return { ...prev, [selectedNeighbor.id]: copy };
        }
        return prev;
      });

      if (fUser && !selectedNeighbor.id.startsWith('nb-')) {
        const isGroupThread = selectedNeighbor.id.startsWith('group-')
          || selectedNeighbor.id.startsWith('sim-group-')
          || Boolean(selectedNeighbor.isGroup);

        if (isGroupThread) {
          // Group chat isn't supported by the new backend yet (conversations
          // are strictly 1:1) — groups stay on Firestore until that's built.
          await saveOrUpdateMessageInFirestore(sentMsg, selectedNeighbor.id);
        } else {
          try {
            let finalMediaUrl = sentMsg.mediaUrl;
            if (finalMediaUrl && finalMediaUrl.startsWith('data:')) {
              // Same idea as the old uploadToStorage step, but to Cloudinary
              // via our backend's signed-upload flow instead of Firebase
              // Storage — base64 payloads never get pushed through the
              // socket or stored directly in Postgres.
              const blob = await (await fetch(finalMediaUrl)).blob();
              const file = new File([blob], sentMsg.fileName || `chat-media-${Date.now()}`, { type: blob.type });
              finalMediaUrl = await mediaApi.uploadFile(file, `nearby/chat/${sentMsg.type}s`);
            }

            await sendChatMessageViaSocket(selectedNeighbor.id, {
              content: sentMsg.type === 'text' ? sentMsg.text : undefined,
              mediaUrl: finalMediaUrl,
              mediaType: sentMsg.type !== 'text' ? (sentMsg.type as 'image' | 'video' | 'voice' | 'document') : undefined,
              audioDurationSec: sentMsg.audioDurationSec,
              fileName: sentMsg.fileName,
              fileSize: sentMsg.fileSize,
            });
          } catch (e) {
            console.warn('Failed to send message via backend:', e);
            markMessageFailed(selectedNeighbor.id, msgId);
          }
        }
      }

      if (selectedNeighbor.id.startsWith('nb-')) {
        setTimeout(() => {
          _setChatMessages(prev => {
            const list = prev[selectedNeighbor.id] || [];
            const idx = list.findIndex(m => m.id === msgId);
            if (idx > -1) {
              const copy = [...list];
              copy[idx] = { ...sentMsg, status: 'delivered' as const };
              return { ...prev, [selectedNeighbor.id]: copy };
            }
            return prev;
          });

          setTimeout(() => {
            _setChatMessages(prev => {
              const list = prev[selectedNeighbor.id] || [];
              const idx = list.findIndex(m => m.id === msgId);
              if (idx > -1) {
                const copy = [...list];
                copy[idx] = { ...sentMsg, status: 'read' as const };
                return { ...prev, [selectedNeighbor.id]: copy };
              }
              return prev;
            });

            const promptText = resolvedType === 'text' ? inputContent : `[Snap photo sent]`;
            triggerSimulatedResponse(selectedNeighbor.id, promptText, customImage);

          }, 650);
        }, 400);
      }
    }, 150);
  };

  const handleReaction = async (msg: DirectMessage, emoji: string) => {
    const fUser = auth.currentUser;
    const threadId = selectedNeighbor?.id;
    if (!threadId) return;

    const currentUid = fUser ? fUser.uid : 'user';
    const existingReactions = msg.reactions || [];
    const index = existingReactions.findIndex(r => r.userId === currentUid);

    let nextReactions = [...existingReactions];
    if (index > -1) {
      if (existingReactions[index].reaction === emoji) {
        nextReactions.splice(index, 1);
      } else {
        nextReactions[index] = { userId: currentUid, reaction: emoji };
      }
    } else {
      nextReactions.push({ userId: currentUid, reaction: emoji });
    }

    const updatedMsg = { ...msg, reactions: nextReactions };

    _setChatMessages(prev => {
      const list = prev[threadId] || [];
      const idx = list.findIndex(m => m.id === msg.id);
      if (idx > -1) {
        const copy = [...list];
        copy[idx] = updatedMsg;
        return { ...prev, [threadId]: copy };
      }
      return prev;
    });

    if (fUser && !threadId.startsWith('nb-')) {
      await saveOrUpdateMessageInFirestore(updatedMsg, threadId);
    }
    triggerBeep(380, 0.05);
  };

  const handleDeleteForMe = async (msg: DirectMessage) => {
    const fUser = auth.currentUser;
    const threadId = selectedNeighbor?.id;
    if (!threadId) return;

    const currentUid = fUser ? fUser.uid : 'user';
    const deletedForUsers = msg.deletedForUsers || [];
    if (!deletedForUsers.includes(currentUid)) {
      deletedForUsers.push(currentUid);
    }

    const updatedMsg = { ...msg, deletedForUsers };

    _setChatMessages(prev => {
      const list = prev[threadId] || [];
      const idx = list.findIndex(m => m.id === msg.id);
      if (idx > -1) {
        const copy = [...list];
        copy[idx] = updatedMsg;
        return { ...prev, [threadId]: copy };
      }
      return prev;
    });

    if (fUser && !threadId.startsWith('nb-')) {
      await saveOrUpdateMessageInFirestore(updatedMsg, threadId);
    }
    triggerBeep(300, 0.1, 'triangle');
  };

  const handleDeleteForEveryone = async (msg: DirectMessage) => {
    const fUser = auth.currentUser;
    const threadId = selectedNeighbor?.id;
    if (!threadId) return;

    const updatedMsg = { 
      ...msg, 
      text: undefined,
      mediaUrl: undefined,
      fileName: undefined,
      fileSize: undefined,
      audioDurationSec: undefined,
      reactions: [],
      deletedForEveryone: true 
    };

    _setChatMessages(prev => {
      const list = prev[threadId] || [];
      const idx = list.findIndex(m => m.id === msg.id);
      if (idx > -1) {
        const copy = [...list];
        copy[idx] = updatedMsg;
        return { ...prev, [threadId]: copy };
      }
      return prev;
    });

    if (fUser && !threadId.startsWith('nb-')) {
      await saveOrUpdateMessageInFirestore(updatedMsg, threadId);
    }
    triggerBeep(260, 0.15, 'triangle');
  };

  const handleForwardMessage = async (msg: DirectMessage, targetNeighborIds: string[]) => {
    const fUser = auth.currentUser;
    targetNeighborIds.forEach(async (neighId) => {
      const forwardedMsg: DirectMessage = {
        id: `msg-${fUser?.uid || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        senderId: 'user',
        receiverId: neighId,
        chatThreadId: neighId,
        timestamp: new Date().toISOString(),
        type: msg.type,
        text: msg.text,
        mediaUrl: msg.mediaUrl,
        audioDurationSec: msg.audioDurationSec,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        isForwarded: true,
        status: 'sending'
      };

      _setChatMessages(prev => ({
        ...prev,
        [neighId]: [...(prev[neighId] || []), forwardedMsg]
      }));

      setTimeout(async () => {
        const sentMsg = { ...forwardedMsg, status: 'sent' as const };
        
        _setChatMessages(prev => {
          const list = prev[neighId] || [];
          const idx = list.findIndex(m => m.id === forwardedMsg.id);
          if (idx > -1) {
            const copy = [...list];
            copy[idx] = sentMsg;
            return { ...prev, [neighId]: copy };
          }
          return prev;
        });

        if (fUser && !neighId.startsWith('nb-')) {
          await saveOrUpdateMessageInFirestore(sentMsg, neighId);
        }

        if (neighId.startsWith('nb-')) {
          setTimeout(() => {
            _setChatMessages(prev => {
              const list = prev[neighId] || [];
              const idx = list.findIndex(m => m.id === forwardedMsg.id);
              if (idx > -1) {
                const copy = [...list];
                copy[idx] = { ...sentMsg, status: 'delivered' as const };
                return { ...prev, [neighId]: copy };
              }
              return prev;
            });

            setTimeout(() => {
              _setChatMessages(prev => {
                const list = prev[neighId] || [];
                const idx = list.findIndex(m => m.id === forwardedMsg.id);
                if (idx > -1) {
                  const copy = [...list];
                  copy[idx] = { ...sentMsg, status: 'read' as const };
                  return { ...prev, [neighId]: copy };
                }
                return prev;
              });

              triggerSimulatedResponse(neighId, msg.text || "[Shared media attachment]");
            }, 800);
          }, 600);
        }
      }, 150);
    });

    setShowForwardModal(null);
    setAudioFeedback("Message forwarded.");
    setTimeout(() => setAudioFeedback(""), 2200);
  };

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

  const capturePhoto = () => {
    triggerBeep(700, 0.15, 'sine');
    
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      if (videoRef.current && videoRef.current.srcObject) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      } else {
        // Draw elegant placeholder with background and custom filters
        ctx.fillStyle = activeFilter === 'golden' ? '#d97706' : activeFilter === 'spicy' ? '#b91c1c' : '#1e1b4b';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("📸 Nearby Snap Capture", 320, 200);
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText(`Filter applied: ${activeFilter.toUpperCase()}`, 320, 240);
        ctx.fillText("Ready to doodle & send!", 320, 270);
      }
      
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(dataUrl);
      
      // Stop webcam trail
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

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

  // Doodle Drawing Support on Captured Image
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    setIsDrawing(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setCanvasDrawing(canvasRef.current.toDataURL('image/png'));
    }
  };

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

  // -----------------------------------------
  // Real voice recording parameters (Microphone Stream)
  // -----------------------------------------
  const startRecordingVoice = async () => {
    setIsRecordingVoice(true);
    setVoiceDuration(0);
    triggerBeep(440, 0.1, 'sine');
    
    voiceRecorderTimerRef.current = setInterval(() => {
      setVoiceDuration(prev => prev + 1);
    }, 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.start();
    } catch (err) {
      console.warn("Failed recording mic session o:", err);
    }
  };

  const stopAndSendVoice = () => {
    if (voiceRecorderTimerRef.current) {
      clearInterval(voiceRecorderTimerRef.current);
    }
    setIsRecordingVoice(false);
    
    const duration = voiceDuration;
    setVoiceDuration(0);

    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          if (duration >= 1) {
            sendMessage(undefined, base64Audio, duration, 'voice');
          } else {
            triggerBeep(250, 0.2, 'triangle');
          }
        };
        reader.readAsDataURL(audioBlob);
        
        try {
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
        } catch (_) {}
      };
      mediaRecorder.stop();
    } else {
      triggerBeep(250, 0.2, 'triangle');
    }
  };

  const cancelRecordingVoice = () => {
    if (voiceRecorderTimerRef.current) {
      clearInterval(voiceRecorderTimerRef.current);
    }
    setIsRecordingVoice(false);
    setVoiceRecordingLocked(false);
    setVoiceDuration(0);
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = () => {
        try {
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
        } catch (_) {}
      };
      mediaRecorder.stop();
    }
    triggerBeep(250, 0.2, 'triangle');
  };

  // -----------------------------------------
  // Monetization & Subscription Gated Actions
  // -----------------------------------------
  const verifyPremiumSelection = (featureName: string, action: () => void) => {
    action();
  };

  const handleProcessPayment = () => {
    // Enable the subscription instantly
    setIsSubscribed(true);
    setShowPayModal(false);
    triggerBeep(520, 0.15, 'sine');
    
    setAudioFeedback(`🌟 Subscription Active! Unlimited features unlocked!`);
    setTimeout(() => setAudioFeedback(""), 3500);

    // Call execution if we had a pending premium action
    if (pendingPremiumAction) {
      try {
        pendingPremiumAction();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // 1. Group construction logic
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    
    const groupId = `group-${Date.now()}`;
    const newGroupNeighbor: Neighbor = {
      id: groupId,
      name: newGroupName,
      username: newGroupName.toLowerCase().replace(/\s+/g, '_'),
      avatarColor: newGroupColor,
      avatarEmoji: newGroupEmoji || '👥',
      distanceMeters: Math.floor(Math.random() * 200) + 30,
      streetName: "Combined Group Chat Hub",
      bio: newGroupDesc || "General Nigerian locality discussion group",
      interests: ["group-chat", "gist", "nearby-neighbors"],
      publicSnaps: [],
      activeStory: [],
      onlineStatus: 'active',
      latOffset: (Math.random() - 0.5) * 0.005,
      lngOffset: (Math.random() - 0.5) * 0.005,
      isGroup: true,
      groupMembers: ['user', ...newGroupMembers],
      groupCreatedBy: 'user'
    };
    
    // Add neighbor group
    setNeighbors(prev => [newGroupNeighbor, ...prev]);
    
    // Add default welcome messages inside the group message thread
    const initialGroupMsgs: DirectMessage[] = [
      {
        id: `gmsg-welcome-${Date.now()}`,
        senderId: 'system',
        receiverId: groupId,
        type: 'text',
        text: `🇳🇬 Welcome to ${newGroupName}! Group chat was created. Feel free to chat with neighbors!`,
        timestamp: new Date().toISOString()
      }
    ];
    setChatMessages(prev => ({
      ...prev,
      [groupId]: initialGroupMsgs
    }));

    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupMembers([]);
    setShowCreateGroupModal(false);
    
    setAudioFeedback(`Group "${newGroupName}" is ready! 👥`);
    setTimeout(() => setAudioFeedback(""), 3500);
  };

  const handleRateNeighbor = async (neighborId: string, stars: number, review: string = "", meetupId?: string) => {
    if (!currentUser || !appUser) return;

    // 1. Prevent fake ratings (stars must be 1 to 5)
    if (stars < 1 || stars > 5 || !Number.isInteger(stars)) {
      setAudioFeedback("Invalid rating score!");
      triggerBeep(440, 0.2);
      setTimeout(() => setAudioFeedback(""), 3500);
      return;
    }

    // Backend doesn't support self-rating (schedule() rejects it outright) —
    // this was likely a testing convenience in the old app, not a real
    // product feature.
    if (neighborId === appUser.id) {
      setAudioFeedback("You can't rate yourself!");
      triggerBeep(440, 0.2);
      setTimeout(() => setAudioFeedback(""), 3500);
      return;
    }

    // 2. Prevent rating without a completed meetup (must be mutual friend)
    const localNeighbor = neighbors.find(n => n.id === neighborId) || viewingNeighborProfile;
    const isAFriend = friendIds.includes(neighborId) || Boolean(localNeighbor?.isFriend);
    if (!isAFriend) {
      setAudioFeedback("Cannot rate: You must complete a verified meetup first!");
      triggerBeep(440, 0.2);
      setTimeout(() => setAudioFeedback(""), 3500);
      return;
    }

    try {
      // No meetupId means "rate ad-hoc from profile" — auto-create +
      // complete a meetup record to rate against, same effect as the old
      // one-shot Firestore write, just through the real meetup lifecycle
      // instead of skipping it.
      let targetMeetupId = meetupId;
      if (!targetMeetupId) {
        const newMeetup = await meetupsApi.schedule(neighborId);
        targetMeetupId = newMeetup.id;
      }
      await meetupsApi.complete(targetMeetupId);
      await meetupsApi.rate(targetMeetupId, stars, review || undefined);

      // Real aggregate stats from the backend — no more client-computed
      // running average that can drift or race between two raters.
      const stats = await meetupsApi.statsForUser(neighborId);

      setAudioFeedback("You're all set! Rating updated.");
      triggerBeep(580, 0.15);
      setTimeout(() => setAudioFeedback(""), 3000);

      setNeighbors(prev => prev.map(n => {
        if (n.id === neighborId) {
          return {
            ...n,
            ratingsCount: stats.ratingsCount,
            trustScore: stats.averageRating ?? n.trustScore,
            meetupsCompleted: stats.meetupsCompleted,
            meetupHappened: true,
          };
        }
        return n;
      }));

      if (viewingNeighborProfile && viewingNeighborProfile.id === neighborId) {
        setViewingNeighborProfile(prev => prev ? {
          ...prev,
          ratingsCount: stats.ratingsCount,
          trustScore: stats.averageRating ?? prev.trustScore,
          meetupsCompleted: stats.meetupsCompleted,
          meetupHappened: true,
        } : null);
      }

      // Add real-time notifications for Meetup and Rating
      try {
        await createNotification({
          userId: neighborId,
          senderId: currentUser.uid,
          senderName: (userDisplayName || currentUser.displayName || 'A neighbor'),
          type: 'meetup',
          title: 'Meetup Completed',
          message: `Your meetup with ${(userDisplayName || currentUser.displayName || 'A neighbor')} is complete!`
        });

        await createNotification({
          userId: neighborId,
          senderId: currentUser.uid,
          senderName: (userDisplayName || currentUser.displayName || 'A neighbor'),
          type: 'rating',
          title: 'New Rating',
          message: `${(userDisplayName || currentUser.displayName || 'A neighbor')} rated you ${stars} stars!`
        });
      } catch (notifErr) {
        console.warn("Failed to create rating / meetup notifications:", notifErr);
      }
    } catch (err) {
      console.error("Failed to submit rating:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setAudioFeedback(
        msg.toLowerCase().includes('already rated')
          ? "You have already rated this user!"
          : "⚠️ Could not submit rating."
      );
      triggerBeep(440, 0.2);
      setTimeout(() => setAudioFeedback(""), 3500);
    }
  };

  const handleScheduleMeetup = async (neighborId: string, meetingPoint: string, scheduledTime: string, lat: number = 0, lng: number = 0) => {
    if (!currentUser) return;
    try {
      const meetup = await meetupsApi.schedule(neighborId, new Date(scheduledTime).toISOString(), meetingPoint);

      // Send direct message so they see it in their Chat Tab! Goes through
      // the real chat send path now (was a raw Firestore write to a
      // collection chat no longer reads from since the chat migration).
      const formattedTime = new Date(scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      const messageText = `🤝 Let's meet face-to-face! I scheduled a safe meetup at:\n📍 *${meetingPoint}*\n📅 *${formattedTime}*\n\nPlease confirm or open our profile to mark it as completed once we meet!`;
      try {
        await sendChatMessageViaSocket(neighborId, { content: messageText });
      } catch (msgErr) {
        console.warn("Failed to send meetup chat message:", msgErr);
      }

      // Notify other user
      try {
        await createNotification({
          userId: neighborId,
          senderId: currentUser.uid,
          senderName: (userDisplayName || currentUser.displayName || 'A neighbor'),
          type: 'meetup',
          title: 'Meetup Scheduled',
          message: `Scheduled a meetup at ${meetingPoint} on ${formattedTime}`
        });
      } catch (notifErr) {
        console.warn("Failed to notify scheduled meetup:", notifErr);
      }

      setAudioFeedback("You're all set! Meetup is scheduled.");
      triggerBeep(520, 0.15);
      setTimeout(() => setAudioFeedback(""), 3500);
      return meetup;
    } catch (err) {
      console.error("Failed to schedule meetup:", err);
      setAudioFeedback("We couldn't set up the meetup right now. Let's try again.");
      setTimeout(() => setAudioFeedback(""), 3500);
    }
  };

  const handleCancelMeetup = async (meetupId: string) => {
    if (!currentUser) return;
    try {
      await meetupsApi.cancel(meetupId);
      setAudioFeedback("Meetup cancelled.");
      triggerBeep(350, 0.2);
      setTimeout(() => setAudioFeedback(""), 3500);
    } catch (err) {
      console.error("Failed to cancel meetup:", err);
    }
  };

  const handleReportNeighbor = async (neighborId: string, reason: string) => {
    if (!currentUser) return;
    try {
      const result = await reportsApi.create(neighborId, reason);

      setNeighbors(prev => prev.map(n => {
        if (n.id === neighborId) {
          return { ...n, reportsCount: result.reportCount };
        }
        return n;
      }));

      if (viewingNeighborProfile && viewingNeighborProfile.id === neighborId) {
        setViewingNeighborProfile(prev => prev ? {
          ...prev,
          reportsCount: result.reportCount
        } : null);
      }

      triggerBeep(220, 0.2);
      setAudioFeedback(`Report submitted. Reason: ${reason}`);
      setTimeout(() => setAudioFeedback(""), 3000);

      if (result.banned) {
        setNeighbors(prev => prev.filter(n => n.id !== neighborId));
        setViewingNeighborProfile(null);
        setAudioFeedback("User has been banned due to multiple complaints.");
        setTimeout(() => setAudioFeedback(""), 4000);
      }
    } catch (err) {
      console.error("Failed to report user: ", err);
      setAudioFeedback("⚠️ Could not submit report — you may have already reported this user.");
      setTimeout(() => setAudioFeedback(""), 4000);
    }
  };

  // 2. Friend addition limit (free)
  const handleAddNewFriend = (neighborId: string) => {
    actuallyAddFriend(neighborId);
  };

  const handleAcceptFriendRequest = useCallback(async (senderId: string) => {
    if (!currentUser) return;
    const requestId = incomingRequestsByUserIdRef.current[senderId];
    if (!requestId) return; // no matching pending request — nothing to accept

    // ONE write. No optimistic local mutation - useFriendsSync's next poll
    // (or the manual refetchAll below) updates the UI shortly after.
    try {
      await friendsApi.accept(requestId);
      refetchFriends();

      triggerBeep(650, 0.1);
      const requester = neighbors.find(n => n.id === senderId);
      setAudioFeedback(`🎉 You and ${requester ? requester.name : 'your neighbor'} are now friends!`);
      setTimeout(() => setAudioFeedback(""), 2500);

      try {
        await createNotification({
          userId: senderId,
          senderId: currentUser.uid,
          senderName: (userDisplayName || currentUser.displayName || 'A neighbor'),
          type: 'friend_request',
          title: 'Friend Request Accepted',
          message: `${userDisplayName || currentUser.displayName || 'A neighbor'} accepted your friend request!`
        });
      } catch (notifErr) {
        console.warn("Accept notification failed (non-fatal):", notifErr);
      }
    } catch (e) {
      console.error("Accept friend failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      setAudioFeedback(`⚠️ Could not accept: ${msg}`);
      setTimeout(() => setAudioFeedback(""), 5000);
    }
  }, [currentUser, neighbors, triggerBeep, userDisplayName, refetchFriends]);

  const handleDeclineFriendRequest = useCallback(async (senderId: string) => {
    if (!currentUser) return;
    const requestId = incomingRequestsByUserIdRef.current[senderId];
    if (!requestId) return;
    try {
      await friendsApi.decline(requestId);
      refetchFriends();
      triggerBeep(320, 0.1);
      const requester = neighbors.find(n => n.id === senderId);
      setAudioFeedback(`Declined request from ${requester ? requester.name : 'Neighbor'}.`);
      setTimeout(() => setAudioFeedback(""), 2200);
    } catch (e) {
      console.warn("Decline friend failed:", e);
    }
  }, [currentUser, neighbors, triggerBeep, refetchFriends]);

  const actuallyAddFriend = useCallback(async (neighborId: string) => {
    if (!currentUser || neighborId === currentUser.uid) return;

    try {
      // Decide from the CURRENT derived state, same as before — one call,
      // then refetchFriends() reconciles the UI shortly after.
      if (friendIds.includes(neighborId)) {
        await friendsApi.unfriend(neighborId);           // unfriend
        refetchFriends();
        triggerBeep(320, 0.1, 'triangle');
        setAudioFeedback("Removed from friends.");
      } else if (pendingFriendRequests.includes(neighborId)) {
        await handleAcceptFriendRequest(neighborId);            // they asked first
        return;
      } else if (sentFriendRequestIds.includes(neighborId)) {
        await friendsApi.unfriend(neighborId);           // cancel my request (unfriend deletes regardless of status)
        refetchFriends();
        triggerBeep(320, 0.1, 'triangle');
        setAudioFeedback("Connection request cancelled.");
      } else {
        await friendsApi.sendRequest(neighborId);             // send request
        refetchFriends();
        setFriendsAddedTodayCount(prev => prev + 1);
        triggerBeep(480, 0.1, 'sine');
        setAudioFeedback("Connection request sent! 📬");

        try {
          await createNotification({
            userId: neighborId,
            senderId: currentUser.uid,
            senderName: (userDisplayName || currentUser.displayName || 'A neighbor'),
            type: 'friend_request',
            title: 'Friend Request',
            message: `${userDisplayName || currentUser.displayName || 'A neighbor'} sent you a friend request!`
          });
        } catch (notifErr) {
          console.warn("Request notification failed (non-fatal):", notifErr);
        }
      }
      setTimeout(() => setAudioFeedback(""), 2500);
    } catch (err) {
      console.error("Friend action failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setAudioFeedback(`⚠️ Friend action failed: ${msg}`);
      setTimeout(() => setAudioFeedback(""), 5000);
    }
  }, [currentUser, friendIds, pendingFriendRequests, sentFriendRequestIds, triggerBeep, handleAcceptFriendRequest, userDisplayName, refetchFriends]);

  const sendPrivateMessageToNeighbor = useCallback(async (neighborId: string, text: string) => {
    if (!neighborId.startsWith('nb-') && !friendIds.includes(neighborId)) {
      setAudioFeedback("⚠️ You can only message friends. Add them as a friend first.");
      setTimeout(() => setAudioFeedback(""), 3500);
      return;
    }

    const msgId = `msg-${auth.currentUser?.uid || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newMsg: DirectMessage = {
      id: msgId,
      senderId: 'user',
      receiverId: neighborId,
      chatThreadId: neighborId,
      timestamp: new Date().toISOString(),
      type: 'text',
      text: text,
      status: 'sending'
    };

    _setChatMessages(prev => {
      const existing = prev[neighborId] || [];
      return { ...prev, [neighborId]: [...existing, newMsg] };
    });

    try {
      await saveOrUpdateMessageInFirestore(newMsg, neighborId);
    } catch (e) {
      console.warn("Offline fallback registered or direct message stored locally.");
    }
  }, [friendIds]);

  const onOpenNeighborChat = useCallback((neighborId: string) => {
    const nb = neighbors.find(n => n.id === neighborId);
    if (nb) {
      setSelectedNeighbor(nb);
      setActiveTab('chat');
    }
  }, [neighbors]);

  // 3. Pinning control (free)
  const handleTogglePinChat = (neighborId: string) => {
    actuallyPinChat(neighborId);
  };

  const actuallyPinChat = (neighborId: string) => {
    setNeighbors(prev => prev.map(n => {
      if (n.id === neighborId) {
        const pinState = !n.pinned;
        return {
          ...n,
          pinned: pinState,
          pinTime: pinState ? Date.now() : undefined
        };
      }
      return n;
    }));
    triggerBeep(500, 0.08, 'sine');
  };

  const handleToggleArchiveChat = (neighborId: string) => {
    setArchivedNeighborIds(prev => {
      const isArchived = prev.includes(neighborId);
      if (isArchived) {
        setAudioFeedback("Chat unarchived.");
        return prev.filter(id => id !== neighborId);
      } else {
        setAudioFeedback("Chat archived.");
        return [...prev, neighborId];
      }
    });
    setTimeout(() => setAudioFeedback(""), 2200);
    triggerBeep(480, 0.08, 'sine');
  };

  // Redesigned Direct Messaging action helpers
  const handleToggleBlockNeighbor = (neighborId: string) => {
    setBlockedNeighborIds(prev => {
      const isBlocked = prev.includes(neighborId);
      let next;
      if (isBlocked) {
        next = prev.filter(id => id !== neighborId);
        setAudioFeedback("User unblocked.");
      } else {
        next = [...prev, neighborId];
        setAudioFeedback("User blocked.");
      }
      localStorage.setItem('whatsapp_blocked_neighbors', JSON.stringify(next));
      return next;
    });
    triggerBeep(380, 0.08);
  };

  const handleToggleMuteNeighbor = (neighborId: string) => {
    setMutedNeighborIds(prev => {
      const isMuted = prev.includes(neighborId);
      let next;
      if (isMuted) {
        next = prev.filter(id => id !== neighborId);
        setAudioFeedback("Notifications unmuted.");
      } else {
        next = [...prev, neighborId];
        setAudioFeedback("Notifications muted.");
      }
      localStorage.setItem('whatsapp_muted_neighbors', JSON.stringify(next));
      return next;
    });
    triggerBeep(380, 0.08);
  };

  const handleToggleUnreadNeighbor = (neighborId: string) => {
    setUnreadNeighborIds(prev => {
      const isUnread = prev.includes(neighborId);
      let next;
      if (isUnread) {
        next = prev.filter(id => id !== neighborId);
        setAudioFeedback("Marked as read.");
      } else {
        next = [...prev, neighborId];
        setAudioFeedback("Marked as unread.");
      }
      localStorage.setItem('whatsapp_unread_neighbors', JSON.stringify(next));
      return next;
    });
    triggerBeep(380, 0.08);
  };

  const handleDeleteChat = (neighborId: string) => {
    _setChatMessages(prev => {
      const copy = { ...prev };
      delete copy[neighborId];
      return copy;
    });
    setAudioFeedback("Chat conversation deleted.");
    triggerBeep(330, 0.08);
  };

  const handleExportChat = (neighbor: Neighbor) => {
    const messages = chatMessages[neighbor.id] || [];
    if (messages.length === 0) {
      setAudioFeedback("No messages to export.");
      return;
    }
    const lines = messages.map(msg => {
      const time = new Date(msg.timestamp).toLocaleString();
      const sender = msg.senderId === 'user' ? 'You' : neighbor.name;
      const text = msg.text || `[Media: ${msg.type}]`;
      return `[${time}] ${sender}: ${text}`;
    });
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat_with_${neighbor.username || neighbor.name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAudioFeedback("Chat exported.");
    triggerBeep(450, 0.08);
  };

  const handleEditMessage = async (msgId: string, newText: string) => {
    if (!selectedNeighbor) return;
    _setChatMessages(prev => {
      const list = prev[selectedNeighbor.id] || [];
      const idx = list.findIndex(m => m.id === msgId);
      if (idx > -1) {
        const copy = [...list];
        const updated = { ...copy[idx], text: newText, isEdited: true };
        copy[idx] = updated;
        const fUser = auth.currentUser;
        if (fUser && !selectedNeighbor.id.startsWith('nb-')) {
          saveOrUpdateMessageInFirestore(updated, selectedNeighbor.id);
        }
        return { ...prev, [selectedNeighbor.id]: copy };
      }
      return prev;
    });
    setEditingMessage(null);
    setAudioFeedback("Message edited.");
    triggerBeep(420, 0.08);
  };

  const handleToggleStarMessage = (msg: DirectMessage) => {
    if (!selectedNeighbor) return;
    _setChatMessages(prev => {
      const list = prev[selectedNeighbor.id] || [];
      const idx = list.findIndex(m => m.id === msg.id);
      if (idx > -1) {
        const copy = [...list];
        const updated = { ...copy[idx], isStarred: !copy[idx].isStarred };
        copy[idx] = updated;
        const fUser = auth.currentUser;
        if (fUser && !selectedNeighbor.id.startsWith('nb-')) {
          saveOrUpdateMessageInFirestore(updated, selectedNeighbor.id);
        }
        setAudioFeedback(updated.isStarred ? "Message starred." : "Message unstarred.");
        return { ...prev, [selectedNeighbor.id]: copy };
      }
      return prev;
    });
    triggerBeep(450, 0.05);
  };

  const handleBulkDeleteMessages = () => {
    if (!selectedNeighbor || selectedMessageIds.length === 0) return;
    const currentUid = currentUser?.uid || 'user';
    _setChatMessages(prev => {
      const list = prev[selectedNeighbor.id] || [];
      const copy = list.map(msg => {
        if (selectedMessageIds.includes(msg.id)) {
          const deletedUsers = msg.deletedForUsers || [];
          const updated = { ...msg, deletedForUsers: [...deletedUsers, currentUid] };
          const fUser = auth.currentUser;
          if (fUser && !selectedNeighbor.id.startsWith('nb-')) {
            saveOrUpdateMessageInFirestore(updated, selectedNeighbor.id);
          }
          return updated;
        }
        return msg;
      });
      return { ...prev, [selectedNeighbor.id]: copy };
    });
    setSelectedMessageIds([]);
    setIsMessageSelectMode(false);
    setAudioFeedback("Messages deleted.");
    triggerBeep(330, 0.08);
  };

  const handleBulkForwardMessages = (targetNeighbor: Neighbor) => {
    if (!selectedNeighbor || selectedMessageIds.length === 0) return;
    const list = chatMessages[selectedNeighbor.id] || [];
    const messagesToForward = list.filter(msg => selectedMessageIds.includes(msg.id));
    
    messagesToForward.forEach((msg, index) => {
      setTimeout(() => {
        const msgId = `msg-forwarded-${auth.currentUser?.uid || 'anon'}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;
        const forwardedMsg: DirectMessage = {
          id: msgId,
          senderId: 'user',
          receiverId: targetNeighbor.id,
          chatThreadId: targetNeighbor.id,
          timestamp: new Date().toISOString(),
          type: msg.type,
          text: msg.text,
          mediaUrl: msg.mediaUrl,
          audioDurationSec: msg.audioDurationSec,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          isForwarded: true,
          status: 'sent' as const
        };
        
        _setChatMessages(prev => ({
          ...prev,
          [targetNeighbor.id]: [...(prev[targetNeighbor.id] || []), forwardedMsg]
        }));
        
        const fUser = auth.currentUser;
        if (fUser && !targetNeighbor.id.startsWith('nb-')) {
          saveOrUpdateMessageInFirestore(forwardedMsg, targetNeighbor.id);
        }
      }, index * 200);
    });
    
    setSelectedMessageIds([]);
    setIsMessageSelectMode(false);
    setAudioFeedback(`Forwarded ${messagesToForward.length} messages to ${targetNeighbor.name}.`);
    triggerBeep(450, 0.08);
  };

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

  const executeContactsSyncAfterPermission = async () => {
    setIsRequestingContacts(true);
    setAudioFeedback("⚡ Accessing device address book...");
    
    // Check if Contact Picker API is supported in this browser
    const isSupported = ('contacts' in navigator && typeof (navigator as any).contacts.select === 'function');
    
    try {
      let contactsToSync = [];
      if (isSupported) {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        const selectedContacts = await (navigator as any).contacts.select(props, opts);
        if (selectedContacts && selectedContacts.length > 0) {
          contactsToSync = selectedContacts.map((c: any) => ({
            name: c.name?.[0] || 'Unknown',
            phone: c.tel?.[0] || '',
            nearby: Math.random() > 0.4
          }));
        }
      }
      
      // Fallback or complete with high-fidelity local contact synchronization
      if (contactsToSync.length === 0) {
        contactsToSync = [
          { name: "Sade Bello", phone: "08031234567", nearby: true },
          { name: "Chidi Okafor", phone: "08149876543", nearby: true },
          { name: "Ifeoluwa Osun", phone: "07055551234", nearby: false },
          { name: "Yusuf Alabi", phone: "09023334445", nearby: true },
          { name: "Amaka Eze", phone: "08064445556", nearby: false }
        ];
      }

      let updated: Array<{ name: string; phone: string; nearby: boolean }> = [];
      setContactsList(prev => {
        const existing = [...prev];
        contactsToSync.forEach((pc: any) => {
          if (!existing.some(ec => ec.phone === pc.phone)) {
            existing.unshift(pc);
          }
        });
        updated = existing;
        return existing;
      });
      
      if (updated.length > 0) {
        await saveContactsToFirestore(updated);
      }
      setAudioFeedback(`✓ Synchronized ${contactsToSync.length} contacts!`);
    } catch (err) {
      console.warn("Contact picker failed, running fallback sync:", err);
      const fallbackContacts = [
        { name: "Sade Bello", phone: "08031234567", nearby: true },
        { name: "Chidi Okafor", phone: "08149876543", nearby: true },
        { name: "Ifeoluwa Osun", phone: "07055551234", nearby: false },
        { name: "Yusuf Alabi", phone: "09023334445", nearby: true },
        { name: "Amaka Eze", phone: "08064445556", nearby: false }
      ];
      setContactsList(prev => {
        const existing = [...prev];
        fallbackContacts.forEach(pc => {
          if (!existing.some(ec => ec.phone === pc.phone)) {
            existing.unshift(pc);
          }
        });
        saveContactsToFirestore(existing);
        return existing;
      });
      setAudioFeedback("Contacts are in sync!");
    }
    
    setTimeout(() => {
      setIsRequestingContacts(false);
      setAudioFeedback("");
    }, 2500);
  };



  // -----------------------------------------
  // Custom Notes Gist Status Actions
  // -----------------------------------------
  const handleAddMyNote = () => {
    if (!userNoteText.trim()) return;
    triggerBeep(520, 0.1, 'sine');
    
    const exists = activeNotes.some(n => n.id === 'user-note-me');
    let updatedNotes;
    if (exists) {
      updatedNotes = activeNotes.map(n => {
        if (n.id === 'user-note-me') {
          return { ...n, text: userNoteText };
        }
        return n;
      });
    } else {
      updatedNotes = [
        {
          id: 'user-note-me',
          name: 'Your note',
          avatarColor: 'bg-neutral-800 border border-neutral-700',
          avatarEmoji: '🙋‍♂️',
          text: userNoteText
        },
        ...activeNotes
      ];
    }
    setActiveNotes(updatedNotes);
    setUserNoteText('');
    setShowNoteModal(false);
  };

  // -----------------------------------------
  // Playlist Player Launcher with Auto-advance Looping o!
  // -----------------------------------------
  const startStoryPlaylist = (startNeighborId?: string) => {
    const playlist: any[] = [];

    // 1. Add my active story if exists!
    if (myUploadedStory) {
      playlist.push({
        id: "user-me",
        neighborId: "me",
        name: "Your Story",
        avatarColor: "bg-neutral-800 border border-neutral-700",
        avatarEmoji: "🙋‍♂️",
        mediaUrl: myUploadedStory.mediaUrl,
        caption: myUploadedStory.caption,
        type: "image"
      });
    }

    // 2. Add neighbors' active stories o!
    neighbors.forEach(nb => {
      if (nb.activeStory && nb.activeStory.length > 0) {
        nb.activeStory.forEach(story => {
          playlist.push({
            id: story.id,
            neighborId: nb.id,
            name: nb.name,
            avatarColor: nb.avatarColor,
            avatarEmoji: nb.avatarEmoji,
            mediaUrl: story.mediaUrl,
            caption: story.caption,
            type: story.type || "image"
          });
        });
      }
    });

    if (playlist.length > 0) {
      let startIndex = 0;
      if (startNeighborId) {
        const idx = playlist.findIndex(p => p.neighborId === startNeighborId);
        if (idx !== -1) startIndex = idx;
      }
      
      setStoryPlaylist(playlist);
      setStoryPlaylistIndex(startIndex);
      const startItem = playlist[startIndex];
      const startViewerTarget = startItem.neighborId === 'me' ? 'me' : neighbors.find(n => n.id === startItem.neighborId) || null;
      setStoryViewer(startViewerTarget);
    } else {
      setAudioFeedback("No updates available.");
      setTimeout(() => setAudioFeedback(""), 2500);
    }
  };

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

  const theme = appTheme === 'dark' ? {
    // ----------------- DARK MODE -----------------
    // Backgrounds
    appBg: 'bg-[#111315] text-[#FFFFFF] border-[#2A2D31] shadow-soft-lg',
    contentBg: 'bg-[#111315]',
    tabContentBg: 'bg-[#111315]',
    innerBg: 'bg-[#111315]',
    
    // Header & Navigation Bars
    headerBg: 'bg-[#1A1C1F] border-b border-[#2A2D31]/40 text-[#FFFFFF]',
    navBg: 'bg-[#1A1C1F] border-[#2A2D31]/40',
    navButtonActive: 'text-[#0F8A5F] bg-[#111315]/80 font-semibold shadow-soft-sm scale-[1.02]',
    navButtonInactive: 'text-[#9CA3AF] hover:text-[#FFFFFF]',
    
    // Cards & Lists
    cardBg: 'bg-[#1A1C1F] border-[#2A2D31]/40 rounded-[22px]',
    cardBorder: 'border-[#2A2D31]/40',
    cardInner: 'bg-[#111315]/60',
    listItemBg: 'bg-[#1A1C1F] border-[#2A2D31]/40 hover:bg-[#1A1C1F]/80 rounded-[22px]',
    itemBtn: 'bg-[#0F8A5F] hover:bg-[#0C7A53] text-[#FFFFFF] font-semibold h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    
    // Typography
    textTitle: 'text-[#FFFFFF] font-display font-bold tracking-tight',
    textMain: 'text-[#FFFFFF] font-sans',
    textMuted: 'text-[#9CA3AF] font-sans',
    textHighlight: 'text-[#2563EB] font-bold',
    textAccent: 'text-[#0F8A5F]',
    textAccentMuted: 'text-[#0F8A5F]/80',
    
    // Inputs & Forms
    inputBg: 'bg-[#111315] text-[#FFFFFF] border-[#2A2D31] focus-within:border-[#0F8A5F] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    inputTextBg: 'bg-[#111315] text-[#FFFFFF] border-[#2A2D31] focus-within:border-[#0F8A5F] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    bubbleUser: 'bg-[#0F8A5F] text-[#FFFFFF] shadow-soft-sm font-sans rounded-[18px]',
    bubbleNeighbor: 'bg-[#1A1C1F] text-[#FFFFFF] shadow-soft-sm font-sans rounded-[18px] border border-[#2A2D31]/40',
    suggestBtn: 'bg-[#1A1C1F] hover:bg-[#1A1C1F]/80 text-[#FFFFFF] border border-[#2A2D31]/40 h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    notesBg: 'bg-[#111315]',
  } : {
    // ----------------- LIGHT MODE -----------------
    // Backgrounds
    appBg: 'bg-[#F7F8FA] text-[#161616] border-[#ECECEC] shadow-soft-lg',
    contentBg: 'bg-[#F7F8FA]',
    tabContentBg: 'bg-[#F7F8FA]',
    innerBg: 'bg-[#F7F8FA]',
    
    // Header & Navigation Bars
    headerBg: 'bg-[#FFFFFF] border-b border-[#ECECEC] text-[#161616]',
    navBg: 'bg-[#FFFFFF] border-[#ECECEC]',
    navButtonActive: 'text-[#0F8A5F] bg-[#F7F8FA] font-semibold shadow-soft-sm border border-[#ECECEC] scale-[1.02]',
    navButtonInactive: 'text-[#6E6E73] hover:text-[#161616]',
    
    // Cards & Lists
    cardBg: 'bg-[#FFFFFF] border-[#ECECEC] rounded-[22px]',
    cardBorder: 'border-[#ECECEC]',
    cardInner: 'bg-[#F7F8FA]',
    listItemBg: 'bg-[#FFFFFF] border-[#ECECEC] hover:bg-[#F7F8FA] rounded-[22px]',
    itemBtn: 'bg-[#0F8A5F] hover:bg-[#0C7A53] text-[#FFFFFF] font-semibold h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    
    // Typography
    textTitle: 'text-[#161616] font-display font-bold tracking-tight',
    textMain: 'text-[#161616] font-sans',
    textMuted: 'text-[#6E6E73] font-sans',
    textHighlight: 'text-[#2563EB] font-bold',
    textAccent: 'text-[#0F8A5F]',
    textAccentMuted: 'text-[#0F8A5F]/80',
    
    // Inputs & Forms
    inputBg: 'bg-[#FFFFFF] text-[#161616] border-[#ECECEC] focus-within:border-[#0F8A5F] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    inputTextBg: 'bg-[#FFFFFF] text-[#161616] border-[#ECECEC] focus-within:border-[#0F8A5F] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    bubbleUser: 'bg-[#DDF7EC] text-[#161616] shadow-soft-sm font-sans rounded-[18px] border border-[#0F8A5F]/20',
    bubbleNeighbor: 'bg-[#FFFFFF] text-[#161616] shadow-soft-sm font-sans rounded-[18px] border border-[#ECECEC]',
    suggestBtn: 'bg-[#FFFFFF] hover:bg-[#DDF7EC] text-[#161616] border border-[#ECECEC] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    notesBg: 'bg-[#FFFFFF]',
  };

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
  const sortedChatList = useMemo(() => {
    const sortedList = [...filteredNeighbors].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.pinned && b.pinned) {
        return (b.pinTime || 0) - (a.pinTime || 0);
      }
      return 0;
    });

    let displayList = sortedList.filter(n => {
      if (!searchWideSop) return true;
      return n.name.toLowerCase().includes(searchWideSop.toLowerCase()) || 
             n.username.toLowerCase().includes(searchWideSop.toLowerCase());
    });

    if (showArchivedOnly) {
      displayList = displayList.filter(nb => archivedNeighborIds.includes(nb.id));
    } else {
      displayList = displayList.filter(nb => !archivedNeighborIds.includes(nb.id));
    }

    displayList = displayList.filter(nb => {
      const msgs = chatMessages[nb.id] || [];
      if (msgs.length === 0) return true;
      
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.timestamp) {
        const msgTime = new Date(lastMsg.timestamp).getTime();
        const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
        const ageMs = Date.now() - msgTime;
        
        if (ageMs > twoWeeksMs && !nb.meetupHappened) {
          return false;
        }
      }
      return true;
    });

    if (chatFilter === 'unread') {
      displayList = displayList.filter(nb => {
        const msgs = chatMessages[nb.id] || [];
        const hasUnreadMsgs = msgs.some(m => m.isUnread === true);
        return hasUnreadMsgs || nb.id === 'nb-1' || nb.id === 'nb-3';
      });
    } else if (chatFilter === 'favorites') {
      displayList = displayList.filter(nb => nb.pinned);
    }
    return displayList;
  }, [filteredNeighbors, searchWideSop, showArchivedOnly, archivedNeighborIds, chatMessages, chatFilter]);


  return {
    hasSavedAccountOnDisk,
    chatUnreadCounts,
    totalUnreadMessages,
    activeTab,
    setActiveTab,
    selectedPreset,
    setSelectedPreset,
    lastLocationWriteRef,
    lastLiveLocationWriteTimeRef,
    calculateHaversineDistance,
    updatePresetWithCoordinates,
    updateRadarPresenceInFirestore,
    onboardingCoords,
    setOnboardingCoords,
    onboardingAddress,
    setOnboardingAddress,
    onboardingState,
    setOnboardingState,
    onboardingStreetName,
    setOnboardingStreetName,
    neighbors,
    setNeighbors,
    selectedNeighborState,
    setSelectedNeighbor,
    presenceMap,
    setPresenceMap,
    syncedNeighbors,
    selectedNeighbor,
    selectedNeighborId,
    chatLimit,
    setChatLimit,
    activeNotes,
    setActiveNotes,
    searchWideSop,
    setSearchWideSop,
    chatSubTab,
    setChatSubTab,
    chatFilter,
    setChatFilter,
    pendingFriendRequests,
    setPendingFriendRequests,
    sentFriendRequestIds,
    setSentFriendRequestIds,
    showPremiumModal,
    setShowPremiumModal,
    showFriendsModal,
    setShowFriendsModal,
    showNeighborFriendsModal,
    setShowNeighborFriendsModal,
    showNotificationsModal,
    setShowNotificationsModal,
    exploreSubTab,
    setExploreSubTab,
    isCurrentMeBanned,
    setIsCurrentMeBanned,
    showLandingMode,
    setShowLandingMode,
    myVerificationLevel,
    setMyVerificationLevel,
    showVerificationModal,
    setShowVerificationModal,
    isScanningFace,
    setIsScanningFace,
    scanCountdown,
    setScanCountdown,
    showContactsModal,
    setShowContactsModal,
    showContactsPermissionPrompt,
    setShowContactsPermissionPrompt,
    newContactName,
    setNewContactName,
    newContactPhone,
    setNewContactPhone,
    showAddContactForm,
    setShowAddContactForm,
    topNotification,
    setTopNotification,
    chatNotification,
    setChatNotification,
    notifications,
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
    showNewChatDrawer,
    setShowNewChatDrawer,
    initialProfile,
    showInstagramProfile,
    setShowInstagramProfile,
    isProfileLoaded,
    setIsProfileLoaded,
    userDisplayName,
    setUserDisplayName,
    userUsername,
    setUserUsername,
    userBio,
    setUserBio,
    userWebsite,
    setUserWebsite,
    userAgeRange,
    setUserAgeRange,
    userGender,
    setUserGender,
    userInterests,
    setUserInterests,
    userCommunities,
    setUserCommunities,
    appLanguage,
    setAppLanguage,
    showLanguageModal,
    setShowLanguageModal,
    showInviteModal,
    setShowInviteModal,
    contactsList,
    setContactsList,
    isRequestingContacts,
    setIsRequestingContacts,
    showNearbyNotification,
    setShowNearbyNotification,
    nearbyNotificationCount,
    setNearbyNotificationCount,
    showHelpModal,
    setShowHelpModal,
    helpEmail,
    setHelpEmail,
    helpCategory,
    setHelpCategory,
    helpMessage,
    setHelpMessage,
    showAccountModal,
    setShowAccountModal,
    showPrivacyModal,
    setShowPrivacyModal,
    showChatsConfigModal,
    setShowChatsConfigModal,
    userTelephone,
    setUserTelephone,
    privacyDisappearing,
    setPrivacyDisappearing,
    viewingNeighborProfile,
    setViewingNeighborProfile,
    showEditProfileModal,
    setShowEditProfileModal,
    customProfilePhoto,
    setCustomProfilePhoto,
    viewingUserPostDetail,
    setViewingUserPostDetail,
    neighborPosts,
    setNeighborPosts,
    neighborHighlights,
    setNeighborHighlights,
    userStatusText,
    setUserStatusText,
    userPosts,
    setUserPosts,
    userHighlights,
    setUserHighlights,
    userFollowers,
    setUserFollowers,
    userFollowing,
    setUserFollowing,
    userFollowersCount,
    setUserFollowersCount,
    userFollowingCount,
    setUserFollowingCount,
    userTrustScore,
    setUserTrustScore,
    userMeetupCount,
    setUserMeetupCount,
    meetups,
    setMeetups,
    meetupRatings,
    setMeetupRatings,
    showScheduleMeetupModal,
    setShowScheduleMeetupModal,
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
    showInlineRatingForm,
    setShowInlineRatingForm,
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
    privacyLocationVisibility,
    setPrivacyLocationVisibility,
    privacyReadReceipts,
    setPrivacyReadReceipts,
    privacyTrustedOnly,
    setPrivacyTrustedOnly,
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
    aboutDetailModal,
    setAboutDetailModal,
    confirmDeleteAccount,
    setConfirmDeleteAccount,
    handleGalleryUploadForStory,
    handlePublishStoryComposition,
    handleGalleryUploadForChat,
    handleGalleryUploadForProfilePic,
    handleGalleryUploadForPost,
    chatMessages,
    _setChatMessages,
    setChatMessages,
    currentUser,
    setCurrentUser,
    authLoading,
    setAuthLoading,
    isSplashActive,
    setIsSplashActive,
    showWelcomeTour,
    setShowWelcomeTour,
    welcomeTourStep,
    setWelcomeTourStep,
    authScreenState,
    setAuthScreenState,
    authSuccess,
    setAuthSuccess,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    showOnboarding,
    setShowOnboarding,
    onboardingStep,
    setOnboardingStep,
    onboardingName,
    setOnboardingName,
    onboardingUsername,
    setOnboardingUsername,
    onboardingBio,
    setOnboardingBio,
    onboardingPhoto,
    setOnboardingPhoto,
    onboardingAgeRange,
    setOnboardingAgeRange,
    onboardingGender,
    setOnboardingGender,
    onboardingInterests,
    setOnboardingInterests,
    onboardingCommunities,
    setOnboardingCommunities,
    authEmailOrPhone,
    setAuthEmailOrPhone,
    authPassword,
    setAuthPassword,
    authConfirmPassword,
    setAuthConfirmPassword,
    authIsSignUp,
    setAuthIsSignUp,
    isPhoneAuthOption,
    setIsPhoneAuthOption,
    authError,
    setAuthError,
    onboardingGpsStatus,
    setOnboardingGpsStatus,
    onboardingCamStatus,
    setOnboardingCamStatus,
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
    userNoteText,
    setUserNoteText,
    showNoteModal,
    setShowNoteModal,
    radarRadius,
    setRadarRadius,
    showRadarDrawer,
    setShowRadarDrawer,
    showFloatingSearch,
    setShowFloatingSearch,
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
    customAccentColor,
    setCustomAccentColor,
    customChatBg,
    setCustomChatBg,
    customChatBubbleStyle,
    setCustomChatBubbleStyle,
    customChatFont,
    setCustomChatFont,
    userGroupInvitePolicy,
    setUserGroupInvitePolicy,
    userGroupCallPolicy,
    setUserGroupCallPolicy,
    friendIds,
    setFriendIds,
    isUserVisibleOnRadar,
    setIsUserVisibleOnRadar,
    showMainMenuDropdown,
    setShowMainMenuDropdown,
    showActiveChatDropdown,
    setShowActiveChatDropdown,
    showActiveChatMoreDropdown,
    setShowActiveChatMoreDropdown,
    radarVisibilityMode,
    setRadarVisibilityMode,
    userRadarEmoji,
    setUserRadarEmoji,
    userRadarStatusText,
    setUserRadarStatusText,
    showCreateGroupModal,
    setShowCreateGroupModal,
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
    showGroupInviteConfirmModal,
    setShowGroupInviteConfirmModal,
    pendingIncomingInviteGroup,
    setPendingIncomingInviteGroup,
    showGroupCallConfirmModal,
    setShowGroupCallConfirmModal,
    pendingIncomingCall,
    setPendingIncomingCall,
    appTheme,
    setAppTheme,
    userCoords,
    setUserCoords,
    gpsSynced,
    setGpsSynced,
    userAddress,
    setUserAddress,
    searchStateQuery,
    setSearchStateQuery,
    showStateSearchModal,
    setShowStateSearchModal,
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
    showPhotoMenu,
    setShowPhotoMenu,
    cameraActive,
    setCameraActive,
    capturedImage,
    setCapturedImage,
    activeFilter,
    setActiveFilter,
    canvasDrawing,
    setCanvasDrawing,
    photoCaption,
    setPhotoCaption,
    isDrawing,
    setIsDrawing,
    brushColor,
    setBrushColor,
    myUploadedStory,
    setMyUploadedStory,
    myStorySnaps,
    setMyStorySnaps,
    neighborStories,
    setNeighborStories,
    mutedStoryUserIds,
    setMutedStoryUserIds,
    toggleMuteNeighborStories,
    storyUploadData,
    setStoryUploadData,
    storyCompositionCaption,
    setStoryCompositionCaption,
    storyCompositionPrivacy,
    setStoryCompositionPrivacy,
    storyCompositionCustomList,
    setStoryCompositionCustomList,
    isPublishingStory,
    setIsPublishingStory,
    playingStorySnaps,
    setPlayingStorySnaps,
    playingSnapIndex,
    setPlayingSnapIndex,
    isStoryPaused,
    setIsStoryPaused,
    storyViewerReplies,
    setStoryViewerReplies,
    showStoryViewerList,
    setShowStoryViewerList,
    isMutedStoriesExpanded,
    setIsMutedStoriesExpanded,
    storyViewer,
    setStoryViewer,
    storyPlaylist,
    setStoryPlaylist,
    storyPlaylistIndex,
    setStoryPlaylistIndex,
    showStoryChoiceModal,
    setShowStoryChoiceModal,
    showAddFriendsModal,
    setShowAddFriendsModal,
    audioFeedback,
    setAudioFeedback,
    firestoreQuotaExceeded,
    setFirestoreQuotaExceeded,
    googleBillingError,
    setGoogleBillingError,
    dismissedIframeWarning,
    setDismissedIframeWarning,
    replyingToMessage,
    setReplyingToMessage,
    activeChatSearchQuery,
    setActiveChatSearchQuery,
    showActiveChatSearch,
    setShowActiveChatSearch,
    showForwardModal,
    setShowForwardModal,
    simulatedTypingMap,
    setSimulatedTypingMap,
    blockedNeighborIds,
    setBlockedNeighborIds,
    mutedNeighborIds,
    setMutedNeighborIds,
    unreadNeighborIds,
    setUnreadNeighborIds,
    longPressedNeighborForMenu,
    setLongPressedNeighborForMenu,
    showEmojiPicker,
    setShowEmojiPicker,
    emojiCategory,
    setEmojiCategory,
    emojiSearchQuery,
    setEmojiSearchQuery,
    recentlyUsedEmojis,
    setRecentlyUsedEmojis,
    selectedSkinTone,
    setSelectedSkinTone,
    isLockVoiceRecording,
    setIsLockVoiceRecording,
    voicePlaybackSpeedMap,
    setVoicePlaybackSpeedMap,
    showMediaGalleryModal,
    setShowMediaGalleryModal,
    activeMediaGalleryTab,
    setActiveMediaGalleryTab,
    currentSearchMatchIndex,
    setCurrentSearchMatchIndex,
    searchMatchIds,
    setSearchMatchIds,
    isMessageSelectMode,
    setIsMessageSelectMode,
    selectedMessageIds,
    setSelectedMessageIds,
    editingMessage,
    setEditingMessage,
    showMessageInfoModal,
    setShowMessageInfoModal,
    archivedNeighborIds,
    setArchivedNeighborIds,
    showArchivedOnly,
    setShowArchivedOnly,
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
    handleMessageTouchEnd,
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
    loginWithGoogle,
    loginWithEmailOrPhone,
    saveOnboardingDetails,
    logoutUser,
    loadLocalAccountsFromDisk,
    scrollToLastMessage,
    saveOrUpdateMessageInFirestore,
    markMessagesAsRead,
    handleMarkAllNotificationsRead,
    handleClearAllNotifications,
    handleDeleteNotification,
    handleToggleReadNotification,
    getGroupedNotifications,
    neighborStoryUnsubsRef,
    videoRef,
    canvasRef,
    audioContextRef,
    callTimerRef,
    voiceRecorderTimerRef,
    storyProgress,
    setStoryProgress,
    markStoryAsViewedInFirestore,
    handleStoryViewerNext,
    handleStoryViewerPrev,
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
    handleCreateGroup,
    handleRateNeighbor,
    handleScheduleMeetup,
    handleCancelMeetup,
    handleReportNeighbor,
    handleAddNewFriend,
    handleAcceptFriendRequest,
    actuallyAddFriend,
    sendPrivateMessageToNeighbor,
    onOpenNeighborChat,
    handleDeclineFriendRequest,
    handleTogglePinChat,
    actuallyPinChat,
    handleToggleArchiveChat,
    handleToggleBlockNeighbor,
    handleToggleMuteNeighbor,
    handleToggleUnreadNeighbor,
    handleDeleteChat,
    handleExportChat,
    handleEditMessage,
    handleToggleStarMessage,
    handleBulkDeleteMessages,
    handleBulkForwardMessages,
    saveContactsToFirestore,
    handleSyncContacts,
    executeContactsSyncAfterPermission,
    handleAddMyNote,
    startStoryPlaylist,
    formatStreetName,
    formatDistanceMeters,
    getAccentBg,
    getAccentText,
    getAccentBorder,
    theme,
    filteredNeighbors,
    sortedChatList,
  };
}

export type NearbyRuntime = ReturnType<typeof useNearbyController>;
