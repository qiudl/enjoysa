import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierTeamPage } from '../SupplierTeamPage';

describe('SupplierTeamPage', () => {
  it('renders without crashing', () => {
    render(<SupplierTeamPage />);
    expect(screen.getByText('supplier.team.title')).toBeInTheDocument();
  });

  it('displays the page title', () => {
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
    // Use getAllByText since '4' appears for both active count and role count
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getAllByText('4')).toHaveLength(2);
  });

  it('renders all team members', () => {
    render(<SupplierTeamPage />);
    expect(screen.getByText('James Chen')).toBeInTheDocument();
    expect(screen.getByText('Sarah Li')).toBeInTheDocument();
    expect(screen.getByText('Michael Wang')).toBeInTheDocument();
    expect(screen.getByText('Emily Zhang')).toBeInTheDocument();
    expect(screen.getByText('David Liu')).toBeInTheDocument();
  });

  it('displays member emails', () => {
    render(<SupplierTeamPage />);
    expect(screen.getByText('james@adelaidetours.com')).toBeInTheDocument();
    expect(screen.getByText('sarah@adelaidetours.com')).toBeInTheDocument();
  });

  it('shows role badges with i18n keys', () => {
    render(<SupplierTeamPage />);
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

  it('shows invite button and opens invite modal on click', () => {
    render(<SupplierTeamPage />);
    const inviteBtn = screen.getByText('supplier.team.invite');
    expect(inviteBtn).toBeInTheDocument();

    fireEvent.click(inviteBtn);

    expect(screen.getByText('supplier.team.inviteMember')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.email')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.role')).toBeInTheDocument();
    expect(screen.getByText('supplier.team.sendInvite')).toBeInTheDocument();
    expect(screen.getByText('common.cancel')).toBeInTheDocument();
  });

  it('submit button is disabled when email is empty', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(screen.getByText('supplier.team.invite'));

    const submitBtn = screen.getByText('supplier.team.sendInvite').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button when email is entered and adds member on submit', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(screen.getByText('supplier.team.invite'));

    const emailInput = screen.getByPlaceholderText('supplier.team.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });

    const submitBtn = screen.getByText('supplier.team.sendInvite').closest('button');
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn!);

    // Modal should close
    expect(screen.queryByText('supplier.team.inviteMember')).not.toBeInTheDocument();
    // New member should appear
    expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
    // Total members count increases to 6
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('closes invite modal via cancel button', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(screen.getByText('supplier.team.invite'));
    expect(screen.getByText('supplier.team.inviteMember')).toBeInTheDocument();

    fireEvent.click(screen.getByText('common.cancel'));
    expect(screen.queryByText('supplier.team.inviteMember')).not.toBeInTheDocument();
  });

  it('toggles member status from active to disabled', () => {
    render(<SupplierTeamPage />);
    // Initially 4 active, 1 disabled
    expect(screen.getAllByText('supplier.team.statusActive')).toHaveLength(4);
    expect(screen.getAllByText('supplier.team.statusDisabled')).toHaveLength(1);

    // Click the disable button on the first member (James Chen, who is active)
    const disableBtns = screen.getAllByTitle('supplier.team.disable');
    fireEvent.click(disableBtns[0]);

    // Now 3 active, 2 disabled
    expect(screen.getAllByText('supplier.team.statusActive')).toHaveLength(3);
    expect(screen.getAllByText('supplier.team.statusDisabled')).toHaveLength(2);
  });

  it('toggles member status from disabled to active', () => {
    render(<SupplierTeamPage />);
    // David Liu is disabled, click enable
    const enableBtn = screen.getByTitle('supplier.team.enable');
    fireEvent.click(enableBtn);

    // Now all 5 are active
    expect(screen.getAllByText('supplier.team.statusActive')).toHaveLength(5);
    expect(screen.queryByText('supplier.team.statusDisabled')).not.toBeInTheDocument();
  });

  it('clicking edit role button shows role select dropdown', () => {
    render(<SupplierTeamPage />);
    // Click edit button on first member (James Chen)
    const editBtns = screen.getAllByTitle('supplier.team.editRole');
    fireEvent.click(editBtns[0]);

    // A select element should appear with role options
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it('changing role via select updates member role', () => {
    render(<SupplierTeamPage />);
    // James Chen is admin, click edit
    const editBtns = screen.getAllByTitle('supplier.team.editRole');
    fireEvent.click(editBtns[0]);

    // Find the select and change to 'finance'
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'finance' } });

    // Now there should be 2 finance roles (Emily + James)
    expect(screen.getAllByText('supplier.team.roleFinance')).toHaveLength(2);
  });

  it('closes invite modal via X button', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(screen.getByText('supplier.team.invite'));
    expect(screen.getByText('supplier.team.inviteMember')).toBeInTheDocument();

    // Click the X close button (it's inside the modal header)
    const closeBtn = screen.getByText('supplier.team.inviteMember').parentElement?.querySelector('button');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(screen.queryByText('supplier.team.inviteMember')).not.toBeInTheDocument();
  });

  it('changes invite role via select in modal', () => {
    render(<SupplierTeamPage />);
    fireEvent.click(screen.getByText('supplier.team.invite'));

    // Find role select in modal (the one after email field)
    const emailInput = screen.getByPlaceholderText('supplier.team.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    // Get the role select in modal
    const selects = screen.getAllByRole('combobox');
    const modalSelect = selects[selects.length - 1];
    fireEvent.change(modalSelect, { target: { value: 'finance' } });

    // Submit with finance role
    const submitBtn = screen.getByText('supplier.team.sendInvite').closest('button');
    fireEvent.click(submitBtn!);

    // New member added with finance role → should now have 2 finance
    expect(screen.getAllByText('supplier.team.roleFinance')).toHaveLength(2);
  });

  it('displays last login info for members', () => {
    render(<SupplierTeamPage />);
    expect(screen.getAllByText(/supplier\.team\.lastLogin/).length).toBeGreaterThanOrEqual(1);
  });
});
