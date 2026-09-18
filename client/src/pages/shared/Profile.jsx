import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { KeyRound, Mail, Phone, Save, ShieldCheck, User } from 'lucide-react';
import Card, { CardHeader } from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import { AvailabilityBadge, RoleBadge } from '../../components/common/Badge.jsx';
import { Input } from '../../components/common/Field.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import AvailabilityToggle from '../../components/layout/AvailabilityToggle.jsx';
import authApi from '../../services/authApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { formatDate } from '../../utils/format.js';
import { ROLES } from '../../utils/constants.js';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const profileForm = useForm({
    defaultValues: { name: user.name, phone: user.phone ?? '' },
  });

  const passwordForm = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSaveProfile = async (values) => {
    setSavingProfile(true);
    try {
      await updateProfile({ name: values.name, phone: values.phone });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (values) => {
    setSavingPassword(true);
    try {
      const response = await authApi.changePassword(values);
      toast.success(response.message);
      passwordForm.reset();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const newPassword = passwordForm.watch('newPassword');

  return (
    <div className="space-y-4">
      <PageHeader title="My profile" subtitle="Your account details and security settings." />

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* --------------------------------------------------- identity */}
        <Card className="h-fit text-center">
          <Avatar
            name={user.name}
            src={user.avatar}
            size="xl"
            className="mx-auto"
            availability={user.role === ROLES.AGENT ? user.availabilityStatus : undefined}
          />
          <h2 className="mt-4 text-lg font-extrabold text-ink-900">{user.name}</h2>
          <p className="flex items-center justify-center gap-1.5 text-sm text-ink-500">
            <Mail className="h-3.5 w-3.5" />
            {user.email}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <RoleBadge role={user.role} size="sm" />
            {user.role === ROLES.AGENT && (
              <AvailabilityBadge availability={user.availabilityStatus} size="sm" />
            )}
          </div>

          <p className="mt-4 border-t border-ink-100 pt-4 text-xs text-ink-400">
            Member since {formatDate(user.createdAt)}
          </p>

          {user.role === ROLES.AGENT && (
            <div className="mt-4 flex justify-center border-t border-ink-100 pt-4">
              <AvailabilityToggle />
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {/* ------------------------------------------------- details */}
          <Card>
            <CardHeader title="Account details" icon={User} />
            <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="mt-5 space-y-4" noValidate>
              <Input
                label="Full name"
                required
                icon={User}
                error={profileForm.formState.errors.name?.message}
                {...profileForm.register('name', {
                  required: 'Name is required',
                  minLength: { value: 2, message: 'Name must be at least 2 characters' },
                })}
              />

              <Input
                label="Phone (optional)"
                icon={Phone}
                placeholder="Your phone number"
                error={profileForm.formState.errors.phone?.message}
                {...profileForm.register('phone', {
                  maxLength: { value: 20, message: 'Phone number is too long' },
                })}
              />

              <Input label="Email" value={user.email} icon={Mail} disabled readOnly hint="Email cannot be changed." />

              <div className="flex justify-end border-t border-ink-100 pt-4">
                <Button type="submit" icon={Save} loading={savingProfile}>
                  Save changes
                </Button>
              </div>
            </form>
          </Card>

          {/* ------------------------------------------------ password */}
          <Card>
            <CardHeader
              title="Change password"
              subtitle="Use at least 8 characters with a letter and a number."
              icon={ShieldCheck}
            />
            <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="mt-5 space-y-4" noValidate>
              <Input
                label="Current password"
                type="password"
                autoComplete="current-password"
                required
                icon={KeyRound}
                error={passwordForm.formState.errors.currentPassword?.message}
                {...passwordForm.register('currentPassword', { required: 'Current password is required' })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  required
                  error={passwordForm.formState.errors.newPassword?.message}
                  {...passwordForm.register('newPassword', {
                    required: 'New password is required',
                    minLength: { value: 8, message: 'At least 8 characters' },
                    validate: {
                      hasLetter: (v) => /[A-Za-z]/.test(v) || 'Must contain a letter',
                      hasNumber: (v) => /[0-9]/.test(v) || 'Must contain a number',
                    },
                  })}
                />

                <Input
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  required
                  error={passwordForm.formState.errors.confirmPassword?.message}
                  {...passwordForm.register('confirmPassword', {
                    required: 'Please confirm the new password',
                    validate: (value) => value === newPassword || 'Passwords do not match',
                  })}
                />
              </div>

              <div className="flex justify-end border-t border-ink-100 pt-4">
                <Button type="submit" variant="secondary" icon={ShieldCheck} loading={savingPassword}>
                  Update password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
