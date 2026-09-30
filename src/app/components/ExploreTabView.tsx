import { Suspense } from 'react';
import { motion } from 'motion/react';
import ExploreTab from '../../features/explore/components/ExploreTab';
import { useNearbyRuntime } from '../context/NearbyRuntimeContext';

export default function ExploreTabView() {
  const {
    activeTab,
    selectedPreset,
    neighbors,
    pendingFriendRequests,
    setViewingNeighborProfile,
    currentUser,
    friendIds,
    appTheme,
    userCoords,
    triggerBeep,
    actuallyAddFriend,
    sendPrivateMessageToNeighbor,
    onOpenNeighborChat,
    theme,
  } = useNearbyRuntime();

  return (
    <>
          {activeTab === 'explore' && (
            <motion.div
              key="explore-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-hidden"
            >
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-zinc-500 text-xs font-mono">Loading local maps & discovery...</p>
                </div>
              }>
                <ExploreTab
                  currentUser={currentUser}
                  userCoords={userCoords}
                  selectedPreset={selectedPreset}
                  neighbors={neighbors}
                  appTheme={appTheme}
                  theme={theme}
                  triggerBeep={triggerBeep}
                  onSendDirectMessage={sendPrivateMessageToNeighbor}
                  onOpenNeighborChat={onOpenNeighborChat}
                  friendIds={friendIds}
                  friendRequests={pendingFriendRequests}
                  onAddFriend={actuallyAddFriend}
                  onViewNeighborProfile={setViewingNeighborProfile}
                />
              </Suspense>
            </motion.div>
          )}

          {/* ---------------------------------------------------- */}
          {/* MENU / SETTINGS TAB (Profile & System Customizations) */}
          {/* ---------------------------------------------------- */}
    </>
  );
}
