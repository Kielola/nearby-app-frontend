import { useState } from 'react';
import { MapPin, Check } from 'lucide-react';
import { redeemTreasureCodeWithLocation } from '../api';
import { formatNaira, type TreasureCode } from '../types';

/**
 * The campus treasure hunt.
 *
 * Redemption is settled by a single conditional UPDATE on the server, so two
 * people submitting the same code at the same instant cannot both be paid — the
 * loser gets a message saying someone beat them to it. The old flow did
 * read → check → write in the browser, where both could pass the check.
 *
 * When a code is pinned to a campus, the redeem request attaches the device's
 * location and the server verifies the distance. If the device cannot produce a
 * fix, the request goes without one and the server skips that check — a member
 * whose location is unavailable is never locked out of a code they physically
 * found. The code itself is still required either way.
 */
export default function TreasurePanel({
  codes,
  isDark,
  onRefresh,
}: {
  codes: TreasureCode[];
  isDark: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const card = `border rounded-[24px] p-5 shadow-sm space-y-4 ${
    isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'
  }`;

  const redeem = async () => {
    const clean = input.trim().toUpperCase();
    if (!clean) return;

    setBusy(true);
    setMessage(null);
    try {
      const result = await redeemTreasureCodeWithLocation(clean);
      setMessage({ text: result.message, ok: true });
      setInput('');
      await onRefresh();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'That code could not be redeemed.',
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const claimed = codes.filter((code) => code.isRedeemed).length;

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

      <div className={card}>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-black">Found a code on campus?</span>
        </div>
        <p className="text-[10px] text-neutral-400 leading-relaxed">
          Codes are hidden at partner campuses. Enter what you found to claim the prize — up to 3 per
          month, and each code can only be claimed once.
        </p>

        <input
          value={input}
          onChange={(event) => setInput(event.target.value.toUpperCase())}
          placeholder="NEARBY-…"
          className={`w-full px-3 py-3 rounded-2xl text-xs font-black tracking-wider outline-none border ${
            isDark
              ? 'bg-neutral-950/50 border-neutral-800 text-neutral-100 placeholder:text-neutral-600'
              : 'bg-stone-50 border-stone-200 text-neutral-900 placeholder:text-stone-400'
          }`}
        />

        <button
          onClick={() => void redeem()}
          disabled={busy || input.trim().length < 3}
          className={`w-full py-3 rounded-2xl text-xs font-black transition ${
            busy || input.trim().length < 3
              ? 'bg-neutral-500/10 text-neutral-400'
              : 'bg-rose-500 text-white active:scale-[0.99]'
          }`}
        >
          {busy ? 'Verifying…' : 'Claim prize'}
        </button>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-black">Campus board</span>
          <span className="text-[10px] text-neutral-400">
            {claimed}/{codes.length} found
          </span>
        </div>

        {codes.length === 0 ? (
          <p className="text-xs text-neutral-400 py-2">No codes are live right now. Check back soon.</p>
        ) : (
          <div className="space-y-3">
            {codes.map((code) => (
              <div key={code.id} className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    code.isRedeemed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                  }`}
                >
                  {code.isRedeemed ? <Check className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold block truncate">{code.campusName}</span>
                  <span className="text-[10px] text-neutral-400 block truncate">
                    {code.isRedeemed
                      ? `Claimed by ${code.redeemedByName ?? 'a member'}`
                      : code.locationHint}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-black shrink-0 ${
                    code.isRedeemed ? 'text-neutral-400 line-through' : 'text-emerald-500'
                  }`}
                >
                  {formatNaira(code.prizeKobo)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
