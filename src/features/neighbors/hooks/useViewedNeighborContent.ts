import { useEffect } from 'react';

/**
 * Posts and highlights for the profile being viewed
 *
 * Loads what a neighbour has posted for as long as their profile is open, and clears it when the viewer closes — otherwise the next profile opened shows the previous neighbour's content for a frame.
 *
 * Every value this block reads is declared in `UseViewedNeighborContentDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseViewedNeighborContentDeps {
  currentUser: any;
  setNeighborHighlights: any;
  setNeighborPosts: any;
  viewingNeighborProfile: any;
}

export function useViewedNeighborContent(deps: UseViewedNeighborContentDeps) {
  const {
  
    currentUser,
    setNeighborHighlights,
    setNeighborPosts,
    viewingNeighborProfile,} = deps;

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
}

export default useViewedNeighborContent;
