import { useStaff } from '@/features/staff/store';
import type { Staff } from '@/features/staff/types';
import { useSession } from '@/store/session';

import { mockDelay } from './mock';

export type StaffRole = 'manager' | 'waiter' | 'chef';

/** A person on the team as the Staff screens see it. The server never sends a PIN. */
export interface StaffMember {
  id: string;
  name: string;
  /** 9 digits without +251. */
  phone: string;
  role: StaffRole;
  /** false = cannot sign in. */
  active: boolean;
  canChangeDeliveryFee: boolean;
  canSeeReports: boolean;
  /** The owner or a manager set the PIN: the person has to choose their own. */
  pinIsTemporary: boolean;
  /** Whether the signed-in person may change this member. */
  editable: boolean;
}

export interface NewStaffInput {
  name: string;
  phone: string;
  /** 4 digits. */
  pin: string;
  role: StaffRole;
  canChangeDeliveryFee: boolean;
  canSeeReports: boolean;
}

export type StaffChanges = Partial<
  Pick<StaffMember, 'name' | 'role' | 'active' | 'canChangeDeliveryFee' | 'canSeeReports'>
>;

// Offline mock: works on the same people the mock sign-in uses (features/staff/store.ts).
const temporary = new Set<string>();

function toMember(staff: Staff): StaffMember {
  const me = useSession.getState().user;
  return {
    id: staff.id,
    name: staff.name,
    phone: staff.phone,
    role: staff.role,
    active: staff.active,
    canChangeDeliveryFee: staff.canChangeDeliveryFee,
    canSeeReports: staff.canSeeReports,
    pinIsTemporary: temporary.has(staff.id),
    editable: staff.id !== me?.userId && (me?.role === 'owner' || staff.role !== 'manager'),
  };
}

const find = (id: string) => {
  const found = useStaff.getState().staff.find((m) => m.id === id);
  if (!found) throw new Error('NOT_FOUND');
  return found;
};

export async function getStaff(): Promise<StaffMember[]> {
  await mockDelay(300);
  return useStaff.getState().staff.map(toMember);
}

export async function addStaff(input: NewStaffInput): Promise<StaffMember> {
  await mockDelay(500);
  const { owner, staff } = useStaff.getState();
  if (owner.phone === input.phone || staff.some((m) => m.phone === input.phone)) {
    throw new Error('PHONE_TAKEN');
  }
  const member: Staff = {
    ...input,
    id: `staff-${Date.now()}`,
    name: input.name.trim(),
    active: true,
  };
  useStaff.setState({ staff: [...staff, member] });
  temporary.add(member.id);
  return toMember(member);
}

export async function updateStaff(id: string, changes: StaffChanges): Promise<StaffMember> {
  await mockDelay(400);
  const updated = { ...find(id), ...changes };
  useStaff.setState((s) => ({ staff: s.staff.map((m) => (m.id === id ? updated : m)) }));
  return toMember(updated);
}

export async function resetStaffPin(id: string, pin: string): Promise<void> {
  await mockDelay(400);
  find(id);
  useStaff.setState((s) => ({ staff: s.staff.map((m) => (m.id === id ? { ...m, pin } : m)) }));
  temporary.add(id);
}
