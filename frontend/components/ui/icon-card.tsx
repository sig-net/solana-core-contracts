import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface IconCardHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor?: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
  actions?: ReactNode;
}

interface IconCardProps extends IconCardHeaderProps {
  children: ReactNode;
  className?: string;
}

const iconColorClasses = {
  green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  yellow:
    'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  red: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  gray: 'bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400',
};

export function IconCardHeader({
  icon: Icon,
  title,
  description,
  iconColor = 'blue',
  actions,
}: IconCardHeaderProps) {
  return (
    <CardHeader>
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-3'>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${iconColorClasses[iconColor]}`}
          >
            <Icon className='h-4 w-4' />
          </div>
          <div>
            <CardTitle className='text-base'>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {actions && <div>{actions}</div>}
      </div>
    </CardHeader>
  );
}

export function IconCard({
  icon,
  title,
  description,
  iconColor = 'blue',
  actions,
  children,
  className = 'hover:shadow-md transition-shadow',
}: IconCardProps) {
  return (
    <Card className={className}>
      <IconCardHeader
        icon={icon}
        title={title}
        description={description}
        iconColor={iconColor}
        actions={actions}
      />
      <CardContent>{children}</CardContent>
    </Card>
  );
}
