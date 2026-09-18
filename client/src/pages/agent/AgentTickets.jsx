import { CheckCircle2 } from 'lucide-react';
import AvailabilityToggle from '../../components/layout/AvailabilityToggle.jsx';
import { EmptyState } from '../../components/common/States.jsx';
import TicketListView from '../../components/tickets/TicketListView.jsx';

export default function AgentTickets() {
  return (
    <TicketListView
      title="My queue"
      subtitle="Only tickets assigned to you - scoped by the server, not the browser."
      actions={<AvailabilityToggle />}
      emptyState={
        <EmptyState
          icon={CheckCircle2}
          title="No tickets assigned"
          description="You're all caught up. Set yourself to Available and new tickets will arrive here automatically."
        />
      }
    />
  );
}
