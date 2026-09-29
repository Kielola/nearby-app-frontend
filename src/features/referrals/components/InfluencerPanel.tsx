import { useState } from 'react';
import { Sparkles, Clock, Check, ExternalLink } from 'lucide-react';
import { applyAsInfluencer } from '../api';
import { formatNaira, type Influencer } from '../types';

/**
 * The Campus Creator programme.
 *
 * Everything on this screen is measured, not asserted: a creator's click count
 * comes from `referral_clicks`, their referral count from `referrals`, and their
 * conversion rate is one divided by the other. The original stored
 * `clicks: 12`, `conversionRate: 85` and `verifiedInvites * 100` as literal
 * values on the application document and displayed them as the creator's
 * performance — numbers with no relationship to anything that happened.
 */
export default function InfluencerPanel({
  influencers,
  myApplication,
  isDark,
  onRefresh,
}: {
  influencers: Influencer[];
  myApplication: { status: 'pending' | 'approved' | 'rejected'; customCode: string; commissionKobo: number } | null;
  isDark: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [twitter, setTwitter] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const card = `border rounded-[24px] p-5 shadow-sm space-y-4 ${
    isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'
  }`;

  const inputClass = `w-full px-3 py-2.5 rounded-xl text-xs font-medium outline-none border ${
    isDark
      ? 'bg-neutral-950/50 border-neutral-800 text-neutral-100 placeholder:text-neutral-600'
      : 'bg-stone-50 border-stone-200 text-neutral-900 placeholder:text-stone-400'
  }`;

  const apply = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await applyAsInfluencer({
        instagram: instagram.trim() || undefined,
        tiktok: tiktok.trim() || undefined,
        twitter: twitter.trim() || undefined,
        customCode: customCode.trim().toUpperCase(),
        campaignName: campaignName.trim(),
      });
      setMessage({ text: result.message, ok: true });
      setShowForm(false);
      await onRefresh();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Your application could not be submitted.',
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs font-bold ${
            message.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Application state, if there is one. */}
      {myApplication && (
        <div className={card}>
          <div className="flex items-center gap-2">
            {myApplication.status === 'approved' ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : myApplication.status === 'pending' ? (
              <Clock className="w-4 h-4 text-amber-500" />
            ) : (
              <Clock className="w-4 h-4 text-rose-500" />
            )}
            <span className="text-xs font-black">
              {myApplication.status === 'approved'
                ? 'You are a Campus Creator'
                : myApplication.status === 'pending'
                  ? 'Application pending review'
                  : 'Application not approved'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400">Your code</span>
            <span className="font-black tracking-wider">{myApplication.customCode}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400">Per verified referral</span>
            <span className="font-black text-emerald-500">
              {formatNaira(myApplication.commissionKobo)}
            </span>
          </div>
        </div>
      )}

      {!myApplication && !showForm && (
        <div className={card}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-black">Become a Campus Creator</span>
          </div>
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Run a campaign on your campus, get your own code, and earn{' '}
            {formatNaira(10000)} for every verified referral. Top creators share a prize pool each
            cycle.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 rounded-2xl text-xs font-black bg-indigo-500 text-white"
          >
            Apply now
          </button>
        </div>
      )}

      {!myApplication && showForm && (
        <div className={card}>
          <span className="text-xs font-black">Campus Creator application</span>
          <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign name (e.g. UNILAG Freshers Drive)" className={inputClass} />
          <input
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
            placeholder="Your custom code (e.g. CHIDI-UNILAG)"
            className={`${inputClass} tracking-wider`}
          />
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram handle" className={inputClass} />
          <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="TikTok handle" className={inputClass} />
          <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="X / Twitter handle" className={inputClass} />

          <p className="text-[10px] text-neutral-400">Add at least one social handle so we can review your application.</p>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className={`flex-1 py-3 rounded-2xl text-xs font-black ${
                isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-stone-100 text-stone-600'
              }`}
            >
              Cancel
            </button>
            <button
              disabled={
                busy ||
                campaignName.trim().length < 2 ||
                customCode.trim().length < 3 ||
                (!instagram.trim() && !tiktok.trim() && !twitter.trim())
              }
              onClick={() => void apply()}
              className={`flex-[2] py-3 rounded-2xl text-xs font-black text-white ${
                busy ||
                campaignName.trim().length < 2 ||
                customCode.trim().length < 3 ||
                (!instagram.trim() && !tiktok.trim() && !twitter.trim())
                  ? 'bg-neutral-500/30'
                  : 'bg-indigo-500'
              }`}
            >
              {busy ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </div>
      )}

      {/* The creator board. */}
      <div className={card}>
        <span className="text-xs font-black">Top creators this cycle</span>
        {influencers.length === 0 ? (
          <p className="text-xs text-neutral-400 py-2">No approved creators yet.</p>
        ) : (
          <div className="space-y-4">
            {influencers.slice(0, 10).map((creator) => (
              <div key={creator.id} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-black ${
                      creator.rank === 1
                        ? 'bg-amber-500 text-white'
                        : isDark
                          ? 'bg-neutral-800 text-neutral-400'
                          : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {creator.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold block truncate">{creator.name}</span>
                    <span className="text-[10px] text-neutral-400 block truncate">
                      {creator.campaignName}
                      {creator.campus ? ` · ${creator.campus}` : ''}
                    </span>
                  </div>
                  <span className="text-[10px] font-black tracking-wider text-neutral-400 shrink-0">
                    {creator.customCode}
                  </span>
                </div>

                {/* Real analytics, straight from the referral rows. */}
                <div className="flex items-center gap-3 pl-10 text-[10px] text-neutral-400">
                  <span>{creator.analytics.clicks} clicks</span>
                  <span>{creator.analytics.verifiedReferrals} verified</span>
                  <span>{creator.analytics.conversionRate}% conversion</span>
                  {creator.handles?.instagram && (
                    <span className="flex items-center gap-0.5">
                      <ExternalLink className="w-2.5 h-2.5" />
                      {creator.handles.instagram}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
