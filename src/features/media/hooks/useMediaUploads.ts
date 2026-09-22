import type React from 'react';
import { auth, uploadToStorage } from '../../../firebase';
import { highlightsApi, postsApi } from '../../../lib/api';
import { mediaApi } from '../../../lib/api/mediaApi';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Media uploads — photos, videos, profile pictures, posts and stories
 *
 * Takes a picked file, uploads it to Cloudinary, and writes the result where it belongs.
 *
 * ## Dependency interface
 *
 * 21 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern —
 * if it keeps growing, split the hook instead.
 */
export interface UseMediaUploadsDeps {
  currentUser: any;
  customProfilePhoto: any;
  refetchMyContentRef: any;
  setAudioFeedback: Dispatch<SetStateAction<any>>;
  setCustomProfilePhoto: Dispatch<SetStateAction<any>>;
  setIsPublishingStory: Dispatch<SetStateAction<any>>;
  setOnboardingPhoto: Dispatch<SetStateAction<any>>;
  setStoryCompositionCaption: Dispatch<SetStateAction<any>>;
  setStoryCompositionCustomList: Dispatch<SetStateAction<any>>;
  setStoryCompositionPrivacy: Dispatch<SetStateAction<any>>;
  setStoryUploadData: Dispatch<SetStateAction<any>>;
  setUserHighlights: Dispatch<SetStateAction<any>>;
  setUserPosts: Dispatch<SetStateAction<any>>;
  storyCompositionCaption: any;
  storyCompositionCustomList: any;
  storyCompositionPrivacy: any;
  storyUploadData: any;
  triggerBeep: any;
  uploadModeRef: any;
  userDisplayName: any;
  userUsername: any;
  /**
   * From `useChatActions`. Used when a media upload is sent directly into a
   * conversation rather than attached to a post.
   */
  sendMessage: any;
}

export function useMediaUploads(deps: UseMediaUploadsDeps) {
  const {
    currentUser,
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
    sendMessage,
  } = deps;

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

  return {
    handleGalleryUploadForChat,
    handleGalleryUploadForPost,
    handleGalleryUploadForProfilePic,
    handleGalleryUploadForStory,
    handlePublishStoryComposition,
  };
}
