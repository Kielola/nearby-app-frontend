import type { Dispatch, SetStateAction } from 'react';
import { browserLocalPersistence, setPersistence, signInWithRedirect } from 'firebase/auth';
import { GoogleAuthProvider, auth, createUserWithEmailAndPassword, db, doc, signInWithEmailAndPassword, signInWithPopup, signOut } from '../../../firebase';
import { INITIAL_MESSAGES, INITIAL_NOTES } from '../../../mockData';
import { loadLocalAccountsFromDisk } from '../services/savedAccounts';

/**
 * Authentication and onboarding
 *
 * Google and email/phone sign-in, the onboarding wizard's final save, and logout.
 *
 * ## Dependency interface
 *
 * 75 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern —
 * if it keeps growing, split the hook instead.
 */
export interface UseAuthActionsDeps {
  _setChatMessages: any;
  activeNotes: any;
  appLanguage: any;
  currentUser: any;
  customAccentColor: any;
  customChatBg: any;
  customChatBubbleStyle: any;
  customChatFont: any;
  customProfilePhoto: any;
  isSubscribed: any;
  isUserVisibleOnRadar: any;
  lastCredentialsRef: any;
  onboardingAgeRange: any;
  onboardingBio: any;
  onboardingCommunities: any;
  onboardingCoords: any;
  onboardingGender: any;
  onboardingInterests: any;
  onboardingName: any;
  onboardingPhoto: any;
  onboardingState: any;
  onboardingStreetName: any;
  onboardingUsername: any;
  persistProfileToBackend: any;
  setActiveNotes: Dispatch<SetStateAction<any>>;
  setAppLanguage: Dispatch<SetStateAction<any>>;
  setAudioFeedback: Dispatch<SetStateAction<any>>;
  setAuthError: Dispatch<SetStateAction<any>>;
  setAuthLoading: Dispatch<SetStateAction<any>>;
  setCurrentUser: Dispatch<SetStateAction<any>>;
  setCustomAccentColor: Dispatch<SetStateAction<any>>;
  setCustomChatBg: Dispatch<SetStateAction<any>>;
  setCustomChatBubbleStyle: Dispatch<SetStateAction<any>>;
  setCustomChatFont: Dispatch<SetStateAction<any>>;
  setCustomProfilePhoto: Dispatch<SetStateAction<any>>;
  setFriendIds: Dispatch<SetStateAction<any>>;
  setIsProfileLoaded: Dispatch<SetStateAction<any>>;
  setIsSubscribed: Dispatch<SetStateAction<any>>;
  setIsSyncing: Dispatch<SetStateAction<any>>;
  setMyUploadedStory: Dispatch<SetStateAction<any>>;
  setOnboardingBio: Dispatch<SetStateAction<any>>;
  setOnboardingName: Dispatch<SetStateAction<any>>;
  setOnboardingPhoto: Dispatch<SetStateAction<any>>;
  setOnboardingStep: Dispatch<SetStateAction<any>>;
  setOnboardingUsername: Dispatch<SetStateAction<any>>;
  setSavedAccounts: Dispatch<SetStateAction<any>>;
  setShowLandingMode: Dispatch<SetStateAction<any>>;
  setShowOnboarding: Dispatch<SetStateAction<any>>;
  setUserAgeRange: Dispatch<SetStateAction<any>>;
  setUserBio: Dispatch<SetStateAction<any>>;
  setUserCommunities: Dispatch<SetStateAction<any>>;
  setUserDisplayName: Dispatch<SetStateAction<any>>;
  setUserFollowers: Dispatch<SetStateAction<any>>;
  setUserFollowersCount: Dispatch<SetStateAction<any>>;
  setUserFollowing: Dispatch<SetStateAction<any>>;
  setUserFollowingCount: Dispatch<SetStateAction<any>>;
  setUserGender: Dispatch<SetStateAction<any>>;
  setUserGroupCallPolicy: Dispatch<SetStateAction<any>>;
  setUserGroupInvitePolicy: Dispatch<SetStateAction<any>>;
  setUserInterests: Dispatch<SetStateAction<any>>;
  setUserMeetupCount: Dispatch<SetStateAction<any>>;
  setUserTrustScore: Dispatch<SetStateAction<any>>;
  setUserUsername: Dispatch<SetStateAction<any>>;
  setUserWebsite: Dispatch<SetStateAction<any>>;
  triggerBeep: any;
  userFollowers: any;
  userFollowersCount: any;
  userFollowing: any;
  userFollowingCount: any;
  userGroupCallPolicy: any;
  userGroupInvitePolicy: any;
  userMeetupCount: any;
  userRadarEmoji: any;
  userRadarStatusText: any;
  userTrustScore: any;
}

export function useAuthActions(deps: UseAuthActionsDeps) {
  const {
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
  } = deps;

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

    const loginWithEmailOrPhone = async (
      emailOrPhoneRaw: string,
      passwordRaw: string,
      isSignUpOption: boolean,
      isPhoneInput: boolean,
      // Passed in rather than read from state — the sign-up confirmation field is
      // local to the screen now. Defaulted so existing callers that genuinely have
      // no confirmation step keep compiling and behave as before.
      confirmPasswordRaw: string = '',
    ) => {
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
          const confirmPass = confirmPasswordRaw.trim();
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
            emailOrPhone: isGoogle ? undefined : lastCredentialsRef.current.emailOrPhone || currentUser.email || currentUser.phoneNumber,
            password: isGoogle ? undefined : lastCredentialsRef.current.password || undefined
          });
          localStorage.setItem('nearby_saved_accounts', JSON.stringify(accounts));
          loadLocalAccountsFromDisk(setSavedAccounts);
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

  return {
    loginWithEmailOrPhone,
    loginWithGoogle,
    logoutUser,
    saveOnboardingDetails,
  };
}
