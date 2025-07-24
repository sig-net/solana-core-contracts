import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor: string;
  iconBgColor: string;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  iconColor,
  iconBgColor,
}: FeatureCardProps) {
  return (
    <div className='space-y-2 text-center'>
      <div
        className={`h-8 w-8 ${iconBgColor} mx-auto flex items-center justify-center rounded-full`}
      >
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <h3 className='text-sm font-medium'>{title}</h3>
      <p className='text-muted-foreground text-xs'>{description}</p>
    </div>
  );
}
