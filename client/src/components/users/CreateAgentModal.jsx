import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Lock, Mail, User } from 'lucide-react';
import Button from '../common/Button.jsx';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Field.jsx';
import userApi from '../../services/userApi.js';

/**
 * The only account an admin can create is a support agent.
 * Customers sign themselves up from the Register page, so there is no role
 * picker here - and the backend endpoint would reject one anyway.
 */
export function CreateAgentModal({ open, onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: { name: '', email: '', password: '' } });

  const close = () => {
    reset();
    onClose();
  };

  const submit = async (values) => {
    setSaving(true);
    try {
      const response = await userApi.createAgent(values);
      toast.success(response.message);
      reset();
      onCreated?.(response.data.user);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add support agent"
      description="Share the email and temporary password with the agent. They start as Offline and receive tickets once they set themselves Available."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(submit)} loading={saving}>
            Add agent
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Input
          label="Full name"
          icon={User}
          required
          error={errors.name?.message}
          {...register('name', {
            required: 'Name is required',
            minLength: { value: 2, message: 'Name must be at least 2 characters' },
          })}
        />
        <Input
          label="Work email"
          type="email"
          icon={Mail}
          required
          error={errors.email?.message}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
          })}
        />
        <Input
          label="Temporary password"
          type="text"
          icon={Lock}
          required
          hint="8+ characters with at least one letter and one number."
          error={errors.password?.message}
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 8, message: 'At least 8 characters' },
            validate: {
              hasLetter: (v) => /[A-Za-z]/.test(v) || 'Must contain a letter',
              hasNumber: (v) => /[0-9]/.test(v) || 'Must contain a number',
            },
          })}
        />
      </form>
    </Modal>
  );
}

export default CreateAgentModal;
