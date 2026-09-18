import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowRight, Lock, Mail, User } from 'lucide-react';
import AuthLayout from './AuthLayout.jsx';
import Button from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Field.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { ROLE_HOME } from '../../utils/constants.js';

/**
 * Self-registration always creates a customer. Agent and admin accounts are
 * created by an administrator, and the backend rejects any `role` sent here.
 */
export default function Register() {
  const { register: signUp, submitting } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      const user = await signUp(values);
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (error) {
      setFormError(error.message);
      toast.error(error.message);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Raise a ticket and get matched with an available support agent."
      footer={
        <p className="text-center text-sm text-ink-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-3 text-sm text-danger-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Your full name"
          icon={User}
          required
          error={errors.name?.message}
          {...register('name', {
            required: 'Full name is required',
            minLength: { value: 2, message: 'Name must be at least 2 characters' },
            maxLength: { value: 80, message: 'Name must be at most 80 characters' },
          })}
        />

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          icon={Mail}
          required
          error={errors.email?.message}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
          })}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          icon={Lock}
          required
          hint="Must be 8+ characters and include a letter and a number."
          error={errors.password?.message}
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 8, message: 'Password must be at least 8 characters' },
            validate: {
              hasLetter: (value) => /[A-Za-z]/.test(value) || 'Password must contain a letter',
              hasNumber: (value) => /[0-9]/.test(value) || 'Password must contain a number',
            },
          })}
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          icon={Lock}
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (value) => value === password || 'Passwords do not match',
          })}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting} iconRight={ArrowRight}>
          Create account
        </Button>

        <p className="text-center text-xs text-ink-400">
          Accounts created here are customer accounts. Agent access is granted by an administrator.
        </p>
      </form>
    </AuthLayout>
  );
}
