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
  it('renders without crashing', () => {
    render(<SupplierTeamPage />);
    expect(screen.getByText('supplier.team.title')).toBeInTheDocument();
  });

  it('displays the page title as h1', () => {
    render(<SupplierTeamPage />);
    const title = screen.getByText('supplier.team.title');
    expect(title.tagName).toBe('H1');
  });

  it('renders stat cards with correct values', () => {
    render(<SupplierTeamPage />);
    expect(screen.getByText('supplier.team.totalMembers')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.activeMembers')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.roles')).toBeInTheDocument();
    // Total members = 5, Active = 4, Roles = 4
    expect(screen.getByText('5')).toBeInTheDocument();
    // '4' appears twice: active members count and roles count
    expect(screen.getAllByText('4')).toHaveLength(2);
  });

  it('renders all three tab buttons', () => {
    render(<SupplierTeamPage />);
    expect(getTabButton('supplier.team.tabMembers')).toBeInTheDocument();
    expect(getTabButton('supplier.team.tabPermissions')).toBeInTheDocument();
    expect(getTabButton('supplier.team.tabInvitations')).toBeInTheDocument();
  });

  it('displays all team members on the members tab', () => {
    render(<SupplierTeamPage />);
    expect(screen.getByText('James Chen')).toBeInTheDocument();
    expect(screen.getByText('Sarah Li')).toBeInTheDocument();
    expect(screen.getByText('Michael Wang')).toBeInTheDocument();
    expect(screen.getByText('Emily Zhang')).toBeInTheDocument();
    expect(screen.getByText('David Liu')).toBeInTheDocument();
  });

  it('shows member emails and role badges', () => {
    render(<SupplierTeamPage />);
    expect(screen.getByText('james@adelaidetours.com')).toBeInTheDocument();
    expect(screen.getByText('sarah@adelaidetours.com')).toBeInTheDocument();
    // Role badges
    expect(screen.getByText('supplier.team.roleAdmin')).toBeInTheDocument();
    expect(screen.getAllByText('supplier.team.roleOperations')).toHaveLength(2);
    expect(screen.getByText('supplier.team.roleFinance')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.roleSupport')).toBeInTheDocument();
  });

  it('shows active and disabled status badges', () => {
    render(<SupplierTeamPage />);
    expect(screen.getAllByText('supplier.team.statusActive')).toHaveLength(4);
    expect(screen.getByText('supplier.team.statusDisabled')).toBeInTheDocument();
  });

  it('switches to permissions tab and shows permission table', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(getTabButton('supplier.team.tabPermissions'));

    expect(screen.getByText('supplier.team.permissionHint')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.page')).toBeInTheDocument();
    // Page names in permission table
    expect(screen.getByText('supplier.nav.dashboard')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.products')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.orders')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.settlement')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.afterSales')).toBeInTheDocument();
    expect(screen.getByText('supplier.nav.team')).toBeInTheDocument();
    // Access level labels
    expect(screen.getAllByText('supplier.team.accessFull').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('supplier.team.accessNone').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('supplier.team.accessReadonly').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to invitations tab and shows invitation list', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(getTabButton('supplier.team.tabInvitations'));

    expect(screen.getByText('lucy@adelaidetours.com')).toBeInTheDocument();
    expect(screen.getByText('tom@adelaidetours.com')).toBeInTheDocument();
    expect(screen.getByText('kate@adelaidetours.com')).toBeInTheDocument();
    // Invitation statuses
    expect(screen.getByText('supplier.team.invPending')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.invAccepted')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.invExpired')).toBeInTheDocument();
  });

  it('revokes a pending invitation', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(getTabButton('supplier.team.tabInvitations'));

    // lucy@adelaidetours.com has status 'pending', so there should be a revoke button
    expect(screen.getByText('lucy@adelaidetours.com')).toBeInTheDocument();

    const revokeBtn = screen.getByText('lucy@adelaidetours.com')
      .closest('[class*="invitationCard"]')!
      .querySelector('button[class*="revokeBtn"]') as HTMLButtonElement;
    fireEvent.click(revokeBtn);

    // After revoking, lucy should be gone
    expect(screen.queryByText('lucy@adelaidetours.com')).not.toBeInTheDocument();
  });

  it('resends an expired invitation', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(getTabButton('supplier.team.tabInvitations'));

    // kate@adelaidetours.com has status 'expired', so there should be a resend button
    const resendBtn = screen.getByText('supplier.team.resend');
    fireEvent.click(resendBtn);

    // After resending, kate's invitation should change from expired to pending
    expect(screen.getAllByText('supplier.team.invPending').length).toBeGreaterThanOrEqual(2);
  });

  it('opens invite modal and invites a new member', () => {
    render(<SupplierTeamPage />);

    // Click the invite button in the page header
    const inviteBtn = screen.getByText('supplier.team.invite');
    fireEvent.click(inviteBtn);

    // Modal should appear
    expect(screen.getByText('supplier.team.inviteMember')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.email')).toBeInTheDocument();

    // Submit button should be disabled when email is empty
    const submitBtn = screen.getByText('supplier.team.sendInvite').closest('button');
    expect(submitBtn).toBeDisabled();

    // Fill in email and submit
    const emailInput = screen.getByPlaceholderText('supplier.team.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'newmember@adelaidetours.com' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn!);

    // Modal should close
    expect(screen.queryByText('supplier.team.inviteMember')).not.toBeInTheDocument();
    // After invite, the new member should appear in the members list
    expect(screen.getByText('newmember@adelaidetours.com')).toBeInTheDocument();
    // Total members should increase from 5 to 6
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('toggles a member status from active to disabled', () => {
    render(<SupplierTeamPage />);
    // Initially 4 active, 1 disabled
    expect(screen.getAllByText('supplier.team.statusActive')).toHaveLength(4);
    expect(screen.getAllByText('supplier.team.statusDisabled')).toHaveLength(1);

    // Click the disable button on the first active member
    const disableBtns = screen.getAllByTitle('supplier.team.disable');
    fireEvent.click(disableBtns[0]);

    // Now 3 active, 2 disabled
    expect(screen.getAllByText('supplier.team.statusActive')).toHaveLength(3);
    expect(screen.getAllByText('supplier.team.statusDisabled')).toHaveLength(2);
  });

  it('toggles a member status from disabled to active', () => {
    render(<SupplierTeamPage />);
    // David Liu is disabled, click enable
    const enableBtn = screen.getByTitle('supplier.team.enable');
    fireEvent.click(enableBtn);

    // Now all 5 are active
    expect(screen.getAllByText('supplier.team.statusActive')).toHaveLength(5);
    expect(screen.queryByText('supplier.team.statusDisabled')).not.toBeInTheDocument();
  });

  it('changes a member role via the edit dropdown', () => {
    render(<SupplierTeamPage />);
    // Click edit button on first member (James Chen, admin)
    const editBtns = screen.getAllByTitle('supplier.team.editRole');
    fireEvent.click(editBtns[0]);

    // A select element should appear
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);

    // Change to 'finance'
    fireEvent.change(selects[0], { target: { value: 'finance' } });

    // Now there should be 2 finance roles (Emily + James)
    expect(screen.getAllByText('supplier.team.roleFinance')).toHaveLength(2);
  });
});
