import { PlusCircle, Ticket as TicketIcon } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { EmptyState } from '../../components/common/States.jsx';
import TicketListView from '../../components/tickets/TicketListView.jsx';

export default function CustomerTickets() {
  return (
    <TicketListView
      title="My tickets"
      subtitle="Every support request you have raised, newest activity first."
      actions={
        <Button to="/customer/tickets/new" icon={PlusCircle}>
          New ticket
        </Button>
      }
      emptyState={
        <EmptyState
          icon={TicketIcon}
          title="No tickets yet"
          description="Create your first support ticket and an available agent is assigned automatically."
          action={
            <Button to="/customer/tickets/new" icon={PlusCircle}>
              Create ticket
            </Button>
          }
        />
      }
    />
  );
}
