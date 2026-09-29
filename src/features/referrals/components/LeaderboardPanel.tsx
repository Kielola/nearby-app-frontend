import { useState } from 'react';
import { Trophy, Crown } from 'lucide-react';
import { formatNaira, type LeaderboardBoards, type LeaderboardPeriod } from '../types';

const PERIODS: { id: 'weekly' | 'biweekly' | 'monthly' | 'allTime'; label: string; api: LeaderboardPeriod }[] = [
  { id: 'weekly', label: 'Weekly', api: 'weekly' },
  { id: 'biweekly', label: 'Bi-weekly', api: 'biweekly' },
  { id: 'monthly', label: 'Monthly', api: 'monthly' },
  { id: 'allTime', label: 'All time', api: 'all_time' },
];

/**
 * Rankings across four windows.
 *
 * The ordering, the ranks and the prize each rank receives all come from the
 * server, which ranks in SQL. The original fetched 100 user documents, sorted
 * them in the browser and presented the result as the global board — so anyone
 * past position 100 was invisible, and the ordering was of a sample rather than
 * of the field. Both of those were silent.
 *
 * Ranks are absolute positions from the query, not `index + 1` of a truncated
 * list, so a user ranked 240 can still be shown their true number.
 */
export default function LeaderboardPanel({
  boards,
  isDark,
}: {
  boards: LeaderboardBoards | null;
  isDark: boolean;
}) {
  const [period, setPeriod] = useState<'weekly' | 'biweekly' | 'monthly' | 'allTime'>('weekly');

  const card = `border rounded-[24px] p-5 shadow-sm space-y-4 ${
    isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'
  }`;

  if (!boards) {
    return (
      <div className={card}>
        <span className="text-xs text-neutral-400">Leaderboards are unavailable right now.</span>
      </div>
    );
  }

  const rows = boards[period] ?? [];
  const prizes = boards.prizes?.[period] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            onClick={() => setPeriod(item.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition ${
              period === item.id
                ? 'bg-amber-500 text-white'
                : isDark
                  ? 'bg-neutral-900/60 text-neutral-400'
                  : 'bg-stone-100 text-stone-500'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {prizes.length > 0 && (
        <div className={`${card} !py-4`}>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black">Prize pool</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {prizes.map((prize, index) => (
              <span
                key={index}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500"
              >
                #{index + 1} · {formatNaira(prize)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={card}>
        {rows.length === 0 ? (
          <p className="text-xs text-neutral-400 py-2">
            No verified referrals in this window yet. Be the first on the board.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((entry) => (
              <div key={`${entry.userId}-${entry.rank}`} className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-black ${
                    entry.rank === 1
                      ? 'bg-amber-500 text-white'
                      : entry.rank <= 3
                        ? 'bg-amber-500/15 text-amber-500'
                        : isDark
                          ? 'bg-neutral-800 text-neutral-400'
                          : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {entry.rank}
                </span>

                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold flex items-center gap-1 truncate">
                    {entry.name}
                    {entry.rank === 1 && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                  </span>
                  <span className="text-[10px] text-neutral-400 block truncate">
                    {entry.verifiedInvites} verified invite{entry.verifiedInvites === 1 ? '' : 's'}
                    {entry.campus ? ` · ${entry.campus}` : ''}
                  </span>
                </div>

                {entry.prizeKobo > 0 && (
                  <span className="text-[10px] font-black text-emerald-500 shrink-0">
                    {formatNaira(entry.prizeKobo)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
        Prizes are paid after each period closes, once results are final. Rankings update as
        referrals are verified.
      </p>
    </div>
  );
}
