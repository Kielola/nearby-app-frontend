/**
 * Completing a premium purchase
 *
 * Starts the subscription checkout and reflects the result in local state.
 *
 * Every value this block reads is declared in `UseProcessPaymentDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseProcessPaymentDeps {
  pendingPremiumAction: any;
  setAudioFeedback: any;
  setIsSubscribed: any;
  setShowPayModal: any;
  triggerBeep: any;
}

export function useProcessPayment(deps: UseProcessPaymentDeps) {
  const {
  
    pendingPremiumAction,
    setAudioFeedback,
    setIsSubscribed,
    setShowPayModal,
    triggerBeep,} = deps;

const handleProcessPayment = () => {
  // Enable the subscription instantly
  setIsSubscribed(true);
  setShowPayModal(false);
  triggerBeep(520, 0.15, 'sine');
  
  setAudioFeedback(`🌟 Subscription Active! Unlimited features unlocked!`);
  setTimeout(() => setAudioFeedback(""), 3500);

  // Call execution if we had a pending premium action
  if (pendingPremiumAction) {
    try {
      pendingPremiumAction();
    } catch (e) {
      console.error(e);
    }
  }
};

  return { handleProcessPayment };
}

export default useProcessPayment;
