import { useState } from 'react';
import { Users, Copy, Check, LogOut } from 'lucide-react';
import { createTeam, joinTeam, leaveTeam } from '../api';
import { formatNaira, type Team } from '../types';

/**
 * Squads of up to five, ranked by the combined verified invites of their
 * members.
 *
 * The member cap and the one-squad-per-person rule are enforced by the database
 * (`UNIQUE (user_id)` on team membership), so two people joining the last slot at
 * the same instant cannot both get in — which a "count then insert" check in the
 * browser could not prevent.
 */
export default function TeamsPanel({
  teams,
  myTeam,
  isDark,
  onRefresh,
}: {
  teams: Team[];
  myTeam: Team | null;
  isDark: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | 'leave' | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const card = `border rounded-[24px] p-5 shadow-sm space-y-4 ${
    isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'
  }`;

  const act = async (kind: 'create' | 'join' | 'leave') => {
    setBusy(kind);
    setMessage(null);
    try {
      const result =
        kind === 'create'
          ? await createTeam(name.trim())
          : kind === 'join'
            ? await joinTeam(code.trim().toUpperCase())
            : await leaveTeam();

      setMessage({ text: result.message, ok: true });
      setName('');
      setCode('');
      await onRefresh();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'That did not work. Please try again.',
        ok: false,
      });
    } finally {
      setBusy(null);
    }
  };

  const inputClass = `w-full px-3 py-2.5 rounded-xl text-xs font-medium outline-none border ${
    isDark
      ? 'bg-neutral-950/50 border-neutral-800 text-neutral-100 placeholder:text-neutral-600'
      : 'bg-stone-50 border-stone-200 text-neutral-900 placeholder:text-stone-400'
  }`;

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

      {myTeam ? (
        <div className={card}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-black block">{myTeam.name}</span>
              <span className="text-[10px] text-neutral-400 block">
                Squad rank #{myTeam.rank} · {myTeam.totalVerifiedInvites} verified invites
              </span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500">
              {formatNaira(myTeam.estimatedPrizeKobo)}
            </span>
          </div>

          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(myTeam.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                // Clipboard unavailable — the code is visible below anyway.
              }
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black ${
              isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Invite code {myTeam.code}
          </button>

          <div className="space-y-2">
            {myTeam.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between">
                <span className="text-[11px] font-bold">{member.name}</span>
                <span className="text-[10px] text-neutral-400">
                  {member.verifiedInvites} invite{member.verifiedInvites === 1 ? '' : 's'}
                </span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 5 - myTeam.members.length) }).map((_, index) => (
              <div key={`empty-${index}`} className="flex items-center justify-between opacity-40">
                <span className="text-[11px] font-bold">Open slot</span>
                <span className="text-[10px] text-neutral-400">—</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => void act('leave')}
            disabled={busy !== null}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black bg-rose-500/10 text-rose-500"
          >
            <LogOut className="w-3.5 h-3.5" />
            {busy === 'leave' ? 'Leaving…' : 'Leave squad'}
          </button>
        </div>
      ) : (
        <div className={card}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-black">Start or join a squad</span>
          </div>
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Up to 5 people per squad. Squad invites count together, and the top squads share a prize
            pool.
          </p>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your squad name"
            className={inputClass}
          />
          <button
            onClick={() => void act('create')}
            disabled={busy !== null || name.trim().length < 2}
            className={`w-full py-3 rounded-2xl text-xs font-black ${
              busy !== null || name.trim().length < 2
                ? 'bg-neutral-500/10 text-neutral-400'
                : 'bg-indigo-500 text-white'
            }`}
          >
            {busy === 'create' ? 'Creating…' : 'Create squad'}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-500/20" />
            <span className="text-[10px] text-neutral-400 font-bold">OR</span>
            <div className="h-px flex-1 bg-neutral-500/20" />
          </div>

          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Squad invite code"
            className={`${inputClass} tracking-[0.2em] font-black`}
          />
          <button
            onClick={() => void act('join')}
            disabled={busy !== null || code.trim().length < 3}
            className={`w-full py-3 rounded-2xl text-xs font-black ${
              busy !== null || code.trim().length < 3
                ? 'bg-neutral-500/10 text-neutral-400'
                : 'bg-amber-500 text-white'
            }`}
          >
            {busy === 'join' ? 'Joining…' : 'Join squad'}
          </button>
        </div>
      )}

      <div className={card}>
        <span className="text-xs font-black">All squads</span>
        {teams.length === 0 ? (
          <p className="text-xs text-neutral-400 py-2">No squads yet — start the first one.</p>
        ) : (
          <div className="space-y-3">
            {teams.slice(0, 20).map((team) => (
              <div key={team.id} className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-black ${
                    team.rank === 1
                      ? 'bg-amber-500 text-white'
                      : isDark
                        ? 'bg-neutral-800 text-neutral-400'
                        : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {team.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold block truncate">{team.name}</span>
                  <span className="text-[10px] text-neutral-400 block">
                    {team.members.length}/5 members · {team.totalVerifiedInvites} invites
                  </span>
                </div>
                {team.estimatedPrizeKobo > 0 && (
                  <span className="text-[10px] font-black text-emerald-500 shrink-0">
                    {formatNaira(team.estimatedPrizeKobo)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
