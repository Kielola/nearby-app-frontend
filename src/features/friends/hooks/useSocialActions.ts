import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { friendsApi, meetupsApi, reportsApi } from '../../../lib/api';
import { DirectMessage, Neighbor } from '../../../types';
import { createNotification } from '../../notifications/services/createNotification';

/**
 * Friend requests, groups, meetups, ratings and reports
 *
 * Everything a user does to another user rather than to a message.
 *
 * ## Dependency interface
 *
 * 24 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern —
 * if it keeps growing, split the hook instead.
 */
export interface UseSocialActionsDeps {
  appUser: any;
  currentUser: any;
  friendIds: any;
  incomingRequestsByUserIdRef: any;
  neighbors: any;
  newGroupColor: any;
  newGroupDesc: any;
  newGroupEmoji: any;
  newGroupName: any;
  pendingFriendRequests: any;
  sendChatMessageViaSocket: any;
  sentFriendRequestIds: any;
  setAudioFeedback: Dispatch<SetStateAction<any>>;
  setChatMessages: Dispatch<SetStateAction<any>>;
  setFriendsAddedTodayCount: Dispatch<SetStateAction<any>>;
  setNeighbors: Dispatch<SetStateAction<any>>;
  setNewGroupDesc: Dispatch<SetStateAction<any>>;
  setNewGroupMembers: Dispatch<SetStateAction<any>>;
  setNewGroupName: Dispatch<SetStateAction<any>>;
  setShowCreateGroupModal: Dispatch<SetStateAction<any>>;
  setViewingNeighborProfile: Dispatch<SetStateAction<any>>;
  triggerBeep: any;
  userDisplayName: any;
  viewingNeighborProfile: any;
  newGroupMembers: any;
  refetchFriends: any;
}

export function useSocialActions(deps: UseSocialActionsDeps) {
  const {
    appUser,
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
  } = deps;

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

  return {
    actuallyAddFriend,
    handleAcceptFriendRequest,
    handleAddNewFriend,
    handleCancelMeetup,
    handleCreateGroup,
    handleDeclineFriendRequest,
    handleRateNeighbor,
    handleReportNeighbor,
    handleScheduleMeetup,
  };
}
