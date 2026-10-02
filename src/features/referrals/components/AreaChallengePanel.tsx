/**
 * The Area vs Area challenge.
 *
 * This is a monthly competition between areas — it replaces the "Squads" and
 * "Treasure" tabs, which advertised prize pools and prize codes that do not exist
 * in the reward scheme. Promising a prize that nobody can win is the same class of
 * mistake as showing a venue that does not exist.
 *
 * Everything shown here comes from `rewardsContent.ts` so the numbers cannot drift
 * from the ones the server pays.
 */
import type { ReactNode } from 'react';
import { MapPin, Trophy, Users } from 'lucide-react';
import { AREA_CHALLENGE } from '../rewardsContent';
import ClaimInstructions from './ClaimInstructions';

export default function AreaChallengePanel({
  isDark,
  verifiedInvites,
  areaName,
}: {
  isDark: boolean;
  verifiedInvites: number;
  /** The area on this user's profile, if they have set one. */
  areaName?: string | null;
}) {
  const card = `border rounded-[24px] p-5 shadow-sm ${
    isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'
  }`;

  const qualified = verifiedInvites >= AREA_CHALLENGE.minimumReferrals;
  const shortfall = Math.max(0, AREA_CHALLENGE.minimumReferrals - verifiedInvites);

  return (
    <div className="space-y-4">
      {/* What it is */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-black">Area vs Area Challenge</h3>
            <p className="text-[10px] text-neutral-400 font-medium">
              Every month · {AREA_CHALLENGE.cadence === 'monthly' ? 'resets on the 1st' : ''}
            </p>
          </div>
        </div>

        <p className="text-[11.5px] leading-relaxed text-neutral-400">
          Areas compete against each other. At the end of the month, the area that brought in more
          verified referrals than the area it was matched against wins that round.
        </p>
      </div>

      {/* The prize */}
      <div className={card}>
        <h3 className="text-xs font-black mb-3">What the winning area gets</h3>
        <div className="space-y-3">
          <Row
            icon={<Trophy className="w-3.5 h-3.5 text-amber-500" />}
            label={`₦${AREA_CHALLENGE.prizeNaira.toLocaleString('en-NG')} each`}
            detail={`to the top ${AREA_CHALLENGE.winnersPerWinningArea} referrers in the winning area`}
          />
          <Row
            icon={<Users className="w-3.5 h-3.5 text-emerald-500" />}
            label={`${AREA_CHALLENGE.minimumReferrals}+ verified referrals`}
            detail="the minimum to be in contention — below this you cannot win"
          />
          <Row
            icon={<MapPin className="w-3.5 h-3.5 text-sky-500" />}
            label="Your own area has to win"
            detail="if the area you are matched against brings in more, they take it"
          />
        </div>
      </div>

      {/* Where this user stands */}
      <div className={card}>
        <h3 className="text-xs font-black mb-3">Where you stand</h3>

        <div className="flex items-center justify-between text-[11px] font-bold mb-2">
          <span className="text-neutral-400">
            {areaName ? `Your area: ${areaName}` : 'Your area is not set'}
          </span>
          <span className={qualified ? 'text-emerald-500' : 'text-amber-500'}>
            {verifiedInvites} / {AREA_CHALLENGE.minimumReferrals}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-neutral-500/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${qualified ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{
              width: `${Math.min(100, (verifiedInvites / AREA_CHALLENGE.minimumReferrals) * 100)}%`,
            }}
          />
        </div>

        <p className="text-[10px] text-neutral-400 leading-relaxed mt-3">
          {qualified
            ? 'You have hit the minimum. From here it comes down to how many you bring in against the area you are matched with.'
            : `${shortfall} more verified referral${shortfall === 1 ? '' : 's'} to reach the minimum of ${AREA_CHALLENGE.minimumReferrals}.`}
        </p>

        {!areaName && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed mt-2">
            Set your area on your profile so your referrals count towards it.
          </p>
        )}
      </div>

      {/* How to claim — the shared component, so this tab and the Rewards tab
          cannot drift apart. */}
      <ClaimInstructions isDark={isDark} />

    </div>
  );
}

function Row({
  icon,
  label,
  detail,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-lg bg-neutral-500/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11.5px] font-bold leading-snug">{label}</p>
        <p className="text-[10px] text-neutral-400 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}
