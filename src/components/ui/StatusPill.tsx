import { View, Text } from 'react-native';
import { CheckCircle, AlertCircle, Copy, Clock } from 'lucide-react-native';

type StatusType = 'verified' | 'pending' | 'mismatch' | 'duplicate';

interface StatusPillProps {
  status: StatusType;
}

const statusConfig = {
  verified: {
    bg: 'bg-successBg',
    text: 'text-successFg',
    icon: CheckCircle,
    label: 'Verified',
  },
  pending: {
    bg: 'bg-warnBg',
    text: 'text-warnFg',
    icon: Clock,
    label: 'Pending',
  },
  mismatch: {
    bg: 'bg-dangerBg',
    text: 'text-dangerFg',
    icon: AlertCircle,
    label: 'Mismatch',
  },
  duplicate: {
    bg: 'bg-dangerBg',
    text: 'text-dangerFg',
    icon: Copy,
    label: 'Duplicate',
  },
};

export const StatusPill = ({ status }: StatusPillProps) => {
  const config = statusConfig[status];
  const IconComponent = config.icon;

  return (
    <View className={`flex-row items-center gap-2 rounded-chip px-3 py-2 ${config.bg}`}>
      <IconComponent size={16} color={config.text.replace('text-', '')} />
      <Text className={`text-sm font-medium ${config.text}`}>{config.label}</Text>
    </View>
  );
};
