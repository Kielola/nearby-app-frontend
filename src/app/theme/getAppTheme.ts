/**
 * The application's Tailwind class sets, per theme.
 *
 * ## Why this is a module rather than inline in the controller
 *
 * These ~80 class strings are constant data. They were built by a bare ternary
 * inside `useNearbyController`, which is a hook that re-renders on essentially
 * every interaction in the application — so the whole object was rebuilt on
 * every render, every time, to produce values that are identical each time.
 *
 * Moved here, the mapping is a pure function of the theme name: nothing to go
 * stale, nothing to keep in sync with the theme state, and it can be memoised at
 * the call site on the one thing it actually depends on.
 *
 * Class ordering matters in Tailwind (later utilities win), so every string
 * below is byte-for-byte as it was.
 */

export type AppThemeName = 'light' | 'dark';

export interface AppTheme {
  appBg: string;
  contentBg: string;
  tabContentBg: string;
  innerBg: string;
  headerBg: string;
  navBg: string;
  navButtonActive: string;
  navButtonInactive: string;
  cardBg: string;
  cardBorder: string;
  cardInner: string;
  listItemBg: string;
  itemBtn: string;
  textTitle: string;
  textMain: string;
  textMuted: string;
  textHighlight: string;
  textAccent: string;
  textAccentMuted: string;
  inputBg: string;
  inputTextBg: string;
  bubbleUser: string;
  bubbleNeighbor: string;
  suggestBtn: string;
  notesBg: string;
}

export function getAppTheme(appTheme: AppThemeName): AppTheme {
    return appTheme === 'dark' ? {
    // ----------------- DARK MODE -----------------
    // Backgrounds
    appBg: 'bg-[#111315] text-[#FFFFFF] border-[#2A2D31] shadow-soft-lg',
    contentBg: 'bg-[#111315]',
    tabContentBg: 'bg-[#111315]',
    innerBg: 'bg-[#111315]',
    
    // Header & Navigation Bars
    headerBg: 'bg-[#1A1C1F] border-b border-[#2A2D31]/40 text-[#FFFFFF]',
    navBg: 'bg-[#1A1C1F] border-[#2A2D31]/40',
    navButtonActive: 'text-[#0F8A5F] bg-[#111315]/80 font-semibold shadow-soft-sm scale-[1.02]',
    navButtonInactive: 'text-[#9CA3AF] hover:text-[#FFFFFF]',
    
    // Cards & Lists
    cardBg: 'bg-[#1A1C1F] border-[#2A2D31]/40 rounded-[22px]',
    cardBorder: 'border-[#2A2D31]/40',
    cardInner: 'bg-[#111315]/60',
    listItemBg: 'bg-[#1A1C1F] border-[#2A2D31]/40 hover:bg-[#1A1C1F]/80 rounded-[22px]',
    itemBtn: 'bg-[#0F8A5F] hover:bg-[#0C7A53] text-[#FFFFFF] font-semibold h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    
    // Typography
    textTitle: 'text-[#FFFFFF] font-display font-bold tracking-tight',
    textMain: 'text-[#FFFFFF] font-sans',
    textMuted: 'text-[#9CA3AF] font-sans',
    textHighlight: 'text-[#2563EB] font-bold',
    textAccent: 'text-[#0F8A5F]',
    textAccentMuted: 'text-[#0F8A5F]/80',
    
    // Inputs & Forms
    inputBg: 'bg-[#111315] text-[#FFFFFF] border-[#2A2D31] focus-within:border-[#0F8A5F] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    inputTextBg: 'bg-[#111315] text-[#FFFFFF] border-[#2A2D31] focus-within:border-[#0F8A5F] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    bubbleUser: 'bg-[#0F8A5F] text-[#FFFFFF] shadow-soft-sm font-sans rounded-[18px]',
    bubbleNeighbor: 'bg-[#1A1C1F] text-[#FFFFFF] shadow-soft-sm font-sans rounded-[18px] border border-[#2A2D31]/40',
    suggestBtn: 'bg-[#1A1C1F] hover:bg-[#1A1C1F]/80 text-[#FFFFFF] border border-[#2A2D31]/40 h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    notesBg: 'bg-[#111315]',
  } : {
    // ----------------- LIGHT MODE -----------------
    // Backgrounds
    appBg: 'bg-[#F7F8FA] text-[#161616] border-[#ECECEC] shadow-soft-lg',
    contentBg: 'bg-[#F7F8FA]',
    tabContentBg: 'bg-[#F7F8FA]',
    innerBg: 'bg-[#F7F8FA]',
    
    // Header & Navigation Bars
    headerBg: 'bg-[#FFFFFF] border-b border-[#ECECEC] text-[#161616]',
    navBg: 'bg-[#FFFFFF] border-[#ECECEC]',
    navButtonActive: 'text-[#0F8A5F] bg-[#F7F8FA] font-semibold shadow-soft-sm border border-[#ECECEC] scale-[1.02]',
    navButtonInactive: 'text-[#6E6E73] hover:text-[#161616]',
    
    // Cards & Lists
    cardBg: 'bg-[#FFFFFF] border-[#ECECEC] rounded-[22px]',
    cardBorder: 'border-[#ECECEC]',
    cardInner: 'bg-[#F7F8FA]',
    listItemBg: 'bg-[#FFFFFF] border-[#ECECEC] hover:bg-[#F7F8FA] rounded-[22px]',
    itemBtn: 'bg-[#0F8A5F] hover:bg-[#0C7A53] text-[#FFFFFF] font-semibold h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    
    // Typography
    textTitle: 'text-[#161616] font-display font-bold tracking-tight',
    textMain: 'text-[#161616] font-sans',
    textMuted: 'text-[#6E6E73] font-sans',
    textHighlight: 'text-[#2563EB] font-bold',
    textAccent: 'text-[#0F8A5F]',
    textAccentMuted: 'text-[#0F8A5F]/80',
    
    // Inputs & Forms
    inputBg: 'bg-[#FFFFFF] text-[#161616] border-[#ECECEC] focus-within:border-[#0F8A5F] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    inputTextBg: 'bg-[#FFFFFF] text-[#161616] border-[#ECECEC] focus-within:border-[#0F8A5F] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    bubbleUser: 'bg-[#DDF7EC] text-[#161616] shadow-soft-sm font-sans rounded-[18px] border border-[#0F8A5F]/20',
    bubbleNeighbor: 'bg-[#FFFFFF] text-[#161616] shadow-soft-sm font-sans rounded-[18px] border border-[#ECECEC]',
    suggestBtn: 'bg-[#FFFFFF] hover:bg-[#DDF7EC] text-[#161616] border border-[#ECECEC] h-[56px] rounded-[18px] transition duration-180 ease-in-out',
    notesBg: 'bg-[#FFFFFF]',
  };
}
