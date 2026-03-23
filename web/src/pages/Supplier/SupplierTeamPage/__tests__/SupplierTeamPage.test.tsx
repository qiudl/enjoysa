import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierTeamPage } from '../SupplierTeamPage';

/**
 * Helper: find a tab button by its i18n key text.
 * Multiple elements may share the same text; this picks the <button> in the tab bar.
 */
function getTabButton(text: string): HTMLButtonElement {
  const all = screen.getAllByText(text);
  const btn = all.find((el) => el.tagName === 'BUTTON');
  if (!btn) throw new Error(`No <button> found with text "${text}"`);
  return btn as HTMLButtonElement;
}

describe('SupplierTeamPage', () => {
  it('renders without crashing and shows the page title', () => {
    render(<SupplierTeamPage />);
    const title = screen.getByText('supplier.team.title');
    expect(title).toBeInTheDocument();
    expect(title.tagName).toBe('H1');
  });

  it('renders stat cards showing 0 members, 0 active, 4 roles', () => {
    render(<SupplierTeamPage />);
    expect(screen.getByText('supplier.team.totalMembers')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.activeMembers')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.roles')).toBeInTheDocument();
    // 0 appears twice: total members and active members
    expect(screen.getAllByText('0')).toHaveLength(2);
    // 4 roles (admin, operations, finance, support)
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders all three tab buttons', () => {
    render(<SupplierTeamPage />);
    expect(getTabButton('supplier.team.tabMembers')).toBeInTheDocument();
    expect(getTabButton('supplier.team.tabPermissions')).toBeInTheDocument();
    expect(getTabButton('supplier.team.tabInvitations')).toBeInTheDocument();
  });

  it('members tab shows empty state when there are no members', () => {
    render(<SupplierTeamPage />);
    // Members tab is the default active tab, so empty state should show immediately
    expect(screen.getByText('supplier.team.noMembers')).toBeInTheDocument();
    // No member cards should be present
    expect(screen.queryByText('supplier.team.statusActive')).not.toBeInTheDocument();
    expect(screen.queryByText('supplier.team.statusDisabled')).not.toBeInTheDocument();
  });

  it('permissions tab shows the full permission table with all pages and access levels', () => {
    render(<SupplierTeamPage />);
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

  it('invitations tab shows empty state when there are no invitations', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(getTabButton('supplier.team.tabInvitations'));

    expect(screen.getByText('supplier.team.noInvitations')).toBeInTheDocument();
    // No invitation cards should be present
    expect(screen.queryByText('supplier.team.invPending')).not.toBeInTheDocument();
    expect(screen.queryByText('supplier.team.invAccepted')).not.toBeInTheDocument();
    expect(screen.queryByText('supplier.team.invExpired')).not.toBeInTheDocument();
  });

  it('opens the invite modal and can submit a new member', () => {
    render(<SupplierTeamPage />);

    // Click the invite button in the page header
    const inviteBtn = screen.getByText('supplier.team.invite');
    fireEvent.click(inviteBtn);

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

    // Submit the invite
    fireEvent.click(submitBtn);

    // Modal should close
    expect(screen.queryByText('supplier.team.inviteMember')).not.toBeInTheDocument();
  });

  it('after inviting, the new member appears in the members list and stats update', () => {
    render(<SupplierTeamPage />);

    // Initially empty
    expect(screen.getByText('supplier.team.noMembers')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);

    // Open invite modal and add a member
    fireEvent.click(screen.getByText('supplier.team.invite'));
    const emailInput = screen.getByPlaceholderText('supplier.team.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });
    fireEvent.click(screen.getByText('supplier.team.sendInvite').closest('button')!);

    // Empty state should be gone, new member should appear
    expect(screen.queryByText('supplier.team.noMembers')).not.toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    // The name is derived from email prefix
    expect(screen.getByText('alice')).toBeInTheDocument();

    // Stats should update: 1 total member, 1 active member, still 4 roles
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText('4')).toBeInTheDocument();

    // The new member should have active status and operations role (default)
    expect(screen.getByText('supplier.team.statusActive')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.roleOperations')).toBeInTheDocument();

    // Switching to invitations tab should show the invitation record
    fireEvent.click(getTabButton('supplier.team.tabInvitations'));
    expect(screen.queryByText('supplier.team.noInvitations')).not.toBeInTheDocument();
    expect(screen.getByText('supplier.team.invAccepted')).toBeInTheDocument();
  });
});
