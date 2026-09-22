import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';

/**
 * The signed-in user's profile fields
 *
 * Display name, handle, bio, social counts, privacy toggles and chat-appearance preferences. Pure state — nothing here depends on anything else in the controller, which is why it can be constructed first, before any consumer runs.
 *
 * ## Dependency interface
 *
 * 1 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.

/**
 * The profile the app starts from on a cold load.
 *
 * Reads the last signed-in uid's cached profile out of localStorage so a
 * returning user sees their own name and photo on the first frame instead of
 * placeholders that then flicker into real values. It lives here rather than in
 * the controller because seeding this state is the only thing it is for.
 */
export const initialProfile = (() => {
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

export function useProfileState() {

    const [myVerificationLevel, setMyVerificationLevel] = useState<'Basic' | 'Verified'>('Basic');

  // ── moved from src/app/hooks/useNearbyController.ts lines 474-482 ──

    const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(initialProfile !== null);
    const [userDisplayName, setUserDisplayName] = useState<string>(initialProfile?.name || "Nearby Member");
    const [userUsername, setUserUsername] = useState<string>(initialProfile?.username || "nearby_member");
    const [userBio, setUserBio] = useState<string>(initialProfile?.bio || "Connecting with neighbors face-to-face 👋");
    const [userWebsite, setUserWebsite] = useState<string>(initialProfile?.website || "foslibrary.com.ng");
    const [userAgeRange, setUserAgeRange] = useState<string>(initialProfile?.ageRange || "25-34");
    const [userGender, setUserGender] = useState<string>(initialProfile?.gender || "Male");
    const [userInterests, setUserInterests] = useState<string[]>(initialProfile?.interests || ["Tech", "Music"]);
    const [userCommunities, setUserCommunities] = useState<string[]>(initialProfile?.communities || ["comm-1"]);

  // ── moved from src/app/hooks/useNearbyController.ts lines 495-496 ──

    const [userTelephone, setUserTelephone] = useState<string>("+234 812 345 6789");
    const [privacyDisappearing, setPrivacyDisappearing] = useState<string>("Off");

  // ── moved from src/app/hooks/useNearbyController.ts lines 502-502 ──

    const [customProfilePhoto, setCustomProfilePhoto] = useState<string | null>(initialProfile?.customProfilePhoto || null);

  // ── moved from src/app/hooks/useNearbyController.ts lines 506-530 ──

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

  // ── moved from src/app/hooks/useNearbyController.ts lines 554-556 ──

    const [privacyLocationVisibility, setPrivacyLocationVisibility] = useState<boolean>(true);
    const [privacyReadReceipts, setPrivacyReadReceipts] = useState<boolean>(true);
    const [privacyTrustedOnly, setPrivacyTrustedOnly] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 680-680 ──

    const [userNoteText, setUserNoteText] = useState<string>('');

  // ── moved from src/app/hooks/useNearbyController.ts lines 700-707 ──

    const [customAccentColor, setCustomAccentColor] = useState<'indigo' | 'emerald' | 'blue' | 'rose' | 'amber' | 'purple'>('indigo');
    const [customChatBg, setCustomChatBg] = useState<'slate' | 'cosmic' | 'sunset' | 'mint' | 'royal' | 'matrix'>('slate');
    const [customChatBubbleStyle, setCustomChatBubbleStyle] = useState<'modern' | 'sharp' | 'neon' | 'gb_doubletick' | 'playful'>('modern');
    const [customChatFont, setCustomChatFont] = useState<'sans' | 'mono' | 'serif' | 'chunky'>('sans');

    // Groups and Privacy States
    const [userGroupInvitePolicy, setUserGroupInvitePolicy] = useState<'always' | 'ask' | 'never'>('ask');
    const [userGroupCallPolicy, setUserGroupCallPolicy] = useState<'always' | 'ask' | 'never'>('ask');

  // ── moved from src/app/hooks/useNearbyController.ts lines 762-763 ──

    const [userRadarEmoji, setUserRadarEmoji] = useState<string>('🙋‍♂️');
    const [userRadarStatusText, setUserRadarStatusText] = useState<string>('Jollof hunting in Yaba');

  // ── moved from src/app/hooks/useNearbyController.ts lines 828-836 ──

    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
      try {
        const saved = localStorage.getItem('nearby_last_user_coords');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (_) {}
      return null;
    });

  // ── moved from src/app/hooks/useNearbyController.ts lines 844-850 ──

    const [userAddress, setUserAddress] = useState<string>(() => {
      try {
        return localStorage.getItem('nearby_user_address') || '';
      } catch (_) {
        return '';
      }
    });

  return {
    customAccentColor,
    customChatBg,
    customChatBubbleStyle,
    customChatFont,
    customProfilePhoto,
    isProfileLoaded,
    myVerificationLevel,
    privacyDisappearing,
    privacyLocationVisibility,
    privacyReadReceipts,
    privacyTrustedOnly,
    setCustomAccentColor,
    setCustomChatBg,
    setCustomChatBubbleStyle,
    setCustomChatFont,
    setCustomProfilePhoto,
    setIsProfileLoaded,
    setMyVerificationLevel,
    setPrivacyDisappearing,
    setPrivacyLocationVisibility,
    setPrivacyReadReceipts,
    setPrivacyTrustedOnly,
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
    setUserStatusText,
    setUserTelephone,
    setUserTrustScore,
    setUserUsername,
    setUserWebsite,
    userAddress,
    userAgeRange,
    userBio,
    userCommunities,
    userCoords,
    userDisplayName,
    userFollowers,
    userFollowersCount,
    userFollowing,
    userFollowingCount,
    userGender,
    userGroupCallPolicy,
    userGroupInvitePolicy,
    userHighlights,
    userInterests,
    userMeetupCount,
    userNoteText,
    userPosts,
    userRadarEmoji,
    userRadarStatusText,
    userStatusText,
    userTelephone,
    userTrustScore,
    userUsername,
    userWebsite,
  };
}
