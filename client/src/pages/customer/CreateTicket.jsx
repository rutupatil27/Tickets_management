import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Clock, Loader2, Send } from 'lucide-react';
import Card, { CardHeader } from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import { Input, Select, Textarea } from '../../components/common/Field.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import ticketApi from '../../services/ticketApi.js';
import {
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITY,
  TICKET_PRIORITY_VALUES,
} from '../../utils/constants.js';

const SUBJECT_MAX = 140;
const DESCRIPTION_MAX = 5000;

export default function CreateTicket() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      subject: '',
      category: '',
      priority: TICKET_PRIORITY.MEDIUM,
      description: '',
    },
  });

  const subject = watch('subject');
  const description = watch('description');

  const onSubmit = async (values) => {
    setSubmitting(true);
    setResult(null);

    try {
      const response = await ticketApi.create(values);
      setResult({ ...response.data, message: response.message });
      toast.success(response.message);

      // Give the confirmation a beat to be read, then open the conversation.
      setTimeout(() => navigate(`/customer/tickets/${response.data.ticket._id}`), 1600);
    } catch (error) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  /* ------------------------------------------------------- confirmation */
  if (result) {
    const { ticket, assigned, agent } = result;

    return (
      <div className="mx-auto max-w-xl">
        <Card className="text-center">
          <span
            className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${
              assigned ? 'bg-success-50 text-success-600' : 'bg-warning-50 text-warning-600'
            }`}
          >
            {assigned ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
          </span>

          <h2 className="mt-4 text-lg font-extrabold text-ink-900">
            Ticket {ticket.ticketNumber} created
          </h2>

          <p className="mt-2 text-sm text-ink-600">
            {assigned ? (
              <>
                Assigned to <span className="font-semibold text-ink-900">{agent.name}</span>. They
                have been notified and will reply in the ticket conversation.
              </>
            ) : (
              'Currently waiting for an available agent. It will be assigned automatically as soon as one comes online.'
            )}
          </p>

          <p className="mt-5 flex items-center justify-center gap-2 text-xs text-ink-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Opening your ticket...
          </p>
        </Card>
      </div>
    );
  }

  /* --------------------------------------------------------------- form */
  return (
    <div className="space-y-4">
      <PageHeader
        title="Create a support ticket"
        subtitle="Describe the issue and we will route it to an available agent automatically."
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/customer/tickets')}>
            Cancel
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <Input
              label="Subject"
              placeholder="Short summary, e.g. Payment deducted but order failed"
              required
              maxLength={SUBJECT_MAX}
              hint={`${subject.length}/${SUBJECT_MAX} characters`}
              error={errors.subject?.message}
              {...register('subject', {
                required: 'Subject is required',
                minLength: { value: 5, message: 'Subject must be at least 5 characters' },
                maxLength: { value: SUBJECT_MAX, message: `Subject must be at most ${SUBJECT_MAX} characters` },
              })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                required
                placeholder="Choose a category"
                options={TICKET_CATEGORIES}
                error={errors.category?.message}
                {...register('category', { required: 'Please choose a category' })}
              />

              <Select
                label="Priority"
                required
                options={TICKET_PRIORITY_VALUES.map((value) => ({
                  value,
                  label: PRIORITY_LABELS[value],
                }))}
                error={errors.priority?.message}
                {...register('priority', { required: 'Please choose a priority' })}
              />
            </div>

            <Textarea
              label="Description"
              rows={8}
              required
              placeholder="What happened? Include any order numbers, transaction IDs, error messages and what you already tried."
              maxLength={DESCRIPTION_MAX}
              hint={`${description.length}/${DESCRIPTION_MAX} characters - the more detail, the faster we can help.`}
              error={errors.description?.message}
              {...register('description', {
                required: 'Description is required',
                minLength: { value: 10, message: 'Please describe the issue in at least 10 characters' },
                maxLength: {
                  value: DESCRIPTION_MAX,
                  message: `Description must be at most ${DESCRIPTION_MAX} characters`,
                },
              })}
            />

            <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/customer/tickets')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" icon={Send} loading={submitting}>
                {submitting ? 'Finding an available agent...' : 'Submit ticket'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit">
          <CardHeader title="What happens next" />
          <ol className="mt-4 space-y-4">
            {[
              'Your ticket gets a unique reference number.',
              'The system picks the available agent with the smallest workload.',
              'That agent is notified instantly and replies in the conversation.',
              'You confirm the fix, or reopen the ticket if it comes back.',
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-ink-600">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
