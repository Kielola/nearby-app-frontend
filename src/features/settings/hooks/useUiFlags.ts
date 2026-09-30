import { readPendingReferralCode } from '../../../features/referrals/pendingCode';
/**
 * Modal, drawer and panel visibility flags
 *
 * Every `show*` boolean in the app, together with the small pieces of form state that only exist to feed a modal. These are one-line `useState(false)` declarations scattered across the controller; grouping them makes the UI's open/closed surface legible in one place, and lets the controller's return object carry them as a single spread instead of a hundred separate keys.
 *
 * ## Dependency interface
 *
 * 1 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
import { UserNote } from '../../../mockData';
import { DirectMessage, Neighbor } from '../../../types';
import { useState } from 'react';

export interface UseUiFlagsDeps {
  hasSavedAccountOnDisk: any;
}

export function useUiFlags(deps: UseUiFlagsDeps) {
  const {
    hasSavedAccountOnDisk,
  } = deps;

    const [showFriendsModal, setShowFriendsModal] = useState<boolean>(false);
    const [showNeighborFriendsModal, setShowNeighborFriendsModal] = useState<string | null>(null);
    const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 364-364 ──

    /**
     * The marketing/landing screen, shown before any form.
     *
     * A brand-new visitor normally lands here and taps "Get Started" to reach the
     * sign-up form. That is the right flow for someone who arrived at the app on
     * their own.
     *
     * It is the WRONG flow for someone who followed an invite link. They were
     * sent by a friend, they have a code, and the code has already been captured
     * from the URL — making them tap "Get Started" first is one pointless step
     * between the invitation and the form that acts on it. Worse, because this
     * screen is what decides whether the form renders at all, an invitee could
     * sit on the landing screen with a perfectly good code in storage and never
     * see the sign-up form the code belongs to.
     *
     * So: arriving on `/join/CODE` or `?ref=CODE` skips the landing screen
     * entirely and drops the visitor straight onto sign-up, with their code
     * already in the field.
     *
     * This is the reason `?ref=` "did nothing" before: setting the auth screen to
     * sign-up was not enough on its own, because this flag gates whether the auth
     * screens render at all.
     */
    const arrivedViaInvite = Boolean(readPendingReferralCode());

    const [showLandingMode, setShowLandingMode] = useState<boolean>(
      !hasSavedAccountOnDisk && !arrivedViaInvite,
    );

  // ── moved from src/app/hooks/useNearbyController.ts lines 366-373 ──

    const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);
    const [isScanningFace, setIsScanningFace] = useState<boolean>(false);
    const [scanCountdown, setScanCountdown] = useState<number>(3);
    const [showContactsModal, setShowContactsModal] = useState<boolean>(false);
    const [showContactsPermissionPrompt, setShowContactsPermissionPrompt] = useState<boolean>(false);
    const [newContactName, setNewContactName] = useState<string>("");
    const [newContactPhone, setNewContactPhone] = useState<string>("");
    const [showAddContactForm, setShowAddContactForm] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 385-385 ──

    const [showNewChatDrawer, setShowNewChatDrawer] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 401-401 ──

    const [showInstagramProfile, setShowInstagramProfile] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 414-417 ──

    const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);

    // Invite & Support modal overlays states
    const [showInviteModal, setShowInviteModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 427-435 ──

    const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
    const [helpEmail, setHelpEmail] = useState<string>("");
    const [helpCategory, setHelpCategory] = useState<string>("General Support");
    const [helpMessage, setHelpMessage] = useState<string>("");

    // Account customization modals states
    const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
    const [showChatsConfigModal, setShowChatsConfigModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 443-443 ──

    const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 477-477 ──

    const [showScheduleMeetupModal, setShowScheduleMeetupModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 487-487 ──

    const [showInlineRatingForm, setShowInlineRatingForm] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 513-513 ──

    const [aboutDetailModal, setAboutDetailModal] = useState<'privacy' | 'terms' | 'guidelines' | null>(null);

  // ── moved from src/app/hooks/useNearbyController.ts lines 557-559 ──

    const [showWelcomeTour, setShowWelcomeTour] = useState<boolean>(() => {
      return !localStorage.getItem('nearby_welcome_completed');
    });

  // ── moved from src/app/hooks/useNearbyController.ts lines 564-565 ──

    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 582-582 ──

    const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 632-632 ──

    const [showNoteModal, setShowNoteModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 635-635 ──

    const [showFloatingSearch, setShowFloatingSearch] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 714-716 ──

    const [showMainMenuDropdown, setShowMainMenuDropdown] = useState<boolean>(false);
    const [showActiveChatDropdown, setShowActiveChatDropdown] = useState<boolean>(false);
    const [showActiveChatMoreDropdown, setShowActiveChatMoreDropdown] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 724-724 ──

    const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 732-732 ──

    const [showGroupInviteConfirmModal, setShowGroupInviteConfirmModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 743-743 ──

    const [showGroupCallConfirmModal, setShowGroupCallConfirmModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 811-811 ──

    const [showStateSearchModal, setShowStateSearchModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 824-824 ──

    const [showPhotoMenu, setShowPhotoMenu] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 877-877 ──

    const [showStoryViewerList, setShowStoryViewerList] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 883-884 ──

    const [showStoryChoiceModal, setShowStoryChoiceModal] = useState<{ note: UserNote; neighbor: Neighbor } | null>(null);
    const [showAddFriendsModal, setShowAddFriendsModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 904-905 ──

    const [showActiveChatSearch, setShowActiveChatSearch] = useState<boolean>(false);
    const [showForwardModal, setShowForwardModal] = useState<DirectMessage | null>(null);

  // ── moved from src/app/hooks/useNearbyController.ts lines 925-925 ──

    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 936-936 ──

    const [showMediaGalleryModal, setShowMediaGalleryModal] = useState<boolean>(false);

  // ── moved from src/app/hooks/useNearbyController.ts lines 943-943 ──

    const [showMessageInfoModal, setShowMessageInfoModal] = useState<DirectMessage | null>(null);

  // ── moved from src/app/hooks/useNearbyController.ts lines 953-953 ──

    const [showArchivedOnly, setShowArchivedOnly] = useState<boolean>(false);

  return {
    aboutDetailModal,
    helpCategory,
    helpEmail,
    helpMessage,
    isScanningFace,
    newContactName,
    newContactPhone,
    scanCountdown,
    setAboutDetailModal,
    setHelpCategory,
    setHelpEmail,
    setHelpMessage,
    setIsScanningFace,
    setNewContactName,
    setNewContactPhone,
    setScanCountdown,
    setShowAccountModal,
    setShowActiveChatDropdown,
    setShowActiveChatMoreDropdown,
    setShowActiveChatSearch,
    setShowAddContactForm,
    setShowAddFriendsModal,
    setShowArchivedOnly,
    setShowChatsConfigModal,
    setShowConfirmPassword,
    setShowContactsModal,
    setShowContactsPermissionPrompt,
    setShowCreateGroupModal,
    setShowEditProfileModal,
    setShowEmojiPicker,
    setShowFloatingSearch,
    setShowForwardModal,
    setShowFriendsModal,
    setShowGroupCallConfirmModal,
    setShowGroupInviteConfirmModal,
    setShowHelpModal,
    setShowInlineRatingForm,
    setShowInstagramProfile,
    setShowInviteModal,
    setShowLandingMode,
    setShowLanguageModal,
    setShowMainMenuDropdown,
    setShowMediaGalleryModal,
    setShowMessageInfoModal,
    setShowNeighborFriendsModal,
    setShowNewChatDrawer,
    setShowNoteModal,
    setShowNotificationsModal,
    setShowOnboarding,
    setShowPassword,
    setShowPhotoMenu,
    setShowPrivacyModal,
    setShowScheduleMeetupModal,
    setShowStateSearchModal,
    setShowStoryChoiceModal,
    setShowStoryViewerList,
    setShowVerificationModal,
    setShowWelcomeTour,
    showAccountModal,
    showActiveChatDropdown,
    showActiveChatMoreDropdown,
    showActiveChatSearch,
    showAddContactForm,
    showAddFriendsModal,
    showArchivedOnly,
    showChatsConfigModal,
    showConfirmPassword,
    showContactsModal,
    showContactsPermissionPrompt,
    showCreateGroupModal,
    showEditProfileModal,
    showEmojiPicker,
    showFloatingSearch,
    showForwardModal,
    showFriendsModal,
    showGroupCallConfirmModal,
    showGroupInviteConfirmModal,
    showHelpModal,
    showInlineRatingForm,
    showInstagramProfile,
    showInviteModal,
    showLandingMode,
    showLanguageModal,
    showMainMenuDropdown,
    showMediaGalleryModal,
    showMessageInfoModal,
    showNeighborFriendsModal,
    showNewChatDrawer,
    showNoteModal,
    showNotificationsModal,
    showOnboarding,
    showPassword,
    showPhotoMenu,
    showPrivacyModal,
    showScheduleMeetupModal,
    showStateSearchModal,
    showStoryChoiceModal,
    showStoryViewerList,
    showVerificationModal,
    showWelcomeTour,
  };
}
