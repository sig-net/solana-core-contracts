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
    <div className='text-center space-y-2'>
      <div
        className={`w-8 h-8 ${iconBgColor} rounded-full flex items-center justify-center mx-auto`}
      >
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <h3 className='font-medium text-sm'>{title}</h3>
      <p className='text-xs text-muted-foreground'>{description}</p>
    </div>
  );
}
