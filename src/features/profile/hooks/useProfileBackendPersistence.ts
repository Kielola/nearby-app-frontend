import { useEffect } from 'react';
import { OperationType, auth, db, doc, handleFirestoreError } from '../../../firebase';

/**
 * Writing profile changes back to the server
 *
 * Debounced, so typing in a bio does not fire a request per keystroke, and gated on the profile having loaded, so a cold start cannot overwrite the server's copy with placeholder values. Every field it sends is listed explicitly — the backend owns the shape of the user row, and a partial write must not clobber columns this screen does not own.
 *
 * Every value this block reads is declared in `UseProfileBackendPersistenceDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseProfileBackendPersistenceDeps {
  activeNotes: any;
  appLanguage: any;
  contactsList: any;
  customAccentColor: any;
  customChatBg: any;
  customChatBubbleStyle: any;
  customChatFont: any;
  customProfilePhoto: any;
  gbAntiDelete: any;
  gbBlueTickOnReply: any;
  gbFreezeLastSeen: any;
  gbHideOnline: any;
  isProfileLoaded: any;
  isSubscribed: any;
  isSyncing: any;
  isUserVisibleOnRadar: any;
  persistProfileToBackend: any;
  userBio: any;
  userDisplayName: any;
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
  userUsername: any;
  userWebsite: any;
}

export function useProfileBackendPersistence(deps: UseProfileBackendPersistenceDeps) {
  const {
  
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
    userWebsite,} = deps;

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
}

export default useProfileBackendPersistence;
