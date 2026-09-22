import type { Dispatch, SetStateAction } from 'react';
import { auth } from '../../../firebase';
import { aiApi } from '../../../lib/api';
import { mediaApi } from '../../../lib/api/mediaApi';
import type { DirectMessage } from '../../../types';

/**
 * Sending, forwarding, reacting to, and deleting chat messages.
 *
 * ## What moved here
 *
 * ~445 lines that were five intertwined functions inside `useNearbyController`:
 *
 *   - `playVoiceNote` — plays a real recording, falling back to a spoken
 *     placeholder only when there is genuinely no media to play.
 *   - `triggerSimulatedResponse` — the canned reply from the demo companions.
 *   - `sendMessage` — the main send path. Builds the optimistic bubble, hands the
 *     message to the socket with a stable `clientId`, and reconciles the
 *     acknowledgement by that id. See `CHANGED_FILES.md` Pass 4 for why the
 *     idempotency key is load-bearing.
 *   - `handleReaction`, `handleDeleteForMe`, `handleDeleteForEveryone`.
 *   - `handleForwardMessage`.
 *
 * ## Why these are parameters rather than a closure
 *
 * In the controller every one of these reached out to whatever it needed. That
 * is why the send path could not be read — or tested — in isolation. The
 * dependency list below is short (18 entries for 445 lines, which is a pleasant
 * surprise) and it is now the contract: adding a read of something new fails to
 * compile until it is declared.
 *
 * ## Note on `_setChatMessages`
 *
 * Named with a leading underscore because it arrives as a parameter while the
 * local `setChatMessages` inside the send path is a different, narrower helper.
 * Renaming it here is deliberate — the two are not interchangeable.
 */
export interface UseChatActionsDeps {
  _setChatMessages: any;
  friendIds: any;
  markMessageFailed: any;
  neighbors: any;
  playSynthesizedVoiceNote: any;
  playingVoiceId: any;
  replyingToMessage: any;
  saveOrUpdateMessageInFirestore: any;
  selectedNeighbor: any;
  sendChatMessageViaSocket: any;
  textInput: any;
  triggerBeep: any;
  setAudioFeedback: Dispatch<SetStateAction<any>>;
  setPlayingVoiceId: Dispatch<SetStateAction<any>>;
  setReplyingToMessage: Dispatch<SetStateAction<any>>;
  setShowForwardModal: Dispatch<SetStateAction<any>>;
  setSimulatedTypingMap: Dispatch<SetStateAction<any>>;
  setTextInput: Dispatch<SetStateAction<any>>;
}

export function useChatActions(deps: UseChatActionsDeps) {
  const {
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
  } = deps;

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
        // Same value as `id` at creation. The server echoes it back untouched, so
        // the echo carries a field that matches this bubble exactly — the server
        // assigns its own uuid, which is why matching on `id` alone never worked.
        clientId: msgId,
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

      // Updates the optimistic bubble in place, keyed on the client-generated id
      // so it survives whatever the server eventually calls the message.
      const markLocalStatus = (status: DirectMessage['status']) => {
        _setChatMessages(prev => {
          const list = prev[selectedNeighbor.id] || [];
          const idx = list.findIndex(m => m.id === msgId);
          if (idx < 0) return prev;
          const copy = [...list];
          copy[idx] = { ...copy[idx], status };
          return { ...prev, [selectedNeighbor.id]: copy };
        });
      };

      setTimeout(async () => {
        const sentMsg = { ...newMsg, status: 'sent' as const };

        // NOTE: the bubble is deliberately NOT flipped to 'sent' here.
        //
        // This used to run before the message was transmitted. The server
        // broadcasts new messages to the whole room *including the sender*, so
        // the echo arrived at a moment when nothing was flagged 'sending' — the
        // reconciliation in onIncomingMessage had nothing to match and appended a
        // second copy. That is why the sender saw the message twice while the
        // receiver (which never renders an optimistic bubble) saw it once.
        //
        // Status is now advanced only after the send actually succeeds.

        if (fUser && !selectedNeighbor.id.startsWith('nb-')) {
          const isGroupThread = selectedNeighbor.id.startsWith('group-')
            || selectedNeighbor.id.startsWith('sim-group-')
            || Boolean(selectedNeighbor.isGroup);

          if (isGroupThread) {
            // Group chat isn't supported by the new backend yet (conversations
            // are strictly 1:1) — groups stay on Firestore until that's built.
            await saveOrUpdateMessageInFirestore(sentMsg, selectedNeighbor.id);
            markLocalStatus('sent');
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
                // The key that lets the sender recognise its own echo.
                clientId: msgId,
                content: sentMsg.type === 'text' ? sentMsg.text : undefined,
                mediaUrl: finalMediaUrl,
                mediaType: sentMsg.type !== 'text' ? (sentMsg.type as 'image' | 'video' | 'voice' | 'document') : undefined,
                audioDurationSec: sentMsg.audioDurationSec,
                fileName: sentMsg.fileName,
                fileSize: sentMsg.fileSize,
              });
              markLocalStatus('sent');
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

  return {
    playVoiceNote,
    triggerSimulatedResponse,
    sendMessage,
    handleReaction,
    handleDeleteForMe,
    handleDeleteForEveryone,
    handleForwardMessage,
  };
}
