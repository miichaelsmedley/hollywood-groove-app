import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { ScanLine, ShieldCheck, FlaskConical, ChevronRight, CreditCard } from 'lucide-react';
import { useStaffRoles } from '../hooks/useStaffRoles';
import { IS_TEST_MODE } from '../lib/mode';

type IconComponent = ComponentType<{ className?: string }>;

interface ToolLink {
  to: string;
  title: string;
  description: string;
  Icon: IconComponent;
}

/**
 * Role-aware navigation hub rendered on the Profile page.
 *
 * Surfaces shortcuts to the standalone staff/admin surfaces (door scanner,
 * Firebase diagnostics) for users whose Firebase Auth custom claims grant
 * access. Renders nothing for ordinary attendees, so it is safe to mount
 * unconditionally.
 */
export default function StaffToolsCard() {
  const {
    loading,
    isPlatformAdmin,
    isEventAdmin,
    isVenueManager,
    isDoorStaff,
    canScanTickets,
  } = useStaffRoles();

  if (loading) return null;

  const tools: ToolLink[] = [];

  if (canScanTickets) {
    tools.push({
      to: '/scan',
      title: 'Door scanner',
      description: 'Scan ticket QR codes and admit guests at the door.',
      Icon: ScanLine,
    });
  }

  if (isPlatformAdmin || isEventAdmin) {
    tools.push({
      to: '/admin/ticketing',
      title: 'Ticketing admin',
      description: 'Review orders and refunds, and manage promo codes.',
      Icon: CreditCard,
    });
  }

  if (IS_TEST_MODE && isPlatformAdmin) {
    tools.push({
      to: '/__testing/firebase',
      title: 'Firebase diagnostics',
      description: 'Inspect auth state, custom claims and database access.',
      Icon: FlaskConical,
    });
  }

  if (tools.length === 0) return null;

  const roleLabels = [
    isPlatformAdmin && 'Absolute admin',
    isEventAdmin && 'Ticket admin',
    isVenueManager && 'Ticketer',
    isDoorStaff && 'Scanner',
  ].filter((label): label is string => Boolean(label));

  return (
    <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <div className="text-sm font-semibold text-cinema-800">Staff &amp; tools</div>
      </div>

      {roleLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {roleLabels.map((label) => (
            <span
              key={label}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {tools.map(({ to, title, description, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-cinema-100 border border-cinema-200 hover:border-primary/60 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/15 text-primary shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-cinema-900">{title}</p>
                <p className="text-xs text-cinema-600">{description}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
