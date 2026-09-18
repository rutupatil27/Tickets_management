import cn from '../../utils/cn.js';

export function Card({ as: Tag = 'section', className, padded = true, children, ...props }) {
  return (
    <Tag className={cn('card', padded && 'p-5 sm:p-6', className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div>
          <h2 className="text-base font-bold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default Card;
