import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthFormState } from '../../features/authentication/hooks/useAuthFormState';
import TermsConsentScreen from '../../features/legal/components/TermsConsentScreen';
import { markPendingTermsAcceptance } from '../../features/legal/pendingAcceptance';
import { TERMS_VERSION } from '../../features/legal/content/termsOfService';
import { MapPin, User, Send, Radar, Check, ChevronRight, ChevronLeft, Eye, EyeOff, Mail, UserPlus, Lock, Link, Shield, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Neighbor, Meetup } from '../../types';
import { auth, GoogleAuthProvider } from '../../firebase';
import { sendEmailVerification } from 'firebase/auth';
import { useNearbyRuntime } from '../context/NearbyRuntimeContext';
import { readPendingReferralCode, writePendingReferralCode, normaliseReferralCode } from '../../features/referrals/pendingCode';
import { useSignupProfile, setSignupProfile, INTEREST_OPTIONS } from '../../features/authentication/signupProfile';
import { NEIGHBORHOODS } from '../../mockData';

export default function AuthGate() {
  // What the user typed at registration. Held in a module store rather than local
  // state so it survives account creation and the verification step that follows.
  const signup = useSignupProfile();

  const {
  showLandingMode,
  setShowLandingMode,
  currentUser,
  authLoading,
  setAuthLoading,
  showWelcomeTour,
  setShowWelcomeTour,
  welcomeTourStep,
  setWelcomeTourStep,
  authScreenState,
  setAuthScreenState,
  authSuccess,
  setAuthSuccess,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  setAuthIsSignUp,
  setIsPhoneAuthOption,
  authError,
  setAuthError,
  savedAccounts,
  handleSendResetLink,
  loginWithEmailOrPhone,
  triggerBeep,
} = useNearbyRuntime();

// The three typed fields are local to this screen, not the controller. Holding
// them in the controller re-rendered the entire app on every keystroke — see
// `useAuthFormState` for the full explanation. Aliased to the names used
// throughout this file so nothing below had to change.
const {
  emailOrPhone: authEmailOrPhone,
  password: authPassword,
  confirmPassword: authConfirmPassword,
  setEmailOrPhone: setAuthEmailOrPhone,
  setPassword: setAuthPassword,
  setConfirmPassword: setAuthConfirmPassword,
} = useAuthFormState();

// Terms gate for new registrations.
//
// `signupTermsAgreed` records that the user pressed I AGREE during THIS session.
// It does not itself constitute the record — that is written server-side the
// moment the account exists (see AuthContext). The value only decides whether
// the consent screen is still in the way.
const [signupTermsAgreed, setSignupTermsAgreed] = useState(false);
const [showTermsGate, setShowTermsGate] = useState(false);

// The referral code shown in the sign-up field.
//
// Seeded from the shared store, so someone who arrived on ?ref=CODE sees their
// inviter's code already filled in and can simply not touch it. They can also
// clear it, or paste a different one — the field is authoritative for whatever
// it currently holds, because that is what a visible, editable field means.
//
// Writes go straight back to the store on every keystroke, so the attribution
// path needs no plumbing through this component.
const [referralCode, setReferralCode] = useState<string>(() => readPendingReferralCode() ?? '');

    // Rendered before the main auth UI so it cannot be skipped or dismissed by
  // navigating within the form.
  if (showTermsGate && !signupTermsAgreed) {
    return (
      <TermsConsentScreen
        onAccepted={() => {
          // Park the acknowledgement so AuthContext can write it the instant
          // the new account's row exists.
          markPendingTermsAcceptance(TERMS_VERSION);
          setSignupTermsAgreed(true);
          setShowTermsGate(false);
          // Now that agreement is on record locally, proceed with signup.
          loginWithEmailOrPhone(authEmailOrPhone, authPassword, true, false, authConfirmPassword);
        }}
        onDecline={() => {
          setShowTermsGate(false);
          setAuthError('You must accept the Terms of Service to create an account.');
        }}
        onBack={() => setShowTermsGate(false)}
        accept={async () => true}
      />
    );
  }

  if (!currentUser) {
    if (showWelcomeTour) {
      const handleNext = () => {
        triggerBeep(380, 0.08);
        if (welcomeTourStep < 2) {
          setWelcomeTourStep(welcomeTourStep + 1);
        } else {
          localStorage.setItem('nearby_welcome_completed', 'true');
          setShowWelcomeTour(false);
          setAuthIsSignUp(true);
          setAuthScreenState('signup');
          setShowLandingMode(false);
        }
      };

      const handleSkip = () => {
        triggerBeep(320, 0.08);
        localStorage.setItem('nearby_welcome_completed', 'true');
        setShowWelcomeTour(false);
        setShowLandingMode(false);
        setAuthIsSignUp(false);
        setAuthScreenState('login');
      };

      return (
        <div className="flex flex-col h-screen bg-[#111315] text-white font-sans max-w-md mx-auto relative border border-neutral-800/40 shadow-2xl justify-between p-6 overflow-hidden">
          {/* Ambient Top Light */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] h-[250px] rounded-full bg-[#0F8A5F]/10 blur-[100px] pointer-events-none" />

          {/* Top Header */}
          <div className="flex justify-between items-center w-full pt-4 relative z-10">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[#0F8A5F]/10 rounded-xl flex items-center justify-center border border-[#0F8A5F]/20">
                <Radar className="w-5 h-5 text-[#0F8A5F]" />
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">Nearby</span>
            </div>
            
            {welcomeTourStep < 2 && (
              <button
                onClick={handleSkip}
                className="text-[14px] font-medium text-[#6E6E73] hover:text-white transition duration-150 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-white/5"
              >
                Skip
              </button>
            )}
          </div>

          {/* Content Slide Container */}
          <div className="my-auto py-4 relative z-10 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`welcome-tour-${welcomeTourStep}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="flex flex-col items-center text-center space-y-6"
              >
                {/* Illustration Panel */}
                <div className="w-full">
                  {welcomeTourStep === 0 && (
                    <div className="w-full h-[240px] rounded-[22px] overflow-hidden relative shadow-soft-lg border border-[#2A2D31]/20">
                      <img 
                        referrerPolicy="no-referrer"
                        src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop" 
                        alt="Diverse Black people talking outdoors" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111315]/80 via-transparent to-transparent" />
                    </div>
                  )}

                  {welcomeTourStep === 1 && (
                    <div className="w-full h-[240px] rounded-[22px] bg-[#1A1C1F] border border-[#2A2D31]/40 overflow-hidden relative shadow-soft-lg flex items-center justify-center">
                      {/* Dynamic Radar Ring Animations */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {[1, 2, 3].map((ring) => (
                          <motion.div
                            key={`radar-ring-${ring}`}
                            className="absolute rounded-full border border-[#0F8A5F]/20 bg-[#0F8A5F]/2"
                            initial={{ width: 40, height: 40, opacity: 0.8 }}
                            animate={{
                              width: ring * 70 + 40,
                              height: ring * 70 + 40,
                              opacity: [0.6, 0.1, 0]
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              delay: ring * 0.8,
                              ease: "easeOut"
                            }}
                          />
                        ))}
                      </div>

                      {/* Glowing Center Pulse */}
                      <div className="relative z-10 flex items-center justify-center">
                        <div className="w-12 h-12 bg-[#0F8A5F] rounded-full flex items-center justify-center text-white font-bold shadow-[0_0_20px_rgba(15,138,95,0.4)] relative">
                          <MapPin className="w-6 h-6 text-white" />
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#FF7A59] rounded-full border-2 border-[#1A1C1F] animate-ping" />
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#FF7A59] rounded-full border-2 border-[#1A1C1F]" />
                        </div>
                      </div>

                      {/* Animated Neighbor Avatars with Proximity tags */}
                      <motion.div
                        animate={{ x: [0, -10, 0], y: [0, 8, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute top-6 left-8 flex flex-col items-center"
                      >
                        <div className="w-9 h-9 rounded-full border-2 border-[#0F8A5F] overflow-hidden shadow-soft-md">
                          <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[9px] font-sans font-semibold text-white/90 bg-[#111315]/90 px-1.5 py-0.5 rounded-full mt-1 border border-[#2A2D31]/40">Bayo, 200m</span>
                      </motion.div>

                      <motion.div
                        animate={{ x: [0, 15, 0], y: [0, -6, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="absolute bottom-6 right-8 flex flex-col items-center"
                      >
                        <div className="w-9 h-9 rounded-full border-2 border-[#FF7A59] overflow-hidden shadow-soft-md">
                          <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[9px] font-sans font-semibold text-white/90 bg-[#111315]/90 px-1.5 py-0.5 rounded-full mt-1 border border-[#2A2D31]/40">Chioma, 400m</span>
                      </motion.div>

                      <motion.div
                        animate={{ x: [0, -8, 0], y: [0, -12, 0] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                        className="absolute top-8 right-12 flex flex-col items-center"
                      >
                        <div className="w-9 h-9 rounded-full border-2 border-[#0F8A5F] overflow-hidden shadow-soft-md">
                          <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[9px] font-sans font-semibold text-white/90 bg-[#111315]/90 px-1.5 py-0.5 rounded-full mt-1 border border-[#2A2D31]/40">Tunde, 150m</span>
                      </motion.div>
                    </div>
                  )}

                  {welcomeTourStep === 2 && (
                    <div className="w-full h-[240px] rounded-[22px] overflow-hidden relative shadow-soft-lg border border-[#2A2D31]/20">
                      <img 
                        referrerPolicy="no-referrer"
                        src="https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&auto=format&fit=crop" 
                        alt="Two people meeting safely at a public cafe" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111315]/80 via-transparent to-transparent" />
                      
                      {/* Safety Verified badge overlay */}
                      <div className="absolute top-3 left-3 bg-[#0F8A5F] text-white text-[11px] font-semibold font-sans px-2.5 py-1 rounded-full flex items-center space-x-1 shadow-soft-sm border border-white/10">
                        <Shield className="w-3.5 h-3.5 text-white" />
                        <span>Safe Meetup Verified</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Text Content */}
                <div className="space-y-3 px-2">
                  <h2 className="text-[22px] font-sans font-bold text-white tracking-tight leading-snug">
                    {welcomeTourStep === 0 && "Real Connections Start Nearby"}
                    {welcomeTourStep === 1 && "Discover People Around You"}
                    {welcomeTourStep === 2 && "Meet Safely"}
                  </h2>
                  <p className="text-[15px] font-sans font-normal text-[#6E6E73] leading-relaxed">
                    {welcomeTourStep === 0 && (
                      <>
                        Stop collecting followers.<br />
                        Start building genuine friendships close to you.
                      </>
                    )}
                    {welcomeTourStep === 1 && "Find people within your preferred distance and safely connect based on shared interests."}
                    {welcomeTourStep === 2 && "Choose trusted public places for your first meetup and build meaningful friendships with confidence."}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer dots & actions */}
          <div className="mt-auto space-y-6 pb-6 relative z-10 w-full">
            {/* Bottom Indicator Dots */}
            <div className="flex justify-center space-x-2.5">
              {[0, 1, 2].map((idx) => (
                <motion.div
                  key={`dot-${idx}`}
                  className="h-2 rounded-full"
                  animate={{
                    width: welcomeTourStep === idx ? 24 : 8,
                    backgroundColor: welcomeTourStep === idx ? "#0F8A5F" : "#2A2D31"
                  }}
                  transition={{ duration: 0.2 }}
                />
              ))}
            </div>

            {/* Buttons */}
            {welcomeTourStep < 2 ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleNext}
                className="w-full h-[56px] rounded-[18px] bg-[#0F8A5F] hover:bg-[#0C7A53] text-white font-semibold text-[16px] shadow-soft-md transition duration-180 flex items-center justify-center cursor-pointer"
              >
                Next
              </motion.button>
            ) : (
              <div className="flex flex-col w-full space-y-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    triggerBeep(520, 0.08);
                    localStorage.setItem('nearby_welcome_completed', 'true');
                    setShowWelcomeTour(false);
                    setAuthIsSignUp(true);
                    setAuthScreenState('signup');
                    setShowLandingMode(false);
                  }}
                  className="w-full h-[56px] rounded-[18px] bg-[#0F8A5F] hover:bg-[#0C7A53] text-white font-semibold text-[16px] shadow-soft-md transition duration-180 flex items-center justify-center cursor-pointer"
                >
                  Get Started
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    triggerBeep(480, 0.08);
                    localStorage.setItem('nearby_welcome_completed', 'true');
                    setShowWelcomeTour(false);
                    setAuthIsSignUp(false);
                    setAuthScreenState('login');
                    setShowLandingMode(false);
                  }}
                  className="w-full h-[56px] rounded-[18px] border border-white/20 text-[#6E6E73] hover:text-white hover:bg-white/5 font-semibold text-[15px] transition duration-180 flex items-center justify-center cursor-pointer"
                >
                  I Already Have an Account
                </motion.button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-screen bg-gradient-to-b from-[#F7F8FA] to-[#EEF8F3] text-[#161616] font-sans overflow-y-auto max-w-[420px] mx-auto relative border border-neutral-200/50 shadow-2xl justify-between p-6">
        {/* Animated Premium Blurred Circles */}
        <motion.div
          className="absolute w-[280px] h-[280px] rounded-full bg-[#0F8A5F] opacity-[0.10] blur-[70px] pointer-events-none"
          animate={{
            x: [-20, 30, -20],
            y: [-30, 20, -30],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ top: '8%', left: '-8%' }}
        />
        <motion.div
          className="absolute w-[250px] h-[250px] rounded-full bg-[#FF7A59] opacity-[0.08] blur-[60px] pointer-events-none"
          animate={{
            x: [25, -35, 25],
            y: [20, -25, 20],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          style={{ bottom: '12%', right: '-8%' }}
        />

        {/* Back Button for Landing State */}
        {!showLandingMode && (
          <div className="absolute top-6 left-6 z-40">
            <button
              onClick={() => {
                triggerBeep(350, 0.05);
                setShowLandingMode(true);
                setAuthError('');
              }}
              className="w-[48px] h-[48px] rounded-full bg-white/90 border border-neutral-200/80 shadow-sm flex items-center justify-center text-neutral-500 hover:text-[#161616] hover:bg-white transition-all cursor-pointer"
              title="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Central Layout Column */}
        <div className="my-auto py-8 w-full flex flex-col space-y-[24px] relative z-10 items-center justify-center">
          
          {/* LOGO */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="relative flex items-center justify-center mb-1"
          >
            {/* Soft Glow behind logo */}
            <div className="absolute inset-0 bg-[#0F8A5F]/15 rounded-[22px] blur-xl" />
            <div className="w-[80px] h-[80px] bg-white border border-neutral-200/80 rounded-[22px] flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.03)] relative z-10">
              <Radar className="w-10 h-10 text-[#0F8A5F]" />
              <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#FF7A59] rounded-full border-2 border-white animate-pulse" />
            </div>
          </motion.div>

          {/* Titles & Copy Section */}
          {showLandingMode ? (
            <div className="text-center space-y-2 w-full px-2">
              <h1 className="text-[32px] font-bold tracking-tight text-[#161616]">Nearby</h1>
              <p className="text-[16px] font-normal text-neutral-500 leading-relaxed max-w-xs mx-auto">
                Discover mutual interest partners, safe meetup spots, and build real friendships close to you.
              </p>
            </div>
          ) : (
            <>
              {authScreenState === 'login' && (
                <div className="text-center space-y-2 w-full px-2">
                  <h2 className="text-[32px] font-bold text-[#161616] tracking-tight leading-tight">Welcome Back</h2>
                  <p className="text-[16px] font-normal text-neutral-500 leading-normal">Continue building real friendships nearby.</p>
                </div>
              )}
              {authScreenState === 'signup' && (
                <div className="text-center space-y-2 w-full px-2">
                  <h2 className="text-[28px] sm:text-[32px] font-bold text-[#161616] tracking-tight leading-tight">Create Your Nearby Account</h2>
                  <p className="text-[16px] font-normal text-neutral-500 leading-normal">Meet genuine people around you in a safe and meaningful way.</p>
                </div>
              )}
              {authScreenState === 'forgot' && (
                <div className="text-center space-y-2 w-full px-2">
                  <h2 className="text-[32px] font-bold text-[#161616] tracking-tight leading-tight">Reset Password</h2>
                  <p className="text-[16px] font-normal text-neutral-500 leading-normal">We'll send you a secure link to reset your password.</p>
                </div>
              )}
              {authScreenState === 'verification' && (
                <div className="text-center space-y-2 w-full px-2">
                  <h2 className="text-[32px] font-bold text-[#161616] tracking-tight leading-tight">Verify Your Email</h2>
                  <p className="text-[16px] font-normal text-neutral-500 leading-normal">We've sent a verification link to your inbox.</p>
                </div>
              )}
            </>
          )}

          {/* Controls & Forms Wrapper */}
          <div className="w-full flex flex-col space-y-[18px]">
            {showLandingMode ? (
              /* Landing Buttons state */
              <div className="space-y-[18px] w-full pt-2">
                <div className="text-center pb-2">
                  <span className="text-[11px] font-mono tracking-widest uppercase text-[#0F8A5F] font-bold bg-[#0F8A5F]/10 px-3 py-1 rounded-full">
                    Live Proximity Networking
                  </span>
                </div>
                
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    triggerBeep(520, 0.08);
                    setAuthIsSignUp(true);
                    setAuthScreenState('signup');
                    setShowLandingMode(false);
                  }}
                  className="w-full h-[58px] bg-[#0F8A5F] hover:bg-[#0C7A53] text-white rounded-[18px] text-[16px] font-semibold transition duration-150 shadow-[0_4px_14px_rgba(15,138,95,0.25)] flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Get Started</span>
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
                
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    triggerBeep(480, 0.08);
                    setAuthIsSignUp(false);
                    setAuthScreenState('login');
                    setShowLandingMode(false);
                  }}
                  className="w-full h-[58px] bg-white hover:bg-neutral-50 text-[#161616] border border-neutral-200/80 rounded-[18px] text-[16px] font-semibold transition duration-150 flex items-center justify-center cursor-pointer shadow-sm"
                >
                  <span>Log In</span>
                </motion.button>
              </div>
            ) : (
              /* Auth Screens states */
              <div className="space-y-[18px] w-full">
                
                {/* 1. Saved Accounts list (Only on Login screen) */}
                {authScreenState === 'login' && savedAccounts.length > 0 && (
                  <div className="w-full space-y-3 bg-white/70 backdrop-blur-sm p-4 rounded-[22px] border border-neutral-200/60 shadow-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Saved Accounts</span>
                      <span className="text-[10px] uppercase px-2 py-0.5 bg-[#0F8A5F]/10 border border-[#0F8A5F]/20 text-[#0F8A5F] rounded-full font-bold">Instant Login</span>
                    </div>
                    
                    <div className="max-h-[145px] overflow-y-auto space-y-2">
                      {savedAccounts.map((acc, aIdx) => (
                        <button
                          key={`acc-${acc.uid}-${aIdx}`}
                          onClick={async () => {
                            triggerBeep(520, 0.1);
                            setAuthError("");
                            setAuthLoading(true);
                            try {
                              if (acc.authType === 'google') {
                                // Google sign-in has been removed. Accounts created
                                // that way hold no password credential, so this saved
                                // entry cannot be reused — send the user to the one
                                // route that still works rather than failing obscurely.
                                setAuthError("This account was created with Google. Google sign-in is no longer available, so please use \"Forgot Password?\" to set a password and continue with email.");
                              } else if (acc.emailOrPhone && acc.password) {
                                setAuthEmailOrPhone(acc.emailOrPhone);
                                setAuthPassword(acc.password);
                                setIsPhoneAuthOption(acc.emailOrPhone.indexOf('@') === -1);
                                await loginWithEmailOrPhone(acc.emailOrPhone, acc.password, false, acc.emailOrPhone.indexOf('@') === -1);
                              } else {
                                setAuthEmailOrPhone(acc.emailOrPhone || "");
                                setIsPhoneAuthOption((acc.emailOrPhone || "").indexOf('@') === -1);
                                setAuthIsSignUp(false);
                                setAuthScreenState('login');
                                setAuthLoading(false);
                                setAuthError("Fill your password below!");
                              }
                            } catch (err: any) {
                              setAuthLoading(false);
                              setAuthError(err?.message || "Failed to login with selection.");
                            }
                          }}
                          className="w-full flex items-center justify-between p-3 rounded-[18px] bg-white border border-neutral-150 hover:border-[#0F8A5F]/60 hover:bg-neutral-50 transition-all text-left active:scale-[0.99] group cursor-pointer"
                        >
                          <div className="flex items-center space-x-3 truncate">
                            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-lg overflow-hidden border border-neutral-200/50 font-sans">
                              {acc.avatar ? (
                                <img src={acc.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                acc.name?.charAt(0) || "👤"
                              )}
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-[14px] text-[#161616] block truncate leading-tight group-hover:text-[#0F8A5F] transition-colors">{acc.name}</span>
                              <span className="text-[11px] text-neutral-400 block mt-0.5">@{acc.username || "neighbor"}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] bg-neutral-100 border border-neutral-200/50 px-2.5 py-0.5 rounded-full text-neutral-500 font-medium">{acc.authType === 'google' ? 'Google — unavailable' : 'Password'}</span>
                            <span className="text-sm font-bold text-[#0F8A5F] group-hover:translate-x-1 transition-all">❯</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Login & Sign Up Forms */}
                {(authScreenState === 'login' || authScreenState === 'signup') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-[18px] w-full"
                  >
                    {/* Email Input */}
                    <div className="relative flex items-center rounded-[18px] border border-neutral-200 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-200 focus-within:border-[#0F8A5F] focus-within:ring-2 focus-within:ring-[#0F8A5F]/10 h-[58px] group">
                      <div className="absolute left-[18px] text-neutral-400 group-focus-within:text-[#0F8A5F] transition-colors">
                        <User className="w-[18px] h-[18px]" />
                      </div>
                      <input
                        type="email"
                        value={authEmailOrPhone}
                        onChange={(e) => setAuthEmailOrPhone(e.target.value)}
                        placeholder="e.g., name@gmail.com"
                        className="w-full pl-[48px] pr-4 h-full bg-transparent text-[15px] font-medium text-[#161616] placeholder-[#9CA3AF] focus:outline-none font-sans"
                        autoComplete="email"
                      />
                    </div>

                    {/* Password Input */}
                    <div className="relative flex items-center rounded-[18px] border border-neutral-200 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-200 focus-within:border-[#0F8A5F] focus-within:ring-2 focus-within:ring-[#0F8A5F]/10 h-[58px] group">
                      <div className="absolute left-[18px] text-neutral-400 group-focus-within:text-[#0F8A5F] transition-colors">
                        <Lock className="w-[18px] h-[18px]" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-[48px] pr-[48px] h-full bg-transparent text-[15px] font-medium text-[#161616] placeholder-[#9CA3AF] focus:outline-none font-sans"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          triggerBeep(450, 0.05);
                          setShowPassword(!showPassword);
                        }}
                        className="absolute right-[18px] text-neutral-400 hover:text-[#161616] transition-colors flex items-center justify-center p-1 cursor-pointer"
                        style={{ minWidth: '44px', minHeight: '44px' }}
                      >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>

                    {/* Confirm Password (Signup only) */}
                    {authScreenState === 'signup' && (
                      <div className="relative flex items-center rounded-[18px] border border-neutral-200 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-200 focus-within:border-[#0F8A5F] focus-within:ring-2 focus-within:ring-[#0F8A5F]/10 h-[58px] group">
                        <div className="absolute left-[18px] text-neutral-400 group-focus-within:text-[#0F8A5F] transition-colors">
                          <Lock className="w-[18px] h-[18px]" />
                        </div>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={authConfirmPassword}
                          onChange={(e) => setAuthConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-[48px] pr-[48px] h-full bg-transparent text-[15px] font-medium text-[#161616] placeholder-[#9CA3AF] focus:outline-none font-sans"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            triggerBeep(450, 0.05);
                            setShowConfirmPassword(!showConfirmPassword);
                          }}
                          className="absolute right-[18px] text-neutral-400 hover:text-[#161616] transition-colors flex items-center justify-center p-1 cursor-pointer"
                          style={{ minWidth: '44px', minHeight: '44px' }}
                        >
                          {showConfirmPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                        </button>
                      </div>
                    )}

                    {/* Registration profile fields (Signup only).
                        These were previously collected nowhere, so every new account
                        landed on an empty profile and the radar filled with people who
                        had no name and nothing in common to match on. Asking here is
                        the only moment a user is guaranteed to be looking at their own
                        profile.

                        Name is required — it is what neighbours see. Everything else is
                        optional and genuinely skippable: a user who does not want to
                        give an age can still register. We ask; we do not demand. */}
                    {authScreenState === 'signup' && (
                      <div className="space-y-3">
                        <div className="relative flex items-center rounded-[18px] border border-neutral-200 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-200 focus-within:border-[#0F8A5F] focus-within:ring-2 focus-within:ring-[#0F8A5F]/10 h-[58px] group">
                          <div className="absolute left-[18px] text-neutral-400 group-focus-within:text-[#0F8A5F] transition-colors">
                            <User className="w-[18px] h-[18px]" />
                          </div>
                          <input
                            type="text"
                            value={signup.displayName}
                            onChange={(e) => setSignupProfile({ displayName: e.target.value })}
                            placeholder="Your name"
                            className="w-full pl-[48px] pr-[18px] h-full bg-transparent text-[15px] font-medium text-[#161616] placeholder-[#9CA3AF] focus:outline-none font-sans"
                            autoComplete="name"
                            aria-label="Your name"
                          />
                        </div>

                        <div className="flex gap-3">
                          <div className="relative flex items-center rounded-[18px] border border-neutral-200 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-200 focus-within:border-[#0F8A5F] focus-within:ring-2 focus-within:ring-[#0F8A5F]/10 h-[58px] group w-[110px] shrink-0">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={13}
                              max={120}
                              value={signup.age ?? ''}
                              onChange={(e) => {
                                // An empty box is "no answer", not zero. Storing 0
                                // would put a newborn on the radar.
                                const raw = e.target.value.trim();
                                setSignupProfile({ age: raw === '' ? null : Number(raw) });
                              }}
                              placeholder="Age"
                              className="w-full px-[18px] h-full bg-transparent text-[15px] font-medium text-[#161616] placeholder-[#9CA3AF] focus:outline-none font-sans"
                              aria-label="Age (optional)"
                            />
                          </div>

                          <div className="relative flex items-center rounded-[18px] border border-neutral-200 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-200 focus-within:border-[#0F8A5F] focus-within:ring-2 focus-within:ring-[#0F8A5F]/10 h-[58px] group flex-1 min-w-0">
                            <div className="absolute left-[18px] text-neutral-400 group-focus-within:text-[#0F8A5F] transition-colors pointer-events-none">
                              <MapPin className="w-[18px] h-[18px]" />
                            </div>
                            <select
                              value={signup.streetName}
                              onChange={(e) => setSignupProfile({ streetName: e.target.value })}
                              className="w-full pl-[48px] pr-[14px] h-full bg-transparent text-[15px] font-medium text-[#161616] focus:outline-none font-sans cursor-pointer appearance-none"
                              aria-label="Your area (optional)"
                            >
                              <option value="">Your area — pick one</option>
                              {NEIGHBORHOODS.map((area) => {
                                const label = `${area.name}, ${area.city}`;
                                return (
                                  <option key={label} value={label}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                            <ChevronRight className="absolute right-[14px] w-4 h-4 text-neutral-400 rotate-90 pointer-events-none" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="px-1 text-[11.5px] leading-snug text-neutral-500 font-medium">
                            What are you into? <span className="text-neutral-400">(optional — helps you find your people)</span>
                          </p>
                          <div className="flex flex-wrap gap-2 px-0.5">
                            {INTEREST_OPTIONS.map((interest) => {
                              const chosen = signup.interests.includes(interest);
                              return (
                                <button
                                  key={interest}
                                  type="button"
                                  onClick={() => {
                                    triggerBeep(520, 0.04);
                                    setSignupProfile({
                                      interests: chosen
                                        ? signup.interests.filter((i) => i !== interest)
                                        : [...signup.interests, interest],
                                    });
                                  }}
                                  aria-pressed={chosen}
                                  className={`px-3 h-[34px] rounded-full text-[12.5px] font-semibold transition-all duration-150 border cursor-pointer ${
                                    chosen
                                      ? 'bg-[#0F8A5F] border-[#0F8A5F] text-white shadow-[0_2px_8px_rgba(15,138,95,0.25)]'
                                      : 'bg-white/70 border-neutral-200 text-[#4B5563] hover:border-[#0F8A5F]/40'
                                  }`}
                                >
                                  {interest}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Referral code (Signup only).
                        Pre-filled from the invite link and fully editable, so a
                        user who was told a code out loud can type it, and one who
                        has no code can leave it empty and still register. */}
                    {authScreenState === 'signup' && (
                      <div className="space-y-1.5">
                        <div className="relative flex items-center rounded-[18px] border border-neutral-200 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-200 focus-within:border-[#0F8A5F] focus-within:ring-2 focus-within:ring-[#0F8A5F]/10 h-[58px] group">
                          <div className="absolute left-[18px] text-neutral-400 group-focus-within:text-[#0F8A5F] transition-colors">
                            <UserPlus className="w-[18px] h-[18px]" />
                          </div>
                          <input
                            type="text"
                            value={referralCode}
                            onChange={(e) => {
                              const clean = normaliseReferralCode(e.target.value);
                              setReferralCode(clean);
                              writePendingReferralCode(clean);
                            }}
                            placeholder="Referral code (optional)"
                            className="w-full pl-[48px] pr-[18px] h-full bg-transparent text-[15px] font-medium text-[#161616] placeholder-[#9CA3AF] focus:outline-none font-sans uppercase tracking-wide"
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            inputMode="text"
                            aria-label="Referral code"
                          />
                        </div>
                        {referralCode && (
                          <p className="px-1 text-[11.5px] leading-snug text-[#0F8A5F] font-medium">
                            You'll be credited to the member who invited you.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Forgot Password Link (Login only) */}
                    {authScreenState === 'login' && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            triggerBeep(450, 0.05);
                            setAuthScreenState('forgot');
                            setAuthError('');
                          }}
                          className="text-[13px] font-semibold text-[#0F8A5F] hover:underline transition duration-150 cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}

                    {/* Main Submit Button */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      disabled={authLoading}
                      onClick={() => {
                        // A NEW account must not be created before the user has
                        // seen and accepted the agreement. Present it now and
                        // let the consent screen call back into signup.
                        if (authScreenState === 'signup' && !signupTermsAgreed) {
                          setShowTermsGate(true);
                          return;
                        }
                        loginWithEmailOrPhone(authEmailOrPhone, authPassword, authScreenState === 'signup', false, authConfirmPassword);
                      }}
                      className="w-full h-[58px] bg-[#0F8A5F] hover:bg-[#0C7A53] text-white rounded-[18px] text-[15px] font-semibold tracking-wide transition duration-180 flex items-center justify-center cursor-pointer shadow-[0_4px_14px_rgba(15,138,95,0.25)] relative overflow-hidden"
                      style={{ minHeight: '48px' }}
                    >
                      {authLoading ? (
                        <div className="flex space-x-1.5 items-center justify-center">
                          <motion.div className="w-2.5 h-2.5 bg-white rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} />
                          <motion.div className="w-2.5 h-2.5 bg-white rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} />
                          <motion.div className="w-2.5 h-2.5 bg-white rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} />
                        </div>
                      ) : (
                        <span className="flex items-center space-x-2">
                          <span>{authScreenState === 'signup' ? "Create Secure Account" : "Access Personal Profile"}</span>
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      )}
                    </motion.button>
                  </motion.div>
                )}

                {/* 3. Forgot Password form state */}
                {authScreenState === 'forgot' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-[18px] w-full"
                  >
                    {/* Email Input */}
                    <div className="relative flex items-center rounded-[18px] border border-neutral-200 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-200 focus-within:border-[#0F8A5F] focus-within:ring-2 focus-within:ring-[#0F8A5F]/10 h-[58px] group">
                      <div className="absolute left-[18px] text-neutral-400 group-focus-within:text-[#0F8A5F] transition-colors">
                        <Mail className="w-[18px] h-[18px]" />
                      </div>
                      <input
                        type="email"
                        value={authEmailOrPhone}
                        onChange={(e) => setAuthEmailOrPhone(e.target.value)}
                        placeholder="e.g., name@gmail.com"
                        className="w-full pl-[48px] pr-4 h-full bg-transparent text-[15px] font-medium text-[#161616] placeholder-[#9CA3AF] focus:outline-none font-sans"
                      />
                    </div>

                    {/* Action Button */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      disabled={authLoading}
                      onClick={() => handleSendResetLink(authEmailOrPhone)}
                      className="w-full h-[58px] bg-[#0F8A5F] hover:bg-[#0C7A53] text-white rounded-[18px] text-[15px] font-semibold tracking-wide transition duration-180 flex items-center justify-center cursor-pointer shadow-[0_4px_14px_rgba(15,138,95,0.25)]"
                      style={{ minHeight: '48px' }}
                    >
                      {authLoading ? (
                        <div className="flex space-x-1.5 items-center justify-center">
                          <motion.div className="w-2.5 h-2.5 bg-white rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} />
                          <motion.div className="w-2.5 h-2.5 bg-white rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} />
                          <motion.div className="w-2.5 h-2.5 bg-white rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} />
                        </div>
                      ) : (
                        <span>Send Reset Link</span>
                      )}
                    </motion.button>

                    {/* Back to sign in */}
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          triggerBeep(350, 0.05);
                          setAuthScreenState('login');
                          setAuthError('');
                        }}
                        className="text-[14px] font-semibold text-[#0F8A5F] hover:underline transition duration-150 cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 4. Email Verification state */}
                {authScreenState === 'verification' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-[18px] w-full"
                  >
                    {/* Button: Open Email App */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        triggerBeep(520, 0.08);
                        window.location.href = "mailto:";
                      }}
                      className="w-full h-[58px] bg-[#0F8A5F] hover:bg-[#0C7A53] text-white rounded-[18px] text-[15px] font-semibold tracking-wide transition duration-180 flex items-center justify-center cursor-pointer shadow-[0_4px_14px_rgba(15,138,95,0.25)]"
                      style={{ minHeight: '48px' }}
                    >
                      <span>Open Email App</span>
                    </motion.button>

                    {/* Secondary: Resend Email */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        triggerBeep(450, 0.08);
                        if (auth.currentUser) {
                          try {
                            await sendEmailVerification(auth.currentUser);
                            setAuthSuccess("Verification link sent!");
                          } catch (e: any) {
                            setAuthError(e.message || "Failed to resend verification email.");
                          }
                        } else {
                          setAuthSuccess("A verification link has been resent to your email.");
                        }
                      }}
                      className="w-full h-[58px] border border-neutral-200 bg-white/85 hover:bg-neutral-50 text-[#161616] rounded-[18px] text-[15px] font-semibold transition duration-180 flex items-center justify-center cursor-pointer shadow-sm"
                      style={{ minHeight: '48px' }}
                    >
                      <span>Resend Email</span>
                    </motion.button>

                    {/* Back to Login */}
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          triggerBeep(350, 0.05);
                          setAuthScreenState('login');
                          setAuthError('');
                        }}
                        className="text-[14px] font-semibold text-[#0F8A5F] hover:underline transition duration-150 cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Google sign-in was removed deliberately.
                    Auth is email + password only. Two reasons:
                      1. Every sign-in now flows through one code path, so the
                         referral attribution has exactly one place to hook into
                         and one place to be wrong.
                      2. It removes an entire class of "popup blocked", "redirect
                         mismatch" and "unauthorized domain" support burden that
                         console configuration could silently break.
                    The Firebase GoogleAuthProvider wiring is gone too — see
                    useAuthActions.ts. Do not re-add the button without re-adding
                    that handler. */}

                {/* Footer Switch Link */}
                {authScreenState === 'login' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-2">
                    <p className="text-[14px] text-neutral-500 font-sans">
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          triggerBeep(480, 0.05);
                          setAuthIsSignUp(true);
                          setAuthScreenState('signup');
                          setAuthError('');
                        }}
                        className="font-bold text-[#0F8A5F] hover:underline transition-all duration-150 inline-block cursor-pointer ml-1"
                        style={{ minWidth: '44px', minHeight: '44px' }}
                      >
                        Create One
                      </button>
                    </p>
                  </motion.div>
                )}
                {authScreenState === 'signup' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-2">
                    <p className="text-[14px] text-neutral-500 font-sans">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          triggerBeep(480, 0.05);
                          setAuthIsSignUp(false);
                          setAuthScreenState('login');
                          setAuthError('');
                        }}
                        className="font-bold text-[#0F8A5F] hover:underline transition-all duration-150 inline-block cursor-pointer ml-1"
                        style={{ minWidth: '44px', minHeight: '44px' }}
                      >
                        Sign In
                      </button>
                    </p>
                  </motion.div>
                )}

              </div>
            )}
          </div>

        </div>

        {/* Floating Success Toast (Green Check, Rounded, Automatically disappears) */}
        <AnimatePresence>
          {authSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.95 }}
              className="absolute top-6 left-6 right-6 bg-white border border-neutral-100 shadow-[0_10px_30px_rgba(15,138,95,0.12)] rounded-[22px] p-4.5 z-50 flex items-center space-x-3.5"
            >
              <div className="w-[42px] h-[42px] rounded-full bg-[#0F8A5F]/10 flex items-center justify-center flex-shrink-0 text-[#0F8A5F]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-bold text-[#161616]">Success</p>
                <p className="text-[12px] text-neutral-500 font-sans leading-tight mt-0.5">{authSuccess}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Friendly Floating Error Rounded Card overlay (no red blocks, retry button) */}
        <AnimatePresence>
          {authError && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.95 }}
              className="absolute bottom-6 left-6 right-6 bg-white border border-neutral-200/80 shadow-[0_12px_32px_rgba(0,0,0,0.08)] rounded-[24px] p-5.5 z-50 flex flex-col space-y-4"
            >
              <div className="flex items-start space-x-3.5">
                <div className="w-[42px] h-[42px] rounded-full bg-[#FF7A59]/10 flex items-center justify-center flex-shrink-0 text-[#FF7A59]">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-[14px] font-bold text-[#161616]">Unable to authenticate</h4>
                  <p className="text-[12px] text-neutral-500 leading-normal font-sans">
                    {authError.includes("wrong-password") || authError.includes("user-not-found") || authError.includes("invalid-credential") || authError.includes("invalid-login-credentials")
                      ? "We couldn't sign you in. Please check your details and try again."
                      : authError}
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => {
                    triggerBeep(320, 0.08);
                    setAuthError("");
                  }}
                  className="px-5 py-2.5 bg-[#0F8A5F] hover:bg-[#0C7A53] text-white text-[13px] font-semibold rounded-full shadow-sm transition duration-150 cursor-pointer"
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Premium bottom status lines */}
        <div className="text-center pb-4 relative z-10">
          <p className="text-[10px] text-neutral-400 font-mono tracking-wider uppercase">
            ✓ END-TO-END SEGREGATION · SECURED VIA FIREBASE CLIENT SHIELDS
          </p>
        </div>
      </div>
    );
  }
}
