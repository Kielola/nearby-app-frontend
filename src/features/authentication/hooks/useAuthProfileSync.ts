import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  db,
  deleteDoc,
  doc,
  getDoc,
} from '../../../firebase';
import type { StorySnap } from '../../../types';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { loadLocalAccountsFromDisk } from '../services/savedAccounts';


/**
 * Signs the session in and out, and hydrates the profile that comes with it.
 *
 * ## Why this was extracted
 *
 * This was a single ~320-line `useEffect` sitting in the middle of
 * `useNearbyController`. It was the largest block in that file and the hardest
 * to reason about, because everything it touched was in scope by closure — you
 * could not tell what it depended on without reading all of it.
 *
 * ## What it does
 *
 * `onAuthStateChanged` fires once on load with the restored session and again on
 * every sign-in and sign-out. This hook:
 *
 *   - applies the stored profile to local state (`applyProfileData`), which is
 *     why it has so many setters: the profile is spread across a few dozen
 *     independent pieces of UI state;
 *   - provisions the Postgres row on a brand new account, via
 *     `persistProfileToBackend`;
 *   - attempts a silent re-login for a returning device, guarded by
 *     `autoLoginAttemptedRef` so a failure cannot loop.
 *
 * ## About the dependency list
 *
 * It is long, and that is an honest measurement rather than a design goal — this
 * hook touches most of the application's state because a sign-in changes most of
 * it. Declaring every one as an explicit parameter means the coupling is now
 * visible and type-checked: adding a read of something new fails to compile
 * until it is passed in, where before it would silently reach through the
 * closure.
 *
 * Widening this interface is deliberately discouraged. If it keeps growing, the
 * right response is to split this by concern (profile hydration vs. session
 * lifecycle), not to reach for a shared context object.
 */
export interface UseAuthProfileSyncDeps {
  /** Device-local cache of signed-in accounts, re-read after a write. */
  setSavedAccounts: Dispatch<SetStateAction<any>>;
  appLanguage: any;
  autoLoginAttemptedRef: any;
  customAccentColor: any;
  customChatBg: any;
  customChatBubbleStyle: any;
  customChatFont: any;
  customProfilePhoto: any;
  friendIds: any;
  isSubscribed: any;
  isUserVisibleOnRadar: any;
  lastCredentialsRef: any;
  persistProfileToBackend: any;
  userGroupCallPolicy: any;
  userGroupInvitePolicy: any;
  userRadarEmoji: any;
  userRadarStatusText: any;
  /** Setter for `activeNotes`. */
  setActiveNotes: Dispatch<SetStateAction<any>>;
  /** Setter for `appLanguage`. */
  setAppLanguage: Dispatch<SetStateAction<any>>;
  /** Setter for `audioFeedback`. */
  setAudioFeedback: Dispatch<SetStateAction<any>>;
  /** Setter for `authIsSignUp`. */
  setAuthIsSignUp: Dispatch<SetStateAction<any>>;
  /** Setter for `authLoading`. */
  setAuthLoading: Dispatch<SetStateAction<any>>;
  /** Setter for `contactsList`. */
  setContactsList: Dispatch<SetStateAction<any>>;
  /** Setter for `currentUser`. */
  setCurrentUser: Dispatch<SetStateAction<any>>;
  /** Setter for `customAccentColor`. */
  setCustomAccentColor: Dispatch<SetStateAction<any>>;
  /** Setter for `customChatBg`. */
  setCustomChatBg: Dispatch<SetStateAction<any>>;
  /** Setter for `customChatBubbleStyle`. */
  setCustomChatBubbleStyle: Dispatch<SetStateAction<any>>;
  /** Setter for `customChatFont`. */
  setCustomChatFont: Dispatch<SetStateAction<any>>;
  /** Setter for `customProfilePhoto`. */
  setCustomProfilePhoto: Dispatch<SetStateAction<any>>;
  /** Setter for `gbAntiDelete`. */
  setGbAntiDelete: Dispatch<SetStateAction<any>>;
  /** Setter for `gbBlueTickOnReply`. */
  setGbBlueTickOnReply: Dispatch<SetStateAction<any>>;
  /** Setter for `gbFreezeLastSeen`. */
  setGbFreezeLastSeen: Dispatch<SetStateAction<any>>;
  /** Setter for `gbHideOnline`. */
  setGbHideOnline: Dispatch<SetStateAction<any>>;
  /** Setter for `isProfileLoaded`. */
  setIsProfileLoaded: Dispatch<SetStateAction<any>>;
  /** Setter for `isSubscribed`. */
  setIsSubscribed: Dispatch<SetStateAction<any>>;
  /** Setter for `isSyncing`. */
  setIsSyncing: Dispatch<SetStateAction<any>>;
  /** Setter for `isUserVisibleOnRadar`. */
  setIsUserVisibleOnRadar: Dispatch<SetStateAction<any>>;
  /** Setter for `myUploadedStory`. */
  setMyUploadedStory: Dispatch<SetStateAction<any>>;
  /** Setter for `onboardingBio`. */
  setOnboardingBio: Dispatch<SetStateAction<any>>;
  /** Setter for `onboardingName`. */
  setOnboardingName: Dispatch<SetStateAction<any>>;
  /** Setter for `onboardingPhoto`. */
  setOnboardingPhoto: Dispatch<SetStateAction<any>>;
  /** Setter for `onboardingStep`. */
  setOnboardingStep: Dispatch<SetStateAction<any>>;
  /** Setter for `onboardingUsername`. */
  setOnboardingUsername: Dispatch<SetStateAction<any>>;
  /** Setter for `radarVisibilityMode`. */
  setRadarVisibilityMode: Dispatch<SetStateAction<any>>;
  /** Setter for `showLandingMode`. */
  setShowLandingMode: Dispatch<SetStateAction<any>>;
  /** Setter for `showOnboarding`. */
  setShowOnboarding: Dispatch<SetStateAction<any>>;
  /** Setter for `userAgeRange`. */
  setUserAgeRange: Dispatch<SetStateAction<any>>;
  /** Setter for `userBio`. */
  setUserBio: Dispatch<SetStateAction<any>>;
  /** Setter for `userCommunities`. */
  setUserCommunities: Dispatch<SetStateAction<any>>;
  /** Setter for `userDisplayName`. */
  setUserDisplayName: Dispatch<SetStateAction<any>>;
  /** Setter for `userFollowers`. */
  setUserFollowers: Dispatch<SetStateAction<any>>;
  /** Setter for `userFollowersCount`. */
  setUserFollowersCount: Dispatch<SetStateAction<any>>;
  /** Setter for `userFollowing`. */
  setUserFollowing: Dispatch<SetStateAction<any>>;
  /** Setter for `userFollowingCount`. */
  setUserFollowingCount: Dispatch<SetStateAction<any>>;
  /** Setter for `userGender`. */
  setUserGender: Dispatch<SetStateAction<any>>;
  /** Setter for `userGroupCallPolicy`. */
  setUserGroupCallPolicy: Dispatch<SetStateAction<any>>;
  /** Setter for `userGroupInvitePolicy`. */
  setUserGroupInvitePolicy: Dispatch<SetStateAction<any>>;
  /** Setter for `userInterests`. */
  setUserInterests: Dispatch<SetStateAction<any>>;
  /** Setter for `userMeetupCount`. */
  setUserMeetupCount: Dispatch<SetStateAction<any>>;
  /** Setter for `userRadarEmoji`. */
  setUserRadarEmoji: Dispatch<SetStateAction<any>>;
  /** Setter for `userRadarStatusText`. */
  setUserRadarStatusText: Dispatch<SetStateAction<any>>;
  /** Setter for `userTrustScore`. */
  setUserTrustScore: Dispatch<SetStateAction<any>>;
  /** Setter for `userUsername`. */
  setUserUsername: Dispatch<SetStateAction<any>>;
  /** Setter for `userWebsite`. */
  setUserWebsite: Dispatch<SetStateAction<any>>;
}

export function useAuthProfileSync(deps: UseAuthProfileSyncDeps): void {
  const {
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
    setSavedAccounts,
  } = deps;

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
                  emailOrPhone: isGoogle ? undefined : lastCredentialsRef.current.emailOrPhone || user.email || user.phoneNumber,
                  password: isGoogle ? undefined : lastCredentialsRef.current.password || undefined
                });
                localStorage.setItem('nearby_saved_accounts', JSON.stringify(accounts));
  loadLocalAccountsFromDisk(setSavedAccounts);
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
                  emailOrPhone: isGoogle ? undefined : lastCredentialsRef.current.emailOrPhone || user.email || user.phoneNumber,
                  password: isGoogle ? undefined : lastCredentialsRef.current.password || undefined
                });
                localStorage.setItem('nearby_saved_accounts', JSON.stringify(accounts));
                loadLocalAccountsFromDisk(setSavedAccounts);
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
}
