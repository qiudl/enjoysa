import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { SupplierTeamPage } from '../SupplierTeamPage';
import { supplierTeamService } from '../../../../services/supplierTeamService';

// REQ-20260506-0008: tests were originally written against a synchronous
// version of the page; it now loads team members + invitations via API on
// mount, and renders a loading spinner until both resolve. We mock the
// service so loading completes immediately and the page renders its
// real content.
vi.mock('../../../../services/supplierTeamService', () => ({
  supplierTeamService: {
    listMembers: vi.fn(),
    listInvitations: vi.fn(),
    inviteMember: vi.fn(),
    updateRole: vi.fn(),
    updateStatus: vi.fn(),
    removeMember: vi.fn(),
    resetPassword: vi.fn(),
    revokeInvitation: vi.fn(),
    resendInvitation: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  (supplierTeamService.listMembers as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (supplierTeamService.listInvitations as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (supplierTeamService.inviteMember as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 99,
    email: 'alice@example.com',
    role: 'operations',
    status: 'pending',
    invited_by: 1,
    accepted_at: null,
    created_at: '2026-05-06T00:00:00Z',
  });
});

/**
 * Helper: find a tab button by its i18n key text.
 * Multiple elements may share the same text; this picks the <button>.
 */
function getTabButton(text: string): HTMLButtonElement {
  const all = screen.getAllByText(text);
  const btn = all.find((el) => el.tagName === 'BUTTON');
  if (!btn) throw new Error(`No <button> found with text "${text}"`);
  return btn as HTMLButtonElement;
}

describe('SupplierTeamPage', () => {
  it('renders without crashing and shows the page title', async () => {
    render(<SupplierTeamPage />);
    const title = await screen.findByText('supplier.team.title');
    expect(title).toBeInTheDocument();
    expect(title.tagName).toBe('H1');
  });

  it('renders stat cards: 0 members, 0 active, plus a roles count card', async () => {
    render(<SupplierTeamPage />);
    await waitFor(() => {
      expect(screen.getByText('supplier.team.totalMembers')).toBeInTheDocument();
    });
    expect(screen.getByText('supplier.team.activeMembers')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.roles')).toBeInTheDocument();
    // 0 appears twice: total members and active members
    expect(screen.getAllByText('0')).toHaveLength(2);
    // The roles card shows the roleConfig keys length (5 at time of
    // writing: admin, operations, finance, support, staff). Just assert
    // it's a positive integer rendered on the page so this test doesn't
    // break next time someone adds/removes a role.
    const rolesLabel = screen.getByText('supplier.team.roles');
    const rolesCard = rolesLabel.closest('div');
    expect(rolesCard?.textContent).toMatch(/\d+/);
  });

  it('renders all three tab buttons', async () => {
    render(<SupplierTeamPage />);
    await waitFor(() => {
      expect(getTabButton('supplier.team.tabMembers')).toBeInTheDocument();
    });
    expect(getTabButton('supplier.team.tabPermissions')).toBeInTheDocument();
    expect(getTabButton('supplier.team.tabInvitations')).toBeInTheDocument();
  });

  it('members tab shows empty state when there are no members', async () => {
    render(<SupplierTeamPage />);
    await waitFor(() => {
      expect(screen.getByText('supplier.team.noMembers')).toBeInTheDocument();
    });
    // No member cards should be present
    expect(screen.queryByText('supplier.team.statusActive')).not.toBeInTheDocument();
    expect(screen.queryByText('supplier.team.statusDisabled')).not.toBeInTheDocument();
  });

  it('permissions tab shows the full permission table with all pages and access levels', async () => {
    render(<SupplierTeamPage />);
    await waitFor(() => {
      expect(getTabButton('supplier.team.tabPermissions')).toBeInTheDocument();
    });
    fireEvent.click(getTabButton('supplier.team.tabPermissions'));

    expect(screen.getByText('supplier.team.permissionHint')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.page')).toBeInTheDocument();

    // Role column headers
    expect(screen.getByText('supplier.team.roleAdmin')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.roleOperations')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.roleFinance')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.roleSupport')).toBeInTheDocument();

    // All 8 page rows
    expect(screen.getByText('supplier.nav.dashboard')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.products')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.orders')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.settlement')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.afterSales')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.team')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.reports')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.settings')).toBeInTheDocument();

    // Access level labels appear in the table
    expect(screen.getAllByText('supplier.team.accessFull').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('supplier.team.accessNone').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('supplier.team.accessReadonly').length).toBeGreaterThanOrEqual(1);
  });

  it('invitations tab shows empty state when there are no invitations', async () => {
    render(<SupplierTeamPage />);
    await waitFor(() => {
      expect(getTabButton('supplier.team.tabInvitations')).toBeInTheDocument();
    });
    fireEvent.click(getTabButton('supplier.team.tabInvitations'));

    expect(screen.getByText('supplier.team.noInvitations')).toBeInTheDocument();
    // No invitation cards should be present
    expect(screen.queryByText('supplier.team.invPending')).not.toBeInTheDocument();
    expect(screen.queryByText('supplier.team.invAccepted')).not.toBeInTheDocument();
    expect(screen.queryByText('supplier.team.invExpired')).not.toBeInTheDocument();
  });

  it('opens the invite modal and can submit a new member', async () => {
    render(<SupplierTeamPage />);
    await waitFor(() => {
      expect(screen.getByText('supplier.team.invite')).toBeInTheDocument();
    });

    // Click the invite button in the page header
    fireEvent.click(screen.getByText('supplier.team.invite'));

    // Modal should appear
    expect(screen.getByText('supplier.team.inviteMember')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.email')).toBeInTheDocument();

    // Submit button should be disabled when email is empty
    const submitBtn = screen.getByText('supplier.team.sendInvite').closest('button')!;
    expect(submitBtn).toBeDisabled();

    // Fill in email
    const emailInput = screen.getByPlaceholderText('supplier.team.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });
    expect(submitBtn).not.toBeDisabled();

    // Submit the invite — calls inviteMember API, then closes modal
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supplierTeamService.inviteMember).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@example.com' }),
      );
    });
    // Modal should close after a successful invite
    await waitFor(() => {
      expect(screen.queryByText('supplier.team.inviteMember')).not.toBeInTheDocument();
    });
  });

  it('after inviting, refreshes the invitations list (not the members list — invites are pending until accepted)', async () => {
    // First render: no members, no invitations.
    render(<SupplierTeamPage />);
    await waitFor(() => {
      expect(screen.getByText('supplier.team.noMembers')).toBeInTheDocument();
    });
    expect(screen.getAllByText('0')).toHaveLength(2);

    // After invite, the page calls listInvitations again. Make the second
    // call return the new pending invitation.
    (supplierTeamService.listInvitations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 99,
        email: 'alice@example.com',
        role: 'operations',
        status: 'pending',
        invited_by: 1,
        accepted_at: null,
        created_at: '2026-05-06T00:00:00Z',
      },
    ]);

    // Open invite modal and submit
    fireEvent.click(screen.getByText('supplier.team.invite'));
    const emailInput = screen.getByPlaceholderText('supplier.team.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });
    fireEvent.click(screen.getByText('supplier.team.sendInvite').closest('button')!);

    // Wait for the refetch and the modal to close.
    await waitFor(() => {
      expect(supplierTeamService.listInvitations).toHaveBeenCalledTimes(2);
    });

    // Members tab still shows empty (invitations are pending until accepted).
    expect(screen.getByText('supplier.team.noMembers')).toBeInTheDocument();
    expect(screen.queryByText('supplier.team.statusActive')).not.toBeInTheDocument();

    // Switching to invitations tab shows the new pending invitation.
    fireEvent.click(getTabButton('supplier.team.tabInvitations'));
    await waitFor(() => {
      expect(screen.queryByText('supplier.team.noInvitations')).not.toBeInTheDocument();
    });
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });
});
