import { useState } from 'react';
import { Wallet, Clock } from 'lucide-react';
import { requestPayout } from '../api';
import { formatNaira, type BalanceSummary, type LedgerEntry, type Payout } from '../types';

/**
 * Balance, earnings history, and the withdrawal request.
 *
 * The balance is read-only here. There is no reducer, no local arithmetic, and
 * no optimistic update after a withdrawal — because the only number that is
 * true is the one the server summed from the ledger. Every action re-reads.
 */
export default function EarningsPanel({
  balance,
  history,
  payouts,
  isDark,
  onRefresh,
}: {
  balance: BalanceSummary | null;
  history: LedgerEntry[];
  payouts: Payout[];
  isDark: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const card = `border rounded-[24px] p-5 shadow-sm space-y-4 ${
    isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'
  }`;

  const submit = async () => {
    if (!balance) return;

    setBusy(true);
    setMessage(null);

    try {
      const result = await requestPayout({
        // Omitted amount means "everything available" — the behaviour the
        // original app had, and what users expect from a single button.
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        // Generated once per submit so a retry after a dropped connection cannot
        // create a second withdrawal.
        idempotencyKey: `payout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });

      setMessage({ text: result.message, ok: true });
      setShowForm(false);
      setBankName('');
      setAccountNumber('');
      setAccountName('');
      await onRefresh();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not submit your withdrawal.',
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const statusStyles: Record<Payout['status'], string> = {
    pending_review: 'bg-amber-500/10 text-amber-500',
    approved: 'bg-sky-500/10 text-sky-500',
    paid: 'bg-emerald-500/10 text-emerald-500',
    rejected: 'bg-rose-500/10 text-rose-500',
  };

  const statusLabels: Record<Payout['status'], string> = {
    pending_review: 'In review',
    approved: 'Approved',
    paid: 'Paid',
    rejected: 'Rejected',
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

      <div className={card}>
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-black">Available balance</span>
        </div>

        <div>
          <span className="text-3xl font-black block">{formatNaira(balance?.balanceKobo ?? 0)}</span>
          <span className="text-[10px] text-neutral-400 block mt-0.5">
            Lifetime earned {formatNaira(balance?.lifetimeEarnedKobo ?? 0)}
          </span>
        </div>

        {!showForm ? (
          <button
            disabled={!balance?.canWithdraw}
            onClick={() => setShowForm(true)}
            className={`w-full py-3 rounded-2xl text-xs font-black transition ${
              balance?.canWithdraw
                ? 'bg-emerald-600 text-white active:scale-[0.99]'
                : 'bg-neutral-500/10 text-neutral-400 cursor-not-allowed'
            }`}
          >
            {balance?.canWithdraw
              ? 'Withdraw to bank account'
              : `Minimum withdrawal ${formatNaira(balance?.minimumWithdrawalKobo ?? 100000)}`}
          </button>
        ) : (
          <div className="space-y-2">
            <Field label="Bank name" value={bankName} onChange={setBankName} placeholder="e.g. OPay, GTBank" isDark={isDark} />
            <Field
              label="Account number"
              value={accountNumber}
              onChange={setAccountNumber}
              placeholder="10 digits"
              isDark={isDark}
              inputMode="numeric"
            />
            <Field label="Account name" value={accountName} onChange={setAccountName} placeholder="As it appears on your bank account" isDark={isDark} />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className={`flex-1 py-3 rounded-2xl text-xs font-black ${
                  isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-stone-100 text-stone-600'
                }`}
              >
                Cancel
              </button>
              <button
                disabled={busy || !bankName.trim() || accountNumber.trim().length < 8 || !accountName.trim()}
                onClick={() => void submit()}
                className={`flex-[2] py-3 rounded-2xl text-xs font-black text-white ${
                  busy || !bankName.trim() || accountNumber.trim().length < 8 || !accountName.trim()
                    ? 'bg-neutral-500/30 cursor-not-allowed'
                    : 'bg-emerald-600 active:scale-[0.99]'
                }`}
              >
                {busy ? 'Submitting…' : `Request ${formatNaira(balance?.balanceKobo ?? 0)}`}
              </button>
            </div>

            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Withdrawals are reviewed by the team before transfer, and the amount is held from your
              balance as soon as you request it — so it cannot be requested twice.
            </p>
          </div>
        )}
      </div>

      {payouts.length > 0 && (
        <div className={card}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-black">Withdrawal history</span>
          </div>
          <div className="space-y-3">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold block">
                    {formatNaira(payout.amountKobo)}
                  </span>
                  <span className="text-[10px] text-neutral-400 block truncate">
                    {payout.bankName} · {new Date(payout.requestedAt).toLocaleDateString('en-NG')}
                  </span>
                  {payout.status === 'rejected' && payout.rejectionReason && (
                    <span className="text-[10px] text-rose-500 block">
                      {payout.rejectionReason}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${statusStyles[payout.status]}`}
                >
                  {statusLabels[payout.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={card}>
        <span className="text-xs font-black">Earnings history</span>
        {history.length === 0 ? (
          <p className="text-xs text-neutral-400 py-2">
            Nothing yet. Rewards appear here the moment they are credited.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold block truncate">
                    {entry.description ?? entry.reason.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    {new Date(entry.createdAt).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-black shrink-0 ${
                    entry.isCredit ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {entry.isCredit ? '+' : '−'}
                  {formatNaira(Math.abs(entry.deltaKobo))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  isDark,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isDark: boolean;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-xl text-xs font-medium outline-none border ${
          isDark
            ? 'bg-neutral-950/50 border-neutral-800 text-neutral-100 placeholder:text-neutral-600'
            : 'bg-stone-50 border-stone-200 text-neutral-900 placeholder:text-stone-400'
        }`}
      />
    </label>
  );
}
